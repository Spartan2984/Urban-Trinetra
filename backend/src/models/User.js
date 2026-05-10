import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['citizen', 'officer', 'supervisor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'citizen',
      index: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    reputationScore: {
      type: Number,
      default: 100
    },
    civicPoints: {
      type: Number,
      default: 0
    },
    profileImage: {
      url: String,
      public_id: String
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    refreshTokenHash: {
      type: String,
      select: false
    }
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
