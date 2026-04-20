# Sprint Plan — Reminders & Collection Module + Recurring Invoices (MVP)
**CRM Roberto — Phase 1**  
Prepared by: Aniket (Devsomeware) | Version 1.0

> **How to use this file:**  
> Each section has a ready-to-paste prompt. Copy the entire prompt block and paste it into the chat. Execute milestones in order — later steps depend on earlier ones.

---

## Overview

| Milestone | Focus | Est. Weight |
|---|---|---|
| M1 | Foundations — schemas, models, i18n, activity enum | 15% |
| M2 | Reminder engine — settings API + cron skeleton | 20% |
| M3 | Reminder emails + manual actions API | 20% |
| M4 | Formal notice — Legal PDF + level-4 logic | 10% |
| M5 | Recurring invoices — model + API + cron pass | 15% |
| M6 | Settings UI — template editor + offsets + late fees | 10% |
| M7 | Invoice detail UI — Collection tab + Recurrence card | 5% |
| M8 | Dashboard widgets + internal notifications | 3% |
| M9 | Payments — Apple Pay / Google Pay via Stripe | 2% |

---

## MILESTONE 1 — Foundations

### Step 1 — Extend Invoice model with reminderState + recurrence sub-documents

```
We are building the Reminders & Collection module for CRM Roberto.

TASK: Extend `db/models/Invoice.ts` to add two optional sub-documents to the InvoiceSchema:

1. `reminderState` sub-document (all fields optional, default null/0 so existing invoices are unaffected):
   - level: Number (0-4, default 0) — 0=none,1=soft,2=medium,3=firm,4=formal notice
   - lastSentAt: Date (default null)
   - nextScheduledAt: Date (default null) — sparse index needed
   - isPaused: Boolean (default false)
   - lateFeeAmount: Number (default 0, stored in cents)
   - formalNoticeSentAt: Date (default null)
   - formalNoticeDeadline: Date (default null)

2. `recurrence` sub-document (all fields optional):
   - isActive: Boolean (default false)
   - frequency: String enum ["monthly","quarterly","yearly","custom"] (default null)
   - customIntervalDays: Number (default null) — used only when frequency="custom"
   - nextOccurrenceAt: Date (default null) — sparse index needed
   - lastGeneratedAt: Date (default null)
   - lastGeneratedInvoiceId: ObjectId ref "Invoice" (default null)
   - endDate: Date (default null) — optional hard stop
   - stoppedAt: Date (default null)
   - stoppedReason: String (default null)
   - autoGenerate: Boolean (default false) — auto-generate next invoice (Roberto's request)
   - autoSend: Boolean (default false) — auto-send generated invoice to client

Add sparse ascending indexes for:
- `reminderState.nextScheduledAt`
- `recurrence.nextOccurrenceAt`

Keep all existing fields intact. Do not remove or rename anything.
```

---

### Step 2 — Create ReminderSettings Mongoose model

```
TASK: Create a new file `db/models/ReminderSettings.ts`.

This is a new MongoDB collection, one document per user, seeded lazily on first access.

Schema fields:
- userId: ObjectId ref "User", required, unique, indexed
- offsets: { soft: Number (default 7), medium: Number (default 15), firm: Number (default 30), formalNotice: Number (default 35) }
- templates: {
    en: {
      soft: { subject: String, body: String },
      medium: { subject: String, body: String },
      firm: { subject: String, body: String },
      formalNotice: { subject: String, body: String }
    },
    fr: { same shape as en }
  }
  — all template fields have sensible defaults (see the default templates in Section 6 of the TRD document).
  Default soft EN subject: "Friendly reminder — invoice {{invoiceNumber}}"
  Default soft EN body: the full template from Section 6.2 of the TRD.
  Default formalNotice FR subject: "Mise en demeure — facture {{invoiceNumber}}"
  Default formalNotice FR body: the full template from Section 6.3 of the TRD.
  For medium and firm, write professional EN and FR defaults that match the tone described in Section 5.1.
- lateFee: {
    enabled: Boolean (default false),
    type: String enum ["fixed","percentage"] (default "percentage"),
    value: Number (default 0),
    applyFrom: String enum ["medium","firm","formalNotice"] (default "formalNotice")
  }
- legalNotice: {
    delayDays: Number enum [8,15] (default 8),
    includeInterestClause: Boolean (default true),
    customFooter: String (default null)
  }
- channels: {
    email: { enabled: Boolean (default true) },
    whatsapp: { enabled: Boolean (default false), provider: String (default null) }
  }
- timestamps: true

Export as: `mongoose.models.ReminderSettings || mongoose.model('ReminderSettings', ReminderSettingsSchema)`

Also export a TypeScript type: `type IReminderSettings = InferSchemaType<typeof ReminderSettingsSchema>`
```

---

### Step 3 — Create ReminderLog Mongoose model

```
TASK: Create a new file `db/models/ReminderLog.ts`.

Schema fields:
- userId: ObjectId ref "User", required, indexed
- invoiceId: ObjectId ref "Invoice", required, indexed
- level: Number enum [1,2,3,4], required
- channel: String enum ["email","whatsapp"], default "email"
- status: String enum ["sent","failed","skipped"], required
- skippedReason: String (default null)
- subject: String, required
- bodyPreview: String (first 280 chars of email body)
- recipientEmail: String, required
- lateFeeAmount: Number (default 0, cents)
- error: String (default null)
- sentAt: Date, required
- pdfAttached: Boolean (default false)
- timestamps: true

Compound index: { userId: 1, invoiceId: 1, sentAt: -1 }

Export as: `mongoose.models.ReminderLog || mongoose.model('ReminderLog', ReminderLogSchema)`
Also export: `type IReminderLog = InferSchemaType<typeof ReminderLogSchema>`
```

---

### Step 4 — Extend Activity model enum + add new activity helper actions

