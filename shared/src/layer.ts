import { z } from "zod";
import { LAYER_TYPES } from "./constants.js";
import { bboxSchema, featureCollectionSchema } from "./geojson.js";
import { layerStyleSchema } from "./contribution.js";

/** Métadonnées d'une couche du catalogue officiel — sans géométrie. */
export const officialLayerSchema = z.object({
  layerId: z.string(),
  name: z.string(),
  group: z.string(),
  type: z.enum(LAYER_TYPES),
  color: z.string(),
  fillOpacity: z.number(),
  weight: z.number(),
  defaultVisible: z.boolean(),
  official: z.literal(true),
  order: z.number(),
  featureCount: z.number(),
  bbox: bboxSchema.nullable(),
  source: z.string().nullable(),
  updatedAt: z.string(),
});
export type OfficialLayer = z.infer<typeof officialLayerSchema>;

/** Entrée de catalogue produite par une contribution publiée. */
export const contributedLayerSchema = z.object({
  layerId: z.string(),
  contributionId: z.string(),
  name: z.string(),
  group: z.literal("Contributions"),
  type: z.enum(LAYER_TYPES),
  color: z.string(),
  fillOpacity: z.number(),
  weight: z.number(),
  defaultVisible: z.literal(false),
  official: z.literal(false),
  featureCount: z.number(),
  bbox: bboxSchema.nullable(),
  owner: z.object({ id: z.string(), displayName: z.string() }),
  publishedAt: z.string().nullable(),
});
export type ContributedLayer = z.infer<typeof contributedLayerSchema>;

export const layerIdParamSchema = z.object({
  layerId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_-]+$/i, "Identifiant de couche invalide."),
});

export const createLayerSchema = z
  .object({
    layerId: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/, "L'identifiant doit être en minuscules, sans espace."),
    name: z.string().trim().min(2).max(120),
    group: z.string().trim().min(2).max(80),
    type: z.enum(LAYER_TYPES),
    color: layerStyleSchema.shape.color,
    fillOpacity: z.number().min(0).max(1),
    weight: z.number().min(0).max(10),
    defaultVisible: z.boolean().default(false),
    order: z.number().int().min(0).default(999),
    source: z.string().trim().max(300).optional(),
    geojson: featureCollectionSchema,
  })
  .strict();
export type CreateLayerInput = z.infer<typeof createLayerSchema>;

export const updateLayerSchema = createLayerSchema
  .omit({ layerId: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification transmise." });
export type UpdateLayerInput = z.infer<typeof updateLayerSchema>;

/** Chiffres-clés du parc, calculés à partir de la limite officielle. */
export const parkStatsSchema = z.object({
  areaHa: z.number(),
  areaKm2: z.number(),
  perimeterKm: z.number(),
  bbox: bboxSchema,
  layerCount: z.number(),
  speciesCount: z.number(),
  createdYear: z.number(),
  mabYear: z.number(),
});
export type ParkStats = z.infer<typeof parkStatsSchema>;
