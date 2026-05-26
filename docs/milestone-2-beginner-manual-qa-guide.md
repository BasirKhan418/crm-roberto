# Milestone 2 Beginner-Friendly Manual QA Guide

This document is a simple step-by-step manual testing guide for Milestone 2.

Use it when you want to check the current build by clicking through the product yourself from start to finish.

This guide is written for manual testing, not for developers only. Every section tells you:

1. Where to go
2. What to click
3. What you should see
4. What result is expected
5. What to do if data is missing

## 1. What Milestone 2 Includes In The Current Build

The current build contains these Milestone 2 areas:

1. Main CRM financial dashboard
2. Dashboard smart alerts
3. Dashboard My Expenses Today widget
4. Accountant portal
5. Accountant portal exports
6. Super Admin area
7. Advanced role matrix editor
8. Connection logs and audit log views
9. Role-based page access hardening on CRM pages

## 2. Important Note Before You Start

Some Milestone 2 items were planned in the milestone document but are not currently available in the build.

Do not treat these as manual test failures. They are simply not implemented yet.

The items currently not available are:

1. Super Admin 2FA / TOTP flow
2. Support impersonation start and stop flow
3. Platform notifications foundation in the Super Admin area

## 3. Accounts You Should Prepare Before Testing

Use one company for the normal CRM users so all role checks happen inside the same company.

Prepare these accounts:

| Account | Where to log in | Why you need it |
|---|---|---|
| Super Admin | `/admin/login` | Check platform dashboard, companies, logs, feature flags |
| Administrator | `/login` | Main full company test account |
| Manager | `/login` | Check company-wide expenses and tickets access |
| Standard user | `/login` | Check limited access and redirects |
| Secretary | `/login` | Check supplier/client access and no delete-style flows |
| Technician | `/login` | Check ticket-only style access |
| Read-only | `/login` | Check view-only behavior |
| External accountant | `/accountant-portal/login` | Check separate accountant portal |

## 4. Data You Should Prepare Before Testing

If your database already has good sample data, you can skip this section.

If not, create or confirm the following data exists in the same company:

1. At least 2 suppliers
2. At least 1 client
3. At least 1 paid sales invoice
4. At least 1 unpaid sales invoice
5. At least 1 overdue sales invoice
6. At least 1 active purchase expense marked unpaid or partial
7. At least 1 overdue purchase expense
8. At least 1 draft expense
9. At least 1 archived expense
10. At least 1 expense with attachments
11. At least 2 expenses with same supplier and same amount close in date if you want to test duplicate alerts
12. At least 2 tickets
13. At least 1 ticket assigned to the external accountant if you want to test portal reply and resolve actions

## 5. Quick Map Of What You Will Test

Use this order if you want a clean end-to-end manual pass:

1. Main CRM dashboard as Administrator
2. Dashboard filters, charts, smart alerts, widgets
3. Role access page by page for each role
4. Accountant invitation and accountant portal
5. Exports and ZIP download inside accountant portal
6. Super Admin dashboard and company detail
7. Feature flags and advanced roles
8. Connection logs and audit logs
9. Mobile and direct URL checks

## 6. Role Access Rules You Should Expect On Pages

These are the expected page access rules in the current build.

If a role is not allowed, the user should be redirected away safely.

In most CRM cases:

1. Users with expense access are sent back to `/dashboard`
2. Users with only ticket access are sent back to `/tickets`
3. Users with no matching CRM access are pushed out safely

### 6.1 Dashboard

Expected allowed roles:

1. Administrator
2. Manager
3. Standard user
4. Secretary
5. Read-only

Expected blocked role:

1. Technician

Expected blocked from main CRM entirely:

1. External accountant

### 6.2 Expenses

Expected allowed roles:

1. Administrator
2. Manager
3. Standard user
4. Secretary
5. Read-only

Expected blocked role:

1. Technician

### 6.3 Tickets

