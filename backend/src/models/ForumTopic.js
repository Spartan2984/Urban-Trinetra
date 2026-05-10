import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: Number, enum: [1, -1], required: true }
  },
  { _id: false, timestamps: true }
);

const forumTopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 140
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 4000
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    relatedComplaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
      index: true
    },
    votes: [voteSchema],
    score: {
      type: Number,
      default: 0,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedByRole: String,
    deletedAt: Date,
    deletionReason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

forumTopicSchema.index({ score: -1, createdAt: -1 });
forumTopicSchema.index({ title: 'text', body: 'text' });

export const ForumTopic = mongoose.model('ForumTopic', forumTopicSchema);
