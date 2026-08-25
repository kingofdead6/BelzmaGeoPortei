import { z } from "zod";
import { IUCN_STATUSES } from "./constants.js";
import { paginationQuerySchema } from "./api.js";

export const SPECIES_DATASET_IDS = [
  "flore_protegee",
  "flore_uicn",
  "flore_endemique_rare",
  "faune_invertebres_proteges",
  "faune_reptiles_proteges",
  "faune_oiseaux_proteges",
  "faune_mammiferes_proteges",
  "faune_vertebres_uicn",
  "faune_invertebres_uicn",
  "faune_endemisme",
] as const;
export type SpeciesDatasetId = (typeof SPECIES_DATASET_IDS)[number];

export const SPECIES_KINDS = [
  "flore",
  "flore_uicn",
  "flore_rare",
  "faune",
  "faune_uicn",
  "faune_inv_uicn",
  "endemisme",
] as const;
export type SpeciesKind = (typeof SPECIES_KINDS)[number];

/**
 * Colonnes affichées par type de jeu de données. Les clés reprennent
 * exactement les noms de champs du Tome II — Milieu Biotique (2026).
 */
export const SPECIES_COLUMNS: Record<SpeciesKind, { field: string; label: string; mono?: boolean }[]> = {
  flore: [
    { field: "nom_scientifique", label: "Nom scientifique" },
    { field: "famille", label: "Famille" },
  ],
  flore_uicn: [
    { field: "nom_scientifique", label: "Nom scientifique" },
    { field: "famille", label: "Famille" },
    { field: "statut_uicn", label: "Statut UICN", mono: true },
  ],
  flore_rare: [
    { field: "nom_scientifique", label: "Nom scientifique" },
    { field: "rarete", label: "Rareté", mono: true },
    { field: "chorotype", label: "Chorotype", mono: true },
  ],
  faune: [
    { field: "espece", label: "Espèce" },
    { field: "famille", label: "Famille" },
    { field: "ordre", label: "Ordre" },
  ],
  faune_uicn: [
    { field: "espece", label: "Espèce" },
    { field: "nom_commun", label: "Nom commun" },
    { field: "statut_uicn", label: "Statut UICN", mono: true },
  ],
  faune_inv_uicn: [
    { field: "espece", label: "Espèce" },
    { field: "ordre", label: "Ordre" },
    { field: "statut_uicn", label: "Statut UICN", mono: true },
  ],
  endemisme: [
    { field: "espece", label: "Espèce" },
    { field: "nom_commun", label: "Nom commun" },
    { field: "endemisme", label: "Endémisme" },
  ],
};

/** Abréviations de rareté employées dans le Tome II. */
export const RARITY_LABELS: Record<string, string> = {
  RR: "Très rare",
  R: "Rare",
  AR: "Assez rare",
  AC: "Assez commune",
  C: "Commune",
  CC: "Très commune",
};

export const speciesRecordSchema = z.object({
  id: z.string(),
  dataset: z.enum(SPECIES_DATASET_IDS),
  kind: z.enum(SPECIES_KINDS),
  nom_scientifique: z.string().nullable(),
  espece: z.string().nullable(),
  nom_commun: z.string().nullable(),
  famille: z.string().nullable(),
  ordre: z.string().nullable(),
  groupe: z.string().nullable(),
  statut_uicn: z.enum(IUCN_STATUSES).nullable(),
  rarete: z.string().nullable(),
  chorotype: z.string().nullable(),
  endemisme: z.string().nullable(),
});
export type SpeciesRecord = z.infer<typeof speciesRecordSchema>;

export const speciesDatasetSchema = z.object({
  id: z.enum(SPECIES_DATASET_IDS),
  label: z.string(),
  kind: z.enum(SPECIES_KINDS),
  grouped: z.boolean(),
  count: z.number(),
});
export type SpeciesDataset = z.infer<typeof speciesDatasetSchema>;

export const listSpeciesQuerySchema = paginationQuerySchema.extend({
  dataset: z.enum(SPECIES_DATASET_IDS).optional(),
  q: z.string().trim().min(2).max(120).optional(),
  statut_uicn: z.enum(IUCN_STATUSES).optional(),
});
export type ListSpeciesQuery = z.infer<typeof listSpeciesQuerySchema>;

export const speciesStatsSchema = z.object({
  total: z.number(),
  byDataset: z.array(z.object({ dataset: z.enum(SPECIES_DATASET_IDS), count: z.number() })),
  byIucnStatus: z.array(z.object({ status: z.enum(IUCN_STATUSES), count: z.number() })),
  source: z.string(),
});
export type SpeciesStats = z.infer<typeof speciesStatsSchema>;

/** Nom affichable d'une fiche, quel que soit le jeu de données. */
export function speciesDisplayName(record: Pick<SpeciesRecord, "nom_scientifique" | "espece">): string {
  return record.nom_scientifique ?? record.espece ?? "Espèce non déterminée";
}
