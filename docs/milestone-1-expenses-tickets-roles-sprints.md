# CRM Roberto - Milestone 1 Sprint Build Plan

Expenses Module, Ticket-Chat, Roles Foundation, Invitations, Audit Trail  
Version: 1 - May 2026  
Target milestone: Day 1 to Day 8  
Payment milestone: $350 after validation

## 1. Purpose

This document converts the Phase 1 specification into a practical Milestone 1 build plan for vibe coding inside the current CRM Roberto codebase.

Milestone 1 must deliver a usable foundation where authenticated users can create and manage expenses, attach documents, discuss them through ticket-chat, and operate behind role-based access control and audit logging.

Milestone 2 is intentionally excluded except where Milestone 1 must prepare data structures for later dashboard, accountant portal, and super admin work.

## 2. Current Codebase Context

CRM Roberto is currently built with:

- Next.js 16 App Router with route handlers in `app/api`
- TypeScript and React 19
- MongoDB with Mongoose models in `db/models`
- Repository layer in `db/repository`
- Zod validators in `validators`
- JWT auth through HTTP-only cookies and `utils/middlewares/useMe.ts`
- shadcn/Radix-style UI components in `components/ui`
- S3 signed upload route at `app/api/upload/route.ts`
- Existing modules for clients, suppliers, invoices, notes, dashboard, notifications, onboarding, and admin
- Existing financial data mainly from invoices and payments

Important implementation rule: keep API authorization in route handlers and repository queries. UI role checks are helpful for hiding controls, but they are not security.

## 3. Milestone 1 Scope

Milestone 1 includes:

- Expense module with all five creation entry points:
  - Take photo
  - Import file
  - Email forward placeholder API foundation
  - Desktop drag and drop
  - Manual entry
- Draft and active expense lifecycle
- Full expense form fields
- Default categories and settings customization foundation
- Expense list, filters, search, sort, status badges
- File upload metadata for PDF, JPEG, PNG, HEIC
- Multiple attachments per expense
- Inline preview foundation for PDF and image attachments
- CRM links to client, supplier, invoice, and project placeholder
- Expense actions: create, edit, duplicate, archive, delete, mark as paid
- Ticket-chat system built from scratch
- Ticket messages with attachments
- Ticket status lifecycle and unread notifications
- Roles and permissions foundation enforced at API level
- Invitation-only user registration foundation
- Audit trail and modification history for expenses and key ticket/status events

Milestone 1 does not include:

- Accountant portal UI
- Financial dashboard charts
- Accounting export
- Bulk ZIP download
- Super Admin full interface
- 2FA implementation
- Production email ingestion server for forwarded emails
- Malware scanning implementation

Where those are referenced, create clean placeholders or extensible models only.

## 4. Milestone 1 Definition of Done

Milestone 1 is complete only when:

- Open signup is blocked or redirected to an invitation-only flow.
- Users have roles stored in the database.
- API routes enforce permissions server-side.
- Expenses can be created manually as active records.
- Expenses can be created as drafts from uploaded files, camera capture input, and drag/drop.
- Draft expenses are excluded from any financial summary endpoints created in this milestone.
- Required fields to activate a draft are enforced: amount, date, category, supplier.
- Expense list supports search, filters, sort, pagination, and status badges.
- Attachments are stored as metadata linked to expenses and ticket messages.
- Expense detail shows fields, attachments, linked tickets, and audit trail.
- Ticket-chat can be created from expense detail and from a global quick action.
- Ticket threads support replies, attachments, status changes, and unread notification records.
- Audit entries are created for create, update, archive, delete, duplicate, mark paid, and ticket status changes.
- `npm run lint` passes.
- `npm run build` passes or any existing unrelated failure is documented clearly.

## 5. Data and Security Decisions for Milestone 1

### 5.1 Company Isolation

The long-term specification requires company accounts. The current CRM appears user-scoped in many places. For Milestone 1, implement company isolation in a forward-compatible way:

- Add `companyId` where new models need isolation.
- If no company model exists yet, create a minimal `Company` model and attach users to it.
- Preserve existing user-owned flows by backfilling or deriving a default company for current users.
- Avoid breaking existing clients, suppliers, invoices, quotes, and onboarding during Milestone 1.

Recommended minimum:

- `Company`: name, slug, status, ownerUserId, createdAt, updatedAt
- `User`: role, companyId, invitedBy, invitationStatus, accessRevokedAt, forceLogoutAfter
- Existing records can continue using `user` until later migration, but new expenses/tickets should include both `user` or `createdBy` and `companyId`.

### 5.2 Money Storage

All new expense monetary fields must be stored as integer cents:

- `amountExclVatCents`
- `vatAmountCents`
- `amountInclVatCents`
- `amountPaidCents`
- `remainingBalanceCents` should be computed, not trusted from client payload

Frontend forms may display decimal values, but API validators convert safely to cents.

### 5.3 Roles

Milestone 1 should define all future roles, even if some are not fully used until Milestone 2:

- `super_admin`
- `administrator`
- `manager`
- `standard_user`
- `secretary`
- `technician`
- `read_only`
- `external_accountant`

