type Primitive = string | number | boolean | null | undefined | Date;

function normalizeValue(value: unknown): Primitive {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

export function buildFieldDiff(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): Array<{ fieldName: string; oldValue: Primitive; newValue: Primitive }> {
  const changed: Array<{ fieldName: string; oldValue: Primitive; newValue: Primitive }> = [];

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    const oldValue = normalizeValue(previous[key]);
    const newValue = normalizeValue(next[key]);

    if (oldValue instanceof Date && newValue instanceof Date) {
      if (oldValue.getTime() !== newValue.getTime()) {
        changed.push({ fieldName: key, oldValue, newValue });
      }
      continue;
    }

    if (oldValue !== newValue) {
      changed.push({ fieldName: key, oldValue, newValue });
    }
  }

  return changed;
}
