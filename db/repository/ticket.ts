import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Ticket from "@/db/models/Ticket";
import TicketAttachment from "@/db/models/TicketAttachment";
import TicketMessage from "@/db/models/TicketMessage";
import User from "@/db/models/User";
import { listAuditLogsForEntity, recordAuditLog } from "@/db/repository/audit";
import { createActivityLog } from "@/db/repository/activity";
import { sendTicketEmailNotification } from "@/lib/tickets/email-notifications";
import type { TicketLinkedType, TicketStatus } from "@/lib/tickets/constants";
import type { ListQueryOptions, PaginationMeta } from "@/utils/api/query";
import { buildPagination } from "@/utils/api/query";
import type {
  CreateTicketDTO,
  TicketAttachmentMetadataDTO,
  TicketListQueryDTO,
  TicketReplyDTO,
  TicketStatusChangeDTO,
} from "@/validators/ticket.schema";

type TicketAccessScope = {
  ownOrAssignedOnly?: boolean;
  userId: string;
};

type TicketListResult = {
  items: Array<Record<string, unknown>>;
  pagination: PaginationMeta;
};

type TicketMessageAction = "ticket_created" | "ticket_replied" | "ticket_resolved";

type TicketNotificationSnapshot = {
  id: string;
  title: string;
  type: string;
  status: TicketStatus;
  linkedType?: TicketLinkedType | null;
  linkedId?: string | null;
};

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function toIdString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;

  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (typeof value === "object") {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === "string") return maybeId;
    if (maybeId instanceof mongoose.Types.ObjectId) return String(maybeId);
  }

  return null;
}

function uniqueObjectIdStrings(values: Array<string | null | undefined>) {
  const set = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    if (!isValidObjectId(value)) continue;
    set.add(value);
  }

  return Array.from(set);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withAccessScope(query: Record<string, unknown>, access?: TicketAccessScope) {
  if (!access?.ownOrAssignedOnly || !access.userId || !isValidObjectId(access.userId)) {
    return query;
  }

  const requesterId = toObjectId(access.userId);
  return {
    $and: [
      query,
      {
        $or: [{ createdBy: requesterId }, { assignedTo: requesterId }],
      },
    ],
  };
}

function parseSort(options: ListQueryOptions) {
  const direction: 1 | -1 = options.sortOrder === "asc" ? 1 : -1;
  const allowedFields = ["updatedAt", "createdAt", "title", "status", "type"];
  const sortBy = allowedFields.includes(options.sortBy) ? options.sortBy : "updatedAt";
  return { [sortBy]: direction } as Record<string, 1 | -1>;
}

async function resolveCompanyAssigneeIds(companyId: string, assigneeIds: string[]) {
  const uniqueAssigneeIds = uniqueObjectIdStrings(assigneeIds);
  if (uniqueAssigneeIds.length === 0) {
    return [] as string[];
  }

  const users = await User.find({
    _id: { $in: uniqueAssigneeIds.map((id) => toObjectId(id)) },
    companyId: toObjectId(companyId),
    accessRevokedAt: null,
    account_status: { $ne: "suspended" },
  })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }[]>();

  return users.map((user) => String(user._id));
}

async function createTicketAttachments(params: {
  companyId: string;
  ticketId: string;
  uploadedBy: string;
  attachments: TicketAttachmentMetadataDTO[];
}) {
  if (params.attachments.length === 0) {
    return [] as Array<Record<string, unknown>>;
  }

  const inserted = await TicketAttachment.insertMany(
    params.attachments.map((attachment) => ({
      companyId: params.companyId,
      ticketId: params.ticketId,
      messageId: null,
      uploadedBy: params.uploadedBy,
      originalName: attachment.originalName,
      displayName: attachment.displayName,
      mimeType: attachment.mimeType,
      extension: attachment.extension,
      sizeBytes: attachment.sizeBytes,
      storageKey: attachment.storageKey,
      url: attachment.url,
      checksum: attachment.checksum ?? null,
    }))
  );

  return inserted.map((entry) => entry.toObject() as Record<string, unknown>);
}

