import { Schema, model, type HydratedDocument, type Model } from "mongoose";

/**
 * Un fichier Cloudinary dont la suppression a échoué est consigné ici plutôt
 * que d'être oublié silencieusement ou de faire échouer la requête (§7).
 */
export interface OrphanedAssetAttributes {
  publicId: string;
  resourceType: "image" | "raw";
  reason: string;
  contributionId?: string | null;
  attempts: number;
  lastAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OrphanedAssetDocument = HydratedDocument<OrphanedAssetAttributes>;

const orphanedAssetSchema = new Schema<OrphanedAssetAttributes>(
  {
    publicId: { type: String, required: true, index: true },
    resourceType: { type: String, enum: ["image", "raw"], required: true },
    reason: { type: String, required: true },
    contributionId: { type: String, default: null },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "orphaned_assets" },
);

export const OrphanedAsset: Model<OrphanedAssetAttributes> = model<OrphanedAssetAttributes>(
  "OrphanedAsset",
  orphanedAssetSchema,
);