Expected allowed roles:

1. Administrator
2. Manager
3. Standard user
4. Secretary
5. Technician
6. Read-only

### 6.4 Settings Users

Expected allowed roles:

1. Administrator
2. Manager
3. Read-only

Notes:

1. Read-only should be able to view the page if user viewing is allowed
2. Read-only should not be able to invite or edit users

### 6.5 Settings Roles

Expected allowed roles:

1. Administrator
2. Super Admin if used in CRM context

Expected blocked roles:

1. Manager
2. Standard user
3. Secretary
4. Technician
5. Read-only
6. External accountant

### 6.6 Settings Root, Reminders, Stripe

Expected allowed roles:

1. Administrator
2. Manager

Expected blocked roles:

1. Standard user
2. Secretary
3. Technician
4. Read-only
5. External accountant

### 6.7 Clients And Suppliers

Expected allowed roles:

1. Administrator
2. Manager
3. Secretary

Expected blocked roles:

1. Standard user
2. Technician
3. Read-only
4. External accountant

### 6.8 Catalogue, Quotes, Invoices, Notes

Expected allowed roles:

1. Administrator
2. Manager

Expected blocked roles:

1. Standard user
2. Secretary
3. Technician
4. Read-only
5. External accountant

### 6.9 Profile

Profile is intentionally still available because it is also the current self-service password page.

Expected allowed roles:

1. Administrator
2. Manager
3. Standard user
4. Secretary
5. Technician
6. Read-only

External accountant should still use the accountant portal, not the main CRM profile route.

## 7. Full End-To-End Manual Test

## 7.1 Main CRM Dashboard As Administrator

### Goal

Confirm the Milestone 2 financial dashboard and smart widgets work in the main CRM.

### Steps

1. Log in as the company Administrator at `/login`.
2. Wait until you land on `/dashboard`.
3. Look at the top dashboard area.

### Expected Result

1. The page loads without redirect loops
2. The dashboard should show business widgets instead of an error screen
3. If data exists, numbers should be populated
4. If no matching data exists for the selected period, zero values are acceptable

### Check The Financial Overview Block

1. Stay on `/dashboard`
2. Find the financial overview block
3. Change the period selector
4. Try at least these values if visible in the selector:
5. Current month
6. Quarter
7. Year
8. Custom range if available

### Expected Result

1. The metrics should refresh when the period changes
2. No crash should happen
3. Metrics should include:
4. Expenses totals
5. Revenue totals
6. Gross profit
7. Collected VAT
8. Deductible VAT
9. VAT balance

### Check The Charts

1. In the same financial area, check the charts and chart cards
2. Look for:
3. Expenses by category
4. 12-month trend
5. Current period vs previous period
6. Top suppliers by spend

### Expected Result

1. Charts render without breaking layout
2. Empty charts should still show safely if there is no data
3. Categories and supplier charts should match your sample data directionally
4. The page must not count draft expenses in financial totals
5. The page must not count archived expenses in normal financial totals

### Draft And Archived Expense Check

1. Create or confirm one draft expense exists
2. Create or confirm one archived expense exists
3. Return to `/dashboard`
4. Check the financial totals again

### Expected Result

1. Draft expense should not affect totals
2. Archived expense should not affect totals

## 7.2 Dashboard Smart Alerts

### Goal

Confirm smart alerts appear and route the user to the right place.

### Steps

1. Stay on `/dashboard`
2. Find the `Smart Actions` or smart alerts area
3. Look for these alert types if your data supports them:
4. Unpaid supplier invoices
5. Overdue supplier invoices
6. Ticket waiting more than 48 hours
7. Potential duplicate expenses
8. Click each alert that appears

### Expected Result

1. Clicking an expense-related alert should open a filtered expense page or relevant target
2. Clicking a ticket-related alert should open a relevant ticket page or filtered ticket list
3. The resulting page should already be filtered or focused on the relevant problem
4. If there is no matching record, the app should fail safely instead of crashing