function buildNotificationRecipients(ticket: {
  createdBy: unknown;
  assignedTo?: unknown[];
  participantIds?: unknown[];
}, excludeUserId?: string) {
  const participants = uniqueObjectIdStrings([
    toIdString(ticket.createdBy),
    ...((ticket.assignedTo || []).map((entry: unknown) => toIdString(entry))),
    ...((ticket.participantIds || []).map((entry: unknown) => toIdString(entry))),
  ]);

  if (!excludeUserId) {
    return participants;
  }

  return participants.filter((participantId) => participantId !== excludeUserId);
}

async function listTicketParticipantIds(params: { companyId: string; ticketId: string }) {
  const authorIds = await TicketMessage.find({
    companyId: toObjectId(params.companyId),
    ticketId: toObjectId(params.ticketId),
  }).distinct("authorId");

  return uniqueObjectIdStrings(
    authorIds.map((authorId: unknown) => toIdString(authorId))
  );
}

async function createTicketNotifications(params: {
  companyId: string;
  recipientIds: string[];
  actorId: string;
  action: TicketMessageAction;
  snapshot: TicketNotificationSnapshot;
  messagePreview?: string | null;
  includeActorEmail?: boolean;
}) {
  const recipients = uniqueObjectIdStrings(params.recipientIds);
  const activityRecipients = recipients.filter((id) => id !== params.actorId);
  const emailRecipients = uniqueObjectIdStrings([
    ...activityRecipients,
    params.includeActorEmail ? params.actorId : null,
  ]);

  if (activityRecipients.length === 0 && emailRecipients.length === 0) {
    return;
  }

  const metadata = {
    ticketId: params.snapshot.id,
    ticketType: params.snapshot.type,
    ticketStatus: params.snapshot.status,
    linkedType: params.snapshot.linkedType ?? null,
    linkedId: params.snapshot.linkedId ?? null,
    actorId: params.actorId,
    messagePreview: params.messagePreview ?? null,
  } as const;

  await Promise.all(
    activityRecipients.map(async (recipientId) => {
      try {
        await createActivityLog(recipientId, {
          action: params.action,
          entityType: "ticket",
          entityName: params.snapshot.title,
          entityId: params.snapshot.id,
          metadata,
          isRead: false,
          readAt: null,
        });
      } catch (error) {
        console.error("[tickets] failed to create activity notification", {
          recipientId,
          action: params.action,
          ticketId: params.snapshot.id,
          error,
        });
      }
    })
  );

  const users = await User.find({
    _id: { $in: uniqueObjectIdStrings([...emailRecipients, params.actorId]).map((id) => toObjectId(id)) },
    companyId: toObjectId(params.companyId),
  })
    .select("_id name email")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; email?: string }[]>();

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const actorName = userById.get(params.actorId)?.name?.trim() || "A teammate";

  const subjectByAction: Record<TicketMessageAction, string> = {
    ticket_created: `New ticket assigned: ${params.snapshot.title}`,
    ticket_replied: `New reply on ticket: ${params.snapshot.title}`,
    ticket_resolved: `Ticket resolved: ${params.snapshot.title}`,
  };

  const actorSubjectByAction: Record<TicketMessageAction, string> = {
    ticket_created: `Ticket created: ${params.snapshot.title}`,
    ticket_replied: `Reply posted: ${params.snapshot.title}`,
    ticket_resolved: `Ticket resolved: ${params.snapshot.title}`,
  };

  const bodyByAction: Record<TicketMessageAction, string> = {
    ticket_created: `${actorName} created a ticket and assigned you.\n\nTitle: ${params.snapshot.title}`,
    ticket_replied: `${actorName} replied to the ticket.\n\nTitle: ${params.snapshot.title}${
      params.messagePreview ? `\n\nPreview: ${params.messagePreview}` : ""
    }`,
    ticket_resolved: `${actorName} marked the ticket as resolved.\n\nTitle: ${params.snapshot.title}`,
  };

  const actorBodyByAction: Record<TicketMessageAction, string> = {
    ticket_created: `You created a new ticket.\n\nTitle: ${params.snapshot.title}`,
    ticket_replied: `You posted a ticket reply.\n\nTitle: ${params.snapshot.title}`,
    ticket_resolved: `You marked the ticket as resolved.\n\nTitle: ${params.snapshot.title}`,
  };

  await Promise.all(
    emailRecipients.map(async (recipientId) => {
      const recipient = userById.get(recipientId);
      if (!recipient?.email) {
        return;
      }

      try {
        const isActorRecipient = recipientId === params.actorId;
        const result = await sendTicketEmailNotification({
          to: recipient.email,
          subject: isActorRecipient
            ? actorSubjectByAction[params.action]
            : subjectByAction[params.action],
          body: isActorRecipient ? actorBodyByAction[params.action] : bodyByAction[params.action],
          title: "CRM Roberto",
        });

        if (!result.success) {
          throw new Error(result.message || "Ticket email notification failed");
        }
      } catch (error) {
        console.error("[tickets] failed to send ticket notification email", {
          recipientId,
          action: params.action,
          ticketId: params.snapshot.id,
          error,
        });
      }
    })
  );
}