```
TASK: Extend `db/models/Activity.ts` to support the new reminder and recurrence actions.

Add these new string values to the `action` enum array:
- "invoice_reminder_sent"
- "invoice_reminder_paused"
- "invoice_reminder_resumed"
- "invoice_formal_notice_sent"
- "invoice_recurrence_created"
- "invoice_recurrence_stopped"
- "invoice_recurrence_generated"

Also add "reminder" and "recurrence" to the `entityType` enum array (keep all existing values).

Do NOT change anything else in the model.
```

---

### Step 5 — Add i18n keys for reminders and recurring namespaces

```
TASK: Open `lib/i18n/messages.ts` and add two new top-level namespaces to BOTH the `en` and `fr` message objects: `reminders` and `recurring`.

For the `reminders` namespace add keys (EN / FR translations):
- settings.title: "Reminder Settings" / "Paramètres de relance"
- settings.offsets: "Timing" / "Délais"
- settings.templates: "Email Templates" / "Modèles d'e-mail"
- settings.lateFee: "Late Fees" / "Pénalités de retard"
- settings.legalNotice: "Legal Notice" / "Mise en demeure"
- settings.resetSection: "Reset to defaults" / "Réinitialiser"
- levels.soft: "Soft reminder" / "Rappel amical"
- levels.medium: "Medium reminder" / "Rappel ferme"
- levels.firm: "Firm reminder" / "Dernier rappel"
- levels.formalNotice: "Formal notice" / "Mise en demeure"
- status.notStarted: "Not started" / "Non démarré"
- status.paused: "Paused" / "En pause"
- status.softSent: "Soft sent" / "Rappel amical envoyé"
- status.mediumSent: "Medium sent" / "Rappel ferme envoyé"
- status.firmSent: "Firm sent" / "Dernier rappel envoyé"
- status.formalNoticeSent: "Formal notice sent" / "Mise en demeure envoyée"
- actions.sendNow: "Send reminder now" / "Envoyer maintenant"
- actions.pause: "Pause reminders" / "Mettre en pause"
- actions.resume: "Resume reminders" / "Reprendre"
- actions.downloadNotice: "Download legal notice" / "Télécharger la mise en demeure"
- actions.skipNext: "Skip next reminder" / "Ignorer le prochain rappel"
- history.title: "Reminder history" / "Historique des relances"
- nextScheduled: "Next reminder in {days} days" / "Prochain rappel dans {days} jours"

For the `recurring` namespace add keys:
- card.title: "Recurrence" / "Récurrence"
- card.empty: "Make this invoice recurring" / "Rendre cette facture récurrente"
- frequency.monthly: "Monthly" / "Mensuel"
- frequency.quarterly: "Quarterly" / "Trimestriel"
- frequency.yearly: "Yearly" / "Annuel"
- frequency.custom: "Custom" / "Personnalisé"
- actions.generate: "Generate next invoice" / "Générer la prochaine facture"
- actions.stop: "Stop recurrence" / "Arrêter la récurrence"
- actions.stopReason: "Reason (optional)" / "Raison (optionnel)"
- autoGenerate: "Auto-generate next invoice" / "Générer automatiquement"
- autoSend: "Auto-send to client" / "Envoyer automatiquement au client"
- nextOccurrence: "Next occurrence" / "Prochaine échéance"
- lastGenerated: "Last generated" / "Dernière génération"

Keep all existing keys intact. Only add, never remove.
```

---

## MILESTONE 2 — Reminder Settings API

### Step 6 — Create GET /api/reminders/settings and PATCH /api/reminders/settings

```
TASK: Create the Reminder Settings API routes. The directory structure should be:
- `app/api/reminders/settings/route.ts` — handles GET and PATCH
- `app/api/reminders/settings/reset/route.ts` — handles POST (reset a section to defaults)

Follow the exact same pattern as existing routes in `/api/cprofile/route.ts` and `/api/invoices/route.ts`:
- Auth via `getMe(true)` middleware from `utils/middlewares/`
- Scope everything by `me.user.id`
- Use `NextResponse.json` for all responses
- Handle errors the same way existing routes do

GET /api/reminders/settings:
- Find ReminderSettings by { userId: me.user.id }
- If not found, create a new document with all the defaults defined in the model (lazy seeding)
- Return the full settings document

PATCH /api/reminders/settings:
- Accept partial body — any combination of: offsets, templates (per locale, per level), lateFee, legalNotice, channels
- Validate with Zod (create a `validators/reminder-settings.schema.ts` file):
  - offsets: all numbers > 0, soft < medium < firm, formalNotice >= firm
  - templates: subject max 200 chars, body max 4000 chars
  - lateFee.value: must be >= 0
  - lateFee.type: "fixed" | "percentage"
  - legalNotice.delayDays: 8 | 15
- Use findOneAndUpdate with upsert:true so the document is created if missing
- Return the updated document

POST /api/reminders/settings/reset:
- Accept body: { section: "offsets" | "templates" | "lateFee" | "legalNotice" }
- Reset only the specified section to the default values (same defaults as the model)
- Return the updated document

Create `validators/reminder-settings.schema.ts` with the Zod schemas.
```

---

### Step 7 — Create cron endpoint skeleton + Redis idempotency helper