## 7.3 My Expenses Today Widget

### Goal

Confirm the Milestone 2 dashboard helper widget works.

### Steps

1. Stay on `/dashboard`
2. Find the `My expenses today` widget
3. Check counts and totals
4. If the widget contains links or actions, click them

### Expected Result

1. The widget should show today-related numbers safely
2. If there is no data for today, zero values are acceptable
3. Links should open a sensible target page

## 7.4 Dashboard Customization

### Goal

Confirm the milestone 2 dashboard blocks can still be shown, hidden, and reordered.

### Steps

1. On `/dashboard`, click `Customize dashboard`
2. Hide the milestone 2 blocks one by one
3. Reorder the milestone 2 blocks
4. Save layout
5. Refresh the page

### Expected Result

1. Visibility changes stay saved
2. Block order stays saved after refresh
3. Dashboard still loads without broken spacing

## 7.5 Role Access Check Page By Page

This section is for your access-control audit.

Open the same pages with different users and confirm the app allows only the correct roles.

### Test URLs

Use these URLs one by one:

1. `/dashboard`
2. `/expenses`
3. `/tickets`
4. `/settings/users`
5. `/settings/roles`
6. `/settings`
7. `/settings/reminders`
8. `/settings/stripe`
9. `/clients`
10. `/suppliers`
11. `/catalogue`
12. `/quotes`
13. `/invoices`
14. `/notes`
15. `/profile`

### Administrator Expected Result

1. Should access all normal CRM routes listed above
2. Should be able to use dashboard, expenses, tickets, settings users, settings roles, accountant invitation flow, and company admin flows

### Manager Expected Result

1. Should access dashboard, expenses, tickets, settings users, settings root, reminders, Stripe, clients, suppliers, catalogue, quotes, invoices, notes, and profile
2. Should be blocked from `/settings/roles`

### Standard User Expected Result

1. Should access dashboard, expenses, tickets, and profile
2. Should be redirected away from clients, suppliers, settings root, settings roles, catalogue, quotes, invoices, and notes

### Secretary Expected Result

1. Should access dashboard, expenses, tickets, clients, suppliers, and profile
2. Should be redirected away from settings root, settings roles, catalogue, quotes, invoices, and notes

### Technician Expected Result

1. Should access tickets and profile
2. Should be redirected away from dashboard, expenses, clients, suppliers, settings, catalogue, quotes, invoices, and notes
3. If redirected from a CRM page, a safe landing on `/tickets` is acceptable

### Read-only Expected Result

1. Should access dashboard, expenses, tickets, settings users, settings expenses, and profile
2. Should be redirected away from settings roles, settings root, reminders, Stripe, clients, suppliers, catalogue, quotes, invoices, and notes
3. Visible action buttons should be hidden or blocked where the role is view-only

### External Accountant Expected Result

1. Must not use the normal CRM
2. Trying `/dashboard` or another normal CRM page should push the user away from main CRM access
3. The external accountant should use `/accountant-portal` instead

## 7.6 Accountant Invitation Flow

### Goal

Confirm the company can invite an external accountant into the dedicated portal flow.

### Steps

1. Log in as Administrator in the main CRM
2. Open `/settings/users`
3. Find the invite user form
4. Enter the accountant email
5. Choose role `external_accountant`
6. Submit the form

### Expected Result

1. Invitation should be created successfully
2. If email sending works, a success message should appear
3. If email delivery fails but the invitation is created, the UI should still explain that invitation creation worked
4. Invitation link should exist if the flow exposes it

## 7.7 Accountant Portal Login And Isolation

### Goal

Confirm the accountant portal is separate from the normal CRM.

### Steps

1. Use the invited external accountant account
2. Open `/accountant-portal/login`
3. Log in
4. After login, try to open `/dashboard` manually in the browser address bar

