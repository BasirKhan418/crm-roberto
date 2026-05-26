# CRM Roberto - Milestone 2 Client-Aligned Vibe Coding Plan

Financial Dashboard, Accountant Portal, Accounting Exports, Super Admin, Advanced Roles, Connection Logs  
Version: 2 - May 2026  
Status: Recovery and alignment plan after Milestone 1 validation  

## 1. Why This Document Exists

Milestone 1 has been validated. The next work starts from the financial dashboard, but the earlier Milestone 2 prompt was too generic and drifted away from the final client requirement.

This document replaces the old Milestone 2 sprint prompt for vibe coding. It is written to match:

- the final CRM Roberto implementation document,
- the current repository structure,
- the work already implemented from the wrong prompt,
- the client-facing deliverable for Milestone 2,
- the need to start with the financial dashboard and move forward accurately.

Do not use this as a theoretical plan. Use it as the working prompt sequence for the next coding sessions.

## 2. Scope Decision For This Recovery Pass

The final client document includes Super Admin 2FA and platform-wide notifications. However, the current implementation and current instruction indicate that 2FA and admin/platform notification work should not be treated as the immediate coding target.

For this corrected Milestone 2 recovery pass:

- Include: financial dashboard, smart alerts, My Expenses Today, accountant portal, portal exports, portal tickets, Super Admin company controls, feature flags, role matrix, connection logs, audit logging, mobile QA, permission QA.
- Exclude from immediate build unless the client explicitly re-confirms: Super Admin 2FA/TOTP, support impersonation flow, platform-wide admin notification composer.
- Keep a clear known-limitation note if those excluded items remain absent at delivery.

If the client insists that 2FA and platform notifications are mandatory for payment, add the optional Sprint 6B at the end of this document before final QA.

## 3. Current Repo Reality Check

The repository already contains a lot of Milestone 2 work. Before coding more, verify and harden what exists.

Implemented or partly implemented:

- Main financial dashboard API: `app/api/dashboard/financial/route.ts`.
- Smart alerts API: `app/api/dashboard/smart-alerts/route.ts`.
- Financial repository: `db/repository/financial-dashboard.ts`.
- Period helper: `lib/financial-periods.ts`.
- Financial dashboard hook: `hooks/useFinancialDashboard.ts`.
- Smart alerts hook: `hooks/useSmartAlerts.ts`.
- Dashboard widgets: `components/dashboard/financial-overview.tsx`, `components/dashboard/financial-period-selector.tsx`, `components/dashboard/MyExpensesTodayWidget.tsx`.
- Accountant portal pages: `app/accountant-portal/*`.
- Accountant portal APIs: `app/api/accountant/*`.
- Accountant session cookie: `accountant-token`.
- Portal exports: accounting rows, VAT summary, general ledger, CSV/XLSX.
- ZIP download for purchase invoice attachments.
- Connection log model: `db/models/ConnectionLog.ts`.
- Super Admin area under `app/admin`, not `app/super-admin`.
- Admin APIs under `app/api/admin/*`.
- Feature flags on `Company.featureFlags`.
- Role matrix model and settings UI: `db/models/RoleMatrix.ts`, `app/settings/roles/page.tsx`.

Important implementation gaps or risk areas to verify:

- Financial calculations must exactly match client rules, not just return plausible totals.
- Draft, archived, and deleted expenses must be excluded from dashboard totals by default.
- Invoice revenue is still bridged through company users because invoices are user-scoped.
- Standard user scope must be tested carefully for own-only views.
- External accountant must never enter the normal CRM shell or normal CRM APIs.
- Portal financial record pages must remain read-only.
- Feature flags must block APIs, not only hide UI.
- Role matrix currently appears limited to users, expenses, tickets. The client matrix mentions more modules, so decide whether to expand now or document as current MVP limitation.
- Super Admin 2FA, impersonation, and platform notification foundation are not implemented in the visible current repo.

## 4. Client-Aligned Milestone 2 Definition Of Done

Milestone 2 is complete when the tester can validate these outcomes through the UI and APIs.

### 4.1 Financial Dashboard