```
TASK: Create `app/api/cron/reminders/route.ts` — the main scheduler endpoint.

Security: This endpoint must verify the header `x-cron-secret` matches `process.env.CRON_SECRET`.
If the header is missing or wrong, return 401 immediately. Never expose any data on 401.

The route handler should:
1. Verify x-cron-secret header → 401 if invalid
2. Log `console.info` with `{ event: "cron-run-start", timestamp: new Date().toISOString() }`
3. Call two passes in sequence:
   a. `await runReminderPass()` — returns { processed, sent, skipped, failed }
   b. `await runRecurrencePass()` — returns { processed, generated, skipped }
4. Log `console.info` with `{ event: "cron-run-end", ...totals }`
5. Return 200 with the combined totals

Create `lib/cron/reminder-pass.ts`:
- Export `async function runReminderPass()` — for now just return { processed: 0, sent: 0, skipped: 0, failed: 0 }
- Add a TODO comment: "// TODO M3: implement reminder sending logic"

Create `lib/cron/recurrence-pass.ts`:
- Export `async function runRecurrencePass()` — for now just return { processed: 0, generated: 0, skipped: 0 }
- Add a TODO comment: "// TODO M5: implement recurrence generation logic"

Create `lib/cron/redis-lock.ts`:
- Import ioredis from `utils/otp/connectRedis.ts` (check how it's used there and reuse the same connection pattern)
- Export `async function acquireLock(key: string, ttlSeconds: number): Promise<boolean>`
  - Uses Redis SET with NX + EX options
  - Returns true if lock acquired, false if already locked
- Export `async function releaseLock(key: string): Promise<void>`
  - Deletes the key

Do NOT implement the full cron logic yet — that is M3 and M5.
```

---

## MILESTONE 3 — Reminder Engine (Levels 1-3)

### Step 8 — Email sender for reminders

```
TASK: Add two new email sender functions to `lib/email.ts`.

Study the existing `sendInvoice` function in that file to understand the pattern (Nodemailer, HTML template, PDF attachment).

Add function 1: `sendInvoiceReminder(params: SendReminderParams): Promise<void>`

params type:
- to: string
- clientName: string
- companyName: string
- invoiceNumber: string
- subject: string       — the rendered subject (variables already substituted)
- htmlBody: string      — the rendered HTML body (variables already substituted)
- pdfBuffer?: Buffer    — invoice PDF (optional, reattached for firm/formalNotice)
- locale?: "en" | "fr"

Implementation:
- Use the existing `ConnectEmailClient()` pattern
- Wrap the rendered htmlBody inside `buildDocumentEmailTemplate` if that helper exists, otherwise create a simple wrapper that adds the company signature footer
- Send via transporter.sendMail
- Throw on error (the cron will catch per-invoice)

Add function 2: `sendFormalNotice(params: SendFormalNoticeParams): Promise<void>`

params type: same as SendReminderParams plus:
- legalNoticePdfBuffer: Buffer  — the separate legal notice PDF

Implementation: same as sendInvoiceReminder but attaches TWO PDFs (invoice PDF + legal notice PDF).

Do NOT add any hardcoded email addresses or credentials. Reuse exactly what already exists for SMTP config.
```

---

### Step 9 — Template variable substitution utility

```
TASK: Create `lib/reminders/substitute-variables.ts`.

Export function: `substituteVariables(template: string, vars: ReminderVariables): string`

Type `ReminderVariables`:
- clientName: string
- companyName: string
- invoiceNumber: string
- invoiceDate: string          — already formatted for locale
- dueDate: string              — already formatted for locale
- daysOverdue: number
- amountDue: string            — formatted as EUR string e.g. "1 234,00 €"
- amountOriginal: string       — formatted as EUR string
- lateFees: string             — formatted EUR or empty string ""
- paymentLink: string          — full URL or empty string ""
- legalDeadline: string        — formatted date or empty string ""

Implementation:
- Replace all occurrences of {{variableName}} with the corresponding value
- Use a single regex replace pass: template.replace(/\{\{(\w+)\}\}/g, ...)
- If a variable key is not in the vars object, replace it with an empty string (never leave {{...}} in the output)
- Return the substituted string

Also export a helper: `buildReminderVars(invoice, settings, companyProfile, locale): ReminderVariables`
- invoice: the full Invoice document (Mongoose doc or plain object)
- settings: ReminderSettings document
- companyProfile: CompanyProfile document
- locale: "en" | "fr"
- Compute daysOverdue as Math.max(0, dayjs().diff(invoice.dueDate, "day")) — use dayjs which is already available
- Format amountDue as the remaining unpaid amount
- Include paymentLink only if invoice has a valid Stripe payment token (check how /pay works in the existing codebase)
- Return a complete ReminderVariables object

Import dayjs carefully — check how it is imported in the existing codebase first.
```

---

### Step 10 — Core reminder pass logic (levels 1-3)

```
TASK: Implement `lib/cron/reminder-pass.ts` (replace the skeleton from Step 7).

Full algorithm:
1. Connect to MongoDB (reuse connectDb pattern from `db/connectDb.ts`)
2. Query invoices where:
   - status in ["unpaid", "partial_paid", "overdue"]
   - reminderState.isPaused is NOT true
   - reminderState.nextScheduledAt <= new Date()  (or nextScheduledAt is null but dueDate is past)
   - Populate clientSnapshot from the invoice document (it's a snapshot, no join needed)
   Limit 100 per run (process in pages to avoid memory issues).

3. For each invoice:
   a. Re-check: if invoice.status === "paid" → write ReminderLog {status:"skipped", skippedReason:"invoice_paid"} → continue
   b. Load ReminderSettings for invoice.userId (use findOne, with lean())
   c. Compute targetLevel from offsets + dueDate:
      - daysOverdue = today - dueDate
      - if daysOverdue >= offsets.formalNotice → targetLevel = 4
      - else if >= offsets.firm → targetLevel = 3
      - else if >= offsets.medium → targetLevel = 2
      - else if >= offsets.soft → targetLevel = 1
      - else → skip (not yet due for any reminder)
   d. If targetLevel === invoice.reminderState.level → skip (already sent this level)
   e. If targetLevel === 4 → skip for now (handled in M4); write skipped log with reason "formal_notice_deferred"
   f. Acquire Redis lock: `reminder:${invoiceId}:${targetLevel}` with 600s TTL → if fails, skip
   g. Resolve locale via CompanyProfile.locale or default "fr"
   h. Get template: settings.templates[locale][levelKey] (levelKey: "soft"|"medium"|"firm")
   i. Compute lateFeeAmount:
      - If settings.lateFee.enabled and targetLevel meets applyFrom threshold → compute amount
      - Otherwise 0
   j. Substitute variables using substituteVariables() from Step 9
   k. Send email via sendInvoiceReminder() from Step 8
   l. Write ReminderLog document
   m. Update invoice.reminderState: { level: targetLevel, lastSentAt: now, nextScheduledAt: computed_next }
      - nextScheduledAt = compute next level's offset date OR null if level 3 reached
   n. Call createActivityLog with action "invoice_reminder_sent" and metadata {level, channel:"email", recipientEmail, lateFeeAmount}
   o. On any error: catch, write ReminderLog {status:"failed", error: err.message}, release lock, continue
   p. Track consecutive failures: if invoice has failed 3+ times consecutively, set isPaused=true and log a console.warn

4. Return totals { processed, sent, skipped, failed }

Import all models at the top. Use mongoose lean() where possible for read-only queries.
Do not break the existing invoice API — only update reminderState fields.
```