export async function createTicket(params: {
  companyId: string;
  createdBy: string;
  payload: CreateTicketDTO;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.createdBy)) {
    return { success: false as const, message: "Invalid ticket context" };
  }

  const resolvedAssigneeIds = await resolveCompanyAssigneeIds(
    params.companyId,
    params.payload.assignedTo || []
  );

  const linkedId = params.payload.linkedId ? toObjectId(params.payload.linkedId) : null;

  const unreadBy = uniqueObjectIdStrings(
    resolvedAssigneeIds.filter((assigneeId) => assigneeId !== params.createdBy)
  );

  const created = await Ticket.create({
    companyId: params.companyId,
    title: params.payload.title,
    type: params.payload.type,
    status: "open",
    createdBy: params.createdBy,
    assignedTo: resolvedAssigneeIds,
    linkedType: params.payload.linkedType ?? null,
    linkedId,
    unreadBy,
    resolvedAt: null,
    archivedAt: null,
  });

  const createdAttachments = await createTicketAttachments({
    companyId: params.companyId,
    ticketId: String(created._id),
    uploadedBy: params.createdBy,
    attachments: params.payload.attachments || [],
  });

  const message = await TicketMessage.create({
    companyId: params.companyId,
    ticketId: created._id,
    authorId: params.createdBy,
    body: params.payload.body || "",
    attachmentIds: createdAttachments.map((attachment) => attachment._id),
  });

  if (createdAttachments.length > 0) {
    await TicketAttachment.updateMany(
      { _id: { $in: createdAttachments.map((attachment) => attachment._id) } },
      { $set: { messageId: message._id } }
    );
  }

  await recordAuditLog({
    entityType: "ticket",
    entityId: String(created._id),
    companyId: params.companyId,
    action: "created",
    performedBy: params.createdBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  await createTicketNotifications({
    companyId: params.companyId,
    recipientIds: uniqueObjectIdStrings([params.createdBy, ...resolvedAssigneeIds]),
    actorId: params.createdBy,
    action: "ticket_created",
    snapshot: {
      id: String(created._id),
      title: created.title,
      type: created.type,
      status: "open",
      linkedType: created.linkedType as TicketLinkedType | null,
      linkedId: created.linkedId ? String(created.linkedId) : null,
    },
    messagePreview: params.payload.body ?? null,
    includeActorEmail: true,
  });

  const ticket = await Ticket.findById(created._id)
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  const persistedMessage = await TicketMessage.findById(message._id)
    .populate("authorId", "name email")
    .lean();

  return {
    success: true as const,
    ticket,
    initialMessage: {
      ...persistedMessage,
      attachments: createdAttachments,
    },
  };
}

export async function listTickets(params: {
  companyId: string;
  options: ListQueryOptions;
  filters?: TicketListQueryDTO;
  access: TicketAccessScope;
}): Promise<TicketListResult> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return {
      items: [],
      pagination: buildPagination(params.options.page, params.options.limit, 0),
    };
  }

  const companyObjectId = toObjectId(params.companyId);

  const query: Record<string, unknown> = {
    companyId: companyObjectId,
  };

  if (params.filters?.status) {
    query.status = params.filters.status;
  }

  if (params.filters?.type) {
    query.type = params.filters.type;
  }

  if (params.filters?.linkedType) {
    query.linkedType = params.filters.linkedType;
  }

  if (params.filters?.linkedId && isValidObjectId(params.filters.linkedId)) {
    query.linkedId = toObjectId(params.filters.linkedId);
  }

  const accessUserId = isValidObjectId(params.access.userId) ? params.access.userId : null;

  if (params.filters?.assignedToMe && accessUserId) {
    query.assignedTo = toObjectId(accessUserId);
  }

  if (params.filters?.createdByMe && accessUserId) {
    query.createdBy = toObjectId(accessUserId);
  }

  if (params.filters?.unreadOnly && accessUserId) {
    query.unreadBy = toObjectId(accessUserId);
  }

  if (params.options.search) {
    const searchRegex = new RegExp(escapeRegex(params.options.search), "i");
    const matchedMessages = await TicketMessage.find({
      companyId: companyObjectId,
      body: { $regex: searchRegex },
    })
      .select("ticketId")
      .limit(200)
      .lean<{ ticketId: mongoose.Types.ObjectId }[]>();

    const messageTicketIds = uniqueObjectIdStrings(
      matchedMessages.map((entry) => String(entry.ticketId))
    ).map((id) => toObjectId(id));

    query.$or = [
      { title: { $regex: searchRegex } },
      ...(messageTicketIds.length > 0 ? [{ _id: { $in: messageTicketIds } }] : []),
    ];
  }

  const scopedQuery = withAccessScope(query, params.access);
  const skip = (params.options.page - 1) * params.options.limit;

  const [items, total] = await Promise.all([
    Ticket.find(scopedQuery)
      .sort(parseSort(params.options))
      .skip(skip)
      .limit(params.options.limit)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .lean(),
    Ticket.countDocuments(scopedQuery),
  ]);

  const ticketIds = uniqueObjectIdStrings(items.map((item) => toIdString(item._id))).map((id) =>
    toObjectId(id)
  );

  const messageStats =
    ticketIds.length > 0
      ? await TicketMessage.aggregate<{
          _id: mongoose.Types.ObjectId;
          messageCount: number;
          lastMessageAt: Date;
        }>([
          {
            $match: {
              companyId: companyObjectId,
              ticketId: { $in: ticketIds },
            },
          },
          {
            $group: {
              _id: "$ticketId",
              messageCount: { $sum: 1 },
              lastMessageAt: { $max: "$createdAt" },
            },
          },
        ])
      : [];

  const messageStatsByTicketId = new Map(
    messageStats.map((entry) => [String(entry._id), entry])
  );

  return {
    items: items.map((item) => {
      const itemId = String(item._id);
      const unreadBy = Array.isArray(item.unreadBy)
        ? uniqueObjectIdStrings(item.unreadBy.map((entry: unknown) => toIdString(entry)))
        : [];
      const messageStat = messageStatsByTicketId.get(itemId);

      return {
        ...item,
        messageCount: messageStat?.messageCount || 0,
        lastMessageAt: messageStat?.lastMessageAt || item.updatedAt,
        unreadCount: unreadBy.length,
        isUnreadForMe: accessUserId ? unreadBy.includes(accessUserId) : false,
      };
    }),
    pagination: buildPagination(params.options.page, params.options.limit, total),
  };
}

