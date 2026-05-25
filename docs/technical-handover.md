# CRM Roberto Technical Handover

Last updated: 2026-05-25

## 1. Executive Summary

CRM Roberto is a full-stack CRM and business operations platform built with Next.js App Router, TypeScript, MongoDB/Mongoose, Stripe, AWS S3, Redis, and SMTP email. The product centralizes CRM records, supplier management, expenses, tickets, quotes, invoices, public e-signature, payment collection, reminders, and recurring invoice generation.

The system is designed around three core business guarantees:

- A company/user must only access its own operational data.
- Commercial documents must preserve accounting snapshots at the time of issue.
- Public actions such as quote signing and invoice payment must be token-gated and auditable.

## 2. High-Level Architecture

```mermaid
flowchart LR
  User[Authenticated CRM user] --> Browser[Next.js React UI]
  Client[Public client] --> PublicRoutes[Public sign/pay pages]

  Browser --> AppRoutes[Next.js App Router pages]
  Browser --> Api[Next.js Route Handlers /api]
  PublicRoutes --> Api

  Api --> Auth[JWT cookie session and RBAC]
  Auth --> Mongo[(MongoDB via Mongoose)]
  Api --> Mongo

  Api --> Stripe[Stripe Checkout and Webhooks]
  Api --> S3[AWS S3 presigned uploads]
  Api --> SMTP[SMTP via Nodemailer]
  Api --> Redis[(Redis / Valkey)]

  VercelCron[Vercel Cron] --> CronApi["/api/cron/reminders"]
  LocalCron[Optional local scheduler] --> CronApi
  CronApi --> Redis
  CronApi --> Mongo
  CronApi --> SMTP
```

## 3. Runtime Architecture

```mermaid
flowchart TB
  subgraph Frontend
    Pages[app/* pages]
    Components[components/*]
    Hooks[hooks/* SWR/domain hooks]
    Providers[theme, language, shell providers]
  end

  subgraph Backend
    Routes[app/api/* route handlers]
    Middleware[proxy.ts route protection]
    Repositories[db/repository/*]
    Domain[lib/* domain services]
    Validators[validators/* Zod schemas]
  end

  subgraph Data
    Models[db/models/*]
    Mongo[(MongoDB)]
  end

  Pages --> Components
  Components --> Hooks
  Hooks --> Routes
  Middleware --> Pages
  Routes --> Validators
  Routes --> Repositories
  Routes --> Domain
  Repositories --> Models
  Models --> Mongo
```

## 4. Repository Map

| Path | Responsibility |
|---|---|
| `app/` | App Router pages, layouts, metadata, loading/error states, and API route handlers. |
| `app/api/` | Backend endpoints for auth, CRM, expenses, quotes, invoices, payments, uploads, cron, notifications, admin, and dashboard data. |
| `components/` | Reusable UI and feature components for dashboards, CRM, invoices, quotes, expenses, tickets, onboarding, modals, and shell/navigation. |
| `hooks/` | Client-side data hooks for lists, action counts, details, lookups, dashboard data, auth, and sidebar badges. |
| `db/models/` | Mongoose schema definitions and indexes. |
| `db/repository/` | Data access and cross-model operations. |
| `lib/` | Domain logic for auth tokens, pricing, quote/invoice calculations, permissions, payments, Stripe, reminders, recurrence, PDF, i18n, and tickets. |
| `utils/` | Server middleware helpers, OTP/Redis, S3 client, and API utilities. |
| `validators/` | Zod schemas for request payloads and form validation. |
| `emails/` | SMTP transport and transactional email templates. |
| `cron/` | Optional local scheduler for reminder cron execution. |
| `docs/` | Handover, deployment, API, schema, and milestone documentation. |

## 5. Main Application Modules

