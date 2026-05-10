import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { Complaint } from './src/models/Complaint.js';
import mongoose from 'mongoose';

const test = async () => {
  await connectDb();
  const user = { _id: new mongoose.Types.ObjectId('69eccaeebb3a99b767a8196d'), role: 'citizen' };
  const roleQuery = { $or: [{ citizen: user._id }, { 'auditors.auditor': user._id }] };
  
  const baseMatch = {};
  for (const [key, value] of Object.entries(roleQuery)) {
    if (key === '$or') {
      baseMatch.$or = value.map(cond => {
        const mapped = {};
        for (const [ck, cv] of Object.entries(cond)) {
          mapped[ck] = mongoose.isValidObjectId(cv) ? new mongoose.Types.ObjectId(cv) : cv;
        }
        return mapped;
      });
    } else {
      baseMatch[key] = mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : value;
    }
  }

  const results = await Promise.all([
    Complaint.aggregate([{ $match: baseMatch }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: baseMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([
      { $match: baseMatch },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Complaint.countDocuments({ ...roleQuery, dueAt: { $lt: new Date() }, status: { $nin: ['CLOSED', 'RESOLVED', 'VERIFIED'] } }),
    Complaint.countDocuments(roleQuery),
    user.role === 'officer' ? Complaint.findOne({ assignedTo: user._id, status: 'IN_PROGRESS' }).sort({ createdAt: 1 }) : null,
    Complaint.find(roleQuery).populate('citizen', 'name email').populate('assignedTo', 'name email').sort({ createdAt: 1 }).limit(20),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED' }),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED', completedInTime: true }),
    Complaint.countDocuments({ ...roleQuery, status: 'CLOSED', completedInTime: false }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['SUBMITTED', 'NEW'] } }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['ALLOCATED', 'ASSIGNED', 'IN_PROGRESS'] } }),
    Complaint.countDocuments({ ...roleQuery, status: { $in: ['PENDING_COMPLETION', 'PENDING_VERIFICATION', 'PENDING_AUDIT'] } }),
    user.role === 'citizen' ? Complaint.find({ 'auditors.auditor': user._id, status: 'PENDING_AUDIT' }).limit(10) : null
  ]);

  console.log('Results count:', results.length);
  process.exit(0);
};

test();