export async function getTicketThread(params: {
  companyId: string;
  ticketId: string;
  access: TicketAccessScope;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.ticketId)) {
    return { success: false as const, message: "Invalid ticket context" };
  }

  const baseQuery: Record<string, unknown> = {
    _id: toObjectId(params.ticketId),
    companyId: toObjectId(params.companyId),
  };

  const scopedQuery = withAccessScope(baseQuery, params.access);

  const ticket = await Ticket.findOne(scopedQuery)
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .populate("unreadBy", "name email")
    .lean<Record<string, unknown> | null>();

  if (!ticket) {
    return { success: false as const, message: "Ticket not found" };
  }

  const [messages, attachments, auditLogs] = await Promise.all([
    TicketMessage.find({
      companyId: toObjectId(params.companyId),
      ticketId: toObjectId(params.ticketId),
    })
      .sort({ createdAt: 1 })
      .populate("authorId", "name email")
      .lean<Record<string, unknown>[]>(),
    TicketAttachment.find({
      companyId: toObjectId(params.companyId),
      ticketId: toObjectId(params.ticketId),
    })
      .sort({ createdAt: 1 })
      .lean<Record<string, unknown>[]>(),
    listAuditLogsForEntity({
      companyId: params.companyId,
      entityType: "ticket",
      entityId: params.ticketId,
    }),
  ]);

  const attachmentById = new Map(
    attachments.map((attachment) => [String(attachment._id), attachment])
  );

  const attachmentByMessageId = new Map<string, Record<string, unknown>[]>();
  for (const attachment of attachments) {
    const messageId = toIdString(attachment.messageId);
    if (!messageId) {
      continue;
    }

    const current = attachmentByMessageId.get(messageId) || [];
    current.push(attachment);
    attachmentByMessageId.set(messageId, current);
  }

  const thread = messages.map((message) => {
    const messageId = String(message._id);
    const attachmentIdsRaw = Array.isArray(message.attachmentIds)
      ? message.attachmentIds
      : [];

    const attachmentIds = uniqueObjectIdStrings(
      attachmentIdsRaw.map((entry: unknown) => toIdString(entry))
    );

    const explicitAttachments = attachmentIds
      .map((attachmentId) => attachmentById.get(attachmentId))
      .filter(Boolean) as Record<string, unknown>[];

    return {
      ...message,
      author: message.authorId || null,
      attachments:
        explicitAttachments.length > 0
          ? explicitAttachments
          : attachmentByMessageId.get(messageId) || [],
    };
  });

  return {
    success: true as const,
    ticket: {
      ...ticket,
      unreadCount: Array.isArray(ticket.unreadBy) ? ticket.unreadBy.length : 0,
      messages: thread,
      attachments,
      auditLogs,
    },
  };
}