---

### Step 11 — Manual reminder actions API (send now, pause, resume, skip)

```
TASK: Create manual reminder action API endpoints.

Create directory: `app/api/invoices/[id]/reminders/`

File 1: `app/api/invoices/[id]/reminders/send/route.ts` — POST
- Auth via getMe(true)
- Body (Zod validated): { level: 1|2|3|4, subject?: string, body?: string } — optional overrides
- Validate invoice belongs to me.user.id
- If invoice status is "paid" → return 400 "Invoice is already paid"
- Use the same logic as reminder-pass.ts for template rendering
- Send email, write ReminderLog, update reminderState, createActivityLog
- Return { success: true, log: ReminderLog }

File 2: `app/api/invoices/[id]/reminders/pause/route.ts` — POST
- Set invoice.reminderState.isPaused = true, reminderState.nextScheduledAt = null
- createActivityLog action "invoice_reminder_paused"
- Return updated invoice

File 3: `app/api/invoices/[id]/reminders/resume/route.ts` — POST
- Set invoice.reminderState.isPaused = false
- Recompute nextScheduledAt based on current level and offsets
- createActivityLog action "invoice_reminder_resumed"
- Return updated invoice

File 4: `app/api/invoices/[id]/reminders/logs/route.ts` — GET
- Query param: page (default 1), limit (default 20)
- Return paginated ReminderLog for this invoiceId, sorted by sentAt desc
- Only return logs belonging to me.user.id

All routes: follow the exact same error handling pattern as existing invoice routes.
```

---

## MILESTONE 4 — Formal Notice (Level 4 + Legal PDF)

### Step 12 — Legal Notice PDF template

```
TASK: Create `lib/pdf/LegalNoticePdfTemplate.tsx`.

Study `lib/pdf/InvoicePdfTemplate.tsx` carefully first to understand:
- How @react-pdf/renderer is used
- The visual layout (logo, fonts, colors, spacing)
- How company data and client data are structured
- How the PDF is rendered to a Buffer

Create a new React PDF component `LegalNoticePdfTemplate` with props:
- companyProfile: (logo, name, address, vatNumber, iban, bankName)
- clientName: string
- clientAddress?: string
- invoiceNumber: string
- invoiceDate: string
- dueDate: string
- daysOverdue: number
- amountDue: string
- amountOriginal: string
- lateFees?: string
- legalDeadline: string
- legalNoticeDate: string  — today's date formatted
- delayDays: 8 | 15
- includeInterestClause: boolean
- customFooter?: string
- locale: "en" | "fr"

Layout (same visual grammar as InvoicePdfTemplate):
- Header: company logo top-left, company identity block top-right
- Title: "MISE EN DEMEURE" (FR) or "FORMAL NOTICE" (EN) — bold, large
- Sub-header: "Par lettre recommandée avec accusé de réception" (FR only)
- Date block: city/date of legal notice
- Recipient block: client name/address
- Body text: multi-paragraph professional legal text using the default template from Section 6.3 of the TRD (but using props, not hardcoded values)
- Signature block: company name, owner name
- Legal footer: standard late-interest clause (if includeInterestClause), customFooter if provided
- Page numbers

Also export: `async function renderLegalNoticePdf(props): Promise<Buffer>` — same pattern as the invoice PDF render function.
```

---

### Step 13 — Level 4 formal notice logic + PDF download endpoint

```
TASK: Complete level-4 (formal notice) support.

Part A — Update `lib/cron/reminder-pass.ts`:
Remove the "skip formal_notice_deferred" guard added in Step 10.
When targetLevel === 4:
- Render the invoice PDF (with late fees line if applicable)
- Render the legal notice PDF using renderLegalNoticePdf() from Step 12
- Send via sendFormalNotice() (attaches both PDFs)
- Set invoice.reminderState.formalNoticeSentAt = now
- Set invoice.reminderState.formalNoticeDeadline = now + settings.legalNotice.delayDays days
- Write ReminderLog with pdfAttached: true
- createActivityLog with action "invoice_formal_notice_sent", metadata { deadline, lateFeeAmount }

Part B — Update `app/api/invoices/[id]/reminders/send/route.ts` (from Step 11):
When level === 4, follow the same formal-notice flow.

Part C — New endpoint `app/api/invoices/[id]/reminders/legal-notice/pdf/route.ts` — GET:
- Auth via getMe(true)
- Verify invoice belongs to me.user.id
- Verify invoice.reminderState.level >= 4 (return 403 if not yet reached)
- Re-render the LegalNoticePdfTemplate with the invoice's current data
- Return as PDF: Response with headers Content-Type: application/pdf, Content-Disposition: attachment
```

