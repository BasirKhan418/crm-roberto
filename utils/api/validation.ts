import { ZodError } from 'zod';

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

interface ValidationErrorPayload {
  success: false;
  message: string;
  errors: ValidationIssue[];
  fieldErrors: Record<string, string[]>;
  missingFields: string[];
}

export function buildValidationError(
  error: ZodError,
  fallbackMessage = 'Invalid input'
): ValidationErrorPayload {
  const errors = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return {
      field: path || 'general',
      message: issue.message,
      code: issue.code,
    };
  });

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of errors) {
    if (!fieldErrors[issue.field]) {
      fieldErrors[issue.field] = [];
    }
    fieldErrors[issue.field].push(issue.message);
  }

  const missingFields = Array.from(
    new Set(
      errors
        .filter((issue) => issue.field !== 'general' && /required|must be provided/i.test(issue.message))
        .map((issue) => issue.field)
    )
  );

  return {
    success: false,
    message: errors[0]?.message || fallbackMessage,
    errors,
    fieldErrors,
    missingFields,
  };
}