export async function addTicketMessage(params: {
  companyId: string;
  ticketId: string;
  authorId: string;
  payload: TicketReplyDTO;
  access: TicketAccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.ticketId) ||
    !isValidObjectId(params.authorId)
  ) {
    return { success: false as const, message: "Invalid ticket message context" };
  }

  const baseQuery: Record<string, unknown> = {
    _id: toObjectId(params.ticketId),
    companyId: toObjectId(params.companyId),
  };

  const scopedQuery = withAccessScope(baseQuery, params.access);

  const ticket = await Ticket.findOne(scopedQuery)
    .select("_id title type status createdBy assignedTo unreadBy linkedType linkedId")
    .lean<{
      _id: mongoose.Types.ObjectId;
      title: string;
      type: string;
      status: TicketStatus;
      createdBy: mongoose.Types.ObjectId;
      assignedTo: mongoose.Types.ObjectId[];
      unreadBy: mongoose.Types.ObjectId[];
      linkedType?: TicketLinkedType | null;
      linkedId?: mongoose.Types.ObjectId | null;
    } | null>();

  if (!ticket) {
    return { success: false as const, message: "Ticket not found" };
  }

  if (ticket.status === "archived") {
    return { success: false as const, message: "Archived tickets cannot be replied to" };
  }

  const createdAttachments = await createTicketAttachments({
    companyId: params.companyId,
    ticketId: params.ticketId,
    uploadedBy: params.authorId,
    attachments: params.payload.attachments || [],
  });

  const createdMessage = await TicketMessage.create({
    companyId: params.companyId,
    ticketId: params.ticketId,
    authorId: params.authorId,
    body: params.payload.body || "",
    attachmentIds: createdAttachments.map((attachment) => attachment._id),
  });

  if (createdAttachments.length > 0) {
    await TicketAttachment.updateMany(
      { _id: { $in: createdAttachments.map((attachment) => attachment._id) } },
      { $set: { messageId: createdMessage._id } }
    );
  }

  const assigneeIds = uniqueObjectIdStrings(
    (ticket.assignedTo || []).map((assignee) => String(assignee))
  );
  const participantIds = await listTicketParticipantIds({
    companyId: params.companyId,
    ticketId: params.ticketId,
  });
  const isAuthorAssigned = assigneeIds.includes(params.authorId);
  const hasAssignees = assigneeIds.length > 0;

  let nextStatus: TicketStatus;
  if (isAuthorAssigned) {
    nextStatus = "replied";
  } else if (hasAssignees) {
    nextStatus = "waiting";
  } else {
    nextStatus = "open";
  }

  const previousStatus = ticket.status;

  const unreadBy = uniqueObjectIdStrings([
    ...((ticket.unreadBy || []).map((entry: unknown) => String(entry))),
    ...buildNotificationRecipients(
      {
        ...ticket,
        participantIds,
      },
      params.authorId
    ),
  ]).filter((userId) => userId !== params.authorId);

  await Ticket.updateOne(
    { _id: ticket._id },
    {
      $set: {
        status: nextStatus,
        resolvedAt: null,
        archivedAt: null,
        unreadBy,
      },
    }
  );

  if (nextStatus !== previousStatus) {
    await recordAuditLog({
      entityType: "ticket",
      entityId: params.ticketId,
      companyId: params.companyId,
      action: "status_changed",
      fieldName: "status",
      oldValue: previousStatus,
      newValue: nextStatus,
      performedBy: params.authorId,
      source: "api",
      ipAddress: params.ipAddress,
    });
  }

  await createTicketNotifications({
    companyId: params.companyId,
    recipientIds: buildNotificationRecipients(
      {
        ...ticket,
        participantIds,
      },
      params.authorId
    ),
    actorId: params.authorId,
    action: "ticket_replied",
    snapshot: {
      id: params.ticketId,
      title: ticket.title,
      type: ticket.type,
      status: nextStatus,
      linkedType: ticket.linkedType || null,
      linkedId: ticket.linkedId ? String(ticket.linkedId) : null,
    },
    messagePreview: params.payload.body || null,
  });

  const message = await TicketMessage.findById(createdMessage._id)
    .populate("authorId", "name email")
    .lean();

  return {
    success: true as const,
    message: {
      ...message,
      author: message?.authorId || null,
      attachments: createdAttachments,
    },
    status: nextStatus,
  };
}