---

## MILESTONE 5 — Recurring Invoices

### Step 14 — Recurrence API endpoints

```
TASK: Create recurrence management endpoints.

Create directory: `app/api/invoices/[id]/recurrence/`

File 1: `app/api/invoices/[id]/recurrence/route.ts`

POST — Attach or replace recurrence:
- Auth via getMe(true)
- Body (Zod — create schema in validators/recurrence.schema.ts):
  { frequency: "monthly"|"quarterly"|"yearly"|"custom",
    customIntervalDays?: number (required when frequency="custom", min 1),
    endDate?: string (ISO date, optional),
    nextOccurrenceAt?: string (ISO date, optional — if not provided, compute from dueDate + interval),
    autoGenerate?: boolean (default false),
    autoSend?: boolean (default false) }
- Compute nextOccurrenceAt if not provided:
  - monthly: add 1 month to invoice.dueDate
  - quarterly: add 3 months
  - yearly: add 1 year
  - custom: add customIntervalDays days
- Set invoice.recurrence = { isActive: true, frequency, customIntervalDays, nextOccurrenceAt, endDate, autoGenerate, autoSend, stoppedAt: null, stoppedReason: null }
- createActivityLog action "invoice_recurrence_created" metadata { frequency, nextOccurrenceAt }
- Return updated invoice

DELETE — Stop recurrence:
- Body: { reason?: string }
- Set invoice.recurrence.isActive = false, stoppedAt = now, stoppedReason = reason
- Clear recurrence.nextOccurrenceAt = null (so cron ignores it)
- createActivityLog action "invoice_recurrence_stopped" metadata { reason }
- Return updated invoice

File 2: `app/api/invoices/[id]/recurrence/generate/route.ts` — POST
- Auth via getMe(true)
- Verify recurrence.isActive === true
- Acquire Redis lock: `recurrence:${invoiceId}:${nextOccurrenceAt.toISOString()}` with 600s TTL
- Duplicate the invoice:
  - Copy all lineItems, clientSnapshot, userId, notes, paymentTerms, vatRate, discounts
  - Generate new invoiceNumber (call the existing next-number logic — study app/api/invoices/next-number/route.ts)
  - Set new date = today, new dueDate = today + (same interval as recurrence)
  - Set status = "unpaid"
  - Set payments = []
  - Set reminderState = { level: 0, isPaused: false } (fresh cycle)
  - Set recurrence = {} (the new invoice has no recurrence by default)
- Save new invoice
- Update source invoice: recurrence.lastGeneratedAt = now, recurrence.lastGeneratedInvoiceId = newInvoice._id
- Advance nextOccurrenceAt by one interval (or set null if past endDate)
- If autoSend is true on the recurrence → call sendInvoice() to send the new invoice to the client
- createActivityLog action "invoice_recurrence_generated" metadata { sourceInvoiceId, newInvoiceId, newInvoiceNumber }
- Release lock
- Return { newInvoice }
```

---

### Step 15 — Recurrence pass in cron

```
TASK: Implement `lib/cron/recurrence-pass.ts` (replace the skeleton from Step 7).

Algorithm:
1. Connect to MongoDB
2. Query invoices where:
   - recurrence.isActive = true
   - recurrence.nextOccurrenceAt <= new Date()
   - recurrence.stoppedAt = null

3. For each invoice:
   a. Acquire Redis lock: `recurrence:${invoiceId}:${nextOccurrenceAt.toISOString()}` 600s TTL → skip if fails
   b. Check if endDate is set and now > endDate → stop recurrence (set isActive=false) and continue
   c. Load ReminderSettings and CompanyProfile for invoice.userId
   d. If autoGenerate === true:
      - Call the same duplication logic as the generate endpoint (Step 14)
      - If autoSend === true: send the invoice email to the client
      - Log activity "invoice_recurrence_generated"
   e. If autoGenerate === false:
      - Send a "recurrence due" notification email to the owner (not the client):
        Subject: "Invoice {{invoiceNumber}} is due to be renewed today"
        Body: brief note with a link to the invoice detail page
      - This is an internal email to the CRM owner only
   f. Release lock
   g. Track totals

4. Return { processed, generated, skipped }
```

---

## MILESTONE 6 — Settings UI

### Step 16 — Reminder Settings page (template editor)

```
TASK: Create the Settings → Reminders UI page.

Create `app/settings/reminders/page.tsx` (settings section likely already has a layout — check app/settings/ first).

The page has four sections, each in a collapsible card:

Section 1 — Timing (offsets):
- Four number inputs: Soft (days), Medium (days), Firm (days), Formal Notice (days)
- Inline validation: soft < medium < firm ≤ formalNotice
- "Save timing" button

Section 2 — Email Templates:
- Four template cards: Soft / Medium / Firm / Formal Notice
- Each card has EN and FR tabs (shadcn/ui Tabs)
- Subject: Input field
- Body: Textarea (min 8 rows)
- Live preview panel: render the template with sample variables (use placeholder data: clientName="Jean Dupont", invoiceNumber="INV-2024-001", amountDue="1 234,00 €", dueDate="15/01/2025", etc.)
- "Save template" button per card
- "Reset to default" link per card (calls POST /api/reminders/settings/reset)

Section 3 — Late Fees:
- Toggle: Enable late fees (switch)
- When enabled show:
  - Type: Fixed amount / Percentage (radio)
  - Value: number input (€ or %)
  - Apply from: dropdown (Medium / Firm / Formal Notice)

Section 4 — Legal Notice:
- Delay: 8 days / 15 days (radio buttons)
- Include interest clause: checkbox
- Custom footer: textarea (optional)

Use shadcn/ui components (Card, Tabs, Input, Textarea, Switch, RadioGroup, Select, Button).
Use the existing useAuthMe hook for auth. Fetch settings via SWR or React Query matching the existing pattern in the codebase.
All strings via i18n keys added in Step 5.
```