| Module | Routes | Purpose |
|---|---|---|
| Authentication | `/login`, `/signup`, `/forgot-password`, `/workspace-setup`, `/logout` | Login, OTP verification, password reset, invited user onboarding, workspace bootstrap. |
| Dashboard | `/dashboard` | KPIs, activity, smart actions, reminders, follow-ups, and ticket summary. |
| Clients | `/clients` | Client CRUD, billing/contact data, notes, interactions, attachments. |
| Suppliers | `/suppliers` | Supplier CRUD, category/tag management, supplier notes. |
| Catalogue | `/catalogue` | Products and services used in quote/invoice line items. |
| Quotes | `/quotes` | Commercial quote creation, sending, PDF, status changes, client reply, signing, duplication. |
| Invoices | `/invoices` | Invoice creation, PDF, send flow, payments, reminders, legal recovery, recurrence. |
| Expenses | `/expenses` | Expense drafts, activation, categories, suppliers, attachments, payments, archive, audits. |
| Tickets | `/tickets` | Company-scoped tickets, messages, assignment, status, unread tracking, attachments. |
| Notes | `/notes` | Follow-ups linked to clients or suppliers. |
| Settings | `/settings` | User administration, roles, reminders, recovery rules, payment settings. |
| Profile | `/profile` | User/company profile and guided tour reset. |
| Public Sign | `/sign/[token]` | Tokenized quote signature and reply flow without CRM login. |
| Public Pay | `/pay/[token]` | Tokenized invoice payment flow without CRM login. |
| Admin | `/admin` | Separate admin portal protected by `admin-token`. |

## 6. Authentication And Authorization

Authentication uses signed JWTs stored in HTTP-only cookies. Normal CRM sessions use the `token` cookie, while admin sessions use `admin-token`.

JWT payload fields include `sub`, `name`, `email`, `locale`, `isOnboardingComplete`, `isEmailVerified`, `role`, and `companyId`. Tokens are issued for seven days by `lib/auth-session.ts`.

`proxy.ts` protects CRM page routes and handles onboarding redirects. Public signature routes are bypassed at the page middleware level. API route handlers perform server-side checks through `utils/middlewares/checkMe.ts` and `utils/middlewares/useMe.ts`.

Roles are defined in `lib/permissions.ts`:

| Role | Intended access |
|---|---|
| `super_admin` | Full permissions. |
| `administrator` | Users, expenses, tickets. |
| `manager` | User viewing, expenses, tickets. |
| `standard_user` | Expenses and tickets. |
| `secretary` | Expenses and tickets. |
| `technician` | Tickets. |
| `read_only` | Read access for users, expenses, tickets. |
| `external_accountant` | Explicitly blocked from normal protected CRM routes. |

Security controls currently present:

- Argon2 password hashing with `PASSWORD_PEPPER`.
- JWT secret validation through `JWT_SECRET`.
- Account status checks for suspended users.
- Access revocation and forced logout timestamps.
- Failed login counters and temporary lock fields on `User`.
- Invitation status and hashed invitation tokens.
- Company context enforcement for many company-scoped workflows.
- Stripe webhook signature verification.
- Cron endpoint secret validation through `CRON_SECRET`.

## 7. Core Business Flows

### Quote To Signature To Invoice

```mermaid
sequenceDiagram
  actor User as CRM User
  participant QuoteAPI as Quote API
  participant Mongo as MongoDB
  participant Email as SMTP
  actor Client as Public Client
  participant SignAPI as Sign API
  participant InvoiceAPI as Invoice API

  User->>QuoteAPI: Create quote
  QuoteAPI->>Mongo: Store quote and client snapshot
  User->>QuoteAPI: Send quote
  QuoteAPI->>Mongo: Generate signature token and mark sent
  QuoteAPI->>Email: Email public sign link
  Client->>SignAPI: Open /sign/[token]
  SignAPI->>Mongo: Validate token and expiry
  Client->>SignAPI: Accept, reject, or reply
  SignAPI->>Mongo: Update quote status and conversation
  User->>InvoiceAPI: Convert accepted/signed quote
  InvoiceAPI->>Mongo: Create invoice from quote snapshot
```

### Invoice Payment

```mermaid
sequenceDiagram
  actor User as CRM User
  actor Client as Public Client
  participant InvoiceAPI as Invoice API
  participant PayAPI as Pay API
  participant Stripe as Stripe Checkout
  participant Webhook as Stripe Webhook
  participant Mongo as MongoDB
  participant Email as SMTP

  User->>InvoiceAPI: Send invoice
  InvoiceAPI->>Mongo: Generate payment token
  InvoiceAPI->>Email: Email invoice/payment link
  Client->>PayAPI: Open /pay/[token]
  PayAPI->>Mongo: Validate payment token
  Client->>PayAPI: Start full/deposit/balance checkout
  PayAPI->>Stripe: Create Checkout Session
  Stripe-->>Client: Redirect checkout
  Stripe->>Webhook: checkout.session.completed
  Webhook->>Mongo: Create Payment and update invoice status
  Webhook->>Email: Send payment receipt
```

### Reminder And Recurrence Automation

