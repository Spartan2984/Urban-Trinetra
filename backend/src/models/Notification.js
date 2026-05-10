import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 120
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    readAt: Date,
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint'
    }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
