# CRM Roberto Deployment Guide

Last updated: 2026-07-13

This guide is written for a professional handover team preparing GitHub, ZIP backup, staging deployment, production deployment, and security validation.

## 1. Prerequisites

- Node.js 20 LTS or newer recommended.
- npm compatible with the lockfile used by the delivery team.
- MongoDB Atlas or compatible MongoDB deployment.
- Redis/Valkey service for OTP and cron locks.
- Redis/Valkey service if OCR worker packaging is completed and deployed.
- Stripe account with Checkout and webhook access.
- SMTP provider credentials.
- AWS S3 bucket and IAM credentials.
- OpenAI API key for uploaded draft expense extraction.
- Vercel account or equivalent Node/Next.js hosting platform.

## 2. Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Quality gates:

```bash
npm run lint
npm run build
```

The current package manifest does not provide a `worker:expenses-ocr` script. Do not attempt to run the OCR worker until its missing dependencies and script have been added and the build has been validated.

Local production smoke test:

```bash
npm run build
npm run start
```

## 3. Environment Variables

Use `.env.example` as the source of truth for variable names. Never commit `.env.local` or any file with real secrets.

| Variable | Required | Purpose |
|---|---:|---|
| `MONGO_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | JWT signing and verification secret. |
| `PASSWORD_PEPPER` | Yes | Extra secret mixed into password hashing and token hashing flows. |
| `COMPANY_BOOTSTRAP_CODE` | Production setup | Required by workspace bootstrap in production. Rotate after use. |
| `INVITATION_TOKEN_SECRET` | Recommended | Dedicated invitation token secret; falls back to `JWT_SECRET` if absent. |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app base URL for links, callbacks, emails, payment/sign URLs. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical marketing/metadata URL for sitemap and robots. |
| `NEXTAUTH_URL` | Optional | Fallback URL used by some public signing flows. |
| `AWS_REGION` | Uploads | AWS region for S3. Defaults to `eu-west-3` in code. |
| `AWS_ACCESS_KEY_ID` | Uploads | IAM access key for S3. |
| `AWS_SECRET_ACCESS_KEY` | Uploads | IAM secret key for S3. |
| `AWS_S3_BUCKET` | Uploads | S3 bucket name. |
| `STRIPE_SECRET_KEY` | Payments | Stripe secret key for Checkout and Connect. |
| `STRIPE_WEBHOOK_SECRET` | Payments | Stripe webhook signing secret for `/api/stripe/webhook`. |
| `EMAIL_HOST` | Email | SMTP host. |
| `EMAIL_PORT` | Email | SMTP port, usually `587` or `465`. |
| `EMAIL_USER` | Email | SMTP username and fallback sender. |
| `EMAIL_PASSWORD` | Email | SMTP password. |
| `EMAIL_USER_V2` | Optional email | Alternate sender address. |
| `REDIS_HOST` | OTP/cron | Redis host. |
| `REDIS_PORT` | OTP/cron | Redis port. |
| `REDIS_USER` | Optional Redis | Redis username, defaults to `default`. |
| `REDIS_PASSWORD` | Redis | Redis password. |
| `VALKEY_URL` | Pending OCR runtime | Full Valkey/Redis connection string for BullMQ once the OCR worker is packaged and deployed. |
| `CRON_SECRET` | Cron | Secret required by `/api/cron/reminders`. |
| `CRON_TARGET_URL` | Optional local cron | Target URL for `npm run cron:reminders`. |
| `EXPENSE_EMAIL_INGEST_SECRET` | Future email import | Secret for expense email ingestion endpoint. |
| `EXPENSE_INGEST_SECRET` | Future email import | Legacy/fallback ingest secret. |
| `OPENAI_API_KEY` | Pending OCR runtime | OpenAI API key used by the future packaged worker to map extracted text to structured expense fields. |
| `EXPENSE_OCR_MODEL` | Pending OCR runtime | OpenAI model override for OCR field extraction. Defaults to `gpt-4.1-mini`. |
| `EXPENSE_OCR_LANGUAGES` | Pending OCR runtime | Tesseract languages loaded by the worker. Defaults to `eng+fra`. |
| `EXPENSE_OCR_MAX_PDF_PAGES` | Pending OCR runtime | Max PDF pages OCRed per uploaded draft attachment. |
| `EXPENSE_OCR_MAX_TEXT_CHARS` | Pending OCR runtime | Max OCR text sent to OpenAI per draft job. |
| `EXPENSE_OCR_CONCURRENCY` | Pending OCR runtime | BullMQ worker concurrency for draft OCR jobs. |
| `NODE_ENV` | Runtime | `development` or `production`. |

`.env.example` is the source of truth for the currently deployable web/cron runtime. Add the pending OCR variables above to it only when the worker dependencies and script are added.

## 4. Hosting On Vercel

Recommended baseline:

1. Connect the GitHub repository to Vercel.
2. Set production and preview environment variables in Vercel Project Settings.
3. Ensure `NEXT_PUBLIC_APP_URL` matches the production domain exactly.
4. Ensure Stripe callback URLs and webhook URLs use the same production domain.
5. Deploy from the protected production branch.
6. Validate Vercel Cron jobs from `vercel.json`.

Cron configuration:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 7 * * *" },
    { "path": "/api/cron/reminders", "schedule": "0 19 * * *" }
  ]
}
```