Minimum Milestone 1 enforcement:

- Administrator: full access inside own company
- Manager: full expense and ticket access inside own company, delete allowed
- Standard user: own expenses and own/assigned tickets, no delete
- Secretary: expenses, clients, suppliers create/edit, no delete
- Read-only: view only according to allowed modules
- External accountant: no main CRM access in Milestone 1, reserved for portal in Milestone 2
- Super admin: reserved for Milestone 2 interface, but role value should exist

### 5.4 Audit Trail

Audit entries must be append-only by application convention. Do not expose update or delete routes for audit records.

New audit model fields:

- `entityType`: expense, invoice, supplier, user, ticket
- `entityId`
- `companyId`
- `action`: created, updated, deleted, archived, duplicated, status_changed, marked_paid
- `fieldName`
- `oldValue`
- `newValue`
- `performedBy`
- `performedAt`
- `ipAddress`
- `source`: ui, api, system

## 6. Sprint Overview

Milestone 1 is divided into six implementation sprints.

| Sprint | Target | Core Outcome |
|---|---|---|
| Sprint 1 | Day 1 | Roles, company foundation, invitation-only auth |
| Sprint 2 | Day 2 | Expense models, validators, repositories, categories, audit |
| Sprint 3 | Day 3-4 | Expense APIs, attachments, draft entry points |
| Sprint 4 | Day 5 | Expense frontend list, form, detail, actions |
| Sprint 5 | Day 6 | Ticket-chat backend, messages, attachments, notifications |
| Sprint 6 | Day 7-8 | Ticket-chat frontend, integrations, QA hardening |

Each sprint below has a backend prompt and frontend prompt. Use them in order. After each prompt, run lint/build or at minimum TypeScript and route sanity checks before moving on.

---

# Sprint 1 - Roles, Company Foundation, Invitation-Only Auth

## Goal

Create the access-control foundation before building financial modules. This prevents the new expenses and ticket APIs from being created with weak security.

## Backend Prompt

```text
You are working in the CRM Roberto Next.js 16 App Router codebase. Implement Sprint 1 backend: company foundation, roles, permissions, and invitation-only registration.

Context:
- Existing auth uses JWT HTTP-only cookies and `utils/middlewares/useMe.ts`.
- Existing users are stored in `db/models/User.ts`.
- Existing auth repository is in `db/repository/auth.ts`.
- Existing API routes use `getMe(true)` and return `{ success, message, data }` JSON shapes.
- Use MongoDB/Mongoose, Zod validators, and repository functions consistent with the repo.

Tasks:
1. Add a minimal `Company` Mongoose model in `db/models/Company.ts` with name, slug, status active/suspended, ownerUserId, timestamps, and useful indexes.
2. Extend `User` model with `companyId`, `role`, `invitationStatus`, `invitedBy`, `invitationTokenHash`, `invitationExpiresAt`, `accessRevokedAt`, `forceLogoutAfter`, `lastLoginAt`, `failedLoginCount`, and `lockedUntil`.
3. Define role and permission constants in a reusable server-safe file, for example `lib/permissions.ts`.
4. Add helpers like `requirePermission`, `canAccessModule`, or `assertRolePermission` that API routes can call after `getMe(true)`.
5. Update `AuthorizedUser` in `utils/middlewares/useMe.ts` and the underlying check middleware so route handlers receive role and companyId.
6. Update login logic to reject suspended, revoked, locked, and expired forced sessions. Keep existing email verification behavior working.
7. Create invitation token utilities using secure random tokens and hashed storage. Do not store raw invitation tokens.
8. Add API routes for administrators to invite users, list company users, revoke/suspend a user, and update a user's role. Use route paths that fit the repo, such as `app/api/settings/users` or `app/api/users/invitations`.
9. Add an invitation acceptance route that validates the token, lets the invited user set password, marks email verified, and activates the account.
10. Lock down open registration. Existing signup should no longer create unrestricted active accounts. It should either reject with a clear message or support only invitation token completion.
11. Preserve existing users by adding a fallback/default company creation path during login or via a safe repository helper. Do not break current local development.

Validation and security:
- API authorization must happen server-side.
- Do not expose invitation token hashes in responses.
- Use Zod validators for invitation and role update payloads.
- Keep changes compatible with strict TypeScript.
- Run `npm run lint` after implementation and fix issues caused by this sprint.

Deliverables:
- Company model
- Updated User model and auth types
- Permission helper module
- Invitation APIs
- Updated login/signup behavior
- Basic tests or manual verification notes in code comments only where useful
```

## Frontend Prompt

