import { z } from "zod";
import {
  CONTRIBUTION_KINDS,
  HERITAGE_CATEGORIES,
  IUCN_STATUSES,
  REPORT_REASONS,
  VISIBILITIES,
} from "./constants.js";
import { bboxQuerySchema, geoPointSchema, positionSchema } from "./geojson.js";
import { objectIdSchema, paginationQuerySchema } from "./api.js";
import { publicUserSchema } from "./auth.js";

const titleSchema = z
  .string()
  .trim()
  .min(3, "Le titre doit contenir au moins 3 caractères.")
  .max(140, "Le titre ne peut pas dépasser 140 caractères.");

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "La description ne peut pas dépasser 2 000 caractères.");

/** Les étiquettes arrivent en `tags[]` ou en chaîne séparée par des virgules. */
const tagsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(",")))
  .pipe(
    z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .min(2)
          .max(32)
          .regex(/^[\p{L}\p{N}][\p{L}\p{N} _'-]*$/u, "Étiquette invalide."),
      )
      .max(12, "Douze étiquettes au maximum."),
  )
  .transform((tags) => [...new Set(tags.filter(Boolean))]);

const speciesSchema = z.object({
  scientificName: z.string().trim().min(3).max(160),
  commonName: z.string().trim().max(160).optional(),
  iucnStatus: z.enum(IUCN_STATUSES).optional(),
  group: z.string().trim().max(80).optional(),
});

const layerStyleSchema = z.object({
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Couleur attendue au format hexadécimal (#RRGGBB).")
    .default("#B8912C"),
  fillOpacity: z.number().min(0).max(1).default(0.35),
  weight: z.number().min(0).max(10).default(2),
});
export type LayerStyle = z.infer<typeof layerStyleSchema>;

/**
 * Les champs arrivent en multipart : les objets imbriqués transitent en JSON
 * dans un champ texte, d'où le pré-traitement.
 */
const jsonField = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }, schema);

const numberField = z.coerce.number();

export const createContributionSchema = z
  .object({
    kind: z.enum(CONTRIBUTION_KINDS),
    title: titleSchema,
    description: descriptionSchema.optional(),
    tags: tagsSchema.optional().default([]),
    lng: numberField.min(-180).max(180).optional(),
    lat: numberField.min(-90).max(90).optional(),
    species: jsonField(speciesSchema).optional(),
    heritageCategory: z.enum(HERITAGE_CATEGORIES).optional(),
    style: jsonField(layerStyleSchema).optional(),
    /** Demande la publication dès le dépôt : `private` → `pending`. */
    requestPublication: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((value) => value === true || value === "true")
      .optional()
      .default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.lng === undefined) !== (value.lat === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lat"],
        message: "Indiquez la longitude et la latitude, ou aucune des deux.",
      });
    }
    if (value.kind === "observation" && !value.species) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["species"],
        message: "Une observation doit nommer l'espèce observée.",
      });
    }
    if (value.kind === "heritage") {
      if (!value.heritageCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["heritageCategory"],
          message: "Choisissez la catégorie du site patrimonial.",
        });
      }
      if (value.lng === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lat"],
          message: "Un site patrimonial doit être localisé sur la carte.",
        });
      }
    }
  });
export type CreateContributionInput = z.infer<typeof createContributionSchema>;

export const updateContributionSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    tags: tagsSchema.optional(),
    lng: numberField.min(-180).max(180).nullable().optional(),
    lat: numberField.min(-90).max(90).nullable().optional(),
    species: jsonField(speciesSchema).optional(),
    heritageCategory: z.enum(HERITAGE_CATEGORIES).optional(),
    style: jsonField(layerStyleSchema.partial()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification transmise." })
  .refine((value) => (value.lng === undefined || value.lng === null) === (value.lat === undefined || value.lat === null), {
    path: ["lat"],
    message: "Indiquez la longitude et la latitude, ou aucune des deux.",
  });
export type UpdateContributionInput = z.infer<typeof updateContributionSchema>;

export const contributionSortValues = ["recent", "oldest", "popular"] as const;

export const listContributionsQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(CONTRIBUTION_KINDS).optional(),
  tags: z
    .string()
    .transform((value) => value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))
    .optional(),
  q: z.string().trim().min(2).max(120).optional(),
  bbox: bboxQuerySchema.optional(),
  near: z
    .string()
    .transform((value, ctx) => {
      const parts = value.split(",").map((part) => Number(part.trim()));
      if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Position attendue au format lng,lat." });
        return z.NEVER;
      }
      return parts as [number, number];
    })
    .optional(),
  radius: z.coerce.number().int().min(1).max(200_000).optional(),
  sort: z.enum(contributionSortValues).default("recent"),
});
export type ListContributionsQuery = z.infer<typeof listContributionsQuerySchema>;

export const listMineQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(CONTRIBUTION_KINDS).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  sort: z.enum(contributionSortValues).default("recent"),
});

export const reportContributionSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    note: z.string().trim().max(600).optional(),
  })
  .strict();
export type ReportContributionInput = z.infer<typeof reportContributionSchema>;

export const mediaSchema = z.object({
  publicId: z.string(),
  url: z.string(),
  thumbUrl: z.string(),
  cardUrl: z.string(),
  width: z.number(),
  height: z.number(),
  bytes: z.number(),
  format: z.string(),
  takenAt: z.string().nullable().optional(),
  exifStripped: z.boolean(),
});
export type ContributionMedia = z.infer<typeof mediaSchema>;

export const contributionLayerSummarySchema = z.object({
  featureCount: z.number(),
  geometryTypes: z.array(z.string()),
  bbox: z.array(z.number()).nullable(),
  style: layerStyleSchema,
  sourceFile: z
    .object({
      originalName: z.string(),
      bytes: z.number(),
      format: z.string(),
      url: z.string().nullable(),
    })
    .nullable(),
  withinPark: z.boolean(),
});

export const contributionSchema = z.object({
  id: z.string(),
  kind: z.enum(CONTRIBUTION_KINDS),
  title: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  visibility: z.enum(VISIBILITIES),
  owner: publicUserSchema.pick({ id: true, displayName: true, avatarUrl: true, organization: true }),
  location: geoPointSchema.nullable(),
  media: mediaSchema.nullable(),
  species: speciesSchema.nullable(),
  layer: contributionLayerSummarySchema.nullable(),
  heritage: z.object({ category: z.enum(HERITAGE_CATEGORIES) }).nullable(),
  publishedAt: z.string().nullable(),
  rejectedReason: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  viewCount: z.number(),
  flagCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contribution = z.infer<typeof contributionSchema>;

export const uploadSignatureSchema = z
  .object({
    kind: z.enum(CONTRIBUTION_KINDS),
    filename: z.string().trim().min(1).max(200),
  })
  .strict();
export type UploadSignatureInput = z.infer<typeof uploadSignatureSchema>;

export const mapFeaturesQuerySchema = z.object({
  bbox: bboxQuerySchema.optional(),
  kind: z.enum(CONTRIBUTION_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const contributionIdParamSchema = z.object({ id: objectIdSchema });

/** Transitions autorisées du cycle de vie d'une contribution (§8). */
export const VISIBILITY_TRANSITIONS = {
  private: ["pending"],
  pending: ["private", "public", "rejected"],
  public: ["pending", "private"],
  rejected: ["pending", "private"],
} as const;

export { layerStyleSchema, speciesSchema, positionSchema };