- Main dashboard shows total expenses, total revenue, gross profit, collected VAT, deductible VAT, and VAT balance.
- Period selector supports current month, quarter, year, and custom range.
- Expenses use active purchase expenses only by default.
- Draft expenses never affect dashboard totals.
- Archived and soft-deleted expenses never affect normal dashboard totals.
- Revenue uses issued sales invoices for the selected period.
- All monetary values are calculated in cents.
- Charts are visible and stable: expenses by category, 12-month trend, current period versus previous period, top 5 suppliers.
- Empty periods show zero metrics and empty states, not errors.

### 4.2 Smart Alerts And My Expenses Today

- Smart Actions includes unpaid supplier invoices with count, total, and filtered link.
- Smart Actions includes overdue supplier invoices with count, total, and filtered link.
- Smart Actions includes ticket-chat items with no reply for more than 48 hours.
- Smart Actions includes potential duplicate expenses for same supplier and amount within 30 days.
- My Expenses Today shows expenses entered today, supplier invoices due this week, and open tickets awaiting reply.
- New Quick Expense button goes to the correct quick capture flow.

### 4.3 Accountant Portal

- Accountant portal is separate from the CRM shell.
- Accountant logs in through `/accountant-portal/login`.
- Accountant session uses the independent portal session cookie.
- External accountant cannot access `/dashboard`, `/expenses`, `/tickets`, `/settings`, or normal CRM APIs.
- Portal dashboard has always-visible period selector and the required financial metrics.
- Portal purchase invoices are read-only and support period, supplier, category, payment status, search, sort, attachment download, and ZIP download.
- Portal sales invoices are read-only and support required columns plus PDF download.
- Portal tickets show only assigned or accountant-scoped tickets.
- Accountant can reply to portal tickets and mark them resolved.
- Main CRM user is notified when accountant replies where ticket notifications are enabled.
- Revoked or suspended accountant cannot access portal.

### 4.4 Accounting Exports

- CSV and XLSX exports work for purchase, sale, and all rows.
- Exports include date, supplier/client, reference, category, excl. VAT, VAT, incl. VAT, status, and type.
- Filters apply before export: type, period, status, category.
- VAT summary includes collected VAT, deductible VAT, and balance.
- General ledger export is sorted by date and uses consistent accounting rows.
- Export and ZIP actions are audited.

### 4.5 Super Admin, Feature Flags, Roles, Logs

- Super Admin area is available under the existing `app/admin` route unless deliberately renamed.
- Admin auth is separate from normal CRM auth.
- Super Admin can view platform stats, companies, company detail, users, audit logs, connection logs, and feature flags.
- Super Admin can create a company, suspend a company, reactivate a company, and toggle feature flags.
- Suspended company users cannot log in.
- Feature-disabled modules are hidden in the UI and blocked server-side.
- Advanced role matrix can be edited by permitted company administrators when `advancedRoles` is enabled.
- Connection logs record login success, failed login, portal login, logout, revoke, and force logout where those flows exist.
- Super Admin actions are audited.

## 5. Data Rules That Must Drive The Code

Use these rules as the source of truth while coding and testing.

### 5.1 Expense Rules

- Financial dashboard includes only `status = active` expenses by default.
- Exclude `draft`, `archived`, and soft-deleted expenses from normal financial dashboard totals.
- Required fields to activate a draft remain amount, date, category, and supplier.
- Purchase VAT equals expense VAT amount.
- Unpaid purchase invoices are active expenses with payment status `unpaid` or `partial`.
- Partial purchase remaining amount equals amount incl. VAT minus amount already paid.

### 5.2 Invoice Rules

- Revenue uses issued sales invoices in the selected period.
- Collected VAT uses invoice VAT totals.
- Unpaid sales invoices include unpaid, partial paid, and overdue statuses.
- If invoice totals are stored per user, company scope must resolve all users in the company before aggregation.
- Never count draft or cancelled invoices as issued revenue unless the existing invoice model explicitly uses a different status convention and the client approves it.

### 5.3 Scope And Role Rules

- Super Admin sees all companies in the platform admin area only.
- Administrator sees and manages own company.
- Manager sees company financials and records.
- Standard user sees own expenses and own ticket scope where applicable.
- Read-only user can view allowed modules but cannot mutate data.
- External accountant is portal-only and read-only for financial records.
- API permissions are mandatory. UI hiding is not enough.

## 6. Recommended Vibe Coding Order

Do the remaining work as a recovery sequence, not as greenfield development.