```text
You are working in the CRM Roberto frontend. Implement Sprint 1 frontend: invitation-only access and minimal role management UI.

Context:
- UI uses shadcn/Radix-style components from `components/ui`.
- App shell uses components like `components/crm-shell.tsx`, nav components, and dashboard routes.
- Existing signup/login pages live under `app/(auth)`.
- Keep the design dense, professional, and CRM-oriented. No marketing landing page.

Tasks:
1. Update signup UI so users understand registration is invitation-only. If an invitation token is present in the URL, show the acceptance form instead of normal signup.
2. Build an invitation acceptance form with name if needed, password, confirm password, and submit state.
3. Add a minimal company user management screen under settings, using existing layout patterns.
4. User management screen should allow administrator-level users to invite a user by email and assign a role.
5. Display current company users with role, status, invitation status, and actions: resend invitation placeholder, revoke/suspend, change role.
6. Hide or disable actions based on the current user's permissions, but assume backend is the source of truth.
7. Add useful loading, empty, and error states using existing UI primitives.
8. Add role labels in English/French if the current i18n pattern is nearby and simple to extend. Otherwise keep labels centralized for later i18n.
9. Ensure mobile layout works with table-to-card behavior or horizontal scroll consistent with existing pages.

Validation:
- Invitation acceptance works from a URL with token.
- Normal signup cannot create unrestricted accounts.
- User management page does not appear for unauthorized users.
- Lint passes.
```

## Sprint 1 Acceptance Checklist

- Existing admin user can continue logging in.
- Existing user gets or retains a company context.
- Open registration is blocked.
- Invitation token flow can create a new user.
- Role is visible on the user record returned by auth.
- Unauthorized API calls return 401 or 403 consistently.

---

# Sprint 2 - Expense Data Foundation, Categories, Audit Trail

## Goal

Create the backend data layer for expenses before building UI and upload flows.

## Backend Prompt

```text
Implement Sprint 2 backend for CRM Roberto: expense data models, category customization foundation, validators, repositories, and audit trail.

Context:
- Use Mongoose models in `db/models`.
- Use repositories in `db/repository`.
- Use Zod validators in `validators`.
- Monetary values must be stored as integer cents.
- Expenses must include `companyId` and `createdBy`.
- Draft expenses are not included in financial calculations.

Tasks:
1. Create `Expense` model with fields from the milestone spec:
   - companyId, status draft/active/archived
   - paymentStatus paid/unpaid/partial
   - amountExclVatCents, vatRate, vatAmountCents, amountInclVatCents
   - expenseDate, supplierId, categoryId
   - paymentMethod bank_transfer/card/cash/direct_debit/cheque
   - amountPaidCents, paidAt, dueDate
   - supplierRef, expenseType business/personal_reimbursable, notes
   - clientId, projectId nullable string/ObjectId placeholder, invoiceId
   - createdBy, updatedBy, archivedAt, deletedAt nullable for soft delete
2. Create `ExpenseCategory` model with companyId, name, slug, isDefault, isEnabled, sortOrder, timestamps.
3. Create `ExpenseAttachment` model with companyId, expenseId, uploadedBy, originalName, displayName, mimeType, extension, sizeBytes, storageKey, url, checksum optional, createdAt.
4. Create `AuditLog` model as append-only application data with fields in this document.
5. Add indexes for common filters: companyId/date, companyId/status, companyId/supplierId, companyId/categoryId, companyId/paymentStatus, expenseId attachments, entity audit logs.
6. Create constants for default categories: Fuel, Equipment & supplies, Subcontracting, Servers & hosting, Telecom, Advertising, Software & SaaS, Meals & entertainment, Travel, Rent & utilities, Insurance, Salaries & social charges, Miscellaneous.
7. Add repository functions to ensure default categories exist per company.
8. Add repository functions for expenses: createDraftFromAttachment, createManualExpense, listExpenses, getExpenseById, updateExpense, archiveExpense, softDeleteExpense, duplicateExpense, markExpensePaid.
9. Add amount calculation helpers: convert decimal input to cents, compute VAT amount, compute amount incl VAT, compute remaining balance. Do not trust client-calculated totals.
10. Add Zod validators for create manual expense, create draft, update expense, list query filters, category create/update, mark paid.
11. Add audit helper `recordAuditLog` and field-level diff helper for expense updates.
12. Ensure draft to active transition happens only when amount, date, category, and supplier are present.

Validation:
- Repository functions scope every query by companyId.
- Draft and archived/deleted records are handled explicitly.
- Validators reject invalid enum values and negative amounts.
- Lint passes.

Deliverables:
- Expense, ExpenseCategory, ExpenseAttachment, AuditLog models
- Expense/category/audit repositories
- Expense/category validators
- Default category seeding helper
```

## Frontend Prompt

```text
Implement Sprint 2 frontend foundation for expenses in CRM Roberto without building the full page yet.

Tasks:
1. Create frontend constants/types for expense statuses, payment statuses, payment methods, VAT rates, and expense types. Keep them aligned with backend enums.
2. Create API client helpers or hooks for expense categories and expense list/detail if the repo uses hooks for modules.
3. Add reusable expense UI primitives:
   - status badge for draft/paid/unpaid/partial/archived
   - money display helper that accepts cents
   - VAT rate label helper
   - attachment icon/preview trigger placeholder
4. Add a Settings section placeholder for expense categories if settings routes already exist. It should list categories, allow enable/disable, rename, and add category once APIs exist.
5. Keep all UI responsive and consistent with existing table/card patterns.

Validation:
- Components compile with strict TypeScript.
- No page navigation is broken.
- UI primitives are reusable by Sprint 4.
```

