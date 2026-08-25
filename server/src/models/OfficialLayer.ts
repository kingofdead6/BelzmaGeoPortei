import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { LAYER_TYPES, type LayerType } from "@belezma/shared";

export interface OfficialLayerAttributes {
  layerId: string;
  name: string;
  group: string;
  type: LayerType;
  color: string;
  fillOpacity: number;
  weight: number;
  defaultVisible: boolean;
  official: true;
  order: number;
  geojson: unknown;
  featureCount: number;
  bbox: number[];
  source?: string | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OfficialLayerDocument = HydratedDocument<OfficialLayerAttributes>;

const officialLayerSchema = new Schema<OfficialLayerAttributes>(
  {
    layerId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: LAYER_TYPES, required: true },
    color: { type: String, required: true },
    fillOpacity: { type: Number, required: true, min: 0, max: 1 },
    weight: { type: Number, required: true, min: 0, max: 10 },
    defaultVisible: { type: Boolean, default: false },
    official: { type: Boolean, default: true },
    order: { type: Number, default: 999, index: true },
    // La géométrie n'est jamais renvoyée par /layers : elle est servie à la
    // demande par /layers/:layerId/geojson (§9, chargement paresseux).
    geojson: { type: Schema.Types.Mixed, required: true, select: false },
    featureCount: { type: Number, default: 0 },
    bbox: { type: [Number], default: [] },
    source: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const OfficialLayer: Model<OfficialLayerAttributes> = model<OfficialLayerAttributes>(
  "OfficialLayer",
  officialLayerSchema,
);