1. Sprint 0: Audit current Milestone 2 implementation against the client requirement.
2. Sprint 1: Correct and harden financial dashboard calculations.
3. Sprint 2: Correct and polish dashboard UI, smart alerts, and My Expenses Today.
4. Sprint 3: Validate and harden accountant portal isolation and read-only financial views.
5. Sprint 4: Validate and harden accountant tickets, exports, and ZIP downloads.
6. Sprint 5: Validate and harden Super Admin, feature flags, role matrix, and connection logs.
7. Sprint 6: Final QA, mobile pass, permission pass, lint/build, and handoff notes.
8. Optional Sprint 6B: Add 2FA, impersonation, and platform notifications if client reconfirms they are in scope.

---

# Sprint 0 - Implementation Audit And Gap List

## Goal

Create a precise truth table of what is already implemented, what is wrong, and what must be fixed before new feature work continues.

## Vibe Coding Prompt

```text
You are working in CRM Roberto after Milestone 1 has been validated. Milestone 2 was partly implemented from a wrong prompt, so first perform a code audit against the final client requirements before writing new feature code.

Read these files first:
- docs/milestone-2-client-aligned-vibe-coding-plan.md
- app/api/dashboard/financial/route.ts
- app/api/dashboard/smart-alerts/route.ts
- db/repository/financial-dashboard.ts
- app/dashboard/page.tsx
- components/dashboard/financial-overview.tsx
- components/dashboard/MyExpensesTodayWidget.tsx
- app/api/accountant/**
- app/accountant-portal/**
- app/api/admin/**
- app/admin/**
- lib/company-features.ts
- lib/permissions.ts
- lib/role-matrix.ts
- db/models/ConnectionLog.ts
- db/models/RoleMatrix.ts

Create a concise audit note in docs/milestone-2-current-gap-audit.md with these sections:
1. Already implemented and usable.
2. Implemented but needs verification.
3. Implemented but likely misaligned with client requirement.
4. Missing but required for Milestone 2.
5. Explicitly out of immediate scope unless client reconfirms: 2FA, impersonation, platform notifications.
6. Exact next coding tasks ordered by risk.

Do not refactor code during this audit unless you find a blocking compile error. The output must be practical enough for the next sprint prompt.
```

## Acceptance Checklist

- Gap audit exists and names exact files/routes.
- The audit distinguishes missing work from already implemented work.
- The audit confirms whether financial dashboard is ready to harden first.

---

# Sprint 1 - Financial Dashboard Calculation Hardening

## Goal

Make the financial dashboard mathematically correct according to the client requirement.

## Backend Prompt

```text
Implement Sprint 1 hardening for CRM Roberto Milestone 2 financial dashboard.

Context:
- Milestone 1 is validated.
- Existing financial code lives in db/repository/financial-dashboard.ts.
- Existing routes are app/api/dashboard/financial/route.ts and app/api/dashboard/smart-alerts/route.ts.
- Period helpers live in lib/financial-periods.ts.
- Client requirement: dashboard totals must be real financial totals, not approximate activity counters.

Tasks:
1. Audit all expense aggregation filters.
   - Include only company-scoped active expenses by default.
   - Exclude draft expenses always.
   - Exclude archived expenses by default.
   - Exclude soft-deleted expenses if the model has deletedAt or equivalent.
   - Respect standard_user own scope if current permission design requires it.
2. Audit invoice revenue aggregation.
   - Use issued sales invoices only.
   - Exclude draft, cancelled, deleted, or void invoices if such statuses exist.
   - If Invoice is user-scoped, collect company user IDs safely and query by those users.
   - Confirm totalExcludingTax, totalVat, totalIncludingTax are all integer cents or convert consistently.
3. Verify the formulas:
   - grossProfitCents = totalRevenueExclVatCents - totalExpensesExclVatCents.
   - collectedVatCents = totalRevenueVatCents.
   - deductibleVatCents = totalExpensesVatCents.
   - vatBalanceCents = collectedVatCents - deductibleVatCents.
4. Verify unpaid counters:
   - unpaidPurchaseCount and unpaidPurchaseTotalCents use active unpaid or partial expenses.
   - unpaidSalesCount and unpaidSalesTotalCents use unpaid, partial paid, or overdue issued invoices.
5. Verify chart datasets:
   - expensesByCategory groups by category and returns label, count, totalCents.
   - monthlyTrend returns the last 12 months in chronological order.
   - currentPeriodVsPreviousPeriod uses equal-length previous period.
   - topSuppliersBySpend returns top 5 by amount incl. VAT or the amount the UI labels clearly.
6. Verify smart alerts:
   - unpaid supplier invoices link to /expenses with supported query params.
   - overdue supplier invoices use dueDate < today and paymentStatus unpaid or partial.
   - ticketsWithoutReply48h uses the ticket reminder/no-reply logic from the ticket repository.
   - duplicate expenses use same supplier and same amount within 30 days, active only.
7. Keep response shape stable:
   - { success: true, data } on success.
   - { success: false, message } with correct status on error.
8. Do not add caching until correctness is confirmed.

Validation:
- Run npm run lint.
- Run npm run build if the change touches shared types or route compilation.
- Manually test the API with empty data, draft expense, active expense, archived expense, and issued invoice if seed data is available.
```