## Sprint 2 Acceptance Checklist

- Default categories can be created per company.
- Manual expense repository creates active expenses only with required fields.
- Draft repository can create incomplete expenses.
- Expense update logs field-level audit entries.
- No financial totals include drafts.

---

# Sprint 3 - Expense APIs, Attachments, Draft Entry Points

## Goal

Expose expense functionality through secure route handlers and support quick capture flows.

## Backend Prompt

```text
Implement Sprint 3 backend: secure expense API routes, attachment metadata, upload integration, and draft entry points.

Context:
- Existing upload route creates S3 presigned URLs at `app/api/upload/route.ts`.
- Use `getMe(true)` for authentication and the new permission helpers for authorization.
- Existing API style returns `NextResponse.json({ success, message, data })`.
- Keep file bytes uploaded through S3 signed URL; store metadata in MongoDB after upload.

Tasks:
1. Add `app/api/expenses/route.ts` with GET list and POST create manual expense.
2. Add `app/api/expenses/drafts/route.ts` for creating draft expenses from already-uploaded file metadata.
3. Add `app/api/expenses/[id]/route.ts` with GET detail, PATCH update, DELETE soft delete or archive according to action.
4. Add action routes or a single action endpoint for duplicate, archive, mark-paid, attach-file. Keep route names clear.
5. Add category routes under `app/api/expenses/categories` for list/create/update/disable.
6. Add attachment routes under `app/api/expenses/[id]/attachments` for metadata create/list/delete and download URL support if needed.
7. Update upload route or add a new upload presign wrapper to validate expense-supported file types: PDF, JPEG, PNG, HEIC. Enforce size limit from a constant.
8. Build automatic display naming logic: supplier_date_amount.ext once supplier/date/amount are known; otherwise preserve draft-friendly names until completed.
9. Add email-forward placeholder endpoint, for example `app/api/expenses/email-ingest/route.ts`, protected by an ingest secret. It should validate payload shape and create drafts from attachment metadata, but it does not need full mailbox integration in Milestone 1.
10. Add list filters: status, paymentStatus, categoryId, supplierId, period start/end, search, sortBy, sortOrder, page, limit.
11. Add list search across supplier name if easy with populate/aggregation, plus supplierRef and notes. If supplier name search is too expensive, document a TODO and search direct fields first.
12. Add audit logging for every action route.

Permissions:
- Administrator and manager can view/manage all company expenses.
- Standard user can view/manage own expenses only and cannot delete.
- Secretary can create/edit/archive but cannot delete.
- Read-only can view only.
- External accountant cannot access main CRM routes.

Validation:
- Unauthorized calls return 401.
- Authenticated but forbidden calls return 403.
- Invalid IDs return 404 or 400 consistently.
- Draft activation rules are enforced by backend.
- Lint passes.
```

## Frontend Prompt

```text
Implement Sprint 3 frontend capture flows for the Expenses module.

Context:
- Use existing shadcn/Radix components.
- Use lucide-react icons for actions.
- The first screen of the Expenses module should be the usable expense workspace, not a marketing page.

Tasks:
1. Add Expenses navigation entry in the app sidebar/nav using the existing navigation pattern.
2. Create `app/expenses/page.tsx` as a client page or server/client split consistent with existing modules.
3. At the top of the Expenses module, provide five creation entry points:
   - Take photo: mobile-friendly file input with `accept="image/*"` and camera capture where browser supports it.
   - Import file: file input for multiple PDF/images.
   - Forward email: show the dedicated email address placeholder and copy action. If backend account alias is not ready, clearly mark as setup pending but keep the UI slot.
   - Drag and drop: desktop drop zone for PDF/images, disabled or simplified on mobile.
   - Create manually: opens full expense form.
4. Implement upload flow using the existing S3 presign route or new expense presign wrapper, then call draft creation endpoint with metadata.
5. For multiple imported files, create one draft expense per file.
6. Show upload progress, success/failure state, retry action, and a link to open the created draft.
7. Validate file types before upload and show user-friendly errors.
8. Ensure drag and drop does not interfere with normal page scrolling.
9. Add empty state for no expenses and a loading state for draft creation.

Validation:
- Photo/import/drop creates draft expenses with attachments.
- Manual button opens the form created in Sprint 4 or a placeholder modal if Sprint 4 is not started yet.
- Mobile layout is touch-friendly.
- Lint passes.
```

## Sprint 3 Acceptance Checklist

- File upload creates attachment metadata.
- Each imported file creates one draft expense.
- Drafts appear in list API with status `draft`.
- Unsupported file types are rejected before and after upload.
- Email ingest placeholder exists and is protected.

---

# Sprint 4 - Expense Frontend List, Form, Detail, Actions

## Goal

Make the Expenses module usable end to end for manual entry, draft completion, review, and daily operations.

## Backend Prompt

