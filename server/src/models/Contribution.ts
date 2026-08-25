import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  CONTRIBUTION_KINDS,
  HERITAGE_CATEGORIES,
  IUCN_STATUSES,
  VISIBILITIES,
  type ContributionKind,
  type HeritageCategory,
  type IucnStatus,
  type Visibility,
} from "@belezma/shared";

export interface ContributionMediaAttributes {
  publicId: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  takenAt?: Date | null;
  exifStripped: boolean;
}

export interface ContributionLayerAttributes {
  geojson: unknown;
  featureCount: number;
  geometryTypes: string[];
  bbox: number[];
  withinPark: boolean;
  style: { color: string; fillOpacity: number; weight: number };
  sourceFile?: {
    publicId: string | null;
    url: string | null;
    originalName: string;
    bytes: number;
    format: string;
  } | null;
}

export interface ContributionAttributes {
  owner: Types.ObjectId;
  kind: ContributionKind;
  title: string;
  description?: string | null;
  tags: string[];
  visibility: Visibility;
  publishedAt?: Date | null;
  rejectedReason?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  location?: { type: "Point"; coordinates: [number, number] } | null;
  media?: ContributionMediaAttributes | null;
  species?: {
    scientificName: string;
    commonName?: string | null;
    iucnStatus?: IucnStatus | null;
    group?: string | null;
  } | null;
  layer?: ContributionLayerAttributes | null;
  heritage?: { category: HeritageCategory } | null;
  viewCount: number;
  flagCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ContributionDocument = HydratedDocument<ContributionAttributes>;

const contributionSchema = new Schema<ContributionAttributes>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: CONTRIBUTION_KINDS, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    tags: { type: [String], default: [] },
    visibility: { type: String, enum: VISIBILITIES, default: "private" },
    publishedAt: { type: Date, default: null },
    rejectedReason: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },

    // Point GeoJSON facultatif — `null` tant que la contribution n'est pas
    // localisée. Un sous-schéma évite que Mongoose interprète la clé `type`.
    location: {
      type: new Schema(
        {
          type: { type: String, enum: ["Point"], required: true },
          coordinates: { type: [Number], required: true },
        },
        { _id: false },
      ),
      default: null,
    },

    media: {
      type: new Schema<ContributionMediaAttributes>(
        {
          publicId: { type: String, required: true },
          url: { type: String, required: true },
          thumbUrl: { type: String, required: true },
          width: { type: Number, required: true },
          height: { type: Number, required: true },
          bytes: { type: Number, required: true },
          format: { type: String, required: true },
          takenAt: { type: Date, default: null },
          exifStripped: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: null,
    },

    species: {
      type: new Schema(
        {
          scientificName: { type: String, required: true, trim: true },
          commonName: { type: String, default: null, trim: true },
          iucnStatus: { type: String, enum: [...IUCN_STATUSES, null], default: null },
          group: { type: String, default: null, trim: true },
        },
        { _id: false },
      ),
      default: null,
    },

    layer: {
      type: new Schema(
        {
          geojson: { type: Schema.Types.Mixed, required: true },
          featureCount: { type: Number, required: true },
          geometryTypes: { type: [String], default: [] },
          bbox: { type: [Number], default: [] },
          withinPark: { type: Boolean, default: false },
          style: {
            color: { type: String, default: "#B8912C" },
            fillOpacity: { type: Number, default: 0.35 },
            weight: { type: Number, default: 2 },
          },
          sourceFile: {
            type: new Schema(
              {
                publicId: { type: String, default: null },
                url: { type: String, default: null },
                originalName: { type: String, required: true },
                bytes: { type: Number, required: true },
                format: { type: String, required: true },
              },
              { _id: false },
            ),
            default: null,
          },
        },
        { _id: false },
      ),
      default: null,
    },

    heritage: {
      type: new Schema(
        { category: { type: String, enum: HERITAGE_CATEGORIES, required: true } },
        { _id: false },
      ),
      default: null,
    },

    viewCount: { type: Number, default: 0 },
    flagCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/* Index exigés au §4. */
contributionSchema.index({ visibility: 1, kind: 1, createdAt: -1 });
contributionSchema.index({ owner: 1, createdAt: -1 });
contributionSchema.index({ location: "2dsphere" });
contributionSchema.index(
  { title: "text", description: "text", tags: "text" },
  { name: "contribution_search", weights: { title: 5, tags: 3, description: 1 } },
);
// Sert la file de modération, triée du plus ancien au plus récent.
contributionSchema.index({ visibility: 1, updatedAt: 1 });

export const Contribution: Model<ContributionAttributes> = model<ContributionAttributes>(
  "Contribution",
  contributionSchema,
);
