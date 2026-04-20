import mongoose, { type InferSchemaType } from "mongoose";

const DEFAULT_TEMPLATES = {
  en: {
    soft: {
      subject: "Friendly reminder — invoice {{invoiceNumber}}",
      body:
        "Hello {{clientName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} dated {{invoiceDate}} was due on {{dueDate}}.\n\nAmount due: {{amountDue}}.\n\nIf payment has already been made, please ignore this message. Otherwise, you can use the following payment link: {{paymentLink}}\n\nThank you for your business.\n\nBest regards,\n{{companyName}}",
    },
    medium: {
      subject: "Payment follow-up - invoice {{invoiceNumber}}",
      body:
        "Hello {{clientName}},\n\nWe are following up regarding invoice {{invoiceNumber}}, which is now {{daysOverdue}} day(s) overdue.\n\nOutstanding balance: {{amountDue}} (original amount: {{amountOriginal}}).\n\nPlease proceed with payment as soon as possible using this link: {{paymentLink}}\n\nIf you have any questions or need support, please contact us.\n\nKind regards,\n{{companyName}}",
    },
    firm: {
      subject: "Final reminder before formal notice - invoice {{invoiceNumber}}",
      body:
        "Hello {{clientName}},\n\nThis is a final reminder for overdue invoice {{invoiceNumber}}.\n\nAmount due: {{amountDue}}.\nLate fees: {{lateFees}}\n\nUnless payment is received promptly, we may proceed with formal recovery steps.\n\nPayment link: {{paymentLink}}\n\nRegards,\n{{companyName}}",
    },
    formalNotice: {
      subject: "Formal notice - invoice {{invoiceNumber}}",
      body:
        "Hello {{clientName}},\n\nPlease find attached the formal notice concerning invoice {{invoiceNumber}}.\n\nAmount due: {{amountDue}}.\nLegal deadline: {{legalDeadline}}.\n\nRegards,\n{{companyName}}",
    },
  },
  fr: {
    soft: {
      subject: "Rappel amical - facture {{invoiceNumber}}",
      body:
        "Bonjour {{clientName}},\n\nNous vous rappelons aimablement que la facture {{invoiceNumber}} du {{invoiceDate}} est arrivee a echeance le {{dueDate}}.\n\nMontant restant du: {{amountDue}}.\n\nSi le paiement a deja ete effectue, merci d'ignorer ce message. Sinon, vous pouvez regler ici : {{paymentLink}}\n\nCordialement,\n{{companyName}}",
    },
    medium: {
      subject: "Relance de paiement - facture {{invoiceNumber}}",
      body:
        "Bonjour {{clientName}},\n\nNous revenons vers vous concernant la facture {{invoiceNumber}}, en retard de {{daysOverdue}} jour(s).\n\nSolde restant du: {{amountDue}} (montant initial: {{amountOriginal}}).\n\nNous vous remercions d'effectuer le paiement dans les meilleurs delais via ce lien : {{paymentLink}}\n\nEn cas de question, nous restons a votre disposition.\n\nBien cordialement,\n{{companyName}}",
    },
    firm: {
      subject: "Dernier rappel avant mise en demeure - facture {{invoiceNumber}}",
      body:
        "Bonjour {{clientName}},\n\nCeci constitue un dernier rappel concernant la facture {{invoiceNumber}} impayee.\n\nMontant du: {{amountDue}}.\nPenalites de retard: {{lateFees}}\n\nSans regularisation rapide, une procedure de recouvrement formelle pourra etre engagee.\n\nLien de paiement: {{paymentLink}}\n\nCordialement,\n{{companyName}}",
    },
    formalNotice: {
      subject: "Mise en demeure — facture {{invoiceNumber}}",
      body:
        "Madame, Monsieur,\n\nSauf erreur de notre part, la facture {{invoiceNumber}} demeure impayee a ce jour, pour un montant de {{amountDue}}.\n\nPar la presente, nous vous mettons en demeure de regler cette somme dans le delai legal indique au document joint, soit avant le {{legalDeadline}}.\n\nA defaut de paiement dans ce delai, nous nous reserverons le droit d'engager toute procedure utile pour le recouvrement de notre creance, avec application des frais et interets prevus par la loi.\n\nNous vous invitons a regulariser votre situation sans delai via le lien de paiement suivant : {{paymentLink}}\n\nCordialement,\n{{companyName}}",
    },
  },
} as const;

const ReminderTemplateSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ReminderLocaleTemplatesSchema = new mongoose.Schema(
  {
    soft: { type: ReminderTemplateSchema, required: true },
    medium: { type: ReminderTemplateSchema, required: true },
    firm: { type: ReminderTemplateSchema, required: true },
    formalNotice: { type: ReminderTemplateSchema, required: true },
  },
  { _id: false }
);

const ReminderSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    offsets: {
      type: new mongoose.Schema(
        {
          soft: { type: Number, default: 7, min: 1 },
          medium: { type: Number, default: 15, min: 1 },
          firm: { type: Number, default: 30, min: 1 },
          formalNotice: { type: Number, default: 35, min: 1 },
        },
        { _id: false }
      ),
      default: () => ({
        soft: 7,
        medium: 15,
        firm: 30,
        formalNotice: 35,
      }),
    },
    templates: {
      type: new mongoose.Schema(
        {
          en: {
            type: ReminderLocaleTemplatesSchema,
            required: true,
            default: () => DEFAULT_TEMPLATES.en,
          },
          fr: {
            type: ReminderLocaleTemplatesSchema,
            required: true,
            default: () => DEFAULT_TEMPLATES.fr,
          },
        },
        { _id: false }
      ),
      default: () => ({
        en: DEFAULT_TEMPLATES.en,
        fr: DEFAULT_TEMPLATES.fr,
      }),
    },
    messageLocale: {
      type: String,
      enum: ['auto', 'en', 'fr'],
      default: 'auto',
    },
    lateFee: {
      type: new mongoose.Schema(
        {
          enabled: { type: Boolean, default: false },
          type: {
            type: String,
            enum: ["fixed", "percentage"],
            default: "percentage",
          },
          value: { type: Number, default: 0, min: 0 },
          applyFrom: {
            type: String,
            enum: ["medium", "firm", "formalNotice"],
            default: "formalNotice",
          },
        },
        { _id: false }
      ),
      default: () => ({
        enabled: false,
        type: "percentage",
        value: 0,
        applyFrom: "formalNotice",
      }),
    },
    legalNotice: {
      type: new mongoose.Schema(
        {
          delayDays: { type: Number, enum: [8, 15], default: 8 },
          includeInterestClause: { type: Boolean, default: true },
          customFooter: { type: String, default: null, trim: true },
        },
        { _id: false }
      ),
      default: () => ({
        delayDays: 8,
        includeInterestClause: true,
        customFooter: null,
      }),
    },
    channels: {
      type: new mongoose.Schema(
        {
          email: {
            type: new mongoose.Schema(
              {
                enabled: { type: Boolean, default: true },
              },
              { _id: false }
            ),
            default: () => ({ enabled: true }),
          },
          whatsapp: {
            type: new mongoose.Schema(
              {
                enabled: { type: Boolean, default: false },
                provider: { type: String, default: null, trim: true },
              },
              { _id: false }
            ),
            default: () => ({ enabled: false, provider: null }),
          },
        },
        { _id: false }
      ),
      default: () => ({
        email: { enabled: true },
        whatsapp: { enabled: false, provider: null },
      }),
    },
  },
  { timestamps: true }
);

export type IReminderSettings = InferSchemaType<typeof ReminderSettingsSchema>;

export default mongoose.models.ReminderSettings || mongoose.model("ReminderSettings", ReminderSettingsSchema);
