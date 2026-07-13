import { cn } from '@/lib/utils';

export type CountBadgeTone = 'green' | 'orange' | 'red' | 'blue' | 'slate';

const COUNT_BADGE_TONE_CLASSES: Record<CountBadgeTone, string> = {
  green: 'bg-emerald-500',
  orange: 'bg-amber-500 text-amber-950',
  red: 'bg-red-600',
  blue: 'bg-sky-600',
  slate: 'bg-slate-600',
};

function formatBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

export function CountBadge({
  count,
  tone = 'red',
  title,
  className,
}: {
  count: number;
  tone?: CountBadgeTone;
  title?: string;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none text-white',
        COUNT_BADGE_TONE_CLASSES[tone],
        className
      )}
      title={title}
      aria-label={title}
    >
      {formatBadgeCount(count)}
    </span>
  );
}

export function CountBadgeRow({
  items,
  className,
}: {
  items: Array<{
    count: number;
    tone?: CountBadgeTone;
    title?: string;
  }>;
  className?: string;
}) {
  const visibleItems = items.filter((item) => item.count > 0);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <span className={cn('ml-auto flex items-center gap-1', className)}>
      {visibleItems.map((item, index) => (
        <CountBadge
          key={`${item.tone ?? 'red'}-${item.count}-${index}`}
          count={item.count}
          tone={item.tone}
          title={item.title}
        />
      ))}
    </span>
  );
}