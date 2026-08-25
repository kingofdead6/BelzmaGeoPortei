import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { MODERATION_ACTIONS, type ModerationAction } from "@belezma/shared";

/** Journal d'audit en ajout seul : aucune route ne le modifie ni ne le purge. */
export interface ModerationLogAttributes {
  actor: Types.ObjectId;
  action: ModerationAction;
  target: { model: string; id: Types.ObjectId };
  reason?: string | null;
  snapshot?: unknown;
  createdAt: Date;
}

export type ModerationLogDocument = HydratedDocument<ModerationLogAttributes>;

const moderationLogSchema = new Schema<ModerationLogAttributes>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: MODERATION_ACTIONS, required: true, index: true },
    target: {
      model: { type: String, required: true },
      id: { type: Schema.Types.ObjectId, required: true },
    },
    reason: { type: String, default: null },
    snapshot: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

moderationLogSchema.index({ createdAt: -1 });
moderationLogSchema.index({ "target.id": 1, createdAt: -1 });

export const ModerationLog: Model<ModerationLogAttributes> = model<ModerationLogAttributes>(
  "ModerationLog",
  moderationLogSchema,
);
