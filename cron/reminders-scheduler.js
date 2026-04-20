import cron from 'node-cron';
import dotenv from 'dotenv';

// Load env for local/PM2 execution on EC2.
dotenv.config({ path: '.env.local' });

dotenv.config();

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL =
  process.env.CRON_TARGET_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://127.0.0.1:3000';

const ENDPOINT = `${BASE_URL.replace(/\/$/, '')}/api/cron/reminders`;

if (!CRON_SECRET) {
  console.error('[cron-reminders] Missing CRON_SECRET. Aborting scheduler startup.');
  process.exit(1);
}

async function triggerReminderCron(sourceLabel) {
  const startedAt = new Date().toISOString();

  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        'x-cron-secret': CRON_SECRET,
        'user-agent': 'ec2-cron-reminders/1.0',
      },
    });

    const text = await response.text();
    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    if (!response.ok) {
      console.error('[cron-reminders] Request failed', {
        source: sourceLabel,
        startedAt,
        status: response.status,
        payload,
      });
      return;
    }

    console.info('[cron-reminders] Request succeeded', {
      source: sourceLabel,
      startedAt,
      status: response.status,
      payload,
    });
  } catch (error) {
    console.error('[cron-reminders] Network/Runtime failure', {
      source: sourceLabel,
      startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Match Vercel schedule: 07:00 UTC and 19:00 UTC.
cron.schedule(
  '0 7 * * *',
  () => {
    void triggerReminderCron('daily-07-utc');
  },
  { timezone: 'UTC' }
);

cron.schedule(
  '0 19 * * *',
  () => {
    void triggerReminderCron('daily-19-utc');
  },
  { timezone: 'UTC' }
);

console.info('[cron-reminders] Scheduler started', {
  endpoint: ENDPOINT,
  schedule: ['0 7 * * *', '0 19 * * *'],
  timezone: 'UTC',
});