### Expected Result

1. Accountant login works only through the accountant portal
2. The portal opens its own interface
3. The external accountant must not get normal CRM access
4. Main CRM routes should redirect or block safely

## 7.8 Accountant Portal Dashboard

### Goal

Confirm the portal dashboard is read-only and period-aware.

### Steps

1. While logged in as external accountant, open `/accountant-portal`
2. Find the period selector
3. Change the period
4. Observe the metrics and charts

### Expected Result

1. The period selector should always be visible on the portal dashboard
2. Metrics should refresh when period changes
3. The page must look read-only
4. The portal must not show normal CRM create or edit actions for financial records

## 7.9 Accountant Portal Purchase Invoices

### Goal

Confirm purchase invoices are visible and filterable in the portal.

### Steps

1. Click `Purchase invoices` in the accountant portal sidebar
2. Apply search
3. Apply payment status filter
4. Apply supplier filter if visible
5. Apply category filter if visible
6. Apply date or period filter

### Expected Result

1. List should refresh correctly when filters change
2. Accountant should be able to read data but not edit the expense records
3. Attachment information should be visible where available

## 7.10 Accountant Portal Sales Invoices

### Goal

Confirm sales invoices are visible and PDF access works.

### Steps

1. Click `Sales invoices` in the accountant portal sidebar
2. Apply search and status filters
3. Open one invoice PDF action if shown

### Expected Result

1. List should load successfully
2. Paid, unpaid, and overdue invoices should appear according to your data
3. PDF download should work for an allowed invoice
4. The view remains read-only

## 7.11 Accountant Portal Tickets

### Goal

Confirm the accountant can work only inside assigned ticket scope.

### Steps

1. Click `Tickets` in the accountant portal sidebar
2. Open a ticket assigned to the accountant
3. Read the thread
4. Send a reply
5. Mark the ticket resolved if the action is available
6. Try another ticket that is not assigned to the accountant if such data exists

### Expected Result

1. Assigned ticket should open correctly
2. Reply should be saved and shown in the thread
3. Resolve action should update the status
4. Tickets outside the accountant scope should not be available

## 7.12 Accountant Portal Exports

### Goal

Confirm Milestone 2 export features work in the portal.

### Steps

1. Click `Exports` in the accountant portal sidebar
2. Test each export type:
3. Accounting rows export
4. VAT summary export
5. General ledger export
6. For each export type, try:
7. CSV format
8. XLSX format
9. A filtered export using date or type filters if available

### Expected Result

1. Files should download successfully
2. CSV files should open as readable tabular content
3. XLSX files should open in spreadsheet software without corruption
4. Filters should affect the file content
5. API errors should appear as a clear message instead of a silent failure

## 7.13 Purchase Attachment ZIP Download

### Goal

Confirm ZIP download works for purchase invoice attachments.

### Steps

1. Stay in the accountant portal purchase invoices area if the ZIP action is there, or use the export flow if exposed there
2. Select expenses that have attachments
3. Trigger the ZIP download
4. Open the ZIP after download

### Expected Result

1. ZIP file downloads successfully
2. Attached files are inside the ZIP
3. Folder names should look organized by expense date and supplier where possible
4. If one remote file cannot be fetched, the ZIP should still download and contain a `README.txt` with failure details

## 7.14 Super Admin Login And Dashboard

### Goal

Confirm the separate Super Admin area works.

### Steps

1. Log out of normal CRM if needed
2. Open `/admin/login`
3. Log in with Super Admin credentials
4. After login, open `/admin`

### Expected Result

1. Login should use the separate admin area
2. You should land in the Super Admin dashboard
3. You should see platform metrics and company list

### Check Platform Dashboard Content

1. On `/admin`, check these areas:
2. Company metrics
3. Active company count
4. Active user count
5. Active accountant count
6. Recent audit events
7. Module usage badges

### Expected Result

