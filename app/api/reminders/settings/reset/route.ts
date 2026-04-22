import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import ReminderSettings from '@/db/models/ReminderSettings';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { resetReminderSettingsSchema } from '@/validators/reminder-settings.schema';

type ResetSection = 'offsets' | 'templates' | 'lateFee' | 'legalNotice';

export const POST = async (request: NextRequest) => {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const payload = (await request.json()) as { section?: ResetSection };
    const parsed = resetReminderSettingsSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    await ConnectDb();

    const defaultDoc = new ReminderSettings({ userId: me.user.id }).toObject() as Record<string, unknown>;
    const section = parsed.data.section;
    const sectionDefaults = defaultDoc[section];

    const updated = await ReminderSettings.findOneAndUpdate(
      { userId: me.user.id },
      { $set: { [section]: sectionDefaults }, $setOnInsert: { userId: me.user.id } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ message: `Error resetting reminder settings: ${String(error)}`, success: false }, { status: 500 });
  }
};
