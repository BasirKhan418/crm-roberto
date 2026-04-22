import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import ReminderSettings from '@/db/models/ReminderSettings';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import {
  reminderOffsetsSchema,
  updateReminderSettingsSchema,
  type UpdateReminderSettingsDTO,
} from '@/validators/reminder-settings.schema';

type Primitive = string | number | boolean | null | Date;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function flattenForMongoSet(input: Record<string, unknown>, prefix = ''): Record<string, Primitive> {
  const output: Record<string, Primitive> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(output, flattenForMongoSet(value, path));
      continue;
    }

    output[path] = value as Primitive;
  }

  return output;
}

export const GET = async () => {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    await ConnectDb();

    let settings = await ReminderSettings.findOne({ userId: me.user.id }).lean();

    if (!settings) {
      const created = await ReminderSettings.create({ userId: me.user.id });
      settings = created.toObject();
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return NextResponse.json({ message: `Error fetching reminder settings: ${String(error)}`, success: false }, { status: 500 });
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const payload = (await request.json()) as UpdateReminderSettingsDTO;
    const parsed = updateReminderSettingsSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    if (parsed.data.offsets) {
      const current = await ReminderSettings.findOne({ userId: me.user.id })
        .select('offsets')
        .lean<{ offsets?: { soft?: number; medium?: number; firm?: number; formalNotice?: number } } | null>();

      const mergedOffsets = {
        soft: current?.offsets?.soft ?? 7,
        medium: current?.offsets?.medium ?? 15,
        firm: current?.offsets?.firm ?? 30,
        formalNotice: current?.offsets?.formalNotice ?? 35,
        ...parsed.data.offsets,
      };

      const offsetsCheck = reminderOffsetsSchema.safeParse(mergedOffsets);
      if (!offsetsCheck.success) {
        return NextResponse.json(buildValidationError(offsetsCheck.error), { status: 400 });
      }
    }

    const setDoc = flattenForMongoSet(parsed.data as Record<string, unknown>);
    if (parsed.data.lateFee?.stages !== undefined) {
      setDoc['lateFee.enabled'] = false;
      setDoc['lateFee.type'] = 'percentage';
      setDoc['lateFee.value'] = 0;
      setDoc['lateFee.applyFrom'] = 'formalNotice';
    }

    if (Object.keys(setDoc).length === 0) {
      return NextResponse.json({ success: false, message: 'No valid fields provided for update' }, { status: 400 });
    }

    const updated = await ReminderSettings.findOneAndUpdate(
      { userId: me.user.id },
      { $set: setDoc, $setOnInsert: { userId: me.user.id } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).lean();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ message: `Error updating reminder settings: ${String(error)}`, success: false }, { status: 500 });
  }
};
