# Sprint 6 Manual QA Checklist

This project currently does not include an automated test suite pattern for feature-level UI/API tests.
Use this checklist to validate Sprint 6 changes before release.

## 1) Tickets list and filters

1. Open `/tickets`.
2. Confirm list loads and pagination appears.
3. Search by title keyword and confirm matching ticket rows update.
4. Search by message body keyword and confirm matching tickets appear.
5. Filter by status and type; confirm rows reflect selected filters.
6. Enable `Assigned to me`, `Created by me`, `Unread only` and confirm results narrow correctly.
7. Apply linked filters (`linkedType=expense` + linked record id) and confirm only linked tickets show.

## 2) Ticket detail and thread actions

1. Open a ticket from `/tickets`.
2. Confirm message thread renders in chronological order.
3. Confirm unread indicator clears after opening an unread ticket.
4. Upload at least one attachment in reply composer and send reply.
5. Confirm reply appears in thread with attachment links.
6. Change status (for users with `tickets.manage`) and confirm badge updates.
7. Verify read-only behavior on archived tickets (reply disabled).

## 3) Expense-linked ticket flow

1. Open an expense detail page and go to `Linked tickets` tab.
2. Confirm linked tickets load without errors.
3. Create a linked ticket from the expense page.
4. Confirm the new ticket appears in linked tickets list.
5. Use `Open` action on linked ticket card and verify it routes to `/tickets/[id]`.

## 4) Dashboard smart actions

1. Open `/dashboard`.
2. Confirm `Smart Actions` block loads normally.
3. Verify `tickets waiting over 48h` action appears when waiting tickets are stale.
4. Click the ticket smart action:
   - If target exists, confirm it opens `/tickets/[id]`.
   - If no target exists, confirm it opens filtered `/tickets?status=waiting&assignedToMe=true`.

## 5) Dashboard My Tickets widget

1. In dashboard customization, confirm `My tickets` block can be shown/hidden and reordered.
2. Confirm widget shows `Open`, `Waiting`, and `Unread` counts.
3. Click each metric and verify target routes:
   - Open -> `/tickets?assignedToMe=true&status=open`
   - Waiting -> `/tickets?assignedToMe=true&status=waiting`
   - Unread -> `/tickets?unreadOnly=true`

## 6) Sidebar ticket badge

1. Confirm sidebar includes `Tickets` nav item.
2. Trigger unread tickets for current user.
3. Confirm unread count appears on sidebar ticket badge.
4. Open/mark tickets as read; confirm badge count decreases.

## 7) Permission checks

1. Login with role lacking `tickets.view`:
   - `/tickets` should block access.
   - Ticket-related dashboard widgets should fail safely.
2. Login with role having `tickets.view` but not `tickets.manage`:
   - Can view ticket list/detail.
   - Cannot send replies or change status.

## 8) Regression smoke checks

1. Dashboard blocks still load: Stats, Collection, Activity, Recent Quotes, Recurrences.
2. Expense detail tabs still work: Summary, Attachments, Audit, Tickets.
3. Sidebar quote and invoice badges still increment as before.
4. Run lint and build before merge.