export async function changeTicketStatus(params: {
  companyId: string;
  ticketId: string;
  updatedBy: string;
  payload: TicketStatusChangeDTO;
  access: TicketAccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.ticketId) ||
    !isValidObjectId(params.updatedBy)
  ) {
    return { success: false as const, message: "Invalid ticket status context" };
  }

  const baseQuery: Record<string, unknown> = {
    _id: toObjectId(params.ticketId),
    companyId: toObjectId(params.companyId),
  };

  const scopedQuery = withAccessScope(baseQuery, params.access);

  const ticket = await Ticket.findOne(scopedQuery)
    .select("_id title type status createdBy assignedTo unreadBy linkedType linkedId")
    .lean<{
      _id: mongoose.Types.ObjectId;
      title: string;
      type: string;
      status: TicketStatus;
      createdBy: mongoose.Types.ObjectId;
      assignedTo: mongoose.Types.ObjectId[];
      unreadBy: mongoose.Types.ObjectId[];
      linkedType?: TicketLinkedType | null;
      linkedId?: mongoose.Types.ObjectId | null;
    } | null>();

  if (!ticket) {
    return { success: false as const, message: "Ticket not found" };
  }

  const previousStatus = ticket.status;
  const nextStatus = params.payload.status;

  if (previousStatus === nextStatus) {
    return {
      success: true as const,
      ticket,
    };
  }

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    resolvedAt: nextStatus === "resolved" ? new Date() : null,
    archivedAt: nextStatus === "archived" ? new Date() : null,
  };

  let participantIds: string[] = [];

  if (nextStatus === "resolved") {
    participantIds = await listTicketParticipantIds({
      companyId: params.companyId,
      ticketId: params.ticketId,
    });

    const unreadBy = uniqueObjectIdStrings([
      ...((ticket.unreadBy || []).map((entry: unknown) => String(entry))),
      ...buildNotificationRecipients(
        {
          ...ticket,
          participantIds,
        },
        params.updatedBy
      ),
    ]).filter((userId) => userId !== params.updatedBy);

    updatePayload.unreadBy = unreadBy;
  }

  const updated = await Ticket.findByIdAndUpdate(ticket._id, { $set: updatePayload }, {
    returnDocument: "after",
  })
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  await recordAuditLog({
    entityType: "ticket",
    entityId: params.ticketId,
    companyId: params.companyId,
    action: "status_changed",
    fieldName: "status",
    oldValue: previousStatus,
    newValue: nextStatus,
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  if (nextStatus === "resolved") {
    await createTicketNotifications({
      companyId: params.companyId,
      recipientIds: buildNotificationRecipients(
        {
          ...ticket,
          participantIds,
        },
        params.updatedBy
      ),
      actorId: params.updatedBy,
      action: "ticket_resolved",
      snapshot: {
        id: params.ticketId,
        title: ticket.title,
        type: ticket.type,
        status: nextStatus,
        linkedType: ticket.linkedType || null,
        linkedId: ticket.linkedId ? String(ticket.linkedId) : null,
      },
    });
  }

  return {
    success: true as const,
    ticket: updated,
  };
}

export async function markTicketRead(params: {
  companyId: string;
  ticketId: string;
  userId: string;
  access: TicketAccessScope;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.ticketId) ||
    !isValidObjectId(params.userId)
  ) {
    return { success: false as const, message: "Invalid ticket read context" };
  }

  const baseQuery: Record<string, unknown> = {
    _id: toObjectId(params.ticketId),
    companyId: toObjectId(params.companyId),
  };

  const scopedQuery = withAccessScope(baseQuery, params.access);

  const updated = await Ticket.findOneAndUpdate(
    scopedQuery,
    {
      $pull: { unreadBy: toObjectId(params.userId) },
    },
    { returnDocument: "after" }
  )
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  if (!updated) {
    return { success: false as const, message: "Ticket not found" };
  }

  return {
    success: true as const,
    ticket: updated,
  };
}