## Frontend Prompt

```text
Harden the existing financial dashboard frontend without redesigning the full dashboard.

Context:
- Existing dashboard page is app/dashboard/page.tsx.
- Existing components include components/dashboard/financial-overview.tsx and components/dashboard/financial-period-selector.tsx.
- Existing hook is hooks/useFinancialDashboard.ts.

Tasks:
1. Confirm the period selector exposes month, quarter, year, and custom range.
2. Confirm metric labels match the client terms exactly:
   - Total expenses
   - Total revenue
   - Gross profit
   - Collected VAT
   - Deductible VAT
   - VAT balance
3. Confirm charts are visible, compact, and operational:
   - expenses by category
   - 12-month trend
   - current period versus previous period
   - top 5 suppliers
4. Confirm money formatting uses cents and never floating point display math.
5. Add or fix empty, loading, and error states.
6. Keep the UI dense and CRM-like, not marketing-style.
7. Check mobile width around 390px for overflow.

Validation:
- Dashboard loads with and without financial data.
- Period changes trigger correct refetch.
- No chart or table overflows on mobile.
- npm run lint passes.
```

## Acceptance Checklist

- Dashboard totals match active expense and issued invoice records.
- Draft expenses do not affect totals.
- Archived/deleted expenses do not affect normal totals.
- VAT balance is correct.
- Empty states work.

---

# Sprint 2 - Dashboard Integration, Smart Alerts, My Expenses Today

## Goal

Make the dashboard useful for the client, with smart operational links and no broken old widgets.

## Prompt

```text
Implement Sprint 2 dashboard integration polish for CRM Roberto Milestone 2.

Context:
- Financial dashboard backend should now be correct.
- Existing Smart Actions/Priority Actions component is components/dashboard/PriorityActionsPanel.tsx.
- Existing sidebar badges hook is hooks/useSidebarBadges.ts.
- Existing My Expenses Today component is components/dashboard/MyExpensesTodayWidget.tsx.

Tasks:
1. Confirm Financial Overview appears on the main dashboard by default for roles allowed to view it.
2. Confirm existing dashboard blocks still load: stats, collections, quotes, invoices, tickets, activities.
3. Integrate or verify Smart Actions entries:
   - unpaid supplier invoices
   - overdue supplier invoices
   - ticket-chat with no reply over 48 hours
   - potential duplicate expenses
4. Every alert must link directly to the relevant filtered page using query params that the destination page actually supports.
5. Verify My Expenses Today:
   - expenses entered today count and total
   - supplier invoices due this week count and total
   - open tickets awaiting reply
   - New quick expense button to the correct quick capture entry point
6. Confirm dashboard customization/local storage keys do not break existing saved layouts.
7. Confirm feature flag financialDashboard hides/blocks financial dashboard where disabled.
8. Confirm external_accountant cannot access the normal dashboard and is redirected to the portal login.
9. Polish mobile layout for the financial block and My Expenses Today.

Validation:
- Admin, manager, standard user, read-only user, and external accountant are tested.
- Smart alert links open correct filtered pages.
- Existing dashboard widgets remain stable.
- npm run lint passes.
```

## Acceptance Checklist

- Financial block is visible and useful.
- Smart alerts are actionable.
- My Expenses Today works.
- Old dashboard behavior is not broken.

---

# Sprint 3 - Accountant Portal Isolation And Financial Views

## Goal

Make the accountant portal match the client requirement exactly: separate, read-only, scoped, and accounting-focused.

## Backend Prompt

