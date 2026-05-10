import mongoose from 'mongoose';

export const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'NEW',
  'ALLOCATED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_COMPLETION',
  'PENDING_VERIFICATION',
  'PENDING_AUDIT',
  'RESOLVED',
  'VERIFIED',
  'CLOSED',
  'ESCALATED',
  'REJECTED',
  'REOPENED'
];

export const CATEGORIES = [
  'pothole',
  'garbage',
  'water_leakage',
  'streetlight',
  'drainage',
  'illegal_construction',
  'sanitation',
  'road_damage',
  'sewage_overflow',
  'park_maintenance'
];

export const CATEGORY_SLA_HOURS = {
  pothole: 72,
  garbage: 48,
  water_leakage: 24,
  streetlight: 48,
  drainage: 48,
  illegal_construction: 120,
  sanitation: 48,
  road_damage: 72,
  sewage_overflow: 24,
  park_maintenance: 96
};

const imageSchema = new mongoose.Schema(
  {
    public_id: String,
    secure_url: String,
    signature: String
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: COMPLAINT_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      index: true
    },
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 2000
    },
    priorityHint: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    contactName: { type: String, trim: true, maxlength: 80 },
    contactPhone: { type: String, trim: true, maxlength: 20 },
    location: {
      address: { type: String, required: true, trim: true, maxlength: 250 },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          required: true
        }
      }
    },
    images: [imageSchema],
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'SUBMITTED',
      index: true
    },
    slaHours: {
      type: Number,
      required: true
    },
    dueAt: {
      type: Date,
      required: true,
      index: true
    },
    escalatedAt: Date,
    completionRequestedAt: Date,
    completionReviewedAt: Date,
    completionRejectedAt: Date,
    deadlineExtendedAt: Date,
    deadlineExtensionCount: {
      type: Number,
      default: 0
    },
    completedInTime: Boolean,
    resolvedAt: Date,
    closedAt: Date,
    resolutionImages: [imageSchema],
    aiVerification: {
      score: Number,
      verified: Boolean,
      message: String
    },
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 500 },
      submittedAt: Date
    },
    statusHistory: [statusHistorySchema],
    vetoed: {
      type: Boolean,
      default: false
    },
    vetoCount: {
      type: Number,
      default: 0
    },
    overrunCount: {
      type: Number,
      default: 0
    },
    previousOfficers: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    previousDepartments: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
    ],
    previousSupervisors: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    auditors: [
      {
        auditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        vote: { type: String, enum: ['approve', 'reject'] },
        stakedPoints: Number,
        votedAt: Date,
        assignedAt: { type: Date, default: Date.now },
        dueDate: Date
      }
    ],
    rejectedAuditors: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    supervisorApprovalRequired: {
      type: Boolean,
      default: false
    },
    forumTopic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ForumTopic',
      index: true
    }
  },
  { timestamps: true }
);

complaintSchema.index({ 'location.coordinates': '2dsphere' });
complaintSchema.index({ category: 1, status: 1, createdAt: -1 });
complaintSchema.index({ department: 1, status: 1, dueAt: 1 });

complaintSchema.pre('validate', function setSla(next) {
  if (!this.slaHours) {
    this.slaHours = CATEGORY_SLA_HOURS[this.category] || 72;
  }
  if (!this.dueAt) {
    this.dueAt = new Date(Date.now() + this.slaHours * 60 * 60 * 1000);
  }
  next();
});

complaintSchema.pre('save', function setComplaintId(next) {
  if (!this.complaintId) {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate()
    ).padStart(2, '0')}`;
    this.complaintId = `FMC-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  next();
});

export const Complaint = mongoose.model('Complaint', complaintSchema);