export async function archiveResolvedOlderThan(params: {
  companyId: string;
  olderThanDays?: number;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false as const, message: "Invalid company context", archivedCount: 0 };
  }

  const olderThanDays = Math.max(1, params.olderThanDays || 30);
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await Ticket.updateMany(
    {
      companyId: toObjectId(params.companyId),
      status: "resolved",
      resolvedAt: { $lte: cutoffDate },
      archivedAt: null,
    },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
      },
    }
  );

  return {
    success: true as const,
    archivedCount: result.modifiedCount,
  };
}

export async function listLinkedTickets(params: {
  companyId: string;
  linkedType: TicketLinkedType;
  linkedId: string;
  access: TicketAccessScope;
  limit?: number;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.linkedId)) {
    return { success: false as const, message: "Invalid linked ticket context", items: [] };
  }

  const query: Record<string, unknown> = {
    companyId: toObjectId(params.companyId),
    linkedType: params.linkedType,
    linkedId: toObjectId(params.linkedId),
  };

  const scopedQuery = withAccessScope(query, params.access);

  const tickets = await Ticket.find(scopedQuery)
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(params.limit || 20, 100)))
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  const requesterId = isValidObjectId(params.access.userId) ? params.access.userId : null;

  return {
    success: true as const,
    items: tickets.map((ticket) => {
      const unreadBy = Array.isArray(ticket.unreadBy)
        ? uniqueObjectIdStrings(ticket.unreadBy.map((entry: unknown) => toIdString(entry)))
        : [];

      return {
        ...ticket,
        unreadCount: unreadBy.length,
        isUnreadForMe: requesterId ? unreadBy.includes(requesterId) : false,
      };
    }),
  };
}

