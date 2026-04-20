import dayjs from 'dayjs';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { createActivityLog } from '@/db/repository/activity';
import { normalizeRecurrencePayload } from '@/lib/recurrence/core';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { stopRecurrenceSchema, upsertRecurrenceSchema } from '@/validators/recurrence.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = upsertRecurrenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id }).select('_id invoiceNumber dueDate').lean<{
      _id: mongoose.Types.ObjectId;
      invoiceNumber: string;
      dueDate?: Date | null;
    } | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const recurrencePayload = normalizeRecurrencePayload(
      {
        frequency: parsed.data.frequency,
        customIntervalDays: parsed.data.customIntervalDays,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        nextOccurrenceAt: parsed.data.nextOccurrenceAt ? new Date(parsed.data.nextOccurrenceAt) : null,
        autoGenerate: parsed.data.autoGenerate,
        autoSend: parsed.data.autoSend,
      },
      invoice.dueDate ?? null
    );

    if (recurrencePayload.endDate && recurrencePayload.nextOccurrenceAt > recurrencePayload.endDate) {
      return NextResponse.json(
        { success: false, message: 'nextOccurrenceAt cannot be after endDate' },
        { status: 400 }
      );
    }

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      {
        $set: {
          recurrence: recurrencePayload,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'invoice_recurrence_created',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        frequency: recurrencePayload.frequency,
        nextOccurrenceAt: dayjs(recurrencePayload.nextOccurrenceAt).toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error updating recurrence: ${String(error)}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = stopRecurrenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    const now = new Date();
    const reason = parsed.data.reason?.trim() || null;

    const updated = await Invoice.findOneAndUpdate(
      { _id: id, userId: me.user.id },
      {
        $set: {
          'recurrence.isActive': false,
          'recurrence.stoppedAt': now,
          'recurrence.stoppedReason': reason,
          'recurrence.nextOccurrenceAt': null,
        },
      },
      { new: true, runValidators: true }
    ).lean<{ _id: mongoose.Types.ObjectId; invoiceNumber: string } | null>();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await createActivityLog(me.user.id, {
      action: 'invoice_recurrence_stopped',
      entityType: 'invoice',
      entityName: updated.invoiceNumber,
      entityId: String(updated._id),
      metadata: {
        reason,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error stopping recurrence: ${String(error)}` }, { status: 500 });
  }
}
