import { NextRequest, NextResponse } from 'next/server';

import { runRecurrencePass } from '@/lib/cron/recurrence-pass';
import { runReminderPass } from '@/lib/cron/reminder-pass';

function readCronSecret(request: NextRequest): string {
  const explicitSecret = request.headers.get('x-cron-secret')?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const authHeader = request.headers.get('authorization')?.trim();
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

async function runCron(request: NextRequest) {
  const cronSecret = readCronSecret(request);

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.info({ event: 'cron-run-start', timestamp: new Date().toISOString() });

    const reminder = await runReminderPass();
    const recurrence = await runRecurrencePass();

    const totals = {
      reminder,
      recurrence,
    };

    console.info({ event: 'cron-run-end', timestamp: new Date().toISOString(), ...totals });

    return NextResponse.json({ success: true, totals }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error running cron reminders: ${String(error)}` }, { status: 500 });
  }
}

export const POST = runCron;
export const GET = runCron;