export async function listTicketRecipients(params: {
  companyId: string;
  search?: string;
  limit?: number;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false as const, message: "Invalid company context", users: [] };
  }

  const query: Record<string, unknown> = {
    companyId: toObjectId(params.companyId),
    accessRevokedAt: null,
    account_status: { $ne: "suspended" },
  };

  if (params.search) {
    const searchRegex = new RegExp(escapeRegex(params.search), "i");
    query.$or = [{ name: { $regex: searchRegex } }, { email: { $regex: searchRegex } }];
  }

  const users = await User.find(query)
    .select("_id name email role invitationStatus account_status")
    .sort({ name: 1, email: 1 })
    .limit(Math.max(1, Math.min(params.limit || 30, 100)))
    .lean();

  return {
    success: true as const,
    users: users.map((user) => ({
      ...user,
      _id: String(user._id),
    })),
  };
}

export async function listTicketsWithoutReplyForReminder(params: {
  companyId: string;
  olderThanHours?: number;
  limit?: number;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false as const, message: "Invalid company context", items: [] };
  }

  const olderThanHours = Math.max(1, params.olderThanHours || 48);
  const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const items = await Ticket.find({
    companyId: toObjectId(params.companyId),
    status: "waiting",
    updatedAt: { $lte: cutoffDate },
    archivedAt: null,
  })
    .sort({ updatedAt: 1 })
    .limit(Math.max(1, Math.min(params.limit || 100, 500)))
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  return {
    success: true as const,
    items,
  };
}

export async function getMyTicketSummary(params: {
  companyId: string;
  userId: string;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.userId)) {
    return {
      success: false as const,
      message: "Invalid ticket summary context",
      data: {
        open: 0,
        waiting: 0,
        unread: 0,
      },
    };
  }

  const companyObjectId = toObjectId(params.companyId);
  const userObjectId = toObjectId(params.userId);

  const myScope: Record<string, unknown> = {
    companyId: companyObjectId,
    archivedAt: null,
    $or: [{ createdBy: userObjectId }, { assignedTo: userObjectId }],
  };

  const [open, waiting, unread] = await Promise.all([
    Ticket.countDocuments({
      ...myScope,
      status: { $in: ["open", "replied"] },
    }),
    Ticket.countDocuments({
      ...myScope,
      status: "waiting",
    }),
    Ticket.countDocuments({
      companyId: companyObjectId,
      archivedAt: null,
      unreadBy: userObjectId,
    }),
  ]);

  return {
    success: true as const,
    data: {
      open,
      waiting,
      unread,
    },
  };
}
