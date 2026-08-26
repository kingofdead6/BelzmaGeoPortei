import { Router } from "express";
import {
  IUCN_STATUSES,
  listSpeciesQuerySchema,
  SPECIES_DATASET_IDS,
  type IucnStatus,
  type SpeciesDataset,
  type SpeciesDatasetId,
} from "@belezma/shared";
import type { FilterQuery } from "mongoose";
import { Species, type SpeciesAttributes } from "../models/index.js";
import { validate, validatedQuery } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { pageMeta, sendData } from "../utils/respond.js";
import { toSpeciesRecord } from "../services/serialize.js";
import { speciesFile } from "../seed/load-seed-files.js";

export const speciesRouter: Router = Router();

/** Onglets de la page Biodiversité, dans l'ordre du Tome II. */
speciesRouter.get(
  "/datasets",
  asyncHandler(async (_req, res) => {
    const file = speciesFile();
    const counts = await Species.aggregate<{ _id: SpeciesDatasetId; count: number }>([
      { $group: { _id: "$dataset", count: { $sum: 1 } } },
    ]);
    const countByDataset = new Map(counts.map((entry) => [entry._id, entry.count]));

    const datasets: SpeciesDataset[] = file.datasets.map((dataset) => ({
      id: dataset.id,
      label: dataset.label,
      kind: dataset.kind,
      grouped: dataset.grouped,
      count: countByDataset.get(dataset.id) ?? 0,
    }));

    sendData(res, datasets, { source: file.source });
  }),
);

speciesRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [total, byDataset, byStatus] = await Promise.all([
      Species.countDocuments(),
      Species.aggregate<{ _id: SpeciesDatasetId; count: number }>([
        { $group: { _id: "$dataset", count: { $sum: 1 } } },
      ]),
      Species.aggregate<{ _id: IucnStatus | null; count: number }>([
        { $match: { statut_uicn: { $ne: null } } },
        { $group: { _id: "$statut_uicn", count: { $sum: 1 } } },
      ]),
    ]);

    const datasetOrder = new Map(SPECIES_DATASET_IDS.map((value, index) => [value, index]));
    const statusOrder = new Map(IUCN_STATUSES.map((value, index) => [value, index]));

    sendData(res, {
      total,
      byDataset: byDataset
        .filter((entry): entry is { _id: SpeciesDatasetId; count: number } => entry._id !== null)
        .map((entry) => ({ dataset: entry._id, count: entry.count }))
        .sort((a, b) => (datasetOrder.get(a.dataset) ?? 0) - (datasetOrder.get(b.dataset) ?? 0)),
      byIucnStatus: byStatus
        .filter((entry): entry is { _id: IucnStatus; count: number } => entry._id !== null)
        .map((entry) => ({ status: entry._id, count: entry.count }))
        .sort((a, b) => (statusOrder.get(a.status) ?? 0) - (statusOrder.get(b.status) ?? 0)),
      source: speciesFile().source,
    });
  }),
);

speciesRouter.get(
  "/",
  validate(listSpeciesQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { dataset, q, statut_uicn: status, page, limit } = validatedQuery(req, listSpeciesQuerySchema);

    const filter: FilterQuery<SpeciesAttributes> = {};
    if (dataset) filter.dataset = dataset;
    if (status) filter.statut_uicn = status;
    if (q) {
      // Recherche « commence par » sur les trois champs de nom : plus utile
      // qu'un index texte pour des noms latins souvent saisis partiellement.
      const pattern = new RegExp(escapeRegExp(q), "i");
      filter.$or = [{ nom_scientifique: pattern }, { espece: pattern }, { nom_commun: pattern }];
    }

    const [records, total] = await Promise.all([
      Species.find(filter)
        .sort({ dataset: 1, order: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Species.countDocuments(filter),
    ]);

    sendData(res, records.map(toSpeciesRecord), pageMeta(page, limit, total));
  }),
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
