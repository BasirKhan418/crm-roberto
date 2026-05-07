# CRM Roberto

CRM Roberto is an executive-grade CRM platform for teams managing client relationships, supplier operations, notes, follow-ups, quote-to-invoice workflows, e-signatures, and Stripe-powered payment collection.

The platform is designed around one principle: fast operational execution with strong context. Users move from lead to quote, from quote to signed invoice, and from invoice to collected payment without leaving the application.

---

## Table of Contents

1. [Core Capabilities](#core-capabilities)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Authentication & Access Model](#authentication--access-model)
7. [Data Models](#data-models)
8. [API Reference](#api-reference)
9. [Pages & Routes](#pages--routes)
10. [Operational Flows](#operational-flows)
    - [Quote Lifecycle](#quote-lifecycle)
    - [Invoice & Payment Lifecycle](#invoice--payment-lifecycle)
    - [Payment Reminders & Collection](#payment-reminders--collection)
    - [Recurring Invoices](#recurring-invoices)
    - [E-Signature Flow](#e-signature-flow)
    - [Stripe Connect (Merchant Onboarding)](#stripe-connect-merchant-onboarding)
11. [Email System](#email-system)
12. [PDF Generation](#pdf-generation)
13. [File Storage (AWS S3)](#file-storage-aws-s3)
14. [Localization (i18n)](#localization-i18n)
15. [Activity & Audit Log](#activity--audit-log)
16. [Dashboard & KPIs](#dashboard--kpis)
17. [Onboarding Tour](#onboarding-tour)
18. [Admin Panel](#admin-panel)
19. [Frontend Hooks](#frontend-hooks)
20. [Deployment Checklist](#deployment-checklist)
21. [Troubleshooting](#troubleshooting)

---

## Core Capabilities

- **Client & Supplier Management** — Rich profiles with full contact details, billing addresses, VAT/RCS numbers, bank details, linked documents, and file attachments.
- **Notes & Follow-Ups** — Contextual notes linked to clients or suppliers with schedulable follow-up dates and an activity timeline view.
- **Catalogue** — Reusable products and services with VAT rates, pricing, images, and attachments.
- **Quote Lifecycle** — Draft → Send → Sign → Accept/Reject → Convert to Invoice.
- **Invoice Lifecycle** — Creation, PDF generation, payment tracking (unpaid / partial_paid / paid / overdue), Stripe checkout, and manual payment recording.
- **E-Signature** — Tokenized public signing route; clients sign quotes via a shareable link without registering.
- **Payment Collection** — Stripe-powered checkout with deposit, full, and partial payment options. Stripe Connect for merchant accounts.
- **Automated Reminders** — 4-level payment reminder strategy (soft → medium → firm → formal notice) with customizable templates, offsets, and late fees.
- **Recurring Invoices** — Monthly, quarterly, yearly, or custom-interval invoice regeneration with optional auto-send.
- **Multilingual UX** — EN/FR interface, email templates, and validation messages.
- **Dashboard** — Executive dashboard with KPIs, collection status, recent quotes, and upcoming recurrences.
- **Guided Onboarding Tour** — Route-aware tour via driver.js, persisted per user.
- **Admin Panel** — User management and account suspension.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers, Middleware) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS, shadcn/ui, Radix Primitives |
| Animations | Framer Motion |
| Database | MongoDB + Mongoose |
| Validation | Zod |
| Authentication | JWT (HTTP-only cookies, Argon2 password hashing) |
| Payments | Stripe (standard checkout + Connect) |
| File Storage | AWS S3 (presigned upload URLs) |
| Email | Nodemailer (SMTP) |
| OTP / Ephemeral | Redis |
| PDF Generation | @react-pdf/renderer (server-side) |
| Product Tour | driver.js |
| Scheduling | node-cron |

---

## Project Structure

```
.
├── app/                    # Next.js App Router: pages and API Route Handlers
│   ├── (auth)/             # Login, signup, forgot-password pages
│   ├── admin/              # Admin panel (user management)
│   ├── api/                # All API Route Handlers
│   ├── dashboard/          # Main dashboard
│   ├── clients/            # Client directory and profiles
│   ├── suppliers/          # Supplier directory and profiles
│   ├── quotes/             # Quote list, creation, and detail
│   ├── invoices/           # Invoice list, creation, and detail
│   ├── notes/              # Notes & follow-ups
│   ├── catalogue/          # Products/services catalogue
│   ├── sign/               # Public quote signing route
│   ├── pay/                # Public payment checkout route
│   ├── payment/            # Payment confirmation page
│   ├── onboarding/         # Onboarding flow
│   ├── profile/            # Company profile
│   └── settings/           # User settings (Stripe, reminders)
├── components/             # Reusable UI and domain components
│   ├── ui/                 # shadcn primitives
│   ├── clients/            # Client-specific components
│   ├── quotes/             # Quote-specific components
│   ├── invoices/           # Invoice-specific components
│   ├── catalogue/          # Catalogue-specific components
│   ├── dashboard/          # Dashboard widgets
│   ├── modals/             # Shared modal dialogs
│   ├── providers/          # Context providers
│   └── onboarding/         # Tour and onboarding components
├── db/
│   ├── models/             # Mongoose models (schema definitions)
│   └── repository/         # Data-access layer (all DB queries)
├── hooks/                  # React data/state hooks
├── validators/             # Zod validation schemas
├── lib/                    # Domain logic helpers
│   ├── pdf/                # PDF template components
│   ├── reminders/          # Reminder strategy logic
│   ├── recurrence/         # Recurring invoice generation
│   ├── payments/           # Payment utilities
│   ├── i18n/               # Localization messages
│   └── cron/               # Scheduled job helpers
├── utils/
│   ├── middlewares/        # Route middleware utilities
│   ├── api/                # Request parsing helpers
│   ├── s3/                 # S3 presigned URL helpers
│   └── otp/                # OTP generation and verification
├── emails/                 # Email templates and transport
├── cron/                   # Cron job entry points (reminder scheduler)
└── scripts/                # Operational scripts (e.g. seed admin)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB instance (local or Atlas)
- Redis instance (for OTP flows)
- AWS S3 bucket (for file uploads)
- Stripe account (for payment features)
- SMTP credentials (for email)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example below into `.env.local` at the project root and fill in all required values. See the [Environment Variables](#environment-variables) table for details.

### 3. Seed the admin user

```bash
npx ts-node scripts/seed-admin.ts
```

### 4. Run local development

```bash
npm run dev
```

### 5. Production build and quality checks

```bash
npm run lint
npm run build
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing and verification secret |
| `PASSWORD_PEPPER` | Yes | Additional input for Argon2 password hashing |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical site URL (used in metadata and sitemap) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public app URL (used in links, emails, callbacks) |
| `NEXTAUTH_URL` | Optional | Fallback app URL for certain flows |
| `AWS_S3_BUCKET` | Yes (uploads) | S3 bucket name for file/logo storage |
| `AWS_REGION` | Yes (uploads) | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | Yes (uploads) | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes (uploads) | AWS secret key |
| `STRIPE_SECRET_KEY` | Yes (payments) | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes (payments) | Stripe webhook signature verification secret |
| `EMAIL_HOST` | Yes (email) | SMTP server hostname |
| `EMAIL_PORT` | Yes (email) | SMTP server port |
| `EMAIL_USER` | Yes (email) | SMTP authentication username |
| `EMAIL_PASSWORD` | Yes (email) | SMTP authentication password |
| `EMAIL_USER_V2` | Optional | Alternate sender mailbox |
| `REDIS_HOST` | Yes (OTP) | Redis server hostname |
| `REDIS_PORT` | Yes (OTP) | Redis server port |
| `REDIS_USER` | Optional | Redis username (if ACL enabled) |
| `REDIS_PASSWORD` | Optional | Redis password |
| `NODE_ENV` | Recommended | `development` or `production` |

---

## Authentication & Access Model

### User Authentication

- Credentials are validated with Argon2 (bcrypt-grade hashing + pepper).
- On successful login a signed JWT is issued and stored in an **HTTP-only cookie** named `token`.
- JWT payload: `{ sub: userId, name, email, isOnboardingComplete, isEmailVerified }`
- Token lifetime: **7 days**.

### Middleware (proxy.ts)

The Next.js middleware runs on every matched request and:

1. Verifies the JWT cookie.
2. Redirects unauthenticated users to `/login`.
3. If `isEmailVerified && !isOnboardingComplete` → redirects to `/onboarding`.
4. Admin routes require an `admin-token` cookie with kind `admin`.
5. Public routes (`/login`, `/signup`, `/sign/[token]`, `/pay/[token]`) are bypassed.

### Admin Authentication

- Admin users live in a separate `Admin` collection (name, email, Argon2-hashed password).
- Admins receive an `admin-token` cookie on login.
- Admin routes are prefixed `/admin/` and `/api/admin/`.

---

## Data Models

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | Full name |
| `email` | String | Unique |
| `password` | String | Argon2 hash |
| `isEmailVerified` | Boolean | |
| `isOnboardingComplete` | Boolean | |
| `account_status` | String | `active` \| `suspended` |
| `locale` | String | `en` \| `fr` |
| `onboardingGuideSeenPages` | String[] | Pages where tour has been shown |

---

### Client

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | Owning user |
| `clientType` | String | `company` \| `individual` |
| `fullName` | String | Display name |
| `email` | String | Primary contact email |
| `phone` | String | |
| `title` | String | Mr / Ms / Dr / etc. |
| `firstName` / `lastName` | String | For individuals |
| `companyName` | String | For companies |
| `vatNumber` | String | |
| `rcsNumber` | String | |
| `businessAuthNumber` | String | |
| `bankName` / `iban` | String | |
| `billingEmail` | String | |
| `responsibleEmail` | String | Account manager email |
| `companyPhone` / `privatePhone` / `mobilePhone` | String | |
| `address` / `addressDetails` / `billingAddress` | Object | Street, postal code, city, country |
| `additionalDescription` | String | Free-form notes |

---

### Supplier

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `fullName` | String | Company or contact name |
| `contactName` | String | Primary contact person |
| `category` | String | `materials` \| `logistics` \| `services` \| `technology` \| `other` |
| `email` / `phone` | String | |
| `address` | Object | Street, postal code, city, country |
| `notes` | String | |
| `attachmentUrl` | String | Main document URL |
| `linkedDocuments` | Array | Additional linked files |

---

### Quote

| Field | Type | Notes |
|---|---|---|
| `quoteNumber` | String | Auto-sequenced per user/year (e.g. `Q-2025-001`) |
| `clientId` | ObjectId | Ref → Client |
| `clientSnapshot` | Object | Denormalized client data at quote creation |
| `date` | Date | |
| `subject` | String | |
| `lineItems` | Array | See [Line Item Structure](#line-item-structure) |
| `notes` | String | Footer notes |
| `paymentTerms` | String | |
| `validityDays` | Number | Days until quote expires |
| `depositPercentage` | Number | |
| `status` | String | `draft` \| `sent` \| `accepted` \| `rejected` |
| `signedStatus` | String | `not_signed` \| `signed` |
| `signatureToken` | String | Token for public sign link |
| `statusHistory` | Array | Timestamped status transitions |
| `totalExcludingTax` | Number | |
| `totalVat` | Number | |
| `totalIncludingTax` | Number | |

---

### Invoice

| Field | Type | Notes |
|---|---|---|
| `invoiceNumber` | String | Format `FAC-YYYY-###` |
| `quoteId` / `quoteNumber` | ObjectId / String | Source quote (optional) |
| `clientId` | ObjectId | Ref → Client |
| `clientSnapshot` | Object | Denormalized at creation |
| `date` / `dueDate` | Date | |
| `subject` / `notes` | String | |
| `lineItems` | Array | See [Line Item Structure](#line-item-structure) |
| `status` | String | `unpaid` \| `partial_paid` \| `paid` \| `overdue` |
| `depositPercentage` / `depositAmount` / `depositPaidAt` | Number / Date | |
| `totalExcludingTax` / `totalVat` / `totalIncludingTax` | Number | |
| `paymentToken` | String | UUID for payment link |
| `paymentTokenExpiry` | Date | Default 30 days |
| `recurrence` | ObjectId | Ref → Recurrence |
| `reminderState` | String | Reminder flow state |

---

### Line Item Structure

Used in both Quote and Invoice:

| Field | Notes |
|---|---|
| `productId` | Optional ref to CatalogueItem |
| `name` | Product/service name |
| `quantity` | |
| `unitPriceExcludingTax` | Effective price after discounts |
| `baseUnitPriceExcludingTax` | Original price before discount |
| `discountPercentage` | |
| `vatRate` | e.g. `17` for 17% |
| `totalExcludingTax` | Computed |
| `vatAmount` | Computed |
| `totalIncludingTax` | Computed |

---

### Payment

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `invoiceId` | ObjectId | Ref → Invoice |
| `stripePaymentId` | String | Stripe session or intent ID |
| `amount` | Number | In EUR |
| `currency` | String | Always `EUR` |
| `type` | String | `deposit` \| `full` \| `remaining_balance` |
| `status` | String | `pending` \| `succeeded` \| `failed` |
| `method` | String | Payment method descriptor |
| `source` | String | `stripe` \| `manual` |
| `paidAt` | Date | |

---

### Note

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `title` | String | |
| `description` | String | |
| `linkedType` | String | `client` \| `supplier` |
| `linkedId` | ObjectId | |
| `followUpDate` | Date | Optional |

---

### CatalogueItem

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `name` | String | |
| `type` | String | `product` \| `service` |
| `priceExcludingTax` | Number | |
| `priceIncludingTax` | Number | |
| `vatRate` | Number | Default `17` |
| `currency` | String | `EUR` |
| `description` | String | |
| `attachmentUrl` | String | |
| `imageUrl` | String | |

---

### CompanyProfile

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | Unique |
| `companyName` / `ownerName` | String | |
| `phone` / `businessEmail` | String | |
| `address` | Object | street, postal code, city, country |
| `vatNumber` / `rcsNumber` / `businessAuthNumber` / `matriculeNumber` | String | |
| `iban` / `bankName` | String | |
| `legalIdentifier` | String | Optional |
| `logoUrl` | String | S3 URL |

---

### ReminderSettings

| Field | Notes |
|---|---|
| `userId` | Unique per user |
| `reminders.isEnabled` | Global toggle |
| `templates` | Per-level (soft/medium/firm/formalNotice) × per-locale (en/fr): subject + body |
| `offsets` | Days after due date to trigger each level |
| `lateFeeConfig` | `type` (`fixed`/`percentage`), `amount`, `startLevel` |
| `legalRecoveryCourtInfo` | Jurisdiction data for formal notice PDF |

---

### Other Models

| Model | Purpose |
|---|---|
| `Activity` | Audit log: `userId`, `action`, `entityType`, `entityName`, `entityId`, `metadata` |
| `Interaction` | Client interactions: `type` (call/meeting/email/discussion), `title`, `notes`, `date`, `followUpDate` |
| `QuoteSignature` | E-signature record: `token`, `signatureDataUrl`, `signedAt`, `clientIp`, `isUsed` |
| `Notification` | In-app: `type`, `title`, `message`, `invoiceId`, `isRead` |
| `StripeConnect` | Merchant account: `stripeAccountId`, `chargesEnabled`, `payoutsEnabled`, `onboardingComplete` |
| `ReminderLog` | Reminder audit: `level` (1-4), `channel`, `status`, `lateFeeAmount` |
| `ClientAttachment` | File uploads: `fileName`, `fileUrl`, `fileType`, `fileSize`, `s3Key` |
| `QuoteSequence` | Per-user/year counter for auto-incrementing quote numbers |
| `Admin` | Admin users: `name`, `email`, `password` |

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require the `token` cookie. Request bodies are `application/json`. Errors are returned as `{ error: string }`.

---

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/(auth)/login` | No | Login; sets `token` cookie |
| `POST` | `/api/(auth)/change-password` | Yes | Change own password |
| `GET` | `/api/me` | Yes | Get current user (`?fch=1` to bypass cache) |
| `PATCH` | `/api/me` | Yes | Update locale preference |

---

### Clients

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/clients` | Yes | List clients. Query: `page`, `limit`, `sortBy`, `sortOrder`, `clientType`, `search` |
| `POST` | `/api/clients` | Yes | Create client |
| `GET` | `/api/clients/[id]` | Yes | Get client detail |
| `PATCH` | `/api/clients/[id]` | Yes | Update client |
| `DELETE` | `/api/clients/[id]` | Yes | Delete client |
| `GET` | `/api/clients/[id]/timeline` | Yes | Notes timeline. Query: `page`, `limit` |

---

### Suppliers

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/suppliers` | Yes | List suppliers. Query: `page`, `limit`, `category`, `search` |
| `POST` | `/api/suppliers` | Yes | Create supplier |
| `GET` | `/api/suppliers/[id]` | Yes | Get supplier detail |
| `PATCH` | `/api/suppliers/[id]` | Yes | Update supplier |
| `DELETE` | `/api/suppliers/[id]` | Yes | Delete supplier |

---

### Quotes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/quotes` | Yes | List quotes. Query: `page`, `limit`, `status`, `sort`, `search` |
| `POST` | `/api/quotes` | Yes | Create quote |
| `GET` | `/api/quotes/[id]` | Yes | Get quote detail |
| `PATCH` | `/api/quotes/[id]` | Yes | Update quote |
| `DELETE` | `/api/quotes/[id]` | Yes | Delete quote |
| `POST` | `/api/quotes/[id]/send` | Yes | Send quote email with PDF and signing link |
| `PATCH` | `/api/quotes/[id]/status` | Yes | Update quote status |
| `POST` | `/api/quotes/[id]/duplicate` | Yes | Clone quote |
| `GET` | `/api/quotes/[id]/action-counts` | Yes | Sidebar badge counts for this quote |
| `GET` | `/api/quotes/next-number` | Yes | Preview next auto-generated quote number |
| `GET` | `/api/quotes/kpis` | Yes | Quote pipeline KPIs |

---

### Invoices

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/invoices` | Yes | List invoices. Query: `page`, `limit`, `status`, `search`, `sort`, `dueDateFrom`, `dueDateTo` |
| `POST` | `/api/invoices` | Yes | Create invoice (standalone or convert from quote) |
| `GET` | `/api/invoices/[id]` | Yes | Get invoice detail |
| `PATCH` | `/api/invoices/[id]` | Yes | Update invoice |
| `DELETE` | `/api/invoices/[id]` | Yes | Delete invoice |
| `GET` | `/api/invoices/next-number` | Yes | Next invoice number for current year |
| `GET` | `/api/invoices/[id]/paymentsDone` | Yes | Payment history for invoice |
| `POST` | `/api/invoices/[id]/payments` | Yes | Manually record a payment |
| `GET` | `/api/invoices/kpis` | Yes | Collection KPIs (active cases, overdue count, reminders sent) |

---

### Notes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notes` | Yes | List notes. Query: `linkedType`, `linkedId` |
| `POST` | `/api/notes` | Yes | Create note |
| `GET` | `/api/notes/[id]` | Yes | Get note |
| `PATCH` | `/api/notes/[id]` | Yes | Update note |
| `DELETE` | `/api/notes/[id]` | Yes | Delete note |

---

### Catalogue

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/catalogue` | Yes | List items. Query: `page`, `limit`, `type`, `minPrice`, `maxPrice`, `search` |
| `POST` | `/api/catalogue` | Yes | Create catalogue item |
| `GET` | `/api/catalogue/[id]` | Yes | Get item |
| `PATCH` | `/api/catalogue/[id]` | Yes | Update item |
| `DELETE` | `/api/catalogue/[id]` | Yes | Delete item |

---

### Payments & Checkout (Public)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/pay/[token]` | No | Fetch invoice data for payment page (outstanding amount, deposit options) |
| `POST` | `/api/pay/[token]/checkout` | No | Create Stripe checkout session |
| `POST` | `/api/pay/[token]/confirm` | No | Confirm payment after Stripe redirect |

---

### E-Signature (Public)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/sign/[token]` | No | Fetch quote for signing |
| `POST` | `/api/sign/[token]/reply` | No | Submit signature (canvas data URL, client IP, user agent) |

---

### Stripe

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stripe/connect` | Yes | Start Stripe Connect onboarding; returns redirect URL |
| `GET` | `/api/stripe/connect/callback` | Yes | Stripe Connect callback; stores account status |
| `POST` | `/api/stripe/webhooks` | No (signed) | Handle Stripe webhook events |

**Handled webhook events:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `account.updated` (Connect account status changes)

---

### Reminders

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/reminders/settings` | Yes | Get user's 4-level reminder configuration |
| `PATCH` | `/api/reminders/settings` | Yes | Update reminder settings (templates, offsets, late fees) |
| `POST` | `/api/reminders/settings/reset` | Yes | Reset all settings to platform defaults |

---

### Activity & Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/activity` | Yes | Paginated activity feed. Query: `page`, `limit` |
| `GET` | `/api/activity/[id]` | Yes | Single activity entry |
| `GET` | `/api/activity/events` | Yes | List of all trackable event types |
| `GET` | `/api/dashboard/kpis` | Yes | Dashboard KPIs |
| `GET` | `/api/dashboard/activity` | Yes | Recent activity for dashboard widget |
| `GET` | `/api/sidebar/badges` | Yes | Sidebar notification badge counts |
| `POST` | `/api/sidebar/mark-read` | Yes | Mark notifications as read |

---

### Company Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/cprofile` | Yes | Get company profile |
| `POST` | `/api/cprofile` | Yes | Create company profile |
| `PATCH` | `/api/cprofile` | Yes | Update company profile |
| `POST` | `/api/cprofile/logo` | Yes | Get S3 presigned URL for logo upload |

---

### Onboarding

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/onboarding` | Yes | Get onboarding state |
| `POST` | `/api/onboarding/complete` | Yes | Mark onboarding as complete |

---

### File Upload

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/upload` | Yes | Get S3 presigned PUT URL for client-side upload |

---

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | Admin | List all users with status |
| `PATCH` | `/api/admin/users/[id]/status` | Admin | Suspend or activate a user account |

---

## Pages & Routes

### Public Routes

| Route | Description |
|---|---|
| `/login` | User login |
| `/signup` | User registration |
| `/forgot-password` | Password reset request |
| `/sign/[token]` | Public quote signing page (no login required) |
| `/pay/[token]` | Public Stripe payment checkout page (no login required) |
| `/payment` | Payment success/failure confirmation |

### Admin Routes

| Route | Description |
|---|---|
| `/admin/login` | Admin login |
| `/admin` | User management dashboard (list, suspend, activate) |

### Protected Routes (authenticated users)

| Route | Description |
|---|---|
| `/dashboard` | Executive dashboard: KPIs, activity feed, recent quotes, collection status, upcoming recurrences |
| `/clients` | Client directory with grid/list toggle, search, type filter, add/edit/delete |
| `/clients/[id]` | Client profile: timeline of notes, linked quotes, linked invoices, interactions |
| `/suppliers` | Supplier directory with search and category filter |
| `/suppliers/[id]` | Supplier profile |
| `/notes` | Notes & follow-ups list linked to clients or suppliers |
| `/catalogue` | Products/services catalogue with type and price filters |
| `/quotes` | Quote list with status filter, search, sort |
| `/quotes/new` | Create a new quote |
| `/quotes/[id]` | Quote detail: edit, send, sign, duplicate, convert to invoice |
| `/invoices` | Invoice list with status filter, search, sort |
| `/invoices/new` | Create a standalone invoice |
| `/invoices/[id]` | Invoice detail: edit, record payment, download PDF, manage reminders |
| `/profile` | Company profile: name, address, VAT/RCS, IBAN, logo |
| `/settings` | User settings |
| `/settings/stripe` | Stripe Connect onboarding |
| `/settings/reminders` | 4-level reminder strategy, templates, late fees |
| `/onboarding` | Initial setup flow (company profile + logo) |
| `/logout` | Session termination |

---

## Operational Flows

### Quote Lifecycle

```
Create (draft)
  → Edit line items, notes, validity, deposit
  → Send (PDF emailed + tokenized signing link)
  → Client signs via /sign/[token]
  → Status: accepted or rejected
  → Convert to Invoice
```

1. User creates a quote and selects a client from the directory.
2. Line items reference catalogue products/services or are entered manually.
3. Taxes, discounts, and totals are computed automatically.
4. Quote is sent by email with an attached PDF and a unique signing link.
5. Client opens the signing page, reviews terms, and submits a canvas signature.
6. `QuoteSignature` record is created; quote `signedStatus` → `signed`.
7. User converts the quote to an invoice (all line items and client data are copied).

---

### Invoice & Payment Lifecycle

```
Invoice created (unpaid)
  → Payment link shared: /pay/[paymentToken]
  → Client selects payment type (deposit / full / partial)
  → Stripe checkout session created
  → Payment webhook received → Payment record created
  → Invoice status updated (unpaid → partial_paid → paid)
  → Receipt email sent to client
```

**Payment types:**

| Type | Description |
|---|---|
| `deposit` | Percentage of total defined on invoice |
| `full` | Full invoice amount |
| `remaining_balance` | Remaining after a prior deposit |

**Invoice status transitions:**

| From | To | Trigger |
|---|---|---|
| `unpaid` | `partial_paid` | Deposit payment received |
| `unpaid` / `partial_paid` | `paid` | Full or remaining payment received |
| `unpaid` | `overdue` | Past due date |
| `overdue` | `paid` | Late payment received |

---

### Payment Reminders & Collection

The platform applies a 4-level reminder strategy after the invoice due date:

| Level | Name | Default Offset | Tone |
|---|---|---|---|
| 1 | Soft | Day 7 | Friendly |
| 2 | Medium | Day 15 | Assertive |
| 3 | Firm | Day 30 | Final demand |
| 4 | Formal Notice | Day 35 | Legal notice with court jurisdiction |

**Features:**
- Templates are fully customizable per level and per locale (EN/FR).
- Offset days are configurable per level.
- Late fees can be applied starting from a chosen level (fixed amount or percentage of invoice total).
- Reminder flow can be paused or resumed per invoice.
- All sent reminders are recorded in `ReminderLog` (level, channel, status, late fee applied, recipient).
- The scheduler (`cron/reminders-scheduler.js`) runs on a configurable interval and triggers due reminders.
- A **Formal Notice PDF** is generated and attached to Level 4 emails.

---

### Recurring Invoices

| Frequency | Description |
|---|---|
| Monthly | Regenerates every calendar month |
| Quarterly | Every 3 months |
| Yearly | Once per year |
| Custom | Every N days |

- A recurrence template is attached to a parent invoice.
- At generation time a new invoice is created, copying all line items, notes, deposit config, and client snapshot.
- A fresh `paymentToken` and expiry are assigned.
- If `autoSend` is enabled, the invoice email is dispatched automatically.
- A `Notification` entry is created for each generated invoice.
- Upcoming recurrences are surfaced on the dashboard.

---

### E-Signature Flow

1. User sends quote → backend generates a `signatureToken` (UUID) and `tokenExpiry` (configurable days).
2. Signing URL: `{APP_URL}/sign/{signatureToken}`
3. Client opens URL (no login required). Quote data is fetched via `GET /api/sign/[token]`.
4. Client draws signature on canvas and submits.
5. Backend validates token, marks `isUsed = true`, saves `QuoteSignature` with canvas data URL, client IP, and user agent.
6. Quote `signedStatus` → `signed`. Activity logged.

---

### Stripe Connect (Merchant Onboarding)

1. User goes to `/settings/stripe` and clicks **Connect Stripe**.
2. `GET /api/stripe/connect` creates a Stripe Express account and returns an onboarding URL.
3. User completes Stripe's hosted onboarding flow.
4. Stripe redirects to `GET /api/stripe/connect/callback`.
5. `StripeConnect` document is updated: `chargesEnabled`, `payoutsEnabled`, `onboardingComplete`.
6. Payments made through the platform are routed through the user's connected Stripe account.

---

## Email System

All emails are sent via Nodemailer (SMTP). Templates are HTML-based with EN/FR variants.

| Email | Trigger |
|---|---|
| Quote sent | `POST /api/quotes/[id]/send` |
| Invoice sent | Invoice action |
| Payment receipt | Stripe webhook or manual payment |
| Reminder (levels 1–4) | Reminder scheduler |
| Formal notice | Level 4 reminder |
| Password reset | Forgot-password flow |
| Follow-up reminder | Scheduled follow-up date reached |

Emails include:
- Company logo (from `CompanyProfile.logoUrl`)
- Relevant PDF attachment (quote, invoice, or formal notice)
- Personalized client data
- Payment or signing link where applicable

---

## PDF Generation

All PDFs are rendered server-side using `@react-pdf/renderer`.

| Template | Description |
|---|---|
| `QuotePdfTemplate` | Quote with line items, totals, validity, company header, client info |
| `InvoicePdfTemplate` | Invoice with due date, payment terms, deposit info, payment URL |
| `LegalNoticePdfTemplate` | Formal notice for overdue invoice; includes court jurisdiction data |
| `ReminderHistoryPdfTemplate` | Full audit trail of all reminders sent for an invoice |
| `PaymentOrderPdfTemplate` | Payment order document for manual payment recording |

PDFs are streamed directly in API responses or attached to emails.

---

## File Storage (AWS S3)

All user-uploaded files are stored in an S3 bucket using presigned PUT URLs.

| Use Case | Size Limit | Accepted Types |
|---|---|---|
| Company logo | 5 MB | JPEG, PNG, WebP, SVG |
| Client attachments | Configurable | PDF, JPEG, PNG, and more |
| Catalogue images | Configurable | JPEG, PNG, WebP |
| Supplier documents | Configurable | PDF, JPEG, PNG |

**Upload flow:**
1. Client calls `POST /api/upload` with file metadata.
2. Backend generates a presigned S3 PUT URL (expires in 5 minutes).
3. Client uploads directly to S3 using the presigned URL.
4. Client stores the resulting S3 URL on the relevant entity.

S3 key pattern: `{userId}/{entityType}/{filename}`

---

## Localization (i18n)

| Locale | Language |
|---|---|
| `en` | English |
| `fr` | French |

- Locale preference is stored per user and togglable from the UI at any time.
- Translated: UI labels, validation error messages, email templates, reminder templates, PDF documents, timestamp formatting.
- Currency is always **EUR** regardless of locale.
- Zod validation uses `__i18n__:{key}` placeholder tokens; the runtime resolves them to the user's locale.

---

## Activity & Audit Log

Every significant action is recorded in the `Activity` collection.

**Tracked action types:**

| Domain | Actions |
|---|---|
| Clients | `client_created`, `client_updated`, `client_deleted` |
| Suppliers | `supplier_created`, `supplier_updated`, `supplier_deleted` |
| Notes | `note_created`, `note_updated`, `note_deleted` |
| Catalogue | `product_created`, `product_updated`, `product_deleted` |
| Quotes | `quote_created`, `quote_updated`, `quote_deleted`, `quote_sent`, `quote_client_replied`, `quote_status_changed`, `quote_duplicated` |
| Invoices | `invoice_created`, `invoice_payment_received`, `invoice_payment_updated`, `invoice_payment_deleted` |

Each log entry stores: `userId`, `action`, `entityType`, `entityName`, `entityId`, `metadata`, `createdAt`.

---

## Dashboard & KPIs

The dashboard is fully customizable: users can toggle widget visibility and reorder blocks (persisted in `localStorage`).

**Widgets:**

| Widget | Data Source |
|---|---|
| Smart Actions | Quick-add buttons (client, quote, invoice) |
| Top Insights | Active clients, total revenue, outstanding amount |
| Collection Status | Active cases, paused reminders, formal notices sent |
| Recent Activity | Last 10 activity log entries |
| Recent Quotes | Last 5 quotes with status badges |
| Upcoming Recurrences | Recurring invoices due within the next 14 days |

Data is fetched from `GET /api/dashboard/kpis` and `GET /api/dashboard/activity`.

---

## Onboarding Tour

The guided tour runs on first visit to each major route and highlights key UI elements using **driver.js**.

**Onboarding flow:**

1. **Step 1 — Company Profile:** Fill in company name, owner name, phone, email, address, business IDs (VAT, RCS, matricule), and bank details (IBAN).
2. **Step 2 — Logo Upload:** Optional upload (JPEG/PNG/WebP/SVG, max 5 MB) stored in S3. Used on all generated PDFs and emails.

**Tour state:**
- The pages where a user has seen the tour are stored in `User.onboardingGuideSeenPages[]`.
- The tour can be reset from the Company Profile page, which clears all seen page entries.
- `GET /api/onboarding` returns the current state; `POST /api/onboarding/complete` marks it done.

---

## Admin Panel

Accessible at `/admin` with a separate `admin-token` cookie.

**Features:**
- List all registered users with account status (`active` / `suspended`).
- Suspend a user account (blocks all authenticated access).
- Reactivate a suspended user account.

Admin users are seeded via `scripts/seed-admin.ts` and cannot self-register.

---

## Frontend Hooks

| Hook | Purpose |
|---|---|
| `useAuthMe()` | Current user + loading state (fetches from `/api/me`) |
| `useClients()` | Client list with pagination and refetch |
| `useQuotes()` | Quote list with status/search/sort filters and pagination |
| `useInvoices()` | Invoice list with status/search/sort/date filters |
| `useDashboard()` | Dashboard KPIs and activity data |
| `useInvoicesActionCount()` | Sidebar badge count for invoices |
| `useQuotesActionCount()` | Sidebar badge count for quotes |
| `useRejectedQuotesCount()` | Count of rejected quotes |
| `useSignedQuotesCount()` | Count of signed (pending conversion) quotes |
| `useSidebarBadges()` | Aggregated sidebar notification badges |
| `use-mobile.ts` | Detects mobile viewport |
| `use-adaptive-dropdown-position.ts` | Adaptive dropdown positioning logic |

---

## Deployment Checklist

- [ ] All required environment variables set in target environment
- [ ] MongoDB, Redis, SMTP, S3, and Stripe credentials are valid and accessible
- [ ] Stripe webhook endpoint configured with matching `STRIPE_WEBHOOK_SECRET`
- [ ] S3 bucket CORS policy allows presigned PUT from app domain
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployed domain (used in signing and payment links)
- [ ] Admin user seeded: `npx ts-node scripts/seed-admin.ts`
- [ ] Reminder cron job deployed and running (`cron/reminders-scheduler.js`)
- [ ] `npm run lint && npm run build` pass cleanly
- [ ] Vercel (or equivalent) env vars configured; `vercel.json` reviewed for rewrites

---

## Troubleshooting

### Onboarding tour not appearing

- Check `User.onboardingGuideSeenPages` — if the route key is already present, the tour won't show again.
- Reset tour state from the Company Profile page.
- Ensure dynamic route keys match the normalized format expected by `POST /api/onboarding`.

### File upload failures

- Verify `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
- Confirm the S3 bucket CORS configuration allows `PUT` from your application domain.
- Check presigned URL expiry (default 5 minutes); re-request if expired.

### Payment status not updating

- Inspect Stripe dashboard for webhook delivery status and any failures.
- Verify `STRIPE_WEBHOOK_SECRET` matches the secret configured in the Stripe dashboard.
- Ensure the webhook handler at `POST /api/stripe/webhooks` is reachable from Stripe's IP ranges.

### Reminder emails not sending

- Confirm the cron job (`cron/reminders-scheduler.js`) is running.
- Check `ReminderSettings.reminders.isEnabled` is `true` for the user.
- Review `ReminderLog` for `failed` entries and inspect the `error` field.
- Validate SMTP credentials and ensure the mail server is reachable.

### Quote signing link expired or invalid

- `signatureToken` is single-use (`isUsed = true` after first submission).
- Re-send the quote to generate a fresh token.
- Verify `paymentTokenExpiry` has not passed.

---

## License and Ownership

This repository is private and intended for internal product development and operations.