```text
Implement Sprint 4 backend refinements needed by the expense UI.

Tasks:
1. Add any missing detail payload population for supplier, category, client, invoice, attachments, linked tickets, and audit logs.
2. Add quick inline supplier creation support for the expense form by reusing existing supplier APIs or adding a focused endpoint if needed.
3. Add endpoints or query params needed by select controls: supplier search, client search, invoice search, category list.
4. Make duplicate action copy expense fields and optionally attachments metadata according to the spec. Duplicated expense should be active if required fields are complete, otherwise draft.
5. Mark as paid action must require payment date and payment method, set paymentStatus to paid, set amountPaidCents to amountInclVatCents, and log audit.
6. Partial payment update must calculate remaining balance safely.
7. Archive should not remove audit trail or attachments.
8. Delete should be soft delete unless the repo already has a clear hard-delete pattern. Audit it.

Validation:
- Expense detail payload has everything needed for the page.
- All actions enforce permissions.
- Lint passes.
```

## Frontend Prompt

```text
Implement Sprint 4 frontend: complete Expenses module list, filters, form, detail view, and actions.

Context:
- Existing UI is dashboard-first and operational. Keep the expenses UI dense, scannable, and professional.
- Use existing table, badge, button, dialog, drawer, select, tabs, input, textarea components.
- Avoid nested cards and oversized marketing-style sections.

Tasks:
1. Build expense list view with columns: date, supplier, category, excl. VAT, VAT, incl. VAT, status, attachment, actions.
2. Add sorting by date, amount, supplier, and status.
3. Add filters: status, category, supplier, period.
4. Add instant search for supplier, amount, reference, and notes as supported by API.
5. Add status badges: Paid green, Unpaid red, Partial orange, Draft grey.
6. Build manual/full expense form with all fields:
   - Amount excl. VAT
   - VAT rate
   - Amount incl. VAT calculated preview
   - Expense date
   - Supplier select plus quick inline add
   - Category select
   - Payment method
   - Status paid/unpaid/partial
   - Amount already paid if partial
   - Remaining balance calculated preview
   - Due date optional
   - Supplier invoice reference
   - Type business/personal reimbursable
   - Internal notes
   - CRM links to client, project placeholder, invoice
7. Use the same form for editing a draft. Show required fields needed to activate the draft.
8. Build expense detail view with tabs or sections for fields, attachments, linked tickets, and modification history.
9. Attachment preview: show images inline with zoom dialog. Show PDFs in an iframe/object preview if allowed by browser, otherwise provide open/download action.
10. Add actions: edit, duplicate, archive, delete, mark as paid, create ticket.
11. Mark as paid should open a compact dialog asking payment date and method.
12. Make list and detail responsive. On mobile, prioritize date, supplier, total, status, and action menu.
13. Add loading, error, empty, and optimistic refresh states.

Validation:
- Manual expense can be created active.
- Draft expense can be completed and becomes active when required fields are filled.
- Draft badge is clear.
- Attachments preview without download when possible.
- Actions update list and detail without full page confusion.
- Lint passes.
```

## Sprint 4 Acceptance Checklist

- User can create, edit, duplicate, archive, delete, and mark paid.
- Expense detail shows modification history.
- Draft activation works from the UI.
- Filters and sorting work with pagination.
- Mobile workflow is usable.

---

# Sprint 5 - Ticket-Chat Backend, Attachments, Notifications

## Goal

Build ticket-chat from scratch as an internal messaging system, not on top of the existing Notes module.

## Backend Prompt

```text
Implement Sprint 5 backend: ticket-chat models, route handlers, message thread, attachments, statuses, and notifications.

Context:
- Existing Notes module is not suitable. Build new Ticket models.
- Existing Notification model supports reminder/recurrence types. Extend carefully or create ticket notification support compatible with the bell.
- Tickets must support links to expense, invoice, supplier, client, or null.
- Tickets must be company-scoped.

Tasks:
1. Create `Ticket` model with companyId, title, type accounting/validation/document/dispute, status open/waiting/replied/resolved/archived, createdBy, assignedTo array, linkedType, linkedId, unreadBy array, resolvedAt, archivedAt, timestamps.
2. Create `TicketMessage` model with companyId, ticketId, authorId, body, attachmentIds array or embedded metadata references, createdAt.
3. Create `TicketAttachment` model or reuse a generic attachment model if you intentionally created one. Support PDF/JPEG/PNG/HEIC metadata.
4. Add indexes for companyId/status, assignedTo/status, linkedType/linkedId, ticketId/createdAt.
5. Add Zod validators for create ticket, reply, status change, attachment metadata.
6. Add repository functions: createTicket, listTickets, getTicketThread, addTicketMessage, changeTicketStatus, markTicketRead, archiveResolvedOlderThan.
7. Add API routes:
   - `GET/POST app/api/tickets`
   - `GET app/api/tickets/[id]`
   - `POST app/api/tickets/[id]/messages`
   - `PATCH app/api/tickets/[id]/status`
   - `POST app/api/tickets/[id]/read`
   - `GET app/api/tickets/linked` or query params for linked entity tickets
8. Add route for creating ticket from an expense detail. This can be the same POST route with linkedType expense and linkedId.
9. Add notification records for new ticket, new reply, status resolved. Extend notification type enum safely.
10. Add email notification functions as a clean service wrapper. If email template work is too large, create the service and wire TODO-safe minimal email send using existing Nodemailer setup.
11. Add a cron/helper foundation for 48h no-reply reminders, but the full production scheduler can be completed in Milestone 2 if needed.
12. Audit ticket creation and status changes.

Status behavior:
- New ticket starts open.
- When author replies after assignment, set waiting if the reply is directed to assigned recipients.
- When assigned user replies, set replied.
- Resolved sets resolvedAt and notifies participants.
- Archived is manual or later automated after resolved +30 days.

Permissions:
- Administrator/manager can see all company tickets.
- Standard user sees tickets created by them or assigned to them.
- External accountant is reserved for portal routes later, but assigned accountant users should not access main CRM if role blocks it.

Validation:
- Ticket APIs cannot leak cross-company data.
- Attachments use the same file validation rules as expenses.
- Lint passes.
```

