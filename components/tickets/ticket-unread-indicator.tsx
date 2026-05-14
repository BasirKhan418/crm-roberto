'use client';

export function TicketUnreadIndicator({
  unreadCount,
  locale = 'en',
}: {
  unreadCount?: number;
  locale?: 'en' | 'fr';
}) {
  const count = typeof unreadCount === 'number' ? unreadCount : 0;
  if (count <= 0) return null;

  const label =
    locale === 'fr'
      ? `${count} message${count > 1 ? 's' : ''} non lu${count > 1 ? 's' : ''}`
      : `${count} unread message${count > 1 ? 's' : ''}`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
      aria-label={label}
      title={label}
    >
      <span className="inline-block size-1.5 rounded-full bg-red-500" />
      {count > 99 ? '99+' : count}
    </span>
  );
}
