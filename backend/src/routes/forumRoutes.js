import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createComment,
  createTopic,
  deleteComment,
  deleteTopic,
  getTopic,
  listTopics,
  updateComment,
  updateTopic,
  voteComment,
  voteTopic
} from '../controllers/forumController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const forumRoutes = Router();

forumRoutes.use(protect);

forumRoutes
  .route('/topics')
  .get(
    [query('complaintId').optional().isMongoId(), query('search').optional().trim(), query('sort').optional().isIn(['new', 'popular'])],
    validate,
    listTopics
  )
  .post(
    [body('title').trim().isLength({ min: 4, max: 140 }), body('body').trim().isLength({ min: 10, max: 4000 }), body('relatedComplaint').optional({ checkFalsy: true }).isMongoId()],
    validate,
    createTopic
  );

forumRoutes
  .route('/topics/:id')
  .get([param('id').isMongoId()], validate, getTopic)
  .patch([param('id').isMongoId(), body('title').optional().trim().isLength({ min: 4, max: 140 }), body('body').optional().trim().isLength({ min: 10, max: 4000 })], validate, updateTopic)
  .delete([param('id').isMongoId(), body('reason').optional().trim().isLength({ max: 500 })], validate, deleteTopic);

forumRoutes.post('/topics/:id/vote', [param('id').isMongoId(), body('value').custom((value) => [1, -1].includes(Number(value)))], validate, voteTopic);
forumRoutes.post('/topics/:id/comments', [param('id').isMongoId(), body('body').trim().isLength({ min: 2, max: 2000 })], validate, createComment);
forumRoutes.patch('/comments/:commentId', [param('commentId').isMongoId(), body('body').trim().isLength({ min: 2, max: 2000 })], validate, updateComment);
forumRoutes.delete('/comments/:commentId', [param('commentId').isMongoId(), body('reason').optional().trim().isLength({ max: 500 })], validate, deleteComment);
forumRoutes.post('/comments/:commentId/vote', [param('commentId').isMongoId(), body('value').custom((value) => [1, -1].includes(Number(value)))], validate, voteComment);