```text
Harden Sprint 3 accountant portal backend for CRM Roberto Milestone 2.

Context:
- Portal pages already exist under app/accountant-portal.
- Portal APIs already exist under app/api/accountant.
- Portal session uses accountant-token.
- External accountant must be portal-only.

Tasks:
1. Verify accountant auth routes:
   - login accepts only external_accountant users.
   - login rejects suspended users.
   - login rejects suspended companies.
   - login rejects disabled accountantPortal feature flag.
   - logout clears accountant-token and logs logout.
2. Verify portal session helper or shared checks:
   - every app/api/accountant route requires accountant-token.
   - no normal CRM token is accepted for portal-only APIs unless deliberately documented for admin testing.
   - companyId is always derived from session, never trusted from request body.
3. Verify portal dashboard:
   - reuses the financial calculation engine safely.
   - allows external accountant only inside portal.
   - returns same metrics as admin dashboard for the same company and period when scope is company-wide.
4. Verify purchase invoices endpoint:
   - read-only.
   - active expenses only unless a specific status filter is requested and allowed.
   - filters: period, supplier, category, payment status.
   - search: supplier, reference, amount.
   - pagination and sorting are present.
   - attachment metadata is scoped by company.
5. Verify sales invoices endpoint:
   - read-only.
   - company users are resolved safely if invoices are user-scoped.
   - filters, search, pagination, sorting work.
   - PDF download is scoped and cannot leak cross-company invoices.
6. Verify administrator revoke flow for external accountant access if it exists. If not, add it through existing settings user revoke/suspend flow.
7. Verify connection logs for portal login success, failed login, and logout.

Validation:
- Accountant cannot access normal CRM APIs.
- Normal user cannot access accountant APIs.
- Portal dashboard matches admin dashboard totals.
- Portal financial views do not expose edit/delete/pay/archive actions.
- npm run lint passes.
```

## Frontend Prompt

```text
Harden Sprint 3 accountant portal UI for CRM Roberto Milestone 2.

Tasks:
1. Verify portal shell is separate from CRM shell and does not show CRM sidebar/nav.
2. Verify portal login page redirects already-authenticated accountants to /accountant-portal.
3. Verify portal dashboard has always-visible period selector.
4. Verify dashboard metrics are visible:
   - revenue
   - total expenses
   - gross profit
   - collected VAT
   - deductible VAT
   - VAT balance
   - unpaid sales invoices
   - unpaid purchase invoices
   - open accountant tickets
5. Verify purchase invoices page has filters, search, sort, pagination, attachment download, and no edit controls.
6. Verify sales invoices page has required columns and PDF download, with no edit controls.
7. Polish mobile behavior with horizontal table scroll or compact cards.
8. Keep UI dense, accounting-focused, and clear.

Validation:
- Accountant can log in and use only portal routes.
- Revoked/suspended accountant loses access.
- Financial record pages are read-only.
- npm run lint passes.
```

## Acceptance Checklist

- Portal is isolated.
- Portal dashboard works.
- Purchase and sales views work and are read-only.
- Access logs are created.

---

# Sprint 4 - Accountant Tickets, Exports, ZIP Downloads

## Goal

Complete accountant workflows: answer accounting questions, export rows, and download attachments.

## Prompt

```text
Harden Sprint 4 accountant tickets and exports for CRM Roberto Milestone 2.

Context:
- Portal ticket APIs and pages already exist.
- Export APIs already exist under app/api/accountant/exports.
- ZIP endpoint exists under app/api/accountant/purchase-invoices/attachments-zip.
- xlsx is installed.

Tasks:
1. Verify portal tickets:
   - list only assigned/accountant-scoped tickets.
   - filters by status work.
   - ticket detail shows chronological thread.
   - attachments preview/download are scoped.
   - accountant can reply with text and attachments.
   - accountant can mark resolved.
   - replies create notification/email for main CRM participants where existing ticket notifications support it.
2. Verify export endpoints:
   - accounting rows CSV and XLSX.
   - VAT summary CSV and XLSX.
   - general ledger CSV and XLSX.
   - content types and filenames are correct.
   - filters apply before export: type, period, status, category.
   - row limits or safe memory behavior exist.
3. Verify export columns exactly:
   - date
   - supplier/client
   - reference
   - category
   - excl. VAT
   - VAT
   - incl. VAT
   - status
   - type purchase/sale
4. Verify ZIP endpoint:
   - only selected purchase invoice attachments.
   - max selected expenses and max attachment files enforced.
   - no cross-company file leakage.
   - failures are represented clearly in the ZIP readme or API error.
5. Verify audit logging:
   - exports are recorded as report exported.
   - ZIP downloads are recorded as report downloaded.
6. Polish portal exports UI:
   - filters are clear.
   - buttons trigger blob download.
   - API errors are shown in toasts.
   - mobile layout does not overflow.

Validation:
- Accountant can reply and resolve a ticket.
- User can see notification/reply in main CRM.
- CSV opens with correct columns.
- XLSX opens in spreadsheet app.
- ZIP contains expected files.
- npm run lint passes.
```