1. Numbers render safely
2. Company list loads
3. Search and status filter work

## 7.15 Super Admin Create Company

### Goal

Confirm a company can be created from the Super Admin area.

### Steps

1. On `/admin`, use the `Create company` form
2. Enter company name
3. Enter slug
4. Choose an owner user
5. Submit

### Expected Result

1. Company is created successfully
2. The new company appears in the company list
3. Owner user is linked correctly

## 7.16 Super Admin Company Detail And Feature Flags

### Goal

Confirm company-level controls work.

### Steps

1. On `/admin`, click `View` on a company
2. Open the company detail page
3. Review these sections if visible:
4. Company info
5. Users list
6. Feature flags
7. Audit logs
8. Connection logs
9. Toggle one feature flag such as `advancedRoles` or `accountantPortal`
10. Save changes

### Expected Result

1. Feature flags should save
2. Success message should appear
3. Refresh should keep the new value
4. If you disabled a feature, related UI should disappear or deny access appropriately on next check

## 7.17 Super Admin Suspend And Reactivate Company

### Goal

Confirm company suspension works safely.

### Steps

1. In `/admin` or company detail, choose `Suspend` for a test company
2. Confirm the action
3. Try logging in with a normal user from that company
4. Then reactivate the company
5. Try again

### Expected Result

1. Suspended company users should be blocked from normal access
2. After reactivation, company access should be possible again
3. Suspension and reactivation should be visible in admin UI state

## 7.18 Advanced Role Matrix

### Goal

Confirm the role matrix editor is available to the right users and saves changes.

### Important Current Behavior

In the current build, the advanced role matrix is present as a settings editor for company administrators.

For manual testing, focus on these checks:

1. The page opens only for the correct role
2. The matrix loads
3. The matrix saves
4. Saved values remain after refresh

Do not use this guide to judge every top-level route from the matrix itself.
The current top-level page redirects are primarily enforced from the base role policy.

### Steps

1. Make sure `advancedRoles` feature flag is enabled for the company in the Super Admin company detail page
2. Log in as Administrator in the main CRM
3. Open `/settings/roles`
4. Change the selected role in the dropdown
5. Edit one or more permission checkboxes
6. Click `Save matrix`
7. Refresh the page

### Expected Result

1. Administrator can open the page
2. Non-admin users should not be able to use `/settings/roles`
3. The selected role matrix loads
4. Save succeeds
5. The saved values remain after refresh

## 7.19 Connection Logs And Audit Logs

### Goal

Confirm Milestone 2 connection and audit logging is visible.

### Steps

1. Log in as Super Admin
2. Open `/admin/logs`
3. Review `Connection logs`
4. Review `Audit logs`
5. Use filters:
6. Company filter
7. Event type filter
8. Period filter
9. Entity type filter
10. Search by IP or device text if available

### Expected Result

1. Logs should load without page failure
2. Filtering should refresh the list
3. You should be able to find events such as login, logout, portal login, revoke access, and report downloads if those actions were performed during testing

## 7.20 Manual Connection Log Events You Should Trigger

Use this list to generate visible log entries during your manual pass.

1. Normal CRM login
2. Normal CRM logout
3. Accountant portal login success
4. Accountant portal failed login attempt
5. Accountant portal logout
6. Revoke access for a user from settings users if you want to test revoke logging
7. Download an accountant export to create report audit entries

### Expected Result

1. The events should later appear in admin logs or company detail logs

## 7.21 Direct URL Security Checks

### Goal

Confirm users cannot simply type a protected URL and get access.

### Steps

Use each test account and type URLs directly into the browser address bar.

Test examples:

1. As Technician, type `/dashboard`
2. As Technician, type `/expenses`
3. As Standard user, type `/clients`
4. As Read-only, type `/settings`
5. As Read-only, type `/settings/roles`
6. As External accountant, type `/dashboard`
7. As normal CRM user, type `/accountant-portal`
8. As normal CRM user, type `/admin`

