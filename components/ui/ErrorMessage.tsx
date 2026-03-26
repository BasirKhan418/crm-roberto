import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  message?: string;
}

export default function ErrorMessage({ message = 'Something went wrong. Please refresh.' }: ErrorMessageProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