## Frontend Prompt

```text
Implement Sprint 5 frontend foundations for ticket-chat.

Tasks:
1. Add ticket types, statuses, labels, and badge components.
2. Add hooks/API helpers for listing tickets, creating tickets, loading a thread, replying, changing status, and marking read.
3. Add a global quick-create ticket button in the navigation bar or header using the existing layout pattern.
4. Build a reusable Create Ticket dialog with fields:
   - Title
   - Type
   - Text message
   - Attachments
   - Recipient selector from company users
   - Optional link: expense, invoice, supplier, client
5. Support prefilled linked entity data when opened from expense detail.
6. Build reusable attachment uploader for ticket messages using the same upload flow as expenses.
7. Add status badges and unread indicators for later list/thread UI.
8. Keep create dialog compact and usable on mobile.

Validation:
- A ticket can be created from the global button.
- A ticket can be created with an expense link.
- Attachments upload and associate with the initial message.
- Lint passes.
```

## Sprint 5 Acceptance Checklist

- Ticket can be created with assigned recipients.
- Ticket can be linked to an expense.
- Replies are chronological.
- Notifications are created for recipients.
- Ticket status changes are audited.

---

# Sprint 6 - Ticket UI, Expense Integration, QA Hardening

## Goal

Finish Milestone 1 by connecting tickets to expense detail, bell notifications, dashboard access points, and validation testing.

## Backend Prompt

```text
Implement Sprint 6 backend hardening and integration for Milestone 1 completion.

Tasks:
1. Add linked tickets payload to expense detail endpoint or provide a dedicated linked tickets endpoint used by expense detail.
2. Add unread ticket count to the notifications/bell API or sidebar badge API, using existing patterns in `hooks/useSidebarBadges.ts` and notification routes.
3. Add `My tickets` summary endpoint for dashboard widget foundation: open, waiting, unread counts.
4. Ensure smart action placeholder can count tickets with no reply for more than 48h if data exists.
5. Review every new route for authentication, permission checks, company scoping, validation, and consistent error responses.
6. Review all new models for indexes and safe enum values.
7. Add small repository-level tests if the repo has a test pattern. If not, add a manual QA checklist section to this markdown or a new QA note.
8. Run `npm run lint` and `npm run build`. Fix only issues introduced by Milestone 1 work.

Validation:
- No cross-company data reads.
- No route relies only on frontend authorization.
- Build is clean or unrelated failures are documented.
```

## Frontend Prompt

```text
Implement Sprint 6 frontend: ticket thread UI, linked tickets on expense detail, notification badges, and final QA polish.

Tasks:
1. Create tickets page with filters by status, assigned to me, created by me, linked entity, and search by title/body if backend supports it.
2. Build ticket thread view:
   - Header with title, type, status, participants, linked record
   - Chronological messages with date/time and author name
   - Attachments inline in each message
   - Reply composer with text and multiple attachments
   - Status control visible at top
   - Mark as resolved button
3. Integrate `Linked tickets` tab/section in expense detail.
4. Wire `Create a ticket` action from expense detail with prefilled title and linked expense.
5. Add unread ticket count to bell/sidebar if backend exposes it.
6. Add a small `My tickets` widget placeholder on the dashboard only if it fits existing dashboard block patterns. Otherwise leave a reusable component ready for Milestone 2.
7. Polish empty, loading, error, mobile, and narrow table states.
8. Run through the full Milestone 1 user flow and fix UI bugs:
   - create draft from file
   - complete draft
   - create manual expense
   - mark paid
   - create ticket from expense
   - reply to ticket
   - resolve ticket
   - view audit history

Validation:
- Ticket thread is usable on desktop and mobile.
- Expense detail shows linked tickets and audit history.
- Notification badges update after ticket creation/reply where supported.
- Lint passes.
```

## Sprint 6 Acceptance Checklist

- Ticket-chat is usable from global quick action and expense detail.
- Expense detail has linked tickets and modification history.
- Bell/sidebar badge includes unread tickets or a clean placeholder with backend endpoint ready.
- Full Milestone 1 QA flow passes.
- Lint and build are attempted and results documented.

---

## 7. Final Milestone 1 QA Script

Use this checklist before asking the tester to validate Milestone 1.

### Auth and Permissions

