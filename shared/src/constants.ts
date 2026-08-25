/** Constantes partagées entre l'API et le client. */

export const USER_ROLES = ["user", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CONTRIBUTION_KINDS = ["photo", "layer", "heritage", "observation"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export const VISIBILITIES = ["private", "pending", "public", "rejected"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const HERITAGE_CATEGORIES = [
  "Naturel",
  "Archéologique",
  "Culturel",
  "Historique",
  "Touristique",
  "Scientifique",
] as const;
export type HeritageCategory = (typeof HERITAGE_CATEGORIES)[number];

export const IUCN_STATUSES = ["CR", "EN", "VU", "NT", "LC", "DD"] as const;
export type IucnStatus = (typeof IUCN_STATUSES)[number];

/** Couleurs UICN — reprises à l'identique du prototype. */
export const IUCN_COLORS: Record<IucnStatus, string> = {
  CR: "#B91C1C",
  EN: "#DC2626",
  VU: "#EA580C",
  NT: "#CA8A04",
  LC: "#16A34A",
  DD: "#6B7280",
};

export const IUCN_LABELS: Record<IucnStatus, string> = {
  CR: "En danger critique",
  EN: "En danger",
  VU: "Vulnérable",
  NT: "Quasi menacée",
  LC: "Préoccupation mineure",
  DD: "Données insuffisantes",
};

export const LAYER_TYPES = ["polygon", "line", "point", "mixed"] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

/** Groupes du catalogue, dans l'ordre d'affichage — repris du prototype. */
export const CATALOG_GROUPS = [
  "Limites",
  "Zonage MAB",
  "Végétation",
  "Occupation du sol",
  "Milieu physique",
  "Patrimoine géologique",
  "Infrastructures",
  "Risques",
  "Patrimoine touristique",
  "Biodiversité",
  "Patrimoine",
  "Contributions",
] as const;
export type CatalogGroup = (typeof CATALOG_GROUPS)[number];

export const MODERATION_ACTIONS = [
  "approve",
  "reject",
  "unpublish",
  "delete",
  "suspend_user",
  "role_change",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const REPORT_REASONS = [
  "hors_sujet",
  "contenu_inapproprie",
  "donnee_erronee",
  "droits_image",
  "autre",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  hors_sujet: "Sans rapport avec le parc",
  contenu_inapproprie: "Contenu inapproprié",
  donnee_erronee: "Donnée scientifique erronée",
  droits_image: "Problème de droits d'image",
  autre: "Autre motif",
};

/** Motifs de refus proposés au modérateur (§8 : 4 motifs types + texte libre). */
export const REJECTION_PRESETS = [
  "La photographie ne montre pas le Parc National de Belezma ou ses abords immédiats.",
  "La localisation indiquée ne correspond pas au contenu : repositionnez le point sur la carte.",
  "La détermination de l'espèce n'est pas vérifiable à partir de ce document.",
  "La géométrie déposée ne se superpose pas à l'emprise du parc.",
] as const;

/** Limites d'import (§7). */
export const UPLOAD_LIMITS = {
  imageBytes: 10 * 1024 * 1024,
  geojsonBytes: 25 * 1024 * 1024,
  shapefileZipBytes: 50 * 1024 * 1024,
  maxFeatures: 20_000,
} as const;

export const PAGINATION = { defaultLimit: 24, maxLimit: 100 } as const;

/**
 * Emprise officielle du parc, calculée à partir de la limite officielle
 * (voir scripts/extract-from-prototype.mjs). Le massif s'étend plus à l'est
 * que l'emprise nominale souvent citée (lng 5,87–6,15).
 */
export const PARK_BBOX: readonly [number, number, number, number] = [
  5.90287, 35.51298, 6.30941, 35.6969,
];

export const PARK_CENTER: readonly [number, number] = [35.61, 6.05];
export const PARK_DEFAULT_ZOOM = 11;

/** Superficie de référence portée par la limite officielle (ha). */
export const PARK_AREA_REFERENCE_HA = 26_631.9;
export const PARK_PERIMETER_REFERENCE_KM = 190.5;
export const PARK_CREATED_YEAR = 1984;
export const PARK_MAB_YEAR = 2015;