---

### Step 17 — Add Reminders link to settings navigation

```
TASK: Add a "Reminders" link to the settings navigation in the app.

First, find where the settings sidebar/nav is defined (check `app/settings/layout.tsx` or `components/app-sidebar.tsx`).
Add a navigation item: label "Reminders" (EN) / "Relances" (FR), icon: Bell (from lucide-react), href "/settings/reminders".

Also ensure the settings layout at `app/settings/` exists and wraps child pages properly.
If `app/settings/layout.tsx` does not exist, create a minimal one that renders children inside the existing CRM shell.
```

---

## MILESTONE 7 — Invoice Detail UI

### Step 18 — Collection tab on invoice detail page

```
TASK: Add a "Collection" tab to the invoice detail page.

Open `app/invoices/[id]/page.tsx` and study the existing tab structure.

Add a new tab "Collection" (EN) / "Relances" (FR) next to the existing tabs.

Tab content — `components/invoices/CollectionTab.tsx` (create this file):

Top section — Status card:
- Status chip: color-coded badge (gray=Not started, yellow=Soft sent, orange=Medium sent, red=Firm sent, crimson=Formal notice sent, slate=Paused)
- Next scheduled reminder: plain text "Next reminder in X days" (or "Paused" or "Completed")
- Action buttons row:
  - "Send reminder now" → opens a modal (see below)
  - "Pause" / "Resume" toggle
  - "Skip next" button
  - "Download legal notice PDF" → disabled until level >= 4, opens PDF in new tab

Send-now modal — `components/invoices/SendReminderModal.tsx`:
- Level selector: 1-3 (radio, pre-selects next logical level)
- Subject input (pre-filled from template)
- Body textarea (pre-filled from template, editable)
- "Send" button → POST /api/invoices/:id/reminders/send
- Show success toast / error toast on completion

Bottom section — Reminder history timeline:
- Fetch GET /api/invoices/:id/reminders/logs
- Render a vertical timeline list with:
  - Level badge (Soft / Medium / Firm / Formal Notice)
  - Status dot (green=sent, red=failed, gray=skipped)
  - Subject preview (truncated to 60 chars)
  - "via email" icon
  - Relative date (e.g. "3 days ago")
- "Load more" pagination button

Use shadcn/ui components. Match the visual style of existing invoice tabs.
Use SWR for data fetching (matching the existing hooks pattern in hooks/).
```

---

### Step 19 — Recurrence card on invoice detail page

```
TASK: Add a Recurrence card to the invoice detail page.

Create `components/invoices/RecurrenceCard.tsx`.

Place it above the payments panel in `app/invoices/[id]/page.tsx`.

Empty state (recurrence.isActive is false and never set):
- Single card with a dashed border
- Icon + text: "Make this invoice recurring"
- CTA button: "Set up recurrence" → opens SetupRecurrenceModal

SetupRecurrenceModal — `components/invoices/SetupRecurrenceModal.tsx`:
- Frequency selector: Monthly / Quarterly / Yearly / Custom (tabs or radio)
- Custom interval: number input in days (shown only when Custom selected)
- Next occurrence date: date picker (pre-filled with computed date, editable)
- End date: date picker (optional, labeled "Repeat until (optional)")
- Auto-generate toggle: "Automatically generate next invoice" ON/OFF
- Auto-send toggle: "Automatically send to client" (only enabled when auto-generate is ON)
- "Save" button → POST /api/invoices/:id/recurrence

Active state (recurrence.isActive === true):
- Frequency badge (e.g. "Monthly")
- Next occurrence: date in plain text
- Last generated: relative date + link to the generated invoice (if lastGeneratedInvoiceId exists)
- "Generate now" button → POST /api/invoices/:id/recurrence/generate (with loading state)
- "Stop recurrence" button → opens StopRecurrenceDialog

StopRecurrenceDialog:
- Confirm dialog with a text input: "Reason (optional)"
- Matches the existing rejection comment UX pattern in the codebase
- On confirm → DELETE /api/invoices/:id/recurrence

Stopped state:
- Shows "Recurrence stopped on {date}" with optional reason
- "Restart recurrence" CTA that resets to empty state

All strings via i18n keys from Step 5.
```

---

## MILESTONE 8 — Dashboard Widgets + Internal Notifications

### Step 20 — Dashboard Collection KPI widget

```
TASK: Add collection KPIs to the dashboard.

First, create a new API route `app/api/dashboard/reminders/route.ts` — GET:
- Auth via getMe(true)
- Aggregate from Invoice collection grouped by reminderState.level:
  { level0: count, level1: count, level2: count, level3: count, level4: count, paused: count }
- Also return: overdueCount (invoices past formalNoticeDeadline that are still unpaid)
- Also return: upcomingRecurrences (invoices with recurrence.nextOccurrenceAt in next 14 days, limit 5, include invoiceNumber + clientSnapshot.fullName + nextOccurrenceAt)
- Return all as one JSON object

Then, create `components/dashboard/CollectionWidget.tsx`:
- A card with title "Collection" and an alert icon
- Grid of 5 mini-stat chips: "No reminder", "Soft", "Medium", "Firm", "Formal Notice" — each showing count
- Red alert row if overdueCount > 0: "X invoice(s) past formal notice deadline — action required"
- Render this widget in `app/dashboard/page.tsx` (study the existing dashboard structure first)

Create `components/dashboard/UpcomingRecurrencesWidget.tsx`:
- Card with title "Upcoming recurrences"
- List of up to 5 items: invoice number + client name + "due in X days" badge
- Each row has a "Generate" quick-action button → POST /api/invoices/:id/recurrence/generate
- Empty state: "No recurrences due in the next 14 days"
- Render below the CollectionWidget in the dashboard
```

