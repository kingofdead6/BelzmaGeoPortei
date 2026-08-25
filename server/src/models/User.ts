import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@belezma/shared";

export interface UserAttributes {
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  role: UserRole;
  organization?: string | null;
  bio?: string | null;
  emailVerified: boolean;
  verifyToken?: string | null;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
  status: UserStatus;
  stats: { contributions: number; published: number };
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null, select: false },
    role: { type: String, enum: USER_ROLES, default: "user", index: true },
    organization: { type: String, default: null, trim: true },
    bio: { type: String, default: null, trim: true },
    emailVerified: { type: Boolean, default: false },
    verifyToken: { type: String, default: null, select: false },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
    status: { type: String, enum: USER_STATUSES, default: "active", index: true },
    stats: {
      contributions: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

userSchema.index({ displayName: "text", organization: "text" }, { name: "user_search" });

export const User: Model<UserAttributes> = model<UserAttributes>("User", userSchema);

export type UserId = Types.ObjectId;