```mermaid
flowchart LR
  Scheduler[Vercel Cron or local scheduler] --> Cron["/api/cron/reminders"]
  Cron --> Auth[Validate CRON_SECRET]
  Auth --> ReminderPass[runReminderPass]
  Auth --> RecurrencePass[runRecurrencePass]
  ReminderPass --> RedisLock[Redis lock]
  RecurrencePass --> RedisLock
  ReminderPass --> InvoiceScan[Find due unpaid/partial invoices]
  InvoiceScan --> ReminderSettings[Load reminder settings]
  ReminderSettings --> Email[Send reminder or formal notice]
  Email --> ReminderLog[Write ReminderLog]
  RecurrencePass --> Generate[Generate next recurring invoice]
  Generate --> Activity[Create activity/notification]
```

## 8. Integration Architecture

| Integration | Files | Behavior |
|---|---|---|
| MongoDB | `db/connectDb.ts`, `db/models/*` | Cached Mongoose connection and schema models. |
| Stripe | `lib/stripe.ts`, `app/api/stripe/*`, `app/api/pay/[token]/*` | Checkout sessions, connected account setup, webhook verification, payment finalization, receipts. |
| AWS S3 | `utils/s3/s3Client.ts`, upload route handlers | Presigned uploads for general files, company logos, expense attachments, ticket attachments, and catalogue attachments. |
| SMTP | `emails/connectEmailClient.ts`, `lib/email.ts`, `emails/*` | Transactional auth, quote, invoice, reminder, legal notice, ticket, recurrence, and receipt emails. |
| Redis | `utils/otp/connectRedis.ts`, `lib/cron/redis-lock.ts` | OTP workflows and cron idempotency locks. |
| Vercel Cron | `vercel.json`, `app/api/cron/reminders/route.ts` | Twice-daily reminder/recurrence execution. |

## 9. Security And Audit Notes

Immediate handover security actions:

- Rotate every secret that appeared in local files, chat, screenshots, or ZIPs before final production delivery.
- Ensure `.env.local` is ignored and never included in public GitHub repositories or non-secure ZIP archives.
- Configure Stripe webhook endpoint as `/api/stripe/webhook` and verify `STRIPE_WEBHOOK_SECRET` in production.
- Use least-privilege IAM credentials for S3 and restrict bucket CORS to the production domain.
- Add platform-level rate limiting for login, password reset, public sign/pay token endpoints, and upload presign endpoints.
- Review every data query for correct `companyId` or owner scoping before opening multi-company access.
- Store production secrets only in the hosting provider secret manager.

Auditability already present:

- `AuditLog` captures expense, invoice, supplier, user, and ticket actions.
- `ActivityLog` feeds dashboard activity and unread states.
- `ReminderLog` records sent, skipped, failed, paused, and resumed reminder events.
- `Payment` records Stripe/manual payment entries and receipt dispatch timestamps.

## 10. Future Roadmap

| Item | Status | Recommended implementation direction |
|---|---|---|
| OCR-assisted expense workflow | Roadmap | Add document text extraction after S3 upload, map extracted fields into expense drafts, and keep human approval before activation. |
| Email expense import | Placeholder route exists | Complete inbound email provider setup, verify HMAC/secret, parse attachments, upload to S3, create draft expenses, and add audit events. |
| Background jobs | Roadmap | Move email/PDF/long-running tasks to a queue such as Inngest, BullMQ, or a managed background job service. |
| External accountant portal | Role exists | Build a separate read-only accountant interface with scoped documents and export permissions. |
| Security hardening | Ongoing | Add rate limiting, request logging, structured audit reports, MFA, and automated dependency scanning. |
| Scale readiness | Ongoing | Add observability, database index validation, S3 lifecycle rules, queue-based email delivery, and load testing for dashboard aggregates. |

## 11. Developer Handover Checklist

- Read all docs in `docs/`.
- Run `npm install`, `npm run lint`, and `npm run build` locally.
- Create local `.env.local` from `.env.example` without real production secrets unless authorized.
- Confirm MongoDB indexes for invoices, quotes, payments, expenses, tickets, reminders, and audit logs.
- Verify all production environment variables in the hosting provider.
- Confirm Stripe webhook delivery and SMTP sending in staging.
- Confirm S3 upload, read, delete, and lifecycle behavior in staging.
- Verify reminder cron with a test invoice and non-production recipient.
- Review role access for administrator, manager, technician, read-only, and external accountant.
- Produce a final source ZIP excluding `.env.local`, `.git`, `node_modules`, `.next`, and local temporary files.