export const EXPENSE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
] as const;

export const EXPENSE_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function isExpenseMimeTypeAllowed(mimeType: string): boolean {
  return EXPENSE_ALLOWED_MIME_TYPES.includes(mimeType as (typeof EXPENSE_ALLOWED_MIME_TYPES)[number]);
}

export function getExpenseFileExtension(fileName: string, mimeType: string): string {
  const nameExtension = fileName.split(".").pop()?.toLowerCase();
  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) {
    return nameExtension;
  }

  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/heic") return "heic";

  return "bin";
}

export function formatFileSizeMb(sizeBytes: number): string {
  return (sizeBytes / (1024 * 1024)).toFixed(0);
}
