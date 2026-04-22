import mongoose, { type InferSchemaType } from "mongoose";
import {
  DEFAULT_REMINDER_TEMPLATES,
  cloneReminderLocaleTemplates,
  cloneReminderTemplates,
} from '@/lib/reminders/templates';

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

const ReminderLateFeeStageSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "percentage",
    },
    value: { type: Number, default: 0, min: 0 },
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
            default: () => cloneReminderLocaleTemplates(DEFAULT_REMINDER_TEMPLATES.en),
          },
          fr: {
            type: ReminderLocaleTemplatesSchema,
            required: true,
            default: () => cloneReminderLocaleTemplates(DEFAULT_REMINDER_TEMPLATES.fr),
          },
        },
        { _id: false }
      ),
      default: () => cloneReminderTemplates(),
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
          stages: {
            type: new mongoose.Schema(
              {
                soft: { type: ReminderLateFeeStageSchema, default: () => ({ enabled: false, type: "percentage", value: 0 }) },
                medium: { type: ReminderLateFeeStageSchema, default: () => ({ enabled: false, type: "percentage", value: 0 }) },
                firm: { type: ReminderLateFeeStageSchema, default: () => ({ enabled: false, type: "percentage", value: 0 }) },
                formalNotice: { type: ReminderLateFeeStageSchema, default: () => ({ enabled: false, type: "percentage", value: 0 }) },
              },
              { _id: false }
            ),
            default: () => ({
              soft: { enabled: false, type: "percentage", value: 0 },
              medium: { enabled: false, type: "percentage", value: 0 },
              firm: { enabled: false, type: "percentage", value: 0 },
              formalNotice: { enabled: false, type: "percentage", value: 0 },
            }),
          },
        },
        { _id: false }
      ),
      default: () => ({
        enabled: false,
        type: "percentage",
        value: 0,
        applyFrom: "formalNotice",
        stages: {
          soft: { enabled: false, type: "percentage", value: 0 },
          medium: { enabled: false, type: "percentage", value: 0 },
          firm: { enabled: false, type: "percentage", value: 0 },
          formalNotice: { enabled: false, type: "percentage", value: 0 },
        },
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