The cron route accepts either `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

Important for expense OCR:

- Vercel should host the web app/API only.
- If/when packaged, the expense OCR worker must be a separate long-running process and must not be deployed as a serverless function.
- The checked-in OCR source cannot be deployed today: `package.json` lacks the worker command and its required runtime dependencies.

## 5. Alternative Node Hosting

For a VPS/EC2-style deployment:

1. Install Node.js 20+.
2. Install dependencies with `npm install` or `npm ci` if a lockfile is finalized.
3. Set environment variables in the process manager or secret manager.
4. Build with `npm run build`.
5. Start with `npm run start` behind HTTPS reverse proxy.
6. Run `npm run cron:reminders` as a separate supervised process if Vercel Cron is not used.

Recommended process manager controls:

- Restart on crash.
- Capture structured logs.
- Set memory limits.
- Run app and reminder scheduler as separate processes. Add an OCR worker only after its package manifest support is completed.
- Terminate TLS at a managed load balancer or reverse proxy.

Recommended process split:

- Web app: `npm run build` then `npm run start`
- Reminder scheduler when needed: `npm run cron:reminders`

Email is not a standalone worker in this release. SMTP messages are sent synchronously by web requests and the reminder scheduler. Configure and test SMTP on those processes; do not create an undeclared email worker service.

When the OCR worker is packaged, it will require access to the same MongoDB, Valkey, S3 bucket, and OpenAI key as the web app. It may run on a different host from the Next.js app if the shared services are reachable.

## 6. Stripe Setup

1. Create or select Stripe account.
2. Add `STRIPE_SECRET_KEY` to hosting environment.
3. Create webhook endpoint:

```text
https://your-domain.example/api/stripe/webhook
```

4. Subscribe to at least:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
6. Test a full invoice payment and verify:

- `Payment` document is created.
- Invoice status becomes `partial_paid` or `paid`.
- Receipt email is sent.
- Stripe dashboard shows webhook delivery success.

## 7. SMTP Setup

1. Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`.
2. Configure `EMAIL_USER_V2` if using a branded sender address.
3. Verify SPF, DKIM, and DMARC for the sender domain.
4. Send test emails for:

- Password reset.
- Invitation.
- Quote send.
- Invoice send.
- Payment receipt.
- Reminder/legal notice in staging.

## 8. AWS S3 Setup

