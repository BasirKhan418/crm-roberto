# CRM Roberto - Milestone 2 Current Gap Audit

Date: May 2026  
Basis: verified repository inspection against `docs/milestone-2-client-aligned-vibe-coding-plan.md`.

## 1. Already Implemented And Usable

### Financial Dashboard Backend

- `app/api/dashboard/financial/route.ts` exists, keeps the `{ success, data }` response shape, and blocks access with `requireCompanyFeature(..., "financialDashboard")`.
- `app/api/dashboard/smart-alerts/route.ts` exists and uses the same feature gate.
- `db/repository/financial-dashboard.ts` already implements the core Milestone 2 finance rules:
  - active expenses only for dashboard totals,
  - archived and soft-deleted expenses excluded through `archivedAt: null` and `deletedAt: null`,
  - own-scope versus company-scope access resolution,
  - issued invoice revenue only through `unpaid`, `partial_paid`, `paid`, `overdue`,
  - integer-cents math for metrics, charts, and VAT formulas.
- The financial repository already returns:
  - metric totals,
  - expenses by category,
  - 12-month trend,
  - current versus previous period comparison,
  - top suppliers by spend,
  - smart alerts,
  - My Expenses Today snapshot.

### Financial Dashboard Frontend

- `hooks/useFinancialDashboard.ts` exists and fetches `/api/dashboard/financial` with month, quarter, year, and custom period support.
- `components/dashboard/financial-overview.tsx` already renders the required dashboard block with:
  - period selector,
  - financial metrics,
  - 4 charts,
  - loading, empty, and error states.
- `hooks/useSmartAlerts.ts` and `components/dashboard/MyExpensesTodayWidget.tsx` are already wired to `/api/dashboard/smart-alerts`.

### Accountant Portal Isolation And Core Financial Views

- `proxy.ts` separates `/accountant-portal` from normal CRM protected routes and redirects `external_accountant` users away from the main CRM shell.
- `utils/middlewares/accountantSession.ts` uses the separate `accountant-token` session, checks `kind === "accountant_portal"`, enforces `external_accountant`, validates revoked/suspended/locked states, and re-checks the `accountantPortal` feature flag.
- `app/api/accountant/dashboard/route.ts` exists and blocks access when `financialDashboard` is disabled.
- `db/repository/accountant-portal.ts` reuses the main financial dashboard engine for the portal dashboard.
- `app/api/accountant/purchase-invoices/route.ts` is read-only and supports filters, search, pagination, and sorting.
- `app/api/accountant/sales-invoices/route.ts` is read-only and supports filters, search, pagination, and sorting.
- `app/api/accountant/sales-invoices/[id]/pdf/route.ts` exists for accountant PDF download.

### Accountant Tickets, Exports, And ZIP

- `app/api/accountant/tickets/route.ts`, `app/api/accountant/tickets/[id]/route.ts`, `app/api/accountant/tickets/[id]/messages/route.ts`, and `app/api/accountant/tickets/[id]/status/route.ts` exist for portal ticket list, detail, reply, and status updates.
- `app/api/accountant/exports/accounting-rows/route.ts`, `app/api/accountant/exports/vat-summary/route.ts`, and `app/api/accountant/exports/general-ledger/route.ts` exist and block access when `exports` is disabled.
- `app/api/accountant/purchase-invoices/attachments-zip/route.ts` exists and blocks access when `exports` is disabled.
- `db/repository/accountant-exports.ts` already records audit entries through `recordReportAudit(...)` for export and ZIP actions.

### Super Admin / Platform Admin

- `app/api/admin/_shared.ts` uses separate `admin-token` auth and validates a DB-backed `Admin` record.
- `app/admin` and `app/api/admin/*` already cover platform stats, company list/detail, company creation, company status updates, feature flag updates, audit logs, and connection logs.
- `db/repository/super-admin.ts` already supports:
  - platform stats,
  - company search and status filtering,
  - company detail with user list, audit log preview, and connection log preview,
  - create company,
  - suspend/reactivate company,
  - feature flag updates.

### Feature Flags, Roles, And Logs

- `lib/company-features.ts` centralizes the feature flags and blocks suspended companies.
- Expense APIs already enforce the `expenses` feature flag through `app/api/expenses/_shared.ts`.
- Dashboard financial APIs already enforce the `financialDashboard` feature flag.
- Accountant dashboard and export APIs already enforce `financialDashboard` and `exports`.
- `lib/permissions.ts` already includes the expanded Milestone 2 role list, including `external_accountant`.
- `db/models/ConnectionLog.ts` includes login, portal login, logout, revoke, force logout, and impersonation event names.
- Main CRM login/logout and accountant portal login/logout are already writing connection logs.
- User revoke access already writes `revoke_access` in `app/api/settings/users/route.ts`.

## 2. Implemented But Needs Verification

These areas are implemented in code but still need manual QA with data and role testing before they can be called fully validated.

### Financial Data QA

- `db/repository/financial-dashboard.ts` looks correct for the documented aggregation rules, but it still needs manual record-level validation with:
  - active expense,
  - draft expense,
  - archived expense,
  - unpaid/partial expense,
  - issued invoice,
  - empty period.

### Accountant Portal Data QA

- `db/repository/accountant-portal.ts` appears correctly company-scoped, but portal purchase invoice, sales invoice, and PDF flows still need manual cross-company leakage testing.
- Portal ticket reply and resolve APIs exist, but user-facing notification and email delivery should still be tested end-to-end.

### Admin Manual QA

- Admin connection log filters exist in `app/api/admin/connection-logs/route.ts` and `db/repository/super-admin.ts`, but the search, period, and event-type combinations still need UI QA.
- Company suspension logic exists, but login blocking should still be tested with real company users after suspend/reactivate.

## 3. Required Gaps Fixed In Recovery Pass

### Dashboard Smart Alert And Due-Date Links

- Fixed.
- Expense list API now supports `paymentStatusGroup=open`, `dueStart`, `dueEnd`, `dueBefore`, and `sortBy=dueDate`.
- Unpaid supplier invoices now link to active unpaid or partial supplier invoices.
- Overdue supplier invoices now link to active unpaid or partial invoices with `dueBefore` and due-date sorting.
- My Expenses Today due-this-week card now links to a supported due-date window.

### Role Matrix Coverage

- Fixed.
- The advanced role matrix now covers users, expenses, tickets, invoices, clients, suppliers, financial dashboard, settings, and audit trail.
- Unsaved matrix rows now start from default role permissions instead of all-false rows.

### Accountant Ticket List Scope

- Fixed.
- Accountant ticket list no longer forces `assignedToMe=true`.
- It uses the shared portal access scope, which allows assigned or accountant-created/scoped tickets while staying company/session scoped.

### Force Logout Logging

- Fixed for the existing suspension flow.
- Suspending a company user sets `forceLogoutAfter` and writes a `force_logout` connection log.
- Revoking pending invitations continues to write `revoke_access`.

### Dashboard Copy

- Fixed.
- Financial overview no longer uses sprint/scaffold wording.
- Metric labels now use `Total expenses`, `Total revenue`, `Gross profit`, `Collected VAT`, `Deductible VAT`, and `VAT balance` terminology.

## 4. Missing But Required For Milestone 2

No known required implementation gaps remain in scope after excluding optional 2FA, impersonation, and platform notification composer work.

Remaining work is manual QA with real records and roles, documented in `docs/milestone-2-final-handoff.md`.

## 5. Explicitly Out Of Immediate Scope Unless Client Reconfirms

- Super Admin 2FA/TOTP.
- Support impersonation UI/routes.
- Platform-wide admin notification composer.

Notes:

- `impersonation_start` and `impersonation_stop` exist only as connection-log event types.
- No visible implementation was found for admin 2FA, impersonation routes, or platform notification composition.

## 6. Exact Next Coding Tasks Ordered By Risk

1. Run focused manual QA for company suspension login blocking, accountant portal read-only scoping, sales invoice PDF scope, exports, and ZIP download scope.
2. Run role-based QA for administrator, manager, standard user, secretary, technician, read-only user, and external accountant.
3. Validate dashboard financial totals with real active, draft, archived, unpaid, partial, and issued invoice records.

## 7. Audit Conclusion

Milestone 2 is not mostly missing.

The current repository already contains the financial dashboard engine, accountant portal separation, read-only portal financial views, exports, ZIP download, admin company controls, feature flag gates, role assignability, and most connection logging.

The required in-scope implementation gaps found in this audit have been fixed.

Milestone 2 is ready for final manual validation using `docs/milestone-2-final-handoff.md`. The only excluded optional items are Super Admin 2FA/TOTP, support impersonation, and platform-wide admin notification composer, unless the client reconfirms them as mandatory.

The financial dashboard backend itself appears largely ready; the next risky coding area is Sprint 2 dashboard integration polish rather than a full Sprint 1 backend rebuild.