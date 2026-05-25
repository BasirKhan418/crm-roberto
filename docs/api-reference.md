# CRM Roberto API Reference

Last updated: 2026-05-25

All backend endpoints are implemented as Next.js App Router route handlers under `app/api`. Most endpoints return JSON and expect an authenticated user through the `token` HTTP-only cookie, unless explicitly public or admin-only.

## 1. Authentication And Session APIs

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/(auth)/login` | POST | Public | Verify credentials, issue CRM JWT cookie, enforce account lock/status checks. |
| `/api/(auth)/logout` | POST | Authenticated | Clear CRM session cookie. |
| `/api/(auth)/signup` | POST | Public | Signup is intentionally invitation-only/disabled. |
| `/api/(auth)/workspace-setup` | POST | Public with bootstrap code | Create initial company/workspace owner. |
| `/api/(auth)/verify-otp` | POST | Public/session flow | Verify Redis-backed email OTP and mark email verified. |
| `/api/(auth)/forgot` | POST | Public | Send password reset email. |
| `/api/(auth)/reset` | POST | Public token flow | Reset password using reset token. |
| `/api/(auth)/change-password` | POST | Authenticated | Change current user password. |
| `/api/me` | GET, PATCH | Authenticated | Current user profile and preferences. |
| `/api/me/events` | GET | Authenticated | Current user events/activity metadata. |

## 2. Admin APIs

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/admin/login` | POST | Public admin login | Issue `admin-token` cookie. |
| `/api/admin/logout` | POST | Admin | Clear admin cookie. |
| `/api/admin/me` | GET | Admin | Read current admin session. |
| `/api/admin/users` | GET, PATCH | Admin | List and manage platform users. |

## 3. CRM Entity APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/clients` | GET, POST | List/create clients. |
| `/api/clients/[id]` | GET, PATCH, DELETE | Read/update/delete a client. |
| `/api/clients/[id]/notes` | GET, POST | Client-linked notes. |
| `/api/clients/[id]/interactions` | GET, POST | Client calls, meetings, emails, discussions. |
| `/api/clients/[id]/interactions/[interactionId]` | DELETE | Remove one interaction. |
| `/api/clients/[id]/attachments` | GET, POST | List/create client attachment metadata. |
| `/api/clients/[id]/attachments/[attachmentId]` | DELETE | Delete client attachment metadata. |
| `/api/suppliers` | GET, POST | List/create suppliers. |
| `/api/suppliers/[id]` | GET, PATCH, DELETE | Read/update/delete supplier. |
| `/api/suppliers/[id]/notes` | GET, POST | Supplier-linked notes. |
| `/api/notes` | GET, POST | List/create follow-up notes. |
| `/api/notes/[id]` | GET, PATCH, DELETE | Read/update/delete note. |
| `/api/catalogue` | GET, POST | List/create product or service catalogue item. |
| `/api/catalogue/[id]` | GET, PATCH, DELETE | Read/update/delete catalogue item. |

## 4. Quote APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/quotes` | GET, POST | List/create quotes. |
| `/api/quotes/[id]` | GET, PATCH, DELETE | Read/update/delete quote. |
| `/api/quotes/[id]/send` | POST | Generate signature token and email quote to client. |
| `/api/quotes/[id]/status` | PATCH | Change quote status. |
| `/api/quotes/[id]/duplicate` | POST | Duplicate a quote. |
| `/api/quotes/[id]/pdf` | GET | Generate/download quote PDF. |
| `/api/quotes/[id]/acknowledge` | POST | Acknowledge quote client response/unread state. |
| `/api/quotes/[id]/reject-reply` | POST | Send admin reply to a rejected quote. |
| `/api/quotes/next-number` | GET | Return next canonical quote number. |
| `/api/quotes/kpis` | GET | Quote dashboard KPIs. |
| `/api/quotes/action-counts` | GET | Counts used for sidebar/actions. |

## 5. Public Signature APIs

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/sign/[token]` | GET, POST, PATCH | Public token | Read quote, accept/reject/sign, and update public quote interaction state. |
| `/api/sign/[token]/reply` | POST | Public token | Submit client reply/comment on quote. |

Token security expectations:

- Tokens must be high entropy and time-limited.
- Expired or missing tokens must not leak quote data.
- Signed/rejected status changes must create activity/unread state for the owner.

## 6. Invoice APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/invoices` | GET, POST | List/create invoices. |
| `/api/invoices/[id]` | GET, PATCH, DELETE | Read/update/delete invoice. |
| `/api/invoices/[id]/send` | POST | Send invoice email and payment link. |
| `/api/invoices/[id]/pdf` | GET | Generate/download invoice PDF. |
| `/api/invoices/[id]/payments` | GET, POST, PATCH, DELETE | Read/add/update/delete payment entries. |
| `/api/invoices/[id]/paymentsDone` | GET | Read paid totals/payment completion state. |
| `/api/invoices/[id]/recurrence` | POST, DELETE | Configure/stop recurrence. |
| `/api/invoices/[id]/recurrence/generate` | POST | Generate next recurring invoice manually. |
| `/api/invoices/next-number` | GET | Return next canonical invoice number. |
| `/api/invoices/kpis` | GET | Invoice KPI totals. |

