# CRM Roberto - Milestone 2 Sprint Build Plan

Financial Dashboard, Accountant Portal, Accounting Exports, Super Admin, Advanced Permissions, Connection Logs  
Version: 1 - May 2026  
Target milestone: Day 9 to Day 15  

## 1. Purpose

This document converts Milestone 2 of the Phase 1 specification into a practical sprint-by-sprint build plan for vibe coding inside the current CRM Roberto codebase.

Milestone 2 builds on Milestone 1. It assumes the foundation already exists for expenses, tickets, roles, invitation-only users, audit logs, company isolation, and attachment metadata.

The goal is to deliver the financial intelligence layer, external accountant access, exports, super admin controls, advanced permission management, connection logs, and final QA hardening.

## 2. Current Codebase Context

CRM Roberto currently uses:

- Next.js 16 App Router with route handlers in `app/api`
- TypeScript and React 19
- MongoDB with Mongoose models in `db/models`
- Repository layer in `db/repository`
- Zod validators in `validators`
- JWT authentication through HTTP-only cookies and `utils/middlewares/useMe.ts`
- Existing dashboard page at `app/dashboard/page.tsx`
- Existing dashboard components in `components/dashboard`
- Existing sidebar badge hook in `hooks/useSidebarBadges.ts`
- Existing admin area in `app/admin`
- Existing settings routes in `app/settings`
- S3 signed upload support in `app/api/upload/route.ts`
- Recharts dependency already available for charts
- JSZip dependency already available for ZIP exports

Milestone 2 should reuse Milestone 1 models and services:

- `Company`
- `Expense`
- `ExpenseCategory`
- `ExpenseAttachment`
- `Ticket`
- `TicketMessage`
- `TicketAttachment`
- `AuditLog`
- role/permission helpers
- invitation and user management APIs

## 3. Milestone 2 Scope

Milestone 2 includes:

- Financial dashboard metrics:
  - total expenses by period
  - total revenue by period
  - gross profit
  - collected VAT
  - deductible VAT
  - VAT balance
- Dashboard charts:
  - expenses by category
  - 12-month trend
  - current month vs previous month comparison
  - top 5 suppliers by amount spent
- Smart alerts integrated into the existing dashboard smart actions block:
  - unpaid supplier invoices
  - overdue supplier invoices
  - ticket-chat with no reply for more than 48 hours
  - potential duplicate expenses
- `My expenses today` widget on the main dashboard
- Accountant portal with separate interface and restricted access
- Accountant portal dashboard with always-visible period selector
- Portal purchase invoices view from expenses
- Portal sales invoices view from invoices
- Portal ticket list, thread, replies, and resolve action
- Accounting export in CSV and XLSX-compatible format
- VAT summary export
- General ledger export
- Bulk attachment download as ZIP for purchase invoices
- Super Admin interface foundation:
  - company management
  - feature flags
  - audit log access
  - platform stats
  - support impersonation foundation with logging
  - platform notifications foundation
- Advanced role management UI and per-module permission matrix
- Connection logs with date, time, IP, device, user, company
- Final testing, stability improvements, and mobile QA pass

## 4. Milestone 2 Definition of Done

Milestone 2 is complete only when:

- Main dashboard shows real financial metrics for selected periods.
- Draft expenses are excluded from financial calculations.
- Archived expenses are excluded unless explicitly requested by an export/filter.
- Revenue and collected VAT use issued sales invoices.
- Expenses and deductible VAT use active purchase expenses.
- Smart alerts link directly to the relevant filtered views.
- Accountant can log in through a dedicated portal route and cannot access the main CRM.
- Accountant portal has dashboard, purchase invoices, sales invoices, tickets, and exports.
- Accountant portal is read-only for financial records, but can reply to assigned tickets and mark tickets resolved.
- CSV and Excel-compatible exports work with filters.
- Bulk ZIP download works for selected purchase invoice attachments.
- Super Admin can view companies, suspend/activate accounts, manage feature flags, and view audit logs.
- Super Admin actions are logged.
- Advanced role matrix can be edited by permitted administrators.
- Connection logs are recorded on login and visible to administrators.
- `npm run lint` passes.
- `npm run build` passes or unrelated pre-existing failures are documented clearly.

## 5. Data and Security Decisions for Milestone 2

### 5.1 Portal Isolation

The accountant portal must be separate from the main CRM interface.

Recommended route structure:

- Portal UI: `app/accountant-portal`
- Portal auth: `app/accountant-portal/login`
- Portal APIs: `app/api/accountant/*`

Security rules:

- External accountant role must not access main CRM routes.
- Main CRM users must not use accountant-only portal APIs unless explicitly allowed as administrator for setup/testing.
- Portal APIs must verify company access and accountant assignment.
- Portal sessions should use a separate cookie name from the main CRM session if possible.

### 5.2 Financial Calculation Rules

All calculations must use integer cents.

Expense side:

- Include only `status = active` expenses by default.
- Exclude `draft`, `archived`, and soft-deleted expenses by default.
- Deductible VAT comes from expense VAT amount.
- Unpaid purchase invoices are active expenses with payment status unpaid or partial.

