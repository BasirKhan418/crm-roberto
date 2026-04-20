export interface ReminderPassTotals {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runReminderPass(): Promise<ReminderPassTotals> {
  // TODO M3: implement reminder sending logic
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
}
