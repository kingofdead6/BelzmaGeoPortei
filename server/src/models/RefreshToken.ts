import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Jetons de rafraîchissement suivis côté serveur : c'est ce suivi qui rend la
 * déconnexion effective et permet de détecter la réutilisation d'un jeton
 * déjà consommé (§6).
 */
export interface RefreshTokenAttributes {
  user: Types.ObjectId;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttributes>;

const refreshTokenSchema = new Schema<RefreshTokenAttributes>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

// MongoDB purge automatiquement les jetons expirés.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<RefreshTokenAttributes> = model<RefreshTokenAttributes>(
  "RefreshToken",
  refreshTokenSchema,
);