Revenue side:

- Use issued sales invoices for selected period.
- Collected VAT comes from invoice VAT totals.
- Unpaid sales invoices are invoice statuses unpaid, partial paid, or overdue.

Gross profit:

- `grossProfitCents = revenueExclVatCents - expensesExclVatCents`
- If existing invoice totals are stored including VAT only, create a clear helper that derives or aggregates from available line item VAT fields consistently.

### 5.3 Exports

Export routes should stream or generate files server-side.

Required formats:

- CSV for accounting rows
- XLSX-compatible export
- VAT summary export
- General ledger export
- ZIP for selected attachments

The repo does not currently list an `xlsx` package. Options:

- Add a lightweight `xlsx` dependency if acceptable.
- Or generate CSV plus SpreadsheetML/XML or simple HTML table with `.xls` extension if dependency additions are avoided.

Preferred for professional delivery: install and use `xlsx` or a maintained Excel writer, then document the dependency.

### 5.4 Super Admin Security

Super Admin is platform owner access.

Minimum Milestone 2 security:

- Separate `/admin` or `/super-admin` area, consistent with existing `app/admin`.
- Super admin role required server-side.
- Every super admin action logs audit entry with IP and action description.
- 2FA should be implemented if feasible in this milestone. If time is limited, create the 2FA model/service foundation and block production enablement behind a feature flag/TODO note. The specification says mandatory, so prefer implementing TOTP if possible.

### 5.5 Connection Logs

Create a `ConnectionLog` model with:

- userId
- companyId
- role
- eventType: login_success, login_failed, logout, portal_login_success, portal_login_failed, force_logout
- ipAddress
- userAgent
- deviceLabel
- createdAt

Record logs for main login, portal login, failed attempts, and revocations/force logout.

---

# Sprint 1 - Financial Metrics Backend and Dashboard API

## Goal

Build the reliable financial calculation layer before chart and UI work.

## Backend Prompt

```text
You are working in CRM Roberto after Milestone 1 is complete. Implement Milestone 2 Sprint 1 backend: financial dashboard metrics, period filtering, VAT summaries, smart alert data, and dashboard API endpoints.

Context:
- Current dashboard repository is `db/repository/dashboard.ts`.
- Existing dashboard route handlers live under `app/api/dashboard`.
- Expenses from Milestone 1 store money as integer cents and include companyId/status/paymentStatus/categoryId/supplierId/dueDate.
- Invoices already exist in `db/models/Invoice.ts` and are user-scoped in current code. Bridge them carefully to company/user context without breaking existing invoice pages.
- Draft expenses must be excluded from financial calculations.

Tasks:
1. Create `lib/financial-periods.ts` with helpers for month, quarter, year, custom, and rolling 12 months. Store and compare dates consistently in UTC.
2. Create `db/repository/financialDashboard.ts` or extend `dashboard.ts` with company-scoped financial queries.
3. Implement metrics for selected period:
   - totalExpensesExclVatCents
   - totalExpensesVatCents
   - totalExpensesInclVatCents
   - totalRevenueExclVatCents
   - totalRevenueVatCents
   - totalRevenueInclVatCents
   - grossProfitCents
   - collectedVatCents
   - deductibleVatCents
   - vatBalanceCents
   - unpaidPurchaseCount and unpaidPurchaseTotalCents
   - unpaidSalesCount and unpaidSalesTotalCents
4. Implement chart datasets:
   - expensesByCategory
   - monthlyTrend for 12 rolling months
   - currentPeriodVsPreviousPeriod
   - topSuppliersBySpend limited to 5
5. Implement smart alert queries:
   - unpaid supplier invoices count/total
   - overdue supplier invoices by dueDate
   - tickets with no reply for more than 48 hours
   - potential duplicate expenses with same supplier and amount within 30 days
6. Implement `My expenses today` data:
   - expenses entered today count/total
   - supplier invoices due this week count/total
   - open tickets awaiting reply
7. Add route handlers under `app/api/dashboard/financial` and `app/api/dashboard/smart-alerts` or equivalent paths.
8. Enforce permission checks server-side: administrator/manager full company, standard user limited if applicable, read-only view only, external accountant blocked from main dashboard API.
9. Add caching only if it is safe and easy to invalidate. Otherwise keep queries optimized with indexes from Milestone 1.
10. Return consistent JSON shapes with `success`, `data`, and useful error messages.

Validation:
- Draft expenses are excluded.
- Archived/deleted expenses are excluded by default.
- Period filters work for month, quarter, year, custom.
- Empty data returns zeroed metrics and empty arrays, not errors.
- Lint passes.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 1 frontend foundation: financial dashboard hooks and reusable metric/chart components.

Context:
- Existing dashboard page is `app/dashboard/page.tsx`.
- Existing dashboard components live in `components/dashboard`.
- Recharts is available.
- UI should stay dense and operational, not marketing-style.

Tasks:
1. Create `hooks/useFinancialDashboard.ts` to fetch period-based financial metrics and chart datasets.
2. Create `hooks/useSmartAlerts.ts` or extend existing dashboard hook cleanly.
3. Create reusable period selector component supporting month, quarter, year, custom range.
4. Create financial metric components for expenses, revenue, gross profit, collected VAT, deductible VAT, VAT balance.
5. Create chart components:
   - expenses by category horizontal bar or pie chart
   - 12-month trend
   - month vs previous month comparison
   - top suppliers by spend
6. Create a reusable money formatting helper for cents.
7. Build loading, error, and empty states.
8. Do not fully rearrange dashboard yet unless necessary. Prepare components for Sprint 2 integration.

Validation:
- Components compile.
- Hook returns zero-safe data.
- Responsive behavior is stable on narrow screens.
- Lint passes.
```

