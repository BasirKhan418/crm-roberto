# CRM Roberto - Milestone 2 Beginner Manual QA Guide

Date: May 26, 2026
Scope: Milestone 2 only
Status: Use this guide after `npm run lint` and `npm run build` pass

This guide is written for a beginner tester. Follow it slowly. For every test, write down:

- Tester name
- Date and time
- Browser used
- User role used
- Pass or fail
- Screenshot if something looks wrong

## 0. What Is Included In Milestone 2

Test only these Milestone 2 areas:

- Financial dashboard
- Smart alerts
- My Expenses Today
- Accountant portal
- Accountant purchase invoice and sales invoice views
- Accountant tickets
- Accountant exports and ZIP download
- Super Admin area under `/admin`
- Feature flags
- Company user roles
- Advanced role matrix
- Connection logs
- Mobile layout for these pages

Do not fail Milestone 2 for these optional features unless the client has reconfirmed them:

- Super Admin 2FA/TOTP
- Support impersonation
- Platform-wide admin notification composer

## 1. Before You Start

### 1.1 Required Accounts

Ask the developer or project owner for these test accounts:

| Account | Needed Role | Purpose |
| --- | --- | --- |
| Super Admin | platform admin | Test `/admin` area, companies, feature flags, logs |
| Company Admin | `administrator` | Test normal CRM, settings, users, role matrix |
| Manager | `manager` | Test company financial access and records |
| Standard User | `standard_user` | Test normal user scope |
| Secretary | `secretary` | Test operational user role |
| Technician | `technician` | Test ticket-focused role |
| Read Only | `read_only` | Test view-only behavior |
| Accountant | `external_accountant` | Test accountant portal only |

### 1.2 Recommended Test Data

Before starting, make sure the test company has or can create:

| Data | Why Needed |
| --- | --- |
| One supplier | Needed for expenses |
| One expense category | Needed for expenses |
| One draft expense | Test dashboard exclusion |
| One active unpaid expense | Test expense totals and unpaid alert |
| One active partial expense | Test outstanding amount calculations |
| One archived expense | Test dashboard exclusion |
| One issued invoice | Test revenue and collected VAT |
| One overdue supplier expense | Test overdue alert |
| One due-this-week supplier expense | Test My Expenses Today link |
| One ticket waiting over 48h if possible | Test ticket smart alert |
| One accountant ticket | Test portal ticket workflow |
| One expense with attachment | Test ZIP download |

If some historical data is hard to create from the UI, ask the developer to seed it.

### 1.3 Browser Setup

1. Open the application in a browser.
2. Use a clean browser profile or incognito window.
3. Keep one normal CRM window and one accountant portal window separate.
4. When switching roles, log out first.
5. If results look cached, hard refresh the page.

## 2. Financial Dashboard QA

Use the Company Admin account unless a test says otherwise.

### Test 2.1 - Open Dashboard

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin. | Login succeeds. |
| 2 | Click `Dashboard` in the sidebar. | Dashboard page opens. |
| 3 | Find the `Financial overview` block. | Block is visible. |
| 4 | Look for these metric cards: `Total revenue`, `Total expenses`, `Gross profit`, `Collected VAT`, `Deductible VAT`, `VAT balance`. | All six cards are visible. |
| 5 | Look for the period selector near the financial block. | Month, quarter, year, and custom period controls are available. |
| 6 | Look for charts. | 12-month trend, expenses by category, current vs previous period, and top suppliers are visible or show clean empty states. |

### Test 2.2 - Period Selector

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | On `/dashboard`, change the period to current month. | Metrics refresh without page crash. |
| 2 | Change the period to current quarter. | Metrics refresh. |
| 3 | Change the period to current year. | Metrics refresh. |
| 4 | Choose custom date range. | Date fields appear or become active. |
| 5 | Enter a custom range that includes test data. | Metrics update for that range. |
| 6 | Enter a range with no data. | Metrics show zero or empty states, not an error. |

### Test 2.3 - Draft Expense Must Not Affect Dashboard

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | On `/dashboard`, write down `Total expenses` and `Deductible VAT`. | Baseline values are recorded. |
| 2 | Click `Expenses` in the sidebar. | Expenses page opens. |
| 3 | Create or upload an expense as a draft. | Draft expense appears with draft status. |
| 4 | Go back to `/dashboard`. | Dashboard opens. |
| 5 | Check `Total expenses` and `Deductible VAT`. | Values did not increase because draft expenses are excluded. |

