# CRM Roberto

CRM Roberto is an executive-grade CRM platform built for teams that need a single workspace for client management, supplier operations, notes and follow-ups, quote-to-invoice workflows, e-signature, and Stripe-powered collections.

The product is designed around one principle: fast operational execution with strong context. Users can move from lead to quote, from quote to invoice, and from invoice to payment without leaving the platform.

---

## Core Capabilities

- Client and supplier management with rich profiles
- Contextual notes, follow-up scheduling, and activity timelines
- Products and services catalogue for reusable commercial items
- Full quote lifecycle: draft, send, sign, accept/reject, convert to invoice
- Invoice lifecycle with payment states and PDF generation
- Stripe integration for checkout, deposits, and payment status sync
- Document e-signature flow with tokenized public signing route
- Multilingual UX (EN/FR) and responsive dashboard-first interface
- Guided platform onboarding tour persisted per user in database

---

## Technology Stack

- Framework: Next.js 16 (App Router, Route Handlers, Middleware)
- Language: TypeScript
- UI: React 19, Tailwind CSS, shadcn-based components, Radix primitives
- Data: MongoDB + Mongoose
- Validation: Zod
- Auth: JWT with HTTP-only cookies
- Payments: Stripe
- Storage: AWS S3 (signed upload URLs)
- Messaging: Nodemailer (transactional mail)
- OTP/ephemeral workflows: Redis
- Product Tour: driver.js

---

## Project Structure

- app: routes, pages, API handlers
- components: reusable UI, domain modules, providers, guided-tour components
- db: models and repository layer
- hooks: data and state hooks for dashboard, quotes, invoices, auth
- validators: Zod schemas for request payload validation
- lib: domain helpers (pricing, email, stripe, tokens, calculations)
- utils: middleware utilities, query parsing, S3/OTP helpers
- emails: templated email generation and transport wiring
- scripts: maintenance and operational scripts

---

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create an `.env.local` at project root and define the required variables from the table below.

### 3) Run local development

```bash
npm run dev
```

### 4) Production build and quality checks

```bash
npm run lint
npm run build
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---:|---|
| MONGO_URI | Yes | MongoDB connection string |
| JWT_SECRET | Yes | JWT signing and verification secret |
| PASSWORD_PEPPER | Yes | Additional password hardening input |
| NEXT_PUBLIC_SITE_URL | Recommended | Canonical site URL for metadata/sitemap |
| NEXT_PUBLIC_APP_URL | Recommended | Public app URL for links and callbacks |
| NEXTAUTH_URL | Optional | Fallback app URL used in specific flows |
| AWS_S3_BUCKET | Yes (if uploads enabled) | S3 bucket for files/logos |
| AWS_REGION | Yes (if uploads enabled) | AWS region for S3 |
| AWS_ACCESS_KEY_ID | Yes (if uploads enabled) | S3 credentials |
| AWS_SECRET_ACCESS_KEY | Yes (if uploads enabled) | S3 credentials |
| STRIPE_SECRET_KEY | Yes (if Stripe enabled) | Stripe API access |
| STRIPE_WEBHOOK_SECRET | Yes (if Stripe enabled) | Stripe webhook signature verification |
| EMAIL_HOST | Yes (if email enabled) | SMTP server host |
| EMAIL_PORT | Yes (if email enabled) | SMTP server port |
| EMAIL_USER | Yes (if email enabled) | SMTP username |
| EMAIL_PASSWORD | Yes (if email enabled) | SMTP password |
| EMAIL_USER_V2 | Optional | Alternate sender mailbox |
| REDIS_HOST | Yes (if OTP enabled) | Redis host |
| REDIS_PORT | Yes (if OTP enabled) | Redis port |
| REDIS_USER | Optional | Redis username |
| REDIS_PASSWORD | Optional | Redis password |
| NODE_ENV | Recommended | Runtime mode (`development` or `production`) |

---

## Authentication and Access Model

- User authentication is JWT cookie-based.
- Middleware protects app routes and enforces onboarding completion.
- Admin area uses a dedicated admin token path and separate gate.
- Public signing routes are explicitly bypassed in middleware matcher logic.

---

## Operational Flows

### Quote to Invoice

1. Create and send quote
2. Track signature and acceptance
3. Convert accepted/signed quote into invoice
4. Send invoice and monitor payment status

### Guided Onboarding Tour

- First-visit onboarding tour is route-aware and persisted per user.
- Tour progress is stored in user record and can be reset from Company Profile.
- Route handlers expose read, update, and reset behavior for tour state.

---

## API Design Notes

- API routes follow App Router Route Handler conventions.
- Input validation is schema-driven via Zod.
- Repository layer centralizes data access logic.
- Error responses are consistently shaped as JSON for front-end handling.

---

## Quality and Delivery Standards

- Type-safe codebase with strict TypeScript settings
- ESLint quality gate via `npm run lint`
- Production build gate via `npm run build`
- Focus on predictable UX behavior for dense business workflows

---

## Deployment Checklist

- Set all required environment variables in target environment
- Ensure MongoDB, Redis, Stripe, SMTP, and S3 credentials are valid
- Configure webhook endpoint for Stripe with matching secret
- Run lint and build in CI before promotion
- Validate callback URLs match deployed domain

---

## Troubleshooting

### Tour or onboarding not showing as expected

- Verify user has not already completed route tour state
- Use profile action to reset platform tour state
- Confirm normalized dynamic route keys are accepted by onboarding API

### Upload failures

- Validate AWS credentials, region, and bucket name
- Ensure bucket policy/CORS allows signed PUT operations

### Payment status inconsistencies

- Check Stripe webhook delivery status and signing secret
- Confirm invoice/payment handlers can reach Stripe APIs

---

## License and Ownership

This repository is private and intended for internal product development and operations.

# Roby-Back
# Roby-Back