## Sprint 1 Acceptance Checklist

- Financial dashboard endpoint returns period metrics.
- Chart endpoints/data return correct empty states.
- Draft expenses do not affect numbers.
- Smart alert data exists for dashboard integration.

---

# Sprint 2 - Main Dashboard Integration and Smart Alerts

## Goal

Integrate financial intelligence into the existing main dashboard and Expenses module entry points.

## Backend Prompt

```text
Implement Milestone 2 Sprint 2 backend integration for dashboard widgets, smart actions, and sidebar/bell badges.

Tasks:
1. Extend existing dashboard APIs so the main dashboard can load financial metrics without breaking current `useDashboard` consumers.
2. Add or extend sidebar badge API so ticket unread counts and expense alerts can be fetched with existing `hooks/useSidebarBadges.ts` patterns.
3. Add an endpoint for the `My expenses today` widget if not already included in Sprint 1.
4. Add direct-link filter metadata in smart alert responses so frontend can link to `/expenses` with query params.
5. Emit or reuse activity events so dashboard/badges refresh after expense or ticket changes.
6. Ensure smart alerts respect role scope and company isolation.

Validation:
- Existing dashboard stats still load.
- Existing quote/invoice sidebar badges still work.
- New ticket/expense counts do not break old badge shape.
- Lint passes.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 2 frontend: integrate financial dashboard, smart alerts, and My Expenses Today widget into the main dashboard.

Context:
- Dashboard layout supports customizable blocks in `app/dashboard/page.tsx`.
- Existing components include `PriorityActionsPanel`, `StatCards`, `CollectionWidget`, and others.

Tasks:
1. Add a Financial Overview block to the dashboard using the components from Sprint 1.
2. Add period selector visible for the financial block.
3. Integrate smart alerts into the existing Smart Actions/Priority Actions block:
   - unpaid supplier invoices
   - overdue supplier invoices
   - tickets with no reply over 48h
   - potential duplicates
4. Add `My expenses today` widget with:
   - expenses entered today count and total
   - supplier invoices due this week
   - open tickets awaiting reply
   - New quick expense button linking to the quick capture flow
5. Update dashboard customization block keys and local storage version safely so existing users do not lose layout unexpectedly.
6. Add ticket unread count and expense indicators to the bell/sidebar if backend data is available.
7. Ensure all new widgets are compact, responsive, and fit the existing dashboard visual language.

Validation:
- Dashboard loads with old and new blocks.
- Customization modal can show/hide/reorder new blocks.
- Smart alert links open filtered expenses/tickets views.
- Mobile layout does not overflow.
- Lint passes.
```

## Sprint 2 Acceptance Checklist

- Main dashboard shows financial overview.
- Smart actions include expense/ticket alerts.
- My expenses today widget works.
- Sidebar/bell badges include ticket unread count without breaking invoice/quote badges.

---

# Sprint 3 - Accountant Portal Auth, Dashboard, Purchase and Sales Views

## Goal

Create the dedicated external accountant interface with restricted data access.

## Backend Prompt

