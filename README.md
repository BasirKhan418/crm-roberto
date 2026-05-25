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