### Expected Result

1. Disallowed pages should not open
2. The app should redirect or deny safely
3. No broken white page should appear
4. No raw stack trace should appear

## 7.22 Optional API Spot Checks In Browser DevTools

This section is optional, but useful if you also want a simple API-level manual check.

### How To Do It

1. Open browser DevTools
2. Open the `Network` tab
3. Keep `Fetch/XHR` visible
4. Perform the UI action
5. Click the request row
6. Check `Status` and `Response`

### Useful Requests To Watch

1. `/api/dashboard/financial`
2. `/api/dashboard/smart-alerts`
3. `/api/accountant/dashboard`
4. `/api/accountant/purchase-invoices`
5. `/api/accountant/sales-invoices`
6. `/api/accountant/exports/accounting-rows`
7. `/api/accountant/exports/vat-summary`
8. `/api/accountant/exports/general-ledger`
9. `/api/admin/stats`
10. `/api/admin/connection-logs`
11. `/api/admin/audit-logs`

### Expected Result

1. Allowed actions should normally return `200`
2. Created resources may return `201`
3. Blocked actions should return `401` or `403`
4. Validation problems should return `400`
5. Responses should use safe JSON and not expose raw server internals

## 7.23 Mobile And Small Screen Pass

Milestone 2 also mentions mobile QA.

Do a short pass in browser responsive mode.

### Pages To Check On Mobile Width

1. `/dashboard`
2. `/expenses`
3. `/tickets`
4. `/accountant-portal`
5. `/accountant-portal/purchase-invoices`
6. `/accountant-portal/sales-invoices`
7. `/accountant-portal/tickets`
8. `/admin`
9. `/admin/logs`

### Expected Result

1. No horizontal overflow that makes the page unusable
2. Key actions remain clickable
3. Tables may scroll, but the page should still be usable
4. Filters and period controls should remain accessible

## 8. Final Pass / Release Decision Checklist

Use this at the very end.

Mark each item pass or fail.

1. Main dashboard financial metrics load
2. Financial period selector works
3. Charts render safely
4. Draft expenses do not affect financial totals
5. Archived expenses do not affect financial totals
6. Smart alerts route correctly
7. My Expenses Today widget loads safely
8. Accountant invitation flow works
9. Accountant cannot use normal CRM routes
10. Accountant portal dashboard works
11. Accountant purchase invoices page works
12. Accountant sales invoices page works
13. Accountant ticket read, reply, and resolve flow works
14. CSV exports work
15. XLSX exports work
16. ZIP attachment download works
17. Super Admin login works
18. Super Admin platform dashboard works
19. Company feature flags save correctly
20. Company suspend and reactivate flow works
21. Advanced role matrix loads and saves
22. Connection logs are visible
23. Audit logs are visible
24. Role-based page blocking works for disallowed users
25. Mobile smoke pass is acceptable

## 9. If A Test Fails, Write It Down Like This

Use this simple bug format so retesting is easy later.

1. Title: short name of the problem
2. Account used: Administrator, Manager, Read-only, External accountant, and so on
3. URL: exact page URL
4. Steps: what you clicked
5. Expected result: what should have happened
6. Actual result: what actually happened
7. Screenshot: yes or no
8. Network error: request URL and status if visible

Example:

1. Title: Read-only user can open Stripe settings
2. Account used: Read-only
3. URL: `/settings/stripe`
4. Steps: login, type URL directly
5. Expected result: redirected away from the page
6. Actual result: page opened
7. Screenshot: yes
8. Network error: none

## 10. Suggested Manual Test Order If You Want The Fastest Useful Pass

If you do not want to do everything at once, use this short order first:

1. Administrator dashboard checks
2. External accountant portal checks
3. Super Admin checks
4. Role access direct URL checks
5. Logs checks

After that, do the deeper edge-case checks.