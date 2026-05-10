import { ForumTopic } from '../models/ForumTopic.js';
import { ForumComment } from '../models/ForumComment.js';
import { Complaint } from '../models/Complaint.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { writeAudit } from '../services/auditService.js';

const staffRoles = ['officer', 'supervisor', 'admin'];

const userTag = (user) => (staffRoles.includes(user.role) ? user.role : null);

const applyVote = (item, userId, value) => {
  const normalizedValue = Number(value);
  const existing = item.votes.find((vote) => vote.user.equals(userId));
  if (existing) {
    if (existing.value === normalizedValue) {
      item.votes = item.votes.filter((vote) => !vote.user.equals(userId));
    } else {
      existing.value = normalizedValue;
    }
  } else {
    item.votes.push({ user: userId, value: normalizedValue });
  }
  item.score = item.votes.reduce((sum, vote) => sum + vote.value, 0);
};

const canEdit = (user, item) => item.author?._id?.equals?.(user._id) || item.author?.equals?.(user._id);

export const listTopics = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.complaintId) query.relatedComplaint = req.query.complaintId;
  if (req.query.search) query.$text = { $search: req.query.search };

  const topics = await ForumTopic.find(query)
    .populate('author', 'name role')
    .populate('relatedComplaint', 'complaintId title status')
    .sort(req.query.sort === 'new' ? { createdAt: -1 } : { score: -1, createdAt: -1 })
    .limit(50);

  return ok(res, 'Forum topics fetched', { topics });
});

export const createTopic = asyncHandler(async (req, res) => {
  let relatedComplaint = null;
  if (req.body.relatedComplaint) {
    relatedComplaint = await Complaint.findById(req.body.relatedComplaint);
    if (!relatedComplaint) throw new AppError('Related complaint not found', 404);
  }

  const topic = await ForumTopic.create({
    title: req.body.title,
    body: req.body.body,
    author: req.user._id,
    relatedComplaint: relatedComplaint?._id || null
  });

  if (relatedComplaint && !relatedComplaint.forumTopic) {
    relatedComplaint.forumTopic = topic._id;
    await relatedComplaint.save();
  }

  await writeAudit({
    actor: req.user._id,
    action: 'FORUM_TOPIC_CREATED',
    entityType: 'ForumTopic',
    entityId: topic._id,
    metadata: { relatedComplaint: topic.relatedComplaint }
  });

  return ok(res, 'Forum topic created', { topic }, 201);
});

export const getTopic = asyncHandler(async (req, res) => {
  const topic = await ForumTopic.findById(req.params.id)
    .populate('author', 'name role')
    .populate('relatedComplaint', 'complaintId title status');
  if (!topic) throw new AppError('Forum topic not found', 404);

  const comments = await ForumComment.find({ topic: topic._id })
    .populate('author', 'name role')
    .populate('deletedBy', 'name role')
    .sort({ createdAt: 1 });

  return ok(res, 'Forum topic fetched', { topic, comments });
});

export const updateTopic = asyncHandler(async (req, res) => {
  const topic = await ForumTopic.findById(req.params.id);
  if (!topic) throw new AppError('Forum topic not found', 404);
  if (topic.isDeleted) throw new AppError('Deleted topics cannot be edited', 400);
  if (!canEdit(req.user, topic)) throw new AppError('You can edit only your own topics', 403);

  topic.title = req.body.title ?? topic.title;
  topic.body = req.body.body ?? topic.body;
  await topic.save();

  return ok(res, 'Forum topic updated', { topic });
});

export const deleteTopic = asyncHandler(async (req, res) => {
  const topic = await ForumTopic.findById(req.params.id);
  if (!topic) throw new AppError('Forum topic not found', 404);
  if (!canEdit(req.user, topic) && req.user.role !== 'admin') {
    throw new AppError('You can delete only your own topics', 403);
  }

  topic.isDeleted = true;
  topic.deletedBy = req.user._id;
  topic.deletedByRole = req.user.role;
  topic.deletedAt = new Date();
  topic.deletionReason = req.body.reason || (req.user.role === 'admin' ? 'Deleted by admin' : 'Deleted by author');
  await topic.save();

  await writeAudit({
    actor: req.user._id,
    action: 'FORUM_TOPIC_DELETED',
    entityType: 'ForumTopic',
    entityId: topic._id,
    metadata: { deletedByRole: req.user.role }
  });

  return ok(res, 'Forum topic deleted', { topic });
});

export const voteTopic = asyncHandler(async (req, res) => {
  const topic = await ForumTopic.findById(req.params.id);
  if (!topic) throw new AppError('Forum topic not found', 404);
  if (topic.isDeleted) throw new AppError('Deleted topics cannot be voted on', 400);

  applyVote(topic, req.user._id, req.body.value);
  await topic.save();

  return ok(res, 'Topic vote recorded', { score: topic.score });
});

export const createComment = asyncHandler(async (req, res) => {
  const topic = await ForumTopic.findById(req.params.id);
  if (!topic) throw new AppError('Forum topic not found', 404);
  if (topic.isDeleted) throw new AppError('Cannot comment on a deleted topic', 400);

  const comment = await ForumComment.create({
    topic: topic._id,
    author: req.user._id,
    body: req.body.body
  });

  await writeAudit({
    actor: req.user._id,
    action: 'FORUM_COMMENT_CREATED',
    entityType: 'ForumComment',
    entityId: comment._id,
    metadata: { topic: topic._id, participantTag: userTag(req.user) }
  });

  return ok(res, 'Comment created', { comment }, 201);
});

export const updateComment = asyncHandler(async (req, res) => {
  const comment = await ForumComment.findById(req.params.commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.isDeleted) throw new AppError('Deleted comments cannot be edited', 400);
  if (!canEdit(req.user, comment)) throw new AppError('You can edit only your own comments', 403);

  comment.body = req.body.body;
  await comment.save();

  return ok(res, 'Comment updated', { comment });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await ForumComment.findById(req.params.commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  if (!canEdit(req.user, comment) && req.user.role !== 'admin') {
    throw new AppError('You can delete only your own comments', 403);
  }

  comment.isDeleted = true;
  comment.deletedBy = req.user._id;
  comment.deletedByRole = req.user.role;
  comment.deletedAt = new Date();
  comment.deletionReason = req.body.reason || (req.user.role === 'admin' ? 'Deleted by admin' : 'Deleted by author');
  await comment.save();

  return ok(res, 'Comment deleted', { comment });
});

export const voteComment = asyncHandler(async (req, res) => {
  const comment = await ForumComment.findById(req.params.commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.isDeleted) throw new AppError('Deleted comments cannot be voted on', 400);

  applyVote(comment, req.user._id, req.body.value);
  await comment.save();

  return ok(res, 'Comment vote recorded', { score: comment.score });
});