1. Create S3 bucket.
2. Create least-privilege IAM user/policy for the required bucket operations.
3. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`.
4. Configure bucket CORS for browser uploads from the production/staging domains.
5. Configure lifecycle rules for retention and cleanup if required by business policy.
6. Test upload flows:

- General upload endpoint.
- Company logo upload/delete.
- Expense attachment upload.
- Ticket attachment upload.
- Catalogue attachment upload if used.

## 9. MongoDB Setup

1. Create production and staging databases separately.
2. Restrict network access to hosting provider IPs if possible.
3. Use separate users for staging and production.
4. Validate indexes after first deployment. Critical indexed areas include quote/invoice numbering, payment tokens, payment IDs, expenses, tickets, reminders, and audit logs.
5. Configure automated backups and point-in-time restore where available.

## 10. Redis Setup

Redis/Valkey is used for OTP and cron locks. Configure TLS if supported by provider.

Valkey is also used by BullMQ for uploaded draft expense OCR jobs.

Validation checklist:

- OTP generation and verification works.
- Cron locks prevent duplicate reminder/recurrence processing.
- Do not enable uploaded draft OCR in production until the worker packaging is complete and a queued job is successfully consumed.
- Redis credentials are not logged.

## 11. Production Deployment Checklist

- Rotate all credentials that were shared outside a secret manager.
- Confirm `.env.local` is not committed and not included in ZIP backups.
- Confirm all variables from `.env.example` are set in the hosting provider.
- Run `npm run lint`.
- Run `npm run build`.
- Deploy to staging.
- Smoke-test the three portal entry points: Company CRM (`/login`), Super Admin (`/admin/login`), and Accountant Portal (`/accountant-portal/login`).
- Create a test workspace through `/workspace-setup`, send and accept an invitation, and confirm the invited role reaches only its permitted portal.
- In Super Admin, verify company status and each feature/license flag; confirm the corresponding Company CRM and Accountant Portal access changes take effect.
- Smoke-test dashboard, clients, quotes, invoice send, payment test, manual expense create, ticket create, company/accountant exports, and cron dry run.
- Verify SMTP from web and reminder cron processes. OCR upload-draft processing remains blocked until the worker packaging is complete.
- Configure Stripe webhook and verify successful delivery.
- Configure SMTP DNS and send tests.
- Configure S3 CORS and upload tests.
- Promote to production.
- Monitor logs for first cron run and first payment webhook.

## 12. GitHub Handover Structure

Recommended repository hygiene before inviting external technical reviewers:

- Keep default branch protected.
- Require pull requests for production branch changes.
- Require `npm run lint` and `npm run build` in CI.
- Add repository secrets only to GitHub Actions if CI needs them; otherwise keep deployment secrets in hosting provider.
- Add CODEOWNERS if ownership is split across frontend, backend, infrastructure, and security reviewers.
- Ensure docs are current before each milestone validation.

Suggested top-level handover files:

- `README.md`
- `.env.example`
- `docs/technical-handover.md`
- `docs/api-reference.md`
- `docs/database-schema.md`
- `docs/deployment-guide.md`

## 13. ZIP Backup Guidance

Create source ZIP archives without generated folders or secrets.

Exclude:

- `.git/`
- `.next/`
- `node_modules/`
- `.env.local`
- Any `.env.*` file containing real secrets
- Local temporary files
- Log files

Recommended archive naming:

```text
crm-roberto-source-handover-YYYY-MM-DD.zip
```

After creating the ZIP, inspect it before sharing externally. Confirm it includes `.env.example` and `docs/`, and does not include production secrets.

## 14. Post-Deployment Validation

- Company CRM login works for administrator and standard roles.
- Super Admin login works at `/admin/login`.
- Accountant Portal login works at `/accountant-portal/login` for an `external_accountant` on a company with the feature enabled.
- Protected routes redirect unauthenticated users to login.
- Accountant users cannot access normal Company CRM protected routes; Super Admin users have a separate session.
- Workspace setup, invitation acceptance, onboarding, company status changes, and feature/license gates work as expected.
- Public `/sign/[token]` and `/pay/[token]` routes work only with valid tokens.
- Quote PDF and invoice PDF render correctly.
- Stripe test payment updates invoice status and creates a payment record.
- Receipt email is sent once per successful payment.
- Reminder cron returns success with expected counters.
- Expenses and tickets can upload attachments to S3.
- Manual expense creation does not create OCR queue jobs.
- Do not validate OCR completion until its declared dependencies and `worker:expenses-ocr` script have been supplied, deployed, and smoke-tested.
- Dashboard KPIs load within acceptable latency.
- Audit/activity logs are created for important state changes.