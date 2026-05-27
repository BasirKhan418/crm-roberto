# CRM Roberto

CRM Roberto is a private, production-oriented CRM platform for client and supplier management, expenses, tickets, quotes, invoices, e-signature, reminders, and Stripe-powered payment collection.

This repository is now organized for technical handover. A new engineering team should start with the documents below before changing production infrastructure or business logic.

## Handover Documentation

| Document | Purpose |
|---|---|
| [docs/technical-handover.md](docs/technical-handover.md) | Executive technical overview, architecture diagrams, module ownership map, business flows, security notes, and roadmap. |
| [docs/api-reference.md](docs/api-reference.md) | API route groups, public/private route behavior, key workflows, and integration callbacks. |
| [docs/database-schema.md](docs/database-schema.md) | MongoDB/Mongoose collections, major fields, relationships, indexes, and state machines. |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Local setup, environment variables, build, hosting, Stripe, SMTP, S3, Redis, cron, GitHub, and ZIP backup guidance. |
| [.env.example](.env.example) | Sanitized environment variable template. Never commit real credentials. |

## Product Scope

- Dashboard with revenue, activity, reminders, follow-ups, smart actions, and ticket summaries.
- Client and supplier CRM records with notes, interactions, attachments, and follow-up scheduling.
- Product/service catalogue for reusable commercial line items.
- Quote lifecycle: draft, send, tokenized public signature, accept/reject, client reply, duplicate, and convert to invoice.
- Invoice lifecycle: issue, send, PDF generation, due dates, partial payments, reminders, legal recovery, recurrence, and payment history.
- Expenses lifecycle: draft, active, archived, categories, suppliers, attachments, paid/unpaid status, duplicate detection, and audit trail.
- Tickets lifecycle: company-scoped support/workflow tickets with assignees, messages, unread tracking, and attachments.
- Authentication, onboarding, invitations, role-based permissions, company isolation, and admin access.

## Technology Stack

- Framework: Next.js 16 App Router and Route Handlers
- Language: TypeScript with strict mode
- UI: React 19, Tailwind CSS 4, shadcn-style components, Radix primitives, lucide-react, Recharts
- Data: MongoDB Atlas-compatible database through Mongoose
- Validation and forms: Zod, react-hook-form
- Authentication: JWT in HTTP-only cookies with server-side session validation
- Payments: Stripe Checkout, Stripe webhook verification, payment records, receipts
- Storage: AWS S3 with presigned uploads for documents and logos
- Email: Nodemailer SMTP transactional email
- Redis: OTP workflows and cron locking
- Scheduling: Vercel Cron plus optional local Node scheduler

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` with development credentials. Do not reuse production secrets locally unless explicitly approved.

4. Run the development server:

```bash
npm run dev
```

5. Before delivery or deployment, run:

```bash
npm run lint
npm run build
```

## Main Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start local Next.js development server. |
| `npm run build` | Build production application. |
| `npm run start` | Serve production build. |
| `npm run lint` | Run ESLint checks. |
| `npm run cron:reminders` | Run the local reminder scheduler process. |
| `npm run worker:expenses-ocr` | Start the BullMQ worker that OCRs draft expense attachments and patches draft fields. |

## Draft Expense OCR Worker

When a user uploads a PDF, image, or HEIC file into Expenses and the app creates a draft through `/api/expenses/drafts`, the API now also enqueues a BullMQ job using `VALKEY_URL`.

This does not affect manual expense creation. The normal `POST /api/expenses` path stays synchronous and does not enqueue OCR jobs. Only the upload-to-draft path uses the queue.

Run the worker in a separate terminal:

```bash
npm run worker:expenses-ocr
```

The worker will:

1. Load the uploaded expense attachment from S3.
2. OCR images with `tesseract.js`.
3. Convert PDF pages to images and OCR them page by page.
4. Ask OpenAI for a strict JSON extraction of supplier, reference, amounts, VAT, dates, notes, and expense type.
5. Patch only still-empty or default draft fields so it does not overwrite values a user already filled manually.

Required environment variables for the worker path: `VALKEY_URL`, `OPENAI_API_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `MONGO_URI`.

Deployment shape:

- Run the Next.js app as the web process.
- Run `npm run worker:expenses-ocr` as a separate long-running worker process.
- Point both processes at the same MongoDB, Valkey, S3 bucket, and OpenAI credentials.
- If the app is hosted on Vercel, keep the worker on a persistent Node host such as Railway, Render, Fly.io, a VPS, or Docker/PM2.

## Security Handover Notice

The local environment file is intentionally not part of the repository documentation. If any real keys have been shared through chat, screenshots, ZIP files, or commits, rotate them before final delivery. This includes MongoDB, Redis, AWS, SMTP, Stripe, JWT, password pepper, and cron secrets.

## Repository Standards

- Keep secrets out of Git and ZIP archives; use `.env.example` for variable names only.
- Run `npm run lint` and `npm run build` before milestone validation.
- Keep route handlers server-only; avoid importing database or Node-only modules into client components.
- Prefer repository-layer access patterns and existing domain helpers over new ad hoc data logic.
- Update the handover docs whenever API contracts, environment variables, schema fields, cron behavior, or deployment steps change.

## Ownership

This repository is private and intended for internal product development, delivery validation, maintenance, and future technical audit.