## 7. Reminder And Legal Recovery APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/reminders/settings` | GET, PATCH | Read/update reminder settings, templates, offsets, fees, legal recovery data. |
| `/api/reminders/settings/reset` | POST | Reset reminder settings to defaults. |
| `/api/invoices/[id]/reminders/send` | POST | Send manual reminder. |
| `/api/invoices/[id]/reminders/skip` | POST | Skip next reminder level. |
| `/api/invoices/[id]/reminders/pause` | POST | Pause automatic invoice reminders. |
| `/api/invoices/[id]/reminders/resume` | POST | Resume automatic invoice reminders. |
| `/api/invoices/[id]/reminders/logs` | GET | Read reminder log history. |
| `/api/invoices/[id]/reminders/legal-notice/pdf` | GET | Generate legal notice PDF. |
| `/api/invoices/[id]/reminders/legal-recovery/eligibility` | GET | Check legal recovery eligibility. |
| `/api/invoices/[id]/reminders/legal-recovery/recovery-file` | GET | Generate legal recovery file. |
| `/api/invoices/[id]/reminders/legal-recovery/payment-order/pdf` | GET | Generate payment order PDF. |
| `/api/invoices/[id]/reminders/legal-recovery/sent-to-court` | POST | Mark recovery as sent to court. |

## 8. Payment And Stripe APIs

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/pay/[token]` | GET, POST | Public token | Read payable invoice and create Stripe Checkout session. |
| `/api/pay/[token]/confirm` | POST | Public token | Confirm checkout session and finalize payment state. |
| `/api/stripe/webhook` | POST | Stripe signed webhook | Verify signature and finalize successful checkout events. |
| `/api/stripe/checkout` | POST | Authenticated | Create checkout session for internal invoice/payment flow. |
| `/api/stripe/checkoutDone` | POST | Authenticated/public callback | Complete checkout-related status updates. |
| `/api/stripe/deposit` | POST | Authenticated | Deposit payment flow placeholder/handler. |
| `/api/stripe/connect` | GET, POST, DELETE | Authenticated | Stripe Connect account management. |
| `/api/stripe/connect/callback` | GET | Stripe redirect | Finalize Connect onboarding callback. |
| `/api/stripe/connect/status` | GET, POST | Authenticated | Read/refresh connected account status. |

Webhook events currently handled:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

## 9. Expense APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/expenses` | GET, POST | List/create expenses with filters. |
| `/api/expenses/[id]` | GET, PATCH, DELETE | Read/update/delete expense. |
| `/api/expenses/[id]/actions` | POST | Expense state transitions such as archive, duplicate, mark paid. |
| `/api/expenses/[id]/attachments` | GET, POST, DELETE | Manage expense attachments. |
| `/api/expenses/upload-presign` | POST | Generate S3 upload URL for expenses. |
| `/api/expenses/categories` | GET, POST, PATCH, DELETE | Manage expense categories. |
| `/api/expenses/lookups` | GET, POST | Lookup suppliers/categories/clients for expense forms. |
| `/api/expenses/drafts` | POST | Create or process draft expenses. |
| `/api/expenses/email-ingest` | POST | Placeholder/early endpoint for email-imported expenses. |

## 10. Ticket APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/tickets` | GET, POST | List/create tickets. |
| `/api/tickets/[id]` | GET | Read ticket detail. |
| `/api/tickets/[id]/status` | PATCH | Update ticket status. |
| `/api/tickets/[id]/read` | POST | Mark ticket as read. |
| `/api/tickets/[id]/messages` | POST | Add message to ticket. |
| `/api/tickets/lookups` | GET | Ticket form lookup data. |
| `/api/tickets/upload-presign` | POST | Generate S3 upload URL for ticket attachments. |

## 11. Dashboard, Activity, Notifications, Sidebar

| Route | Methods | Purpose |
|---|---|---|
| `/api/dashboard/stats` | GET | Dashboard financial and operational KPIs. |
| `/api/dashboard/activity` | GET | Dashboard activity feed. |
| `/api/dashboard/followups` | GET | Due follow-ups. |
| `/api/dashboard/reminders` | GET | Reminder candidates/summary. |
| `/api/dashboard/smart-actions` | GET, POST | Smart actions and action handling. |
| `/api/dashboard/tickets/summary` | GET | Ticket summary cards. |
| `/api/activity` | GET, POST | Activity list/create. |
| `/api/activity/[id]` | GET, PATCH, DELETE | Activity detail/update/delete. |
| `/api/activity/read-all` | PATCH | Mark all activity as read. |
| `/api/activity/events` | GET | Activity event metadata. |
| `/api/notifications` | GET | List notifications. |
| `/api/notifications/[id]/read` | PATCH | Mark one notification read. |
| `/api/notifications/read-all` | POST | Mark all notifications read. |
| `/api/sidebar/badges` | GET | Sidebar badge counts. |
| `/api/sidebar/mark-read` | POST | Mark sidebar item/activity read. |

## 12. Upload And Company Profile APIs

| Route | Methods | Purpose |
|---|---|---|
| `/api/upload` | POST | General S3 presigned upload endpoint. |
| `/api/cprofile` | GET, PATCH | Company legal, contact, banking, and profile data. |
| `/api/cprofile/logo` | POST, DELETE | Upload/delete company logo. |

## 13. Cron APIs

| Route | Methods | Access | Purpose |
|---|---|---|---|
| `/api/cron/reminders` | GET, POST | `CRON_SECRET` header or bearer token | Run reminder pass and recurrence pass. |

Configured schedules in `vercel.json`:

- `0 7 * * *`
- `0 19 * * *`

## 14. API Development Rules

- Validate request payloads with existing validators or domain parsing helpers.
- Always call `ConnectDb()` before Mongoose operations.
- Use `useMe()`/`checkMe()` for authenticated routes.
- Enforce `companyId`, `userId`, or ownership filters before returning data.
- Do not expose secret values or raw tokens in JSON responses or logs.
- Use Stripe webhook signature verification before trusting Stripe events.
- Use S3 presigned URLs with size/type validation for direct uploads.