## Acceptance Checklist

- Ticket workflow works from portal.
- CSV/XLSX exports work.
- VAT summary and general ledger work.
- Bulk ZIP works.
- Export/download audit logs exist.

---

# Sprint 5 - Super Admin, Feature Flags, Role Matrix, Connection Logs

## Goal

Make platform controls trustworthy enough for client validation, using the existing `app/admin` area unless you intentionally migrate routes.

## Prompt

```text
Harden Sprint 5 Super Admin and permission systems for CRM Roberto Milestone 2.

Context:
- Existing platform admin area is app/admin, with APIs under app/api/admin.
- Existing admin auth uses admin-token and Admin model.
- Company feature flags exist on Company.featureFlags.
- Role matrix exists with RoleMatrix model and settings roles page.
- ConnectionLog model exists.

Tasks:
1. Verify Super Admin auth:
   - app/admin pages require admin-token.
   - app/api/admin routes require admin session and DB-backed admin existence.
   - normal CRM users cannot access admin APIs.
2. Verify platform dashboard:
   - company count.
   - active companies.
   - active users.
   - active accountants.
   - module usage summary.
   - recent audit events.
3. Verify companies list:
   - search.
   - status filter.
   - active/suspended badges.
   - owner/user summary.
4. Verify company detail:
   - company info.
   - users list.
   - feature flags toggles.
   - audit log preview.
   - connection log preview.
   - suspend/activate actions with confirmation.
5. Verify feature flags server-side:
   - expenses flag blocks sensitive expense APIs where applicable.
   - tickets flag blocks ticket APIs where applicable.
   - financialDashboard flag blocks dashboard financial APIs.
   - accountantPortal flag blocks portal login/dashboard.
   - exports flag blocks accountant export endpoints and hides export nav.
   - advancedRoles flag controls role matrix UI/API.
6. Verify role matrix:
   - administrator can load and save matrix when advancedRoles is enabled.
   - standard user cannot load or save it.
   - saved matrix affects API permission checks where role-matrix helper is wired.
   - If current matrix only covers users, expenses, and tickets, document this as MVP scope or expand to invoices, clients, suppliers, financial dashboard, settings, audit trail.
7. Verify connection logs:
   - main login success.
   - main login failed.
   - logout if available.
   - portal login success.
   - portal login failed.
   - revoke access/force logout where available.
   - filters by event type, company, period, IP/device search.
8. Verify audit logging:
   - company create.
   - company suspend/activate.
   - feature flag update.
   - export/download actions.
9. Do not implement Super Admin 2FA, support impersonation, or platform notifications in this sprint unless the client has explicitly reconfirmed them for this milestone.

Validation:
- Non-admin cannot access app/admin or app/api/admin.
- Suspended company users cannot log in.
- Feature flags block APIs server-side.
- Role matrix saves and affects permissions where intended.
- npm run lint passes.
```

## Acceptance Checklist

- Super Admin platform area works.
- Feature flags work in UI and API.
- Role matrix works or limitation is documented.
- Connection logs are visible.
- Admin actions are audited.

---

# Sprint 6 - Final QA, Mobile, Security, Handoff

## Goal

Get Milestone 2 ready for student tester validation and client payment release.

## Prompt