---

### Step 21 — Internal CRM notifications system

```
TASK: Build a lightweight in-app notification system for CRM-side alerts.

Part A — Data model:
Create `db/models/Notification.ts`:
- userId: ObjectId, required, indexed
- type: String enum ["reminder_sent","formal_notice_sent","recurrence_due","recurrence_generated"], required
- title: String, required
- message: String, required
- invoiceId: ObjectId ref "Invoice" (default null)
- invoiceNumber: String (default null)
- isRead: Boolean (default false)
- createdAt: Date (auto)

Index: { userId: 1, isRead: 1, createdAt: -1 }

Part B — API routes:
Create `app/api/notifications/route.ts` — GET:
- Return last 20 notifications for me.user.id, sorted by createdAt desc
- Return unreadCount alongside the list

Create `app/api/notifications/[id]/read/route.ts` — PATCH:
- Mark a single notification as read

Create `app/api/notifications/read-all/route.ts` — POST:
- Mark all notifications for me.user.id as read

Part C — Trigger notifications:
In `lib/cron/reminder-pass.ts`, after each successful send, also create a Notification document:
- type: "reminder_sent" or "formal_notice_sent"
- title: e.g. "Reminder sent — INV-2024-001"
- message: e.g. "Level 2 reminder sent to client@email.com"

In `lib/cron/recurrence-pass.ts`, after each action, create a Notification:
- type: "recurrence_due" or "recurrence_generated"

Part D — Bell icon:
The `components/notifications-bell.tsx` already exists. Update it to:
- Fetch GET /api/notifications on mount and poll every 60 seconds (or use SWR with refreshInterval: 60000)
- Show a red badge with unreadCount on the bell icon (hide badge when 0)
- Dropdown panel: list the 10 most recent notifications with title, message, relative time
- "Mark all as read" button at the top of the dropdown
- Each notification row links to the invoice detail page if invoiceId is present
- On click of a notification row → PATCH /api/notifications/:id/read
```

---

## MILESTONE 9 — Payments (Apple Pay / Google Pay)

### Step 22 — Stripe Payment Request API (Apple Pay + Google Pay)

```
TASK: Add Apple Pay and Google Pay support to the payment page.

Study the existing payment flow in `app/pay/` and `app/api/pay/` and `lib/stripe.ts` first.

Backend changes — update `app/api/pay/` route(s):
- When creating a Stripe PaymentIntent, ensure `payment_method_types` includes both 'card' and optionally leave it as automatic (Stripe recommends passing automatic_payment_methods: { enabled: true } which auto-includes Apple Pay and Google Pay when available)
- The PaymentIntent should already handle this if you use `automatic_payment_methods: { enabled: true }` — verify the existing code and add it if missing

Frontend changes — update the payment page component:
- Add the Stripe Payment Request Button element (from @stripe/react-stripe-js)
- Use `stripe.paymentRequest({ country: 'LU', currency: 'eur', total: { label: companyName, amount: amountInCents }, requestPayerName: true, requestPayerEmail: true })`
- Check `paymentRequest.canMakePayment()` — if returns non-null, show the PaymentRequestButtonElement above the card form
- Show Apple Pay button on iPhone/Safari, Google Pay on Android/Chrome (Stripe handles this automatically via the PaymentRequestButtonElement)
- Layout: Payment Request Button → divider "or pay with card" → existing card form below
- Mobile-first: the button should be full-width and the most prominent element
- Keep the existing card form as fallback

Architecture note: add a comment `// Future: PayPal can be added here as a separate payment method option` above the payment methods section.

Ensure the @stripe/stripe-js and @stripe/react-stripe-js packages are already installed (check package.json — do not install if already present).
```

---

## MILESTONE 10 — Quick Actions & Permissions (Roberto's Requests)

### Step 23 — Quick action buttons on dashboard invoice rows

```
TASK: Add quick actions to the invoice list on the dashboard.

Study the existing invoice list or dashboard component to understand the current row structure.

For each overdue/unpaid invoice row in the dashboard, add a quick-action dropdown (using shadcn/ui DropdownMenu):
- "Send reminder" → POST /api/invoices/:id/reminders/send (with level auto-set to next logical level)
- "Generate recurrence" (only shown if recurrence.isActive) → POST /api/invoices/:id/recurrence/generate
- "View invoice" → navigate to /invoices/:id

The dropdown trigger should be a small "..." (MoreHorizontal from lucide-react) icon button at the end of each row.
Show a loading spinner on the row while an action is in progress.
Show a toast on success or error.

For bulk actions, add a checkbox to each invoice row in the invoice list page (`app/invoices/page.tsx`):
- When one or more checkboxes are selected, show a floating action bar at the bottom of the screen
- Bulk actions available: "Send reminder to selected" (sends at next logical level for each) and "Export selected" (deferred — show as disabled with tooltip "Coming soon")
- The "Send reminder to selected" action calls POST /api/invoices/:id/reminders/send for each selected invoice sequentially (not in parallel — to avoid SMTP rate limits)
- Show a progress indicator while bulk sending
```

---

### Step 24 — Basic role-based permission guards for reminders

```
TASK: Add basic permission checks for reminder-sensitive actions.

Context: CRM Roberto currently has a single-user model (one user per account). Roberto mentioned wanting basic control over who can send reminders, edit templates, and manage settings. For Phase 1, implement a simple permission flag on the User model.

Step 1 — Extend User model (`db/models/User.ts`):
Add a `permissions` object field:
- canSendReminders: Boolean (default true)
- canEditReminderTemplates: Boolean (default true)
- canManageReminderSettings: Boolean (default true)

All default to true so existing users are unaffected.

