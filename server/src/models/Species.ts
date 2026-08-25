import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import {
  IUCN_STATUSES,
  SPECIES_DATASET_IDS,
  SPECIES_KINDS,
  type IucnStatus,
  type SpeciesDatasetId,
  type SpeciesKind,
} from "@belezma/shared";

/**
 * Fiches issues du Tome II — Milieu Biotique (2026). Les noms de champs
 * reprennent exactement ceux de la source, sans traduction ni normalisation.
 */
export interface SpeciesAttributes {
  dataset: SpeciesDatasetId;
  kind: SpeciesKind;
  nom_scientifique?: string | null;
  espece?: string | null;
  nom_commun?: string | null;
  famille?: string | null;
  ordre?: string | null;
  groupe?: string | null;
  statut_uicn?: IucnStatus | null;
  rarete?: string | null;
  chorotype?: string | null;
  endemisme?: string | null;
  order: number;
}

export type SpeciesDocument = HydratedDocument<SpeciesAttributes>;

const speciesSchema = new Schema<SpeciesAttributes>(
  {
    dataset: { type: String, enum: SPECIES_DATASET_IDS, required: true },
    kind: { type: String, enum: SPECIES_KINDS, required: true },
    nom_scientifique: { type: String, default: null, trim: true },
    espece: { type: String, default: null, trim: true },
    nom_commun: { type: String, default: null, trim: true },
    famille: { type: String, default: null, trim: true },
    ordre: { type: String, default: null, trim: true },
    groupe: { type: String, default: null, trim: true },
    statut_uicn: { type: String, enum: [...IUCN_STATUSES, null], default: null },
    rarete: { type: String, default: null, trim: true },
    chorotype: { type: String, default: null, trim: true },
    endemisme: { type: String, default: null, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

speciesSchema.index({ dataset: 1, order: 1 });
speciesSchema.index({ statut_uicn: 1 });
speciesSchema.index(
  { nom_scientifique: "text", espece: "text", nom_commun: "text" },
  { name: "species_search", weights: { nom_scientifique: 5, espece: 5, nom_commun: 3 } },
);

export const Species: Model<SpeciesAttributes> = model<SpeciesAttributes>("Species", speciesSchema);