```text
Implement Milestone 2 Sprint 3 backend: accountant portal authentication, dashboard API, purchase invoices view, sales invoices view, and access logs.

Context:
- External accountant role was defined in Milestone 1.
- Accountant portal must be independent from the main CRM interface.
- Accountants cannot modify expenses or invoices.
- Accountants can view assigned company accounting data and portal tickets.

Tasks:
1. Create or extend accountant invitation flow from settings: administrator enters accountant email, system sends invitation or magic link.
2. Add portal auth route handlers under `app/api/accountant/auth/*` with separate cookie/session where feasible.
3. Add middleware or route helper `getAccountantSession` that validates portal sessions and company access.
4. Add connection logging for portal login success/failure.
5. Add accountant portal dashboard endpoint with period selector data:
   - revenue
   - total expenses
   - gross profit
   - collected VAT
   - deductible VAT
   - VAT balance
   - unpaid sales invoices count/total
   - unpaid purchase invoices count/total
   - open tickets addressed to accountant
6. Add purchase invoices endpoint from expenses with pagination, filters period/supplier/category/payment status, sorting, search, and attachment metadata.
7. Add sales invoices endpoint from invoices with pagination, filters, sorting, search, amount paid, remaining balance, and PDF download metadata.
8. Ensure portal endpoints are read-only for financial records.
9. Add attachment download support for portal purchase invoices, scoped to accountant's company.
10. Add administrator API to revoke accountant access.

Validation:
- Accountant cannot access main CRM APIs.
- Main CRM standard user cannot access accountant portal APIs.
- Portal financial data matches dashboard calculations for same period.
- Portal list filters and pagination work.
- Lint passes.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 3 frontend: accountant portal shell, login, dashboard, purchase invoices, and sales invoices.

Context:
- Portal must be separate from the main CRM. Do not reuse the full CRM sidebar if it exposes unrelated modules.
- Keep the UI read-only, dense, and accounting-focused.

Tasks:
1. Create accountant portal route group, for example `app/accountant-portal`.
2. Build portal login page for email/password or magic-link acceptance depending on backend implementation.
3. Build a minimal portal shell with navigation:
   - Dashboard
   - Purchase invoices
   - Sales invoices
   - Tickets
   - Exports
4. Add period selector always visible on portal dashboard.
5. Build portal dashboard metric cards for revenue, expenses, gross profit, VAT, unpaid invoices, and open tickets.
6. Build purchase invoices table with filters: period, supplier, category, payment status. Include attachment download icon.
7. Build sales invoices table with columns: date, client, invoice number, excl. VAT, VAT, incl. VAT, status, amount paid, remaining balance, PDF download.
8. Ensure all financial record actions are read-only in portal.
9. Add empty/loading/error states.
10. Make tables usable on mobile with horizontal scroll or compact cards.

Validation:
- Accountant can log in and see only portal routes.
- Portal dashboard data loads by period.
- Purchase and sales filters work.
- No edit/delete controls appear for accountant.
- Lint passes.
```

## Sprint 3 Acceptance Checklist

- Accountant portal is separate from main CRM.
- Accountant dashboard has required financial metrics.
- Purchase invoice view works from expenses.
- Sales invoice view works from invoices.
- Revoked accountant can no longer access portal.

---

# Sprint 4 - Portal Tickets, Accounting Exports, Bulk Downloads

## Goal

Finish accountant workflows: reply to tickets, resolve questions, export accounting files, and bulk download attachments.

## Backend Prompt

```text
Implement Milestone 2 Sprint 4 backend: accountant portal tickets, CSV/XLSX exports, VAT export, general ledger export, and ZIP download.

Context:
- Ticket-chat exists from Milestone 1.
- JSZip is already installed.
- XLSX dependency may need to be added if not present.

Tasks:
1. Add accountant portal ticket endpoints:
   - list tickets addressed to accountant
   - get thread
   - reply in thread
   - mark as resolved
   - list/download attachments
2. Ensure accountant can only access tickets assigned to them or their accountant company profile, scoped by company.
3. Add email notification to main CRM participants when accountant replies.
4. Add export endpoints under `app/api/accountant/exports`:
   - accounting rows CSV
   - accounting rows XLSX
   - VAT summary CSV/XLSX
   - general ledger CSV/XLSX
5. Export columns must include date, supplier/client, reference, category, excl. VAT, VAT, incl. VAT, status, type purchase/sale.
6. Add filters before export: type, period, status, category.
7. Add ZIP download endpoint for selected purchase invoice attachments using JSZip.
8. For large exports, keep memory use reasonable and enforce max row/attachment limits if needed.
9. Audit export actions and bulk downloads.
10. Return correct content types and filenames.

Validation:
- Portal accountant can reply to ticket and user receives notification.
- Portal accountant can resolve ticket.
- CSV opens with expected columns.
- XLSX export opens in Excel/LibreOffice if dependency implemented.
- ZIP contains selected attachment files or signed download links are handled clearly.
- Lint passes.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 4 frontend: accountant portal tickets, exports, and bulk attachment download.

Tasks:
1. Build portal tickets page with filters by status.
2. Build portal ticket thread UI using the same conversation patterns as the main CRM ticket-chat, but inside the portal shell.
3. Allow accountant to reply with text and attachments.
4. Allow accountant to mark a ticket resolved.
5. Build exports page with filters:
   - type purchase/sale/all
   - period
   - status
   - category
6. Add buttons for CSV export, Excel export, VAT summary, and general ledger export.
7. In purchase invoices view, add multiple selection and bulk ZIP download action.
8. Show export/download progress and user-friendly error states.
9. Keep controls touch-friendly and compact.

Validation:
- Portal ticket reply works.
- Portal resolved state updates.
- Export buttons download files.
- Bulk ZIP download works for selected purchase invoices with attachments.
- Lint passes.
```

## Sprint 4 Acceptance Checklist

- Accountant can handle assigned tickets fully.
- User is notified when accountant replies.
- Accounting CSV and Excel exports work.
- VAT summary and general ledger exports work.
- Bulk ZIP download works.

---

# Sprint 5 - Super Admin, Feature Flags, Advanced Role Matrix, Connection Logs

## Goal

Deliver platform control and permission management required for future commercialization.

## Backend Prompt

```text
Implement Milestone 2 Sprint 5 backend: Super Admin system, company management, feature flags, advanced role matrix, audit log access, connection logs, and support impersonation foundation.

Context:
- Existing `app/admin` area may be current admin login. Decide whether to extend it or create `app/super-admin` to avoid confusion with company administrator.
- Super Admin role exists from Milestone 1.
- All Super Admin actions must be authenticated and logged.

Tasks:
1. Add `ConnectionLog` model and repository if not already created. Log main CRM login, failed login, portal login, logout if available, force logout, revoke access.
2. Add feature flag fields to `Company` or create `CompanyFeature` model:
   - expenses
   - tickets
   - financialDashboard
   - accountantPortal
   - exports
   - advancedRoles
3. Add Super Admin API routes:
   - list companies
   - get company detail
   - create company
   - suspend/activate company
   - delete company only if safe; otherwise soft-delete/suspend
   - manage feature flags
   - view company users
   - view audit logs across companies
   - view connection logs
   - platform statistics
4. Add support impersonation foundation:
   - endpoint to start impersonation only for super admin
   - log impersonation start/stop with IP, target company, target user
   - visible UI indicator requirement in API response/session
   - do not allow destructive actions during impersonation unless explicitly designed
5. Add platform notification model or endpoint foundation for future platform/company messages.
6. Add advanced role matrix storage if fixed roles are not enough:
   - module key
   - canView/canCreate/canEdit/canDelete/canExport/canManage
   - companyId
   - role
7. Add administrator endpoints to edit role matrix for own company where allowed.
8. Enforce feature flags in relevant APIs or add helper that routes can call.
9. Implement TOTP 2FA for super admin if feasible. If not, create model fields and mark Super Admin area as requiring 2FA setup before production.

Validation:
- Non-super admin cannot call Super Admin APIs.
- Suspended company users cannot log in.
- Feature flags can disable module access server-side.
- Connection logs record expected events.
- Audit logs are readable but not editable/deletable.
- Lint passes.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 5 frontend: Super Admin interface, company management, feature flags, role matrix UI, and connection logs.

Tasks:
1. Create a distinct Super Admin route group or extend existing admin area with clear platform-owner navigation.
2. Build Super Admin dashboard with platform statistics:
   - company count
   - active users
   - active accountants
   - module usage summary
   - recent audit events
3. Build companies list with search, status filter, and actions.
4. Build company detail page with:
   - company info
   - users
   - feature flags
   - audit log preview
   - connection log preview
   - suspend/activate actions
5. Build feature flag toggles with confirmation for disabling major modules.
6. Build role matrix editor in settings for company administrators:
   - rows by module
   - columns view/create/edit/delete/export/manage
   - role selector
   - save/reset actions
7. Build connection logs table with filters by user, event type, period, IP/device search.
8. Build impersonation UI foundation only if backend supports it, with a strong visible banner while impersonating.
9. Keep dangerous actions behind confirmation dialogs.
10. Ensure unauthorized users do not see platform-owner navigation.

Validation:
- Super Admin can manage companies and flags.
- Company admin can edit allowed role matrix.
- Connection logs are readable.
- Feature-disabled modules are hidden and blocked by API.
- Lint passes.
```

## Sprint 5 Acceptance Checklist

- Super Admin platform area works.
- Company suspend/activate works.
- Feature flags work server-side and frontend-side.
- Advanced role matrix UI saves permissions.
- Connection logs are recorded and visible.
- Super Admin actions are audited.

---

# Sprint 6 - Final QA, Security Review, Mobile Stability, Performance Polish

## Goal

Finish the full MVP Phase 1 with a clean validation pass and quality bonus readiness.

## Backend Prompt

```text
Implement Milestone 2 Sprint 6 backend hardening and final QA for CRM Roberto Phase 1.

Tasks:
1. Review every new API route from Milestones 1 and 2 for authentication, authorization, company scoping, feature flags, validation, and consistent error responses.
2. Review all financial queries for correct handling of draft, archived, deleted, and partial payment records.
3. Review all export routes for permission checks and row/attachment limits.
4. Review file download routes for cross-company leakage risk.
5. Add missing indexes for slow filters:
   - expenses date/status/supplier/category/paymentStatus/company
   - tickets assigned/status/company/updatedAt
   - audit entity/company/performedAt
   - connection logs company/user/event/createdAt
6. Add dashboard query optimization or simple cache invalidation if needed.
7. Confirm all monetary calculations use integer cents for new modules.
8. Confirm audit logs are append-only through API design.
9. Add or update seed/helper scripts for initial Super Admin and default feature flags if required.
10. Run `npm run lint` and `npm run build`. Fix issues introduced by this phase.
11. Document any known limitation that should move to post-MVP, such as full mailbox ingestion or malware scanning.

Validation:
- No unauthenticated sensitive route.
- No cross-company data leaks in manual tests.
- Build and lint pass or unrelated failures are clearly documented.
```

## Frontend Prompt

```text
Implement Milestone 2 Sprint 6 frontend hardening, mobile QA, and final polish.

Tasks:
1. Test and polish responsive layouts for:
   - Expenses quick capture
   - Expense list/detail/form
   - Ticket list/thread
   - Main dashboard financial widgets
   - Accountant portal dashboard/lists/tickets/exports
   - Super Admin company/detail/log pages
   - Role matrix editor
2. Fix text overflow, button wrapping, table overflow, dialog height, and touch target issues.
3. Add final loading/error/empty states where missing.
4. Ensure destructive actions use confirmation dialogs.
5. Ensure read-only accountant views do not show edit/delete actions.
6. Ensure disabled feature flags hide or disable the right nav items and pages.
7. Confirm all links from smart alerts open the expected filtered page.
8. Run a final manual workflow from admin, standard user, accountant, and super admin perspectives.
9. Run `npm run lint` and `npm run build` and fix introduced issues.

Validation:
- Mobile UI is stable on narrow viewport.
- No overlapping text or controls.
- Portal remains separate from CRM shell.
- Feature flags and roles are reflected in navigation.
```

## Sprint 6 Acceptance Checklist

- Full Milestone 2 QA passes.
- Lint/build attempted and issues fixed or documented.
- Mobile QA pass completed.
- Permission edge cases tested.
- Final tester handoff is ready.

---

## 6. Final Milestone 2 QA Script

Use this checklist before asking the tester to validate Milestone 2.

### Financial Dashboard

- Select current month, quarter, year, and custom period.
- Confirm total expenses match active expenses only.
- Confirm draft expenses do not affect totals.
- Confirm total revenue matches issued invoices.
- Confirm gross profit equals revenue minus expenses.
- Confirm VAT balance equals collected VAT minus deductible VAT.
- Confirm expenses by category chart loads.
- Confirm 12-month trend loads.
- Confirm month vs previous month comparison loads.
- Confirm top 5 suppliers loads.
- Confirm empty state works when no data exists.

### Smart Alerts and Widgets

- Unpaid supplier invoice alert links to filtered expenses.
- Overdue supplier invoice alert links to filtered expenses.
- Ticket 48h alert links to filtered tickets.
- Duplicate expense alert links to matching expenses.
- My expenses today count and total are correct.
- Supplier invoices due this week are correct.
- Quick expense button opens capture flow.

### Accountant Portal

- Accountant invitation works.
- Accountant login works.
- Revoked accountant cannot log in.
- Accountant cannot access main CRM routes.
- Portal dashboard period selector works.
- Purchase invoices filters work.
- Sales invoices filters work.
- Attachment download works.
- Sales invoice PDF download works.
- Accountant cannot edit/delete expenses or invoices.
- Accountant can view assigned tickets.
- Accountant can reply to a ticket.
- Accountant can mark a ticket resolved.
- User receives notification after accountant reply.

### Exports

- Purchase/sale/all filter works.
- Period filter works.
- Status filter works.
- Category filter works.
- CSV export has correct columns.
- Excel export opens correctly.
- VAT summary export has collected, deductible, and balance rows.
- General ledger export is sorted by date.
- Bulk ZIP contains selected attachments.
- Export actions are audited.

### Super Admin

- Super Admin can log in to platform area.
- Non-super admin cannot access platform area.
- Company list loads.
- Company can be created.
- Company can be suspended and activated.
- Suspended company users cannot log in.
- Feature flags can be toggled.
- Disabled features are blocked by API and hidden in UI.
- Audit logs across companies are visible.
- Connection logs are visible.
- Impersonation, if implemented, is visibly indicated and logged.
- Super Admin actions are audited.

### Advanced Permissions

- Administrator can manage role matrix where allowed.
- Standard user cannot edit role matrix.
- Read-only role cannot create/edit/delete.
- Secretary cannot delete.
- Manager can view all expenses and tickets.
- External accountant remains portal-only.

### Regression

- Existing dashboard blocks still load.
- Existing clients page still loads.
- Existing suppliers page still loads.
- Existing quotes page still loads.
- Existing invoices page still loads.
- Existing Stripe/payment flows are not broken.
- Existing notifications bell still works.
- Existing onboarding state still works.

## 7. UI End-to-End Testing Prompt

Use this prompt after Milestone 2 is implemented. It is written for a tester, QA agent, or UI automation agent that can run the app locally and evaluate the feature through the browser.

```text
You are testing CRM Roberto Milestone 2 end to end through the UI. Do not inspect code as the primary validation method. Use the browser like a real user and report every issue with the exact page, role, action, expected result, actual result, severity, and screenshot if possible.

Test environment:
- Start the app with `npm run dev`.
- Use the local app URL shown by Next.js.
- Test desktop width around 1440px and mobile width around 390px.
- Use accounts for these roles: administrator, manager, standard user, read-only user, external accountant, super admin.
- Prepare realistic data: active expenses, draft expenses, archived expenses, paid/unpaid/partial expenses, overdue supplier invoices, sales invoices, clients, suppliers, categories, tickets, ticket replies, and attachments.
- Prepare export validation tools: spreadsheet app for CSV/XLSX, ZIP extractor, PDF/image viewer.

Core test flow:
1. Financial dashboard period metrics
   - Log in as administrator and open the main dashboard.
   - Select current month, quarter, year, and custom period.
   - Confirm total expenses include active expenses only.
   - Confirm draft expenses do not affect totals.
   - Confirm archived/deleted expenses are excluded from default totals.
   - Confirm total revenue matches issued sales invoices for the selected period.
   - Confirm gross profit equals revenue minus expenses.
   - Confirm collected VAT, deductible VAT, and VAT balance are correct.

2. Financial charts
   - Confirm expenses by category chart loads and matches category totals.
   - Confirm 12-month trend displays months in order.
   - Confirm current month vs previous month comparison is clear.
   - Confirm top 5 suppliers by spend is sorted correctly.
   - Test empty state by selecting a period with no data.

3. Smart alerts and dashboard widgets
   - Confirm unpaid supplier invoice alert count and total are correct.
   - Confirm overdue supplier invoice alert appears when due date is exceeded.
   - Confirm ticket with no reply for more than 48 hours appears.
   - Confirm potential duplicate expense appears for same supplier and amount within 30 days.
   - Click every alert and confirm it opens the correct filtered expenses or tickets view.
   - Confirm My expenses today count and total are correct.
   - Confirm supplier invoices due this week are correct.
   - Click New quick expense and confirm it opens the Milestone 1 capture flow.

4. Accountant invitation and portal isolation
   - As administrator, invite an external accountant from settings.
   - Accept the accountant invitation and log in through the accountant portal route.
   - Confirm accountant sees portal shell only, not the main CRM shell.
   - Try direct navigation to main CRM routes as accountant and confirm access is blocked.
   - Revoke accountant access and confirm portal login/session no longer works.

5. Accountant portal dashboard
   - Log in as accountant.
   - Use period selector for month, quarter, year, and custom range.
   - Confirm revenue, expenses, gross profit, collected VAT, deductible VAT, VAT balance, unpaid sales, unpaid purchases, and open ticket counters match admin dashboard data for the same company and period.

6. Portal purchase invoices view
   - Open Purchase invoices.
   - Filter by period, supplier, category, and payment status.
   - Sort by date, amount, supplier, and status.
   - Search by supplier, reference, and amount.
   - Download an attachment from the attachment icon.
   - Select multiple rows and download ZIP.
   - Confirm accountant cannot edit, delete, archive, or mark paid.

7. Portal sales invoices view
   - Open Sales invoices.
   - Filter and sort using available controls.
   - Confirm columns: date, client, invoice number, excl. VAT, VAT, incl. VAT, status, amount paid, remaining balance.
   - Download invoice PDF.
   - Confirm view is read-only.

8. Portal tickets
   - Open portal Tickets.
   - Filter by open, waiting, replied, resolved, archived.
   - Open a ticket addressed to the accountant.
   - Read messages and attachments inline.
   - Reply with text and attachment.
   - Mark ticket resolved.
   - Log back in as main CRM user and confirm reply notification and resolved state are visible.

9. Accounting exports
   - Open portal Exports.
   - Export purchase rows as CSV and confirm columns and values.
   - Export sales rows as CSV and confirm columns and values.
   - Export all rows as Excel and confirm file opens correctly.
   - Export VAT summary and confirm collected VAT, deductible VAT, and balance.
   - Export general ledger and confirm transactions are sorted by date.
   - Apply filters before export and confirm exported rows match the filters.

10. Super Admin platform controls
   - Log in as super admin.
   - Confirm non-super-admin users cannot access the super admin area.
   - Open platform dashboard and confirm company count, active users, module usage, and recent audit events load.
   - Create a company account.
   - Suspend and reactivate a company.
   - Confirm suspended company users cannot log in.
   - Toggle feature flags for a company and confirm disabled modules are hidden in UI and blocked by API.
   - View company audit logs and connection logs.
   - If impersonation exists, start and stop impersonation, confirm visible banner, and confirm logs are created.

11. Advanced role matrix and connection logs
   - As company administrator, open role matrix settings.
   - Edit permissions for a role and save.
   - Log in as that role and confirm navigation/actions reflect permissions.
   - Confirm forbidden direct actions fail safely.
   - Open connection logs and filter by user, event type, period, IP/device search.
   - Confirm login success, login failure, portal login, revoke, and force logout events are logged when applicable.

12. Regression pass
   - Confirm clients, suppliers, quotes, invoices, payments, notifications, onboarding, and Milestone 1 expense/ticket flows still work.
   - Confirm Stripe/payment flows are not affected by dashboard/portal additions.

Mobile pass:
- Repeat dashboard, accountant portal dashboard, purchase/sales tables, portal ticket thread, exports page, super admin company detail, and role matrix editor on mobile width.
- Check that tables scroll or convert cleanly, dialogs fit the viewport, buttons are touch-friendly, and no text overlaps.

Final report format:
- Overall result: Pass / Pass with issues / Fail
- Tested roles:
- Tested browsers/devices:
- Financial calculation notes:
- Export file checks:
- Blocking issues:
- Major issues:
- Minor issues:
- Missing requirements:
- Screenshots or reproduction notes:
- Recommendation: approve milestone / fix before approval / approve final bonus
```

## 8. Suggested File Map

Likely new files:

- `db/models/ConnectionLog.ts`
- `db/models/CompanyFeature.ts` or feature fields in `Company.ts`
- `db/models/RolePermission.ts`
- `db/repository/financialDashboard.ts`
- `db/repository/accountantPortal.ts`
- `db/repository/export.ts`
- `db/repository/connectionLog.ts`
- `db/repository/superAdmin.ts`
- `validators/accountant.schema.ts`
- `validators/export.schema.ts`
- `validators/role-permission.schema.ts`
- `validators/super-admin.schema.ts`
- `lib/financial-periods.ts`
- `lib/financial-calculations.ts`
- `lib/accounting-export.ts`
- `lib/connection-log.ts`
- `lib/feature-flags.ts`
- `app/api/dashboard/financial/route.ts`
- `app/api/dashboard/smart-alerts/route.ts`
- `app/api/accountant/auth/login/route.ts`
- `app/api/accountant/dashboard/route.ts`
- `app/api/accountant/purchases/route.ts`
- `app/api/accountant/sales/route.ts`
- `app/api/accountant/tickets/route.ts`
- `app/api/accountant/exports/route.ts`
- `app/api/accountant/downloads/zip/route.ts`
- `app/api/super-admin/companies/route.ts`
- `app/api/super-admin/audit-logs/route.ts`
- `app/api/super-admin/connection-logs/route.ts`
- `app/api/super-admin/platform-stats/route.ts`
- `app/accountant-portal/login/page.tsx`
- `app/accountant-portal/page.tsx`
- `app/accountant-portal/purchases/page.tsx`
- `app/accountant-portal/sales/page.tsx`
- `app/accountant-portal/tickets/page.tsx`
- `app/accountant-portal/exports/page.tsx`
- `app/super-admin/page.tsx`
- `app/super-admin/companies/page.tsx`
- `app/super-admin/companies/[id]/page.tsx`
- `components/dashboard/FinancialOverview.tsx`
- `components/dashboard/MyExpensesToday.tsx`
- `components/accountant-portal/*`
- `components/super-admin/*`
- `components/settings/RoleMatrixEditor.tsx`
- `hooks/useFinancialDashboard.ts`
- `hooks/useSmartAlerts.ts`
- `hooks/useAccountantPortal.ts`
- `hooks/useSuperAdmin.ts`

Likely existing files to update carefully:

- `app/dashboard/page.tsx`
- `components/dashboard/PriorityActionsPanel.tsx`
- `components/app-sidebar.tsx`
- `components/nav-main.tsx`
- `components/notifications-bell.tsx`
- `hooks/useSidebarBadges.ts`
- `db/repository/dashboard.ts`
- `db/models/Company.ts`
- `db/models/User.ts`
- `db/models/Notification.ts`
- `utils/middlewares/checkMe.ts`
- `utils/middlewares/useMe.ts`
- `proxy.ts` or middleware config if route protection lives there
- `app/settings/page.tsx`
- `app/admin/*` if reused for Super Admin

## 9. Notes for Vibe Coding Safely

- Complete Milestone 1 before starting Milestone 2.
- Do not build accountant portal routes inside the normal CRM shell.
- Do not let external accountants access main CRM APIs.
- Keep exports scoped by company and role.
- Keep all financial calculations in shared backend helpers.
- Never include draft expenses in dashboard totals.
- Prefer direct filtered links from alerts instead of vague navigation.
- Keep Super Admin actions logged from the first implementation.
- Treat impersonation as sensitive. Log it clearly and show a visible UI banner.
- Use server-side feature flag checks, not only hidden nav items.
- Run lint/build after every sprint.

## 10. Final Phase 1 Handoff Summary

At the end of Milestone 2, prepare this short handoff for the tester/client:

```text
Milestone 2 delivered:
- Financial dashboard with period metrics, VAT summary, charts, smart alerts, and My Expenses Today widget
- Dedicated accountant portal with independent access, purchase/sales views, tickets, exports, and bulk downloads
- CSV/Excel accounting exports, VAT summary, and general ledger export
- Super Admin platform controls for companies, feature flags, audit logs, connection logs, and support foundations
- Advanced role matrix and server-side feature enforcement
- Final mobile, security, permissions, and regression QA pass

Validation focus:
- Confirm dashboard totals exclude drafts and match active records
- Confirm accountant portal is isolated from main CRM
- Confirm accountant can reply to tickets but cannot modify financial records
- Confirm exports contain correct filtered rows
- Confirm Super Admin actions are logged
- Confirm role and feature restrictions are enforced by APIs
```