### Test 2.4 - Active Unpaid Expense Must Affect Dashboard

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Go to `/expenses`. | Expenses page opens. |
| 2 | Create a new active expense with supplier, category, amount, date, and payment status `unpaid`. | Expense is saved as active/unpaid. |
| 3 | Go to `/dashboard`. | Dashboard opens. |
| 4 | Check `Total expenses`. | It increases by the expense amount excluding VAT. |
| 5 | Check `Deductible VAT`. | It increases by the expense VAT amount. |
| 6 | Check unpaid supplier smart alert. | Count and total include the new unpaid expense. |

### Test 2.5 - Partial Expense Outstanding Amount

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Create or open an active unpaid expense. | Expense detail opens. |
| 2 | Add a partial payment smaller than the full amount. | Expense becomes partial. |
| 3 | Go to `/dashboard`. | Dashboard opens. |
| 4 | Check unpaid supplier alert total. | Total uses remaining outstanding amount, not the full original amount. |
| 5 | Open `/expenses` and filter by partial. | Partial expense appears. |

### Test 2.6 - Archived Expense Must Not Affect Normal Dashboard Totals

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Record dashboard `Total expenses`. | Baseline is recorded. |
| 2 | Go to `/expenses`. | Expenses page opens. |
| 3 | Open or select an active expense. | Expense actions are available. |
| 4 | Archive the expense. | Expense status becomes archived. |
| 5 | Return to `/dashboard`. | Dashboard opens. |
| 6 | Check `Total expenses`. | Archived expense is removed from normal dashboard totals. |

### Test 2.7 - Issued Invoice Revenue

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Record dashboard `Total revenue` and `Collected VAT`. | Baseline is recorded. |
| 2 | Go to `/invoices`. | Invoice list opens. |
| 3 | Create or use an issued invoice with status unpaid, partial paid, paid, or overdue. | Invoice exists in an issued status. |
| 4 | Return to `/dashboard`. | Dashboard opens. |
| 5 | Check `Total revenue`. | It includes invoice amount excluding VAT. |
| 6 | Check `Collected VAT`. | It includes invoice VAT amount. |

## 3. Smart Alerts And My Expenses Today QA

### Test 3.1 - Unpaid Supplier Alert Link

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin. | Login succeeds. |
| 2 | Open `/dashboard`. | Dashboard opens. |
| 3 | Find the Smart Actions or priority actions area. | Unpaid supplier invoices alert is visible if data exists. |
| 4 | Click the unpaid supplier invoices alert. | Browser opens `/expenses` with filters in the URL. |
| 5 | Look at the expense rows. | Active unpaid and partial supplier invoices are shown. |
| 6 | Confirm paid expenses are not shown. | Paid expenses are excluded. |

### Test 3.2 - Overdue Supplier Alert Link

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Make sure an active unpaid or partial expense has a due date before today. | Test overdue expense exists. |
| 2 | Open `/dashboard`. | Dashboard opens. |
| 3 | Click the overdue supplier invoices alert. | Browser opens `/expenses` with `dueBefore` and `sortBy=dueDate`. |
| 4 | Check listed expenses. | Only active unpaid or partial expenses due before today are shown. |
| 5 | Check sorting. | Oldest or nearest due dates appear according to ascending due-date sort. |

### Test 3.3 - Ticket Waiting Over 48h Alert

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Make sure there is a waiting ticket older than 48 hours, if possible. | Test ticket exists. |
| 2 | Open `/dashboard`. | Dashboard opens. |
| 3 | Find ticket waiting/no reply alert. | Alert appears when matching data exists. |
| 4 | Click the alert. | It opens the ticket detail or filtered ticket list. |
| 5 | Check result. | The ticket is waiting and needs reply. |

### Test 3.4 - Potential Duplicate Expenses Alert

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Create two active expenses with same supplier and same amount within 30 days. | Possible duplicate data exists. |
| 2 | Open `/dashboard`. | Dashboard opens. |
| 3 | Find duplicate expenses alert. | Alert appears when duplicates are detected. |
| 4 | Click the alert. | Expenses page opens sorted by expense date. |
| 5 | Check rows. | The possible duplicate expenses can be found. |

### Test 3.5 - My Expenses Today Widget

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open `/dashboard`. | Dashboard opens. |
| 2 | Find `My expenses today`. | Widget is visible. |
| 3 | Check `Entered today`. | Count and amount match expenses created today by the current user. |
| 4 | Check `Due this week`. | Count and amount match active unpaid or partial expenses due this week. |
| 5 | Click `Due this week`. | `/expenses` opens with `dueStart`, `dueBefore`, and `sortBy=dueDate`. |
| 6 | Check `Tickets awaiting reply`. | Count links to waiting assigned tickets. |
| 7 | Click `New expense`. | Expense creation flow opens. |

## 4. Accountant Portal QA

Use the External Accountant account.

### Test 4.1 - Accountant Login

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log out of the normal CRM. | You are logged out. |
| 2 | Open `/login`. | Normal CRM login page opens. |
| 3 | Look for the `External accountant?` / `Open accountant portal` link. | The accountant portal option is visible on the normal login page. |
| 4 | Click `Open accountant portal`. | `/accountant-portal/login` opens. |
| 5 | Click the language switch button in the top-right corner. | Accountant login text switches between English and French. |
| 6 | Enter accountant email and password. | Login succeeds. |
| 7 | Confirm destination page. | `/accountant-portal` dashboard opens. |
| 8 | Check navigation. | Portal navigation is separate from normal CRM sidebar. |
| 9 | Log out and return to `/accountant-portal/login`. | Accountant login page opens. |
| 10 | Click `Back to CRM login` if visible. | `/login` opens for normal CRM users. |

### Test 4.2 - Accountant Cannot Access Normal CRM

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | While logged in as accountant, manually open `/dashboard`. | Access is blocked or redirected. |
| 2 | Manually open `/expenses`. | Access is blocked or redirected. |
| 3 | Manually open `/tickets`. | Access is blocked or redirected. |
| 4 | Manually open `/settings`. | Access is blocked or redirected. |
| 5 | Return to `/accountant-portal`. | Portal still works. |

### Test 4.3 - Accountant Dashboard

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open `/accountant-portal`. | Portal dashboard opens. |
| 2 | Find the period selector. | Period selector is visible. |
| 3 | Change the period. | Metrics refresh. |
| 4 | Check metrics. | Revenue, expenses, gross profit, collected VAT, deductible VAT, VAT balance, unpaid sales, unpaid purchases, and open tickets are visible where implemented. |
| 5 | Compare with Company Admin dashboard for same company and same period. | Totals match company-wide financial dashboard expectations. |

### Test 4.4 - Purchase Invoices Read-Only

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | In accountant portal, click `Purchase invoices`. | Purchase invoice page opens. |
| 2 | Use search box. | Results filter by supplier/reference/amount where matching data exists. |
| 3 | Use period filter. | Results change to selected period. |
| 4 | Use supplier/category/payment status filters. | Results narrow correctly. |
| 5 | Click sort controls if visible. | Sorting changes row order. |
| 6 | Look for edit/delete/pay/archive buttons. | No financial edit controls are visible. |
| 7 | Click attachment download if available. | Attachment downloads only for the selected invoice/company. |

### Test 4.5 - Sales Invoices Read-Only

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | In accountant portal, click `Sales invoices`. | Sales invoice page opens. |
| 2 | Use filters and search. | Results update correctly. |
| 3 | Click PDF download for an invoice. | Correct PDF downloads or opens. |
| 4 | Look for edit/delete/pay/send buttons. | No edit controls are visible. |
| 5 | Try changing URL to another company invoice ID if you have one. | Access is blocked or returns not found. |

### Test 4.6 - Suspended Or Revoked Accountant

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | As Company Admin, open `/settings/users`. | Users page opens. |
| 2 | Suspend or revoke the accountant user. | User becomes suspended or revoked. |
| 3 | In accountant browser, refresh `/accountant-portal`. | Portal access is blocked. |
| 4 | Try logging in again as accountant. | Login fails or account is blocked. |

## 5. Accountant Tickets QA

### Test 5.1 - Ticket List

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as accountant. | Portal opens. |
| 2 | Click `Tickets`. | Ticket list opens. |
| 3 | Check list rows. | Only company-scoped accountant tickets appear. |
| 4 | Use status filter. | Tickets filter by selected status. |
| 5 | Use search if available. | Matching tickets appear. |

### Test 5.2 - Ticket Detail And Reply

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open a ticket from accountant portal. | Ticket detail opens. |
| 2 | Read the message thread. | Messages are chronological and readable. |
| 3 | Type a reply. | Reply text appears in composer. |
| 4 | Attach a file if attachment control is available. | File is accepted if type and size are allowed. |
| 5 | Click send/reply. | Reply is posted. |
| 6 | Log in as normal CRM user and open the same ticket. | Accountant reply is visible. |
| 7 | Check notifications/activity if enabled. | Main CRM participant receives a notification or activity entry. |

### Test 5.3 - Mark Ticket Resolved

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open an accountant portal ticket. | Detail opens. |
| 2 | Change status to resolved or click resolve action. | Ticket status changes to resolved. |
| 3 | Refresh the ticket list. | Ticket appears with resolved status or disappears from open filter. |
| 4 | Check normal CRM ticket view. | Status matches accountant portal. |

## 6. Accountant Exports And ZIP QA

### Test 6.1 - Accounting Rows CSV Export

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as accountant. | Portal opens. |
| 2 | Click `Exports`. | Export page opens. |
| 3 | Choose accounting rows export. | Export option is selected. |
| 4 | Choose CSV format. | CSV option is selected. |
| 5 | Apply type/period/status/category filters if available. | Filters are set. |
| 6 | Click export/download. | CSV file downloads. |
| 7 | Open the CSV. | Columns include date, supplier/client, reference, category, excl. VAT, VAT, incl. VAT, status, and type. |

### Test 6.2 - Accounting Rows XLSX Export

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Stay on accountant `Exports`. | Export page is open. |
| 2 | Choose accounting rows export. | Export option is selected. |
| 3 | Choose XLSX format. | XLSX option is selected. |
| 4 | Click export/download. | XLSX file downloads. |
| 5 | Open in spreadsheet app. | File opens and columns are readable. |

### Test 6.3 - VAT Summary Export

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | On `Exports`, choose VAT summary. | VAT summary option is selected. |
| 2 | Choose CSV or XLSX. | Format is selected. |
| 3 | Click export/download. | File downloads. |
| 4 | Open file. | It includes collected VAT, deductible VAT, and VAT balance. |

### Test 6.4 - General Ledger Export

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | On `Exports`, choose general ledger. | General ledger option is selected. |
| 2 | Choose CSV or XLSX. | Format is selected. |
| 3 | Click export/download. | File downloads. |
| 4 | Open file. | Rows are sorted by date and use consistent accounting row fields. |

### Test 6.5 - Purchase Invoice Attachments ZIP

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Go to accountant `Purchase invoices`. | Page opens. |
| 2 | Select one or more purchase invoices with attachments. | Selected rows are marked. |
| 3 | Click ZIP or download attachments action. | ZIP download starts. |
| 4 | Open the ZIP. | It contains expected selected files only. |
| 5 | Look for any readme/error file if some files failed. | Errors are clearly represented. |
| 6 | Try selecting too many if a limit is visible. | App blocks selection or returns a clear error. |

### Test 6.6 - Export Audit Logs

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | After running exports, log in as Super Admin. | Admin area opens. |
| 2 | Go to `/admin/logs` or company detail audit logs. | Logs page opens. |
| 3 | Search/filter for export/download actions. | Export and ZIP actions are recorded. |

## 7. Super Admin QA

Use the Super Admin account.

### Test 7.1 - Admin Login And Dashboard

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open `/admin/login`. | Admin login page opens. |
| 2 | Enter Super Admin credentials. | Login succeeds. |
| 3 | Confirm URL. | `/admin` opens. |
| 4 | Check dashboard stats. | Company count, active companies, active users, active accountants, module usage, and recent audit events are visible where data exists. |

### Test 7.2 - Normal CRM User Cannot Access Admin

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log out of Super Admin. | Logged out. |
| 2 | Log in as normal Company Admin in normal CRM. | CRM opens. |
| 3 | Manually open `/admin`. | Access is blocked or redirected to admin login. |
| 4 | Manually open an `/api/admin/...` URL if possible. | API returns unauthorized/forbidden. |

### Test 7.3 - Company List

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Super Admin. | `/admin` opens. |
| 2 | Go to company list if not already visible. | Company table/list is visible. |
| 3 | Use search. | Companies filter by search text. |
| 4 | Use status filter. | Active/suspended companies filter correctly. |
| 5 | Check badges. | Active and suspended badges look correct. |

### Test 7.4 - Company Detail

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Click a company from admin list. | Company detail page opens. |
| 2 | Check company information. | Company name, status, and details are visible. |
| 3 | Check users list. | Company users and roles are visible. |
| 4 | Check audit log preview. | Recent audit events are visible if any exist. |
| 5 | Check connection log preview. | Recent connection logs are visible if any exist. |

### Test 7.5 - Company Suspend And Reactivate

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | In company detail, click suspend action. | Confirmation appears if implemented. |
| 2 | Confirm suspend. | Company becomes suspended. |
| 3 | Try logging in as a user from that company. | Login is blocked. |
| 4 | Return as Super Admin and reactivate company. | Company becomes active. |
| 5 | Try logging in as company user again. | Login works if user itself is active. |

## 8. Feature Flag QA

Use Super Admin for toggling flags, and Company Admin or Accountant for checking results.

### Test 8.1 - Financial Dashboard Flag

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | As Super Admin, open company detail. | Feature flags are visible. |
| 2 | Turn off `financialDashboard`. | Flag saves. |
| 3 | Log in as Company Admin and open `/dashboard`. | Financial dashboard is hidden or blocked. |
| 4 | Try refreshing dashboard. | No financial API data is exposed. |
| 5 | Turn `financialDashboard` back on. | Financial dashboard works again. |

### Test 8.2 - Accountant Portal Flag

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | As Super Admin, turn off `accountantPortal` for the company. | Flag saves. |
| 2 | Try logging in at `/accountant-portal/login`. | Accountant login is blocked. |
| 3 | Turn `accountantPortal` back on. | Accountant login works again. |

### Test 8.3 - Exports Flag

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | As Super Admin, turn off `exports` for the company. | Flag saves. |
| 2 | Log in as accountant and open exports page. | Export actions are hidden or blocked. |
| 3 | Try a direct export URL if possible. | API returns forbidden. |
| 4 | Turn `exports` back on. | Export actions work again. |

### Test 8.4 - Expenses And Tickets Flags

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Turn off `expenses`. | Flag saves. |
| 2 | Log in as company user and open `/expenses`. | Expenses are hidden or API-blocked. |
| 3 | Turn `expenses` back on. | Expenses work again. |
| 4 | Turn off `tickets`. | Flag saves. |
| 5 | Open `/tickets`. | Tickets are hidden or API-blocked. |
| 6 | Turn `tickets` back on. | Tickets work again. |

### Test 8.5 - Advanced Roles Flag

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Turn off `advancedRoles`. | Flag saves. |
| 2 | Log in as Company Admin and open `/settings/roles`. | Page says advanced roles are disabled or access is blocked. |
| 3 | Turn `advancedRoles` back on. | Role matrix page opens. |

## 9. Company Users And Roles QA

Use Company Admin.

### Test 9.1 - Invite Every Assignable Role

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin. | CRM opens. |
| 2 | Click `Settings`. | Settings opens. |
| 3 | Click `Users`. | Users page opens. |
| 4 | In invite form, enter a test email and name. | Fields accept input. |
| 5 | Open role dropdown. | Roles include Admin, Manager, Standard user, Secretary, Technician, Read-only user, Accountant. |
| 6 | Select `Manager` and send invite. | Invitation is created and email/link status is shown. |
| 7 | Repeat for Standard user, Secretary, Technician, Read-only user, and Accountant. | Each role can be invited. |

### Test 9.2 - Change Existing User Role

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Stay on `/settings/users`. | Users table is visible. |
| 2 | Find a non-current user. | Row is visible. |
| 3 | Use the role dropdown in that row. | All assignable roles are available. |
| 4 | Select a different role. | Confirmation dialog appears. |
| 5 | Confirm. | User role changes and persists after refresh. |
| 6 | Try changing your own current user role. | Action is disabled or protected. |

### Test 9.3 - Suspend User And Force Logout Log

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | On `/settings/users`, find a non-current user. | Row is visible. |
| 2 | Click suspend. | Confirmation dialog appears. |
| 3 | Confirm. | User becomes suspended. |
| 4 | Ask that user to refresh their browser or log in. | Access is blocked or session is forced out. |
| 5 | As Super Admin, open connection logs. | `force_logout` log appears for that user/company. |

### Test 9.4 - Revoke Pending Invitation

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Create a new pending invitation. | Pending invited user appears. |
| 2 | Click revoke invitation. | Confirmation appears. |
| 3 | Confirm. | Invitation status becomes revoked. |
| 4 | Open connection logs as Super Admin. | `revoke_access` log appears. |
| 5 | Try using revoked invitation link. | Invitation cannot be accepted. |

## 10. Advanced Role Matrix QA

Use Company Admin and make sure `advancedRoles` is enabled.

### Test 10.1 - Open Role Matrix

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin. | CRM opens. |
| 2 | Click `Settings`. | Settings opens. |
| 3 | Click `Roles` or `Role Matrix`. | Role matrix page opens. |
| 4 | Open role dropdown. | Assignable roles are visible. |
| 5 | Check module rows. | Rows include users, expenses, tickets, invoices, clients, suppliers, financial dashboard, settings, and audit trail. |
| 6 | Check permission columns. | View, Create, Edit, Delete, Export, Manage columns are visible. |

### Test 10.2 - Save Role Matrix

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Select `Standard user` from role dropdown. | Matrix loads. |
| 2 | Toggle one permission checkbox. | Checkbox changes. |
| 3 | Click `Save matrix`. | Success toast appears. |
| 4 | Click refresh or reload page. | Saved checkbox remains as saved. |
| 5 | Change role and return to Standard user. | Saved permissions still appear. |

### Test 10.3 - Non-Admin Cannot Manage Role Matrix

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Standard User. | CRM opens. |
| 2 | Try opening `/settings/roles`. | Access is blocked or page is not available. |
| 3 | Try with Read Only user. | Access is blocked. |

## 11. Connection Logs QA

Use Super Admin.

### Test 11.1 - Login And Logout Logs

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as a normal CRM user. | Login succeeds. |
| 2 | Log out. | Logout succeeds. |
| 3 | Try one failed login with wrong password. | Login fails. |
| 4 | Log in as Super Admin and open `/admin/logs`. | Logs page opens. |
| 5 | Filter event type `login_success`. | Successful login appears. |
| 6 | Filter event type `login_failed`. | Failed login appears. |
| 7 | Filter event type `logout`. | Logout appears. |

### Test 11.2 - Portal Login Logs

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as accountant at `/accountant-portal/login`. | Login succeeds. |
| 2 | Log out from accountant portal. | Logout succeeds. |
| 3 | Try wrong accountant password once. | Login fails. |
| 4 | Open Super Admin connection logs. | Logs page opens. |
| 5 | Filter `portal_login_success`. | Accountant success log appears. |
| 6 | Filter `portal_login_failed`. | Accountant failed log appears. |
| 7 | Filter `logout`. | Portal logout appears. |

### Test 11.3 - Connection Log Filters

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open `/admin/logs`. | Logs page opens. |
| 2 | Filter by company. | Only selected company logs appear. |
| 3 | Filter by event type. | Only selected event type appears. |
| 4 | Filter by date period. | Only logs in that period appear. |
| 5 | Search by IP or device if search is available. | Matching logs appear. |

## 12. Permission QA By Role

### Test 12.1 - Administrator

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Administrator. | CRM opens. |
| 2 | Open `/dashboard`. | Dashboard works. |
| 3 | Open `/expenses`. | Expenses work. |
| 4 | Open `/tickets`. | Tickets work. |
| 5 | Open `/settings/users`. | User management works. |
| 6 | Open `/settings/roles`. | Role matrix works if advancedRoles enabled. |

### Test 12.2 - Manager

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Manager. | CRM opens. |
| 2 | Open `/dashboard`. | Dashboard works if permitted by role/feature flags. |
| 3 | Open `/expenses`. | Manager can view/manage operational expenses according to permissions. |
| 4 | Open `/tickets`. | Manager can view/manage tickets according to permissions. |
| 5 | Open `/settings/users`. | Manager can view users if permission allows, but should not have full admin control. |

### Test 12.3 - Standard User

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Standard User. | CRM opens. |
| 2 | Open expenses and tickets. | User sees allowed records according to own/company scope. |
| 3 | Try admin-only settings. | Access is blocked or actions are disabled. |

### Test 12.4 - Secretary

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Secretary. | CRM opens. |
| 2 | Open expenses and tickets. | Secretary can perform allowed operational work. |
| 3 | Try changing roles or feature flags. | Access is blocked. |

### Test 12.5 - Technician

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Technician. | CRM opens. |
| 2 | Open `/tickets`. | Tickets are available according to role. |
| 3 | Try `/expenses`. | Access follows configured permissions; should be blocked if not permitted. |
| 4 | Try `/settings/users`. | Access is blocked. |

### Test 12.6 - Read Only User

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Read Only user. | CRM opens. |
| 2 | Open allowed modules. | User can view allowed pages. |
| 3 | Try creating/editing/deleting expense or ticket. | Mutating actions are hidden or blocked. |
| 4 | Try changing settings. | Access is blocked. |

### Test 12.7 - External Accountant

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in through `/accountant-portal/login`. | Portal opens. |
| 2 | Try normal CRM routes. | Normal CRM access is blocked. |
| 3 | Use portal financial pages. | Read-only portal pages work. |
| 4 | Use exports if enabled. | Export works only when exports feature flag is enabled. |

## 13. Mobile QA

Use browser dev tools or a phone-size browser. Recommended width: about 390px.

### Test 13.1 - Dashboard Mobile

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Set viewport to about 390px wide. | Mobile layout appears. |
| 2 | Open `/dashboard`. | Page loads. |
| 3 | Check financial metric cards. | Cards stack cleanly and text does not overlap. |
| 4 | Check charts. | Charts fit or scroll without breaking layout. |
| 5 | Check Smart Actions and My Expenses Today. | Cards are readable and clickable. |

### Test 13.2 - Expenses Mobile

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Open `/expenses`. | Page loads. |
| 2 | Use quick filters. | Filters scroll/tap correctly. |
| 3 | Open advanced filters. | Inputs fit on screen. |
| 4 | Open create expense dialog. | Dialog fits screen and can be submitted/cancelled. |
| 5 | Click dashboard alert links again on mobile. | Filtered expenses load correctly. |

### Test 13.3 - Accountant Portal Mobile

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as accountant on mobile width. | Portal opens. |
| 2 | Open dashboard. | Metrics are readable. |
| 3 | Open purchase invoices. | Table scrolls or adapts without overlap. |
| 4 | Open sales invoices. | Table scrolls or adapts. |
| 5 | Open tickets. | List and detail are usable. |
| 6 | Open exports. | Buttons and filters fit screen. |

### Test 13.4 - Admin Mobile

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Super Admin on mobile width. | Admin area opens. |
| 2 | Open company list. | List is usable or scrolls horizontally. |
| 3 | Open company detail. | Feature flags and logs are readable. |
| 4 | Open `/admin/logs`. | Filters and table are usable. |

### Test 13.5 - Role Matrix Mobile

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin on mobile width. | CRM opens. |
| 2 | Open `/settings/roles`. | Role matrix page opens. |
| 3 | Use role dropdown. | Dropdown is usable. |
| 4 | Scroll permission table horizontally if needed. | All permission columns can be reached. |
| 5 | Save a small change. | Save button is usable and success toast appears. |

## 14. Final Smoke Test

Run this after all detailed tests.

| Step | What To Do | Expected Result |
| --- | --- | --- |
| 1 | Log in as Company Admin. | CRM opens. |
| 2 | Open dashboard, expenses, tickets, settings users, settings roles. | All pages load. |
| 3 | Log out. | Logout works. |
| 4 | Log in as Accountant. | Portal opens. |
| 5 | Open portal dashboard, purchase invoices, sales invoices, tickets, exports. | All pages load. |
| 6 | Log out. | Portal logout works. |
| 7 | Log in as Super Admin. | Admin opens. |
| 8 | Open dashboard, company detail, logs. | All pages load. |
| 9 | Check browser console. | No repeated critical errors. |
| 10 | Record final result. | Tester marks Milestone 2 pass/fail with notes. |

## 15. Final Sign-Off Template

Copy this section into the QA report after testing.

```text
Milestone 2 Manual QA Result

Tester:
Date:
Environment:
Browser:
Build/Commit:

Financial Dashboard: PASS / FAIL
Smart Alerts: PASS / FAIL
My Expenses Today: PASS / FAIL
Accountant Portal: PASS / FAIL
Accountant Tickets: PASS / FAIL
Exports and ZIP: PASS / FAIL
Super Admin: PASS / FAIL
Feature Flags: PASS / FAIL
Roles and Role Matrix: PASS / FAIL
Connection Logs: PASS / FAIL
Mobile QA: PASS / FAIL

Optional items not tested as Milestone 2 blockers:
- Super Admin 2FA/TOTP
- Support impersonation
- Platform-wide admin notification composer

Blocking issues found:
1.
2.
3.

Non-blocking notes:
1.
2.
3.

Final decision:
Milestone 2 is ACCEPTED / NOT ACCEPTED.
```