- Existing admin can log in.
- Open signup cannot create unrestricted account.
- Admin can invite a user.
- Invited user can accept invitation and set password.
- Standard user cannot delete an expense.
- Read-only user cannot create or edit expenses.
- Forbidden API calls return 403.

### Expenses

- Create manual active expense.
- Create draft from one uploaded PDF.
- Create drafts from multiple image uploads.
- Create draft from mobile camera input.
- Create draft from desktop drag/drop.
- Complete a draft with amount, date, category, supplier.
- Confirm completed draft becomes active.
- Confirm draft is visibly badged grey.
- Filter by status.
- Filter by category.
- Filter by supplier.
- Filter by period.
- Search by supplier/reference/notes.
- Sort by date, amount, supplier, status.
- Preview image attachment.
- Preview PDF attachment or open/download if inline preview is blocked.
- Duplicate expense.
- Archive expense.
- Delete expense according to role permission.
- Mark expense as paid with payment date and method.
- Partial payment shows remaining balance.

### Audit Trail

- Create logs audit entry.
- Edit logs changed fields with old/new values.
- Mark paid logs status/payment changes.
- Archive/delete logs action.
- Audit entries remain visible after archive.
- No UI allows audit edit/delete.

### Ticket-Chat

- Create ticket from expense detail.
- Create ticket from global quick action.
- Assign ticket to another user.
- Add initial attachment.
- Reply with text.
- Reply with attachment.
- Thread is chronological.
- Status changes open/waiting/replied/resolved.
- Mark resolved notifies participants where implemented.
- Linked ticket appears on expense detail.

### Regression

- Existing dashboard loads.
- Existing suppliers list still works.
- Existing invoices pages still load.
- Existing notifications bell still works.
- Existing upload route still works for prior modules.

## 8. UI End-to-End Testing Prompt

Use this prompt after Milestone 1 is implemented. It is written for a tester, QA agent, or UI automation agent that can run the app locally and evaluate the feature through the browser.

```text
You are testing CRM Roberto Milestone 1 end to end through the UI. Do not inspect code as the primary validation method. Use the browser like a real user and report every issue with the exact page, role, action, expected result, actual result, severity, and screenshot if possible.

Test environment:
- Start the app with `npm run dev`.
- Use the local app URL shown by Next.js.
- Test desktop width around 1440px and mobile width around 390px.
- Use seeded or manually created accounts for these roles: administrator, manager, standard user, secretary, read-only user.
- Prepare test files: one PDF, one JPEG, one PNG, one HEIC if supported by the device/browser, and one invalid file type such as `.txt`.

Core test flow:
1. Auth and invitation-only access
   - Open signup without invitation token and confirm unrestricted account creation is blocked.
   - Log in as administrator.
   - Invite a new standard user from settings/user management.
   - Accept invitation from the invitation link and set password.
   - Log in as invited user and confirm correct role and access.

2. Role and permission checks
   - As administrator, confirm expenses, tickets, settings user management, and audit history are accessible.
   - As standard user, confirm own expenses are accessible but delete is blocked.
   - As secretary, confirm create/edit is available but delete is blocked.
   - As read-only user, confirm create/edit/delete controls are hidden or disabled and API-backed actions fail safely.
   - Try direct navigation to forbidden pages and confirm the app shows a safe unauthorized/forbidden state.

3. Expense quick capture entry points
   - Open Expenses module.
   - Create a draft from Take photo or camera capture input.
   - Create one draft by importing a single PDF.
   - Create multiple drafts by importing multiple image/PDF files.
   - Create one draft by desktop drag and drop.
   - Open Forward email entry point and confirm the dedicated email/placeholder flow is clear and does not break the page.
   - Try uploading invalid file type and confirm validation error appears.

4. Draft lifecycle
   - Confirm captured expenses appear in list with grey Draft badge.
   - Open a draft and confirm attachment preview is available.
   - Fill required fields: amount, date, category, supplier.
   - Save and confirm status changes from Draft to Active.
   - Confirm missing required fields prevent activation with clear validation messages.

5. Manual expense form
   - Create a manual expense with amount excl. VAT, VAT rate, date, supplier, category, payment method, payment status, reference, type, and notes.
   - Confirm amount incl. VAT is calculated correctly.
   - Create a partial payment and confirm remaining balance is calculated.
   - Use quick inline supplier add and confirm the supplier appears in the selector.

6. Expense list, filters, and actions
   - Test list columns: date, supplier, category, excl. VAT, VAT, incl. VAT, status, attachment, actions.
   - Sort by date, amount, supplier, and status.
   - Filter by status, category, supplier, and period.
   - Search by supplier, amount, reference, and notes.
   - Duplicate an expense and confirm copied values are correct.
   - Mark an unpaid expense as paid with payment date and method.
   - Archive an expense and confirm it leaves default active list but audit history remains.
   - Delete an expense only with a role that is allowed to delete.

7. Attachments and previews
   - Upload multiple attachments to one expense.
   - Preview image attachment inline and zoom it.
   - Preview PDF inline if browser allows it, otherwise confirm open/download works.
   - Download an individual attachment.
   - Confirm attachment display names update when supplier/date/amount are known.

8. Ticket-chat
   - Create a ticket from an expense detail page.
   - Create a ticket from the global quick action.
   - Add title, type, message, recipient, optional link, and attachments.
   - Confirm ticket thread shows chronological messages with author and date/time.
   - Reply as recipient with text and attachment.
   - Change ticket status open/waiting/replied/resolved.
   - Mark ticket resolved and confirm participants are notified where notifications are implemented.
   - Confirm linked tickets appear on expense detail.

9. Notifications and badges
   - Confirm new ticket creates unread/bell/sidebar indication for recipient if implemented.
   - Confirm reply updates unread state for participants.
   - Confirm reading the ticket clears or reduces unread count according to implementation.

10. Audit trail
   - Open expense modification history.
   - Confirm create, update, duplicate, mark paid, archive, delete, and ticket status actions create audit records.
   - Confirm audit entries show field/action, old value, new value, author, and date/time.
   - Confirm there is no UI to edit or delete audit records.

11. Regression pass
   - Open dashboard, suppliers, invoices, notifications, and upload-dependent existing pages.
   - Confirm existing pages still load and basic interactions still work.

Mobile pass:
- Repeat the main expense capture, draft completion, manual form, ticket thread, and attachment preview flows on mobile width.
- Check that buttons are touch-friendly, dialogs fit the viewport, tables do not create broken overlap, and text does not overflow controls.

Final report format:
- Overall result: Pass / Pass with issues / Fail
- Tested roles:
- Tested browsers/devices:
- Blocking issues:
- Major issues:
- Minor issues:
- Missing requirements:
- Screenshots or reproduction notes:
- Recommendation: approve milestone / fix before approval
```