```text
Run final Milestone 2 hardening for CRM Roberto.

Tasks:
1. Run npm run lint and fix introduced issues.
2. Run npm run build and fix introduced issues where related to Milestone 2.
3. Review every new/modified API route for:
   - authentication
   - authorization
   - company scoping
   - feature flag enforcement
   - input validation
   - no cross-company leakage
   - consistent error responses
4. Review all financial queries for:
   - draft exclusion
   - archived/deleted exclusion
   - issued invoice revenue only
   - partial payment handling
   - integer cents math
5. Review all download/export routes for:
   - portal session only
   - company scope
   - row/file limits
   - audit logging
6. Manual desktop QA at around 1440px:
   - main financial dashboard
   - smart alerts
   - My Expenses Today
   - accountant portal dashboard
   - purchase invoices
   - sales invoices
   - portal tickets
   - portal exports
   - admin dashboard
   - company detail
   - role matrix
   - connection logs
7. Manual mobile QA at around 390px:
   - no text overlap
   - no broken buttons
   - tables scroll or adapt
   - dialogs fit viewport
   - touch targets are usable
8. Regression QA:
   - clients
   - suppliers
   - quotes
   - invoices
   - payments/Stripe where practical
   - notifications bell
   - onboarding
   - Milestone 1 expenses and tickets
9. Create docs/milestone-2-final-handoff.md with:
   - delivered features
   - tested roles
   - commands run
   - known limitations
   - tester focus checklist

Validation:
- lint attempted and result documented.
- build attempted and result documented.
- known limitations are explicit, especially if 2FA/impersonation/platform notifications are excluded.
```

## Acceptance Checklist

- No obvious mobile breakage.
- No known permission leak.
- Lint/build results are known.
- Final handoff exists.

---

# Optional Sprint 6B - Only If Client Reconfirms These Items

## Use This Only If Required

The current recovery pass excludes these from immediate implementation unless the client explicitly confirms they are required for Milestone 2 payment.

## Prompt

```text
Implement optional Milestone 2 security/platform additions only after client reconfirmation.

Tasks:
1. Super Admin 2FA/TOTP:
   - add encrypted TOTP secret fields to Admin model or a dedicated AdminSecurity model.
   - add setup endpoint, verify endpoint, disable/reset endpoint.
   - require 2FA verification before admin-token becomes fully privileged.
   - add recovery/admin reset process if needed.
   - audit setup, verification failure, reset, disable.
2. Support impersonation:
   - start impersonation endpoint for Super Admin only.
   - stop impersonation endpoint.
   - visible UI banner during impersonation.
   - block destructive actions while impersonating unless explicitly allowed.
   - log impersonation start/stop with IP, target company, target user.
3. Platform notifications:
   - model for platform/company notification message.
   - admin UI to send to all companies or one company.
   - delivery to Notification model or a dedicated platform notification list.
   - audit every send action.

Validation:
- Non-admin cannot use any optional route.
- Admin cannot reach privileged admin pages without 2FA if enabled.
- Impersonation is always visibly indicated and logged.
- Platform notifications are audited.
```

---

# Copy-Paste First Prompt To Use Now

Use this as the next vibe-coding message if you want the safest next step:

```text
Start CRM Roberto Milestone 2 recovery from the financial dashboard.

Milestone 1 is validated. The previous Milestone 2 prompt was wrong and some code was already implemented from it. Use docs/milestone-2-client-aligned-vibe-coding-plan.md as the source of truth.

Do Sprint 0 first, then Sprint 1 only if the audit is clear enough.

Deliverables for this coding session:
1. Create docs/milestone-2-current-gap-audit.md with exact implemented/missing/misaligned items.
2. Harden financial dashboard calculations if the audit confirms the route and repository are the right place to fix.
3. Do not implement 2FA, support impersonation, or platform notifications unless explicitly asked.
4. Keep changes minimal and aligned with current repo patterns.
5. Run npm run lint after code changes.

Important client rules:
- Draft expenses must never affect financial totals.
- Archived/deleted expenses must be excluded by default.
- Revenue must use issued sales invoices.
- VAT balance = collected VAT - deductible VAT.
- External accountant is portal-only.
- Feature flags and permissions must be enforced server-side.
```

## Final Tester Focus

The tester should focus on these high-risk areas first:

1. Create one draft expense and confirm dashboard totals do not change.
2. Create one active unpaid expense and confirm expenses/VAT/unpaid alerts change.
3. Archive that expense and confirm normal dashboard totals remove it.
4. Create or use one issued invoice and confirm revenue/VAT changes.
5. Log in as external accountant and try to open `/dashboard` directly.
6. Disable accountantPortal feature flag and confirm portal access is blocked.
7. Disable financialDashboard flag and confirm financial dashboard API is blocked.
8. Export portal CSV/XLSX and confirm columns.
9. Download ZIP for purchase invoice attachments and confirm scope.
10. Suspend company and confirm company users cannot log in.
