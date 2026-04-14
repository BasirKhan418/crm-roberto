import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center">
      <p className="mx-auto max-w-xs text-sm text-muted-foreground">{message}</p>
      {actionLabel ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