## 9. Suggested File Map

Likely new files:

- `db/models/Company.ts`
- `db/models/Expense.ts`
- `db/models/ExpenseCategory.ts`
- `db/models/ExpenseAttachment.ts`
- `db/models/AuditLog.ts`
- `db/models/Ticket.ts`
- `db/models/TicketMessage.ts`
- `db/models/TicketAttachment.ts`
- `db/repository/company.ts`
- `db/repository/expense.ts`
- `db/repository/expenseCategory.ts`
- `db/repository/audit.ts`
- `db/repository/ticket.ts`
- `validators/expense.schema.ts`
- `validators/ticket.schema.ts`
- `validators/invitation.schema.ts`
- `lib/permissions.ts`
- `lib/expense-calculations.ts`
- `lib/audit.ts`
- `app/api/expenses/route.ts`
- `app/api/expenses/[id]/route.ts`
- `app/api/expenses/drafts/route.ts`
- `app/api/expenses/categories/route.ts`
- `app/api/expenses/[id]/attachments/route.ts`
- `app/api/expenses/[id]/actions/route.ts`
- `app/api/tickets/route.ts`
- `app/api/tickets/[id]/route.ts`
- `app/api/tickets/[id]/messages/route.ts`
- `app/api/tickets/[id]/status/route.ts`
- `app/expenses/page.tsx`
- `app/expenses/[id]/page.tsx`
- `app/tickets/page.tsx`
- `app/tickets/[id]/page.tsx`
- `components/expenses/*`
- `components/tickets/*`
- `hooks/useExpenses.ts`
- `hooks/useExpenseDetail.ts`
- `hooks/useTickets.ts`

Likely existing files to update carefully:

- `db/models/User.ts`
- `db/models/Notification.ts`
- `db/repository/auth.ts`
- `utils/middlewares/useMe.ts`
- `utils/middlewares/checkMe.ts`
- `app/api/upload/route.ts`
- `components/app-sidebar.tsx`
- `components/nav-main.tsx`
- `components/notifications-bell.tsx`
- `hooks/useSidebarBadges.ts`
- `app/(auth)/signup/page.tsx`
- settings route/components if present

## 10. Notes for Vibe Coding Safely

- Work sprint by sprint. Do not ask the coding model to implement all Milestone 1 in one prompt.
- After each backend sprint, run lint before frontend work.
- Keep model changes additive and backward compatible where possible.
- Never store raw invitation tokens.
- Never trust client-side totals for money or VAT.
- Do not include draft expenses in financial calculations.
- Do not create ticket-chat on top of Notes.
- Do not expose external accountant main CRM access. Portal comes in Milestone 2.
- Prefer soft delete for financial records.
- Keep audit trail append-only.
- Add indexes as soon as models are created, not later.

## 11. Milestone 1 Handoff Summary

At the end of Milestone 1, prepare this short handoff for the tester:

```text
Milestone 1 delivered:
- Invitation-only access and role foundation
- Expense module with draft capture, manual entry, attachments, filters, actions, and audit history
- Ticket-chat with linked expense conversations, replies, attachments, statuses, and notifications
- Server-side permissions on new APIs
- Default expense categories and category settings foundation

Validation focus:
- Try to create an account without invitation
- Test every expense entry point
- Confirm draft expenses do not affect financial summaries
- Confirm users cannot perform actions outside their role
- Confirm audit history is created and cannot be edited
- Confirm ticket-chat works from expense detail and global quick action
```