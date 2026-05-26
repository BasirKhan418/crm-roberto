# CRM Roberto - Milestone 2 Final Handoff

Date: May 26, 2026
Status: In-scope implementation complete; ready for manual validation

## Scope Delivered

Milestone 2 was completed as a recovery/hardening pass after Milestone 1 validation. Optional Super Admin 2FA/TOTP, support impersonation, and platform-wide admin notification composer were left out of scope unless the client reconfirms them as mandatory.

## Delivered Features

### Financial Dashboard

- Financial dashboard API is feature-gated by `financialDashboard`.
- Dashboard totals use active expenses only by default and exclude draft, archived, and deleted expenses.
- Revenue uses issued invoice statuses only.
- VAT formulas use integer cents:
  - gross profit = revenue excl. VAT - expenses excl. VAT
  - collected VAT = invoice VAT
  - deductible VAT = expense VAT
  - VAT balance = collected VAT - deductible VAT
- Unpaid purchase exposure uses outstanding amount for unpaid and partial expenses.
- Smart alerts use full matching counts/totals, not preview rows only.
- Expenses page supports alert query params for open payment status and due-date windows.
- My Expenses Today due-this-week link uses supported due-date filters.

### Dashboard UI

- Financial overview copy now uses final client-facing wording instead of sprint/scaffold copy.
- Required metric labels are present: Total revenue, Total expenses, Gross profit, Collected VAT, Deductible VAT, VAT balance.
- Charts remain available for 12-month trend, expenses by category, current versus previous period, and top suppliers.

### Accountant Portal

- Accountant portal remains isolated under `/accountant-portal` with `accountant-token`.
- Portal APIs require accountant session and company context.
- Accountant dashboard and exports are feature-gated.
- Purchase and sales invoice APIs remain read-only.
- Accountant ticket list now uses portal access scope instead of forcing assigned-only tickets.
- Export and ZIP routes remain audited and feature-gated by `exports`.

### Super Admin, Feature Flags, Roles, Logs

- Existing platform admin route remains `/admin`.
- Admin APIs use separate `admin-token` auth.
- Company feature flags are enforced server-side for expenses, tickets, financial dashboard, accountant portal, exports, and advanced roles where implemented.
- Company assignable roles now include administrator, manager, standard user, secretary, technician, read-only user, and external accountant.
- Settings user invite/change-role UI supports the full assignable role list.
- Invitation emails include role labels for all assignable roles.
- Advanced role matrix now covers users, expenses, tickets, invoices, clients, suppliers, financial dashboard, settings, and audit trail.
- Unsaved role matrix rows start from default permissions instead of empty all-false rows.
- Suspending a company user sets `forceLogoutAfter` and writes a `force_logout` connection log.
- Revoking pending invitations writes `revoke_access`.

## Validation Commands Run

- `npm run lint` passed.
- `npm run build` passed.

Build note: Next.js reported the existing warning that using edge runtime on a page disables static generation for that page. The build completed successfully.

## Manual Tester Focus

1. Create a draft expense and confirm dashboard totals do not change.
2. Create an active unpaid expense and confirm total expenses, deductible VAT, and unpaid supplier alert change.
3. Add a partial payment and confirm unpaid purchase exposure uses remaining amount.
4. Archive the expense and confirm normal dashboard totals remove it.
5. Create or use an issued invoice and confirm total revenue and collected VAT change.
6. Click unpaid supplier and overdue supplier smart alerts and confirm `/expenses` opens with filtered results.
7. Click My Expenses Today due-this-week and confirm due-date filtered expenses load.
8. Invite users as manager, standard user, secretary, technician, read-only user, and external accountant.
9. Change an existing user's role from Settings > Users and confirm the role persists.
10. Enable Advanced Roles, edit the role matrix, save, reload, and confirm rows persist for all modules.
11. Login as external accountant and confirm `/dashboard`, `/expenses`, `/tickets`, and `/settings` are blocked while `/accountant-portal` works.
12. Confirm accountant purchase and sales invoice pages are read-only.
13. Export accountant CSV/XLSX files and confirm required columns.
14. Download a purchase invoice attachments ZIP and confirm only selected company-scoped files are included.
15. Suspend a company user and confirm their session is forced out or blocked on the next request, and `force_logout` appears in connection logs.
16. Revoke a pending invitation and confirm `revoke_access` appears in connection logs.
17. Suspend a company from Super Admin and confirm company users cannot log in.
18. Disable `financialDashboard`, `accountantPortal`, and `exports` flags one by one and confirm the related APIs block access.
19. Check mobile at about 390px for dashboard, expenses, accountant portal, admin company detail, role matrix, and logs.

## Known Limitations Out Of Scope

- Super Admin 2FA/TOTP is not implemented in this recovery pass.
- Support impersonation UI/routes are not implemented in this recovery pass.
- Platform-wide admin notification composer is not implemented in this recovery pass.

These are intentionally optional unless the client reconfirms them for Milestone 2 payment.
