import { listTicketsWithoutReplyForReminder } from "@/db/repository/ticket";

export async function getTicketNoReplyCandidates(params: {
  companyId: string;
  olderThanHours?: number;
  limit?: number;
}) {
  return listTicketsWithoutReplyForReminder({
    companyId: params.companyId,
    olderThanHours: params.olderThanHours || 48,
    limit: params.limit || 100,
  });
}

export async function runTicketNoReplyReminderSweep(params: {
  companyId: string;
  olderThanHours?: number;
  limit?: number;
}) {
  const result = await getTicketNoReplyCandidates(params);

  if (!result.success) {
    return {
      success: false as const,
      message: result.message,
      remindedCount: 0,
    };
  }

  // Milestone 1 foundation: scheduler wiring and outbound reminder fan-out can
  // be attached in Milestone 2 without changing ticket query semantics.
  return {
    success: true as const,
    remindedCount: 0,
    candidates: result.items,
  };
}
