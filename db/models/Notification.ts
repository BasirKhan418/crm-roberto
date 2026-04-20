import mongoose, { type InferSchemaType, type Model } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'reminder_sent',
  'formal_notice_sent',
  'recurrence_due',
  'recurrence_generated',
] as const;

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    invoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof NotificationSchema>;

const NotificationModel =
  (mongoose.models.Notification as Model<NotificationDocument>) ||
  mongoose.model<NotificationDocument>('Notification', NotificationSchema);

export default NotificationModel;