Step 2 — Guard the sensitive endpoints:
In the following routes, after getMe(true), check the permission flag and return 403 if not allowed:
- POST /api/invoices/:id/reminders/send → requires canSendReminders
- PATCH /api/reminders/settings → requires canManageReminderSettings
- POST /api/reminders/settings/reset → requires canManageReminderSettings

Step 3 — Hide UI elements:
In the CollectionTab component (Step 18), if the user's permissions.canSendReminders is false, disable/hide the "Send reminder now" button with a tooltip "You don't have permission to send reminders".
In the Settings → Reminders page (Step 16), if canManageReminderSettings is false, show the settings read-only with a banner "Contact your account owner to change these settings".

Fetch permissions as part of the existing useAuthMe hook — they are already on the user object.
```

---

## MILESTONE 11 — Vercel Cron Configuration

### Step 25 — vercel.json cron config + environment variable checklist

```
TASK: Configure Vercel Cron for the reminder scheduler.

Create or update `vercel.json` at the project root.

Add the cron configuration:
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "0 19 * * *"
    }
  ]
}

Note: Vercel Cron sends a GET request by default, but our endpoint is POST. 
Check Vercel's documentation behavior — if Vercel Cron only supports GET, change the cron/reminders route to accept GET as well (with the same x-cron-secret validation), and internally call the same runReminderPass + runRecurrencePass functions.

Also create `ENVIRONMENT_CHECKLIST.md` at the project root (this is the only md file you should create):
List every environment variable needed for the new module:
- CRON_SECRET — random secret string, add to Vercel environment variables
- All existing SMTP variables (confirm they are already present: EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, etc.)
- All existing Redis/Valkey variables (confirm from utils/otp/connectRedis.ts)
- NEXT_PUBLIC_APP_URL — needed for generating payment links in reminder emails

Include instructions: "Add CRON_SECRET to Vercel Dashboard → Settings → Environment Variables before deploying."
```

---

## Cross-Cutting Concerns

### Step 26 — High-risk client identification (dashboard flag)

```
TASK: Add high-risk client identification as a structure for future use (Roberto's request).

Part A — Client model update (`db/models/Client.ts`):
Add a computed/stored field:
- riskScore: Number (default 0) — updated by cron
- riskLevel: String enum ["low","medium","high","critical"] (default "low")
- overdueInvoiceCount: Number (default 0)
- totalOverdueAmount: Number (default 0, cents)

Part B — Update cron (add to reminder-pass.ts end of run):
After processing all invoices, run an aggregation to update client risk scores:
- For each client, count invoices where status in ["unpaid","overdue"] and daysOverdue > 30
- If count >= 3 or totalOverdueAmount > 500000 (5000 EUR in cents) → riskLevel = "critical"
- If count >= 2 or totalOverdueAmount > 200000 → riskLevel = "high"  
- If count >= 1 → riskLevel = "medium"
- Otherwise → "low"
- Update the client document with new risk data

Part C — Dashboard client risk widget:
Add a small "At-risk clients" section to the dashboard showing clients with riskLevel "critical" or "high":
- Client name, number of overdue invoices, total overdue amount
- Red/orange color coding
- Link to client detail page
- Empty state: "No at-risk clients" (green checkmark)

This is the foundation — advanced scoring (payment history, dispute patterns) is Phase 2.
```

---

## Final Steps

### Step 27 — End-to-end smoke test checklist

```
TASK: Write a manual smoke test script as inline comments in `app/api/cron/reminders/route.ts`.

Add a comment block at the top of the file (after the imports) documenting the test steps:

// SMOKE TEST CHECKLIST — run before each deployment
// 1. Create an invoice dated 40 days ago with status "unpaid" → cron should send formal notice
// 2. Create an invoice dated 16 days overdue → cron should send medium reminder
// 3. Mark the invoice from step 2 as "paid" → cron should skip it on next run
// 4. Create a recurring monthly invoice due yesterday → cron should send recurrence-due notification
// 5. Set autoGenerate=true on a recurrence → cron should create a new invoice
// 6. Test the send-now endpoint via curl: POST /api/invoices/:id/reminders/send {level:1}
// 7. Verify ReminderLog is created for each action
// 8. Verify Notification is created for each action
// 9. Verify activity log entries appear in the activity feed
// 10. Test pause/resume → verify cron skips paused invoices
// 11. Test Redis lock by simulating two concurrent cron runs → verify no duplicate sends
// 12. Test Apple Pay button appears on mobile Safari (requires HTTPS + valid Stripe keys)

Also verify the following in the codebase:
- All new MongoDB models are imported in at least one API route (so Mongoose registers them)
- All new API routes are protected by getMe(true)
- No hardcoded credentials anywhere
- All template variables have fallback empty strings (no raw {{...}} in sent emails)
```

---

## Architecture Notes for Future Phases

> Keep this section as reference when building Phase 2.

**WhatsApp (Phase 2):**  
- `ReminderSettings.channels.whatsapp` is already structured to accept `{ enabled: true, provider: "twilio" | "meta" }`
- The `sendInvoiceReminder` function should be refactored in Phase 2 to accept a `channel` param and route to the correct provider
- `ReminderLog.channel` already accepts `"whatsapp"` as a value

**SMS (Phase 2):**  
- Same provider pattern as WhatsApp — add `sms: { enabled: boolean, provider: string }` to channels

**PayPal (Phase 2):**  
- The payment page already has the architecture comment from Step 22
- Stripe's `automatic_payment_methods` does not include PayPal — it would need a separate PaymentMethod handler

**Stripe late-fee auto-charge (Phase 2):**  
- `lateFeeAmount` is already stored on both the invoice and the ReminderLog
- Phase 2: use `stripe.invoiceItems.create` to add the late fee before charging

**Advanced permissions / multi-user (Phase 2):**  
- The `User.permissions` object from Step 24 can be extended with role-based access (owner/manager/viewer)

---

*End of Sprint Plan — CRM Roberto Phase 1*
