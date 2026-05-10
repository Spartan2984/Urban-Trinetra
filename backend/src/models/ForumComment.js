import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: Number, enum: [1, -1], required: true }
  },
  { _id: false, timestamps: true }
);

const forumCommentSchema = new mongoose.Schema(
  {
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumTopic',
      required: true,
      index: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 2000
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

forumCommentSchema.index({ topic: 1, createdAt: 1 });

export const ForumComment = mongoose.model('ForumComment', forumCommentSchema);
