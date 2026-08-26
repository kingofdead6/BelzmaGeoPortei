import type { HydratedDocument, Types } from "mongoose";
import type {
  Contribution as ContributionDto,
  OfficialLayer as OfficialLayerDto,
  PublicUser,
  SessionUser,
  SpeciesRecord,
} from "@belezma/shared";
import type {
  ContributionAttributes,
  OfficialLayerAttributes,
  SpeciesAttributes,
  UserAttributes,
} from "../models/index.js";
import { buildImageUrls } from "./cloudinary.js";

type Lean<T> = T & { _id: Types.ObjectId };
type MaybeDocument<T> = Lean<T> | HydratedDocument<T>;

function id(value: unknown): string {
  return String(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Vrai si le champ peuplé est un document utilisateur et non un simple identifiant. */
function isPopulatedUser(value: unknown): value is Lean<UserAttributes> {
  return typeof value === "object" && value !== null && "displayName" in value;
}

export function toPublicUser(user: MaybeDocument<UserAttributes>): PublicUser {
  return {
    id: id(user._id),
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    organization: user.organization ?? null,
    bio: user.bio ?? null,
    role: user.role,
    stats: { contributions: user.stats?.contributions ?? 0, published: user.stats?.published ?? 0 },
    createdAt: iso(user.createdAt) ?? new Date().toISOString(),
  };
}

export function toSessionUser(user: MaybeDocument<UserAttributes>): SessionUser {
  return {
    ...toPublicUser(user),
    email: user.email,
    emailVerified: user.emailVerified,
    status: user.status,
  };
}

const ANONYMOUS_OWNER: ContributionDto["owner"] = {
  id: "",
  displayName: "Contributeur retiré",
  avatarUrl: null,
  organization: null,
};

export function toContribution(
  contribution: MaybeDocument<ContributionAttributes>,
): ContributionDto {
  const owner = contribution.owner;
  const media = contribution.media ?? null;
  const layer = contribution.layer ?? null;

  return {
    id: id(contribution._id),
    kind: contribution.kind,
    title: contribution.title,
    description: contribution.description ?? null,
    tags: contribution.tags ?? [],
    visibility: contribution.visibility,
    owner: isPopulatedUser(owner)
      ? {
          id: id(owner._id),
          displayName: owner.displayName,
          avatarUrl: owner.avatarUrl ?? null,
          organization: owner.organization ?? null,
        }
      : { ...ANONYMOUS_OWNER, id: id(owner) },
    location: contribution.location
      ? {
          type: "Point",
          coordinates: [
            contribution.location.coordinates[0] ?? 0,
            contribution.location.coordinates[1] ?? 0,
          ],
        }
      : null,
    // Les URL transformées sont dérivées du `publicId`, jamais stockées (§7).
    media: media
      ? {
          publicId: media.publicId,
          ...buildImageUrls(media.publicId),
          width: media.width,
          height: media.height,
          bytes: media.bytes,
          format: media.format,
          takenAt: iso(media.takenAt),
          exifStripped: media.exifStripped,
        }
      : null,
    species: contribution.species
      ? {
          scientificName: contribution.species.scientificName,
          commonName: contribution.species.commonName ?? undefined,
          iucnStatus: contribution.species.iucnStatus ?? undefined,
          group: contribution.species.group ?? undefined,
        }
      : null,
    // La géométrie complète n'est jamais incluse ici : elle est servie par
    // /layers/contributed/:id/geojson pour rester en chargement paresseux.
    layer: layer
      ? {
          featureCount: layer.featureCount,
          geometryTypes: layer.geometryTypes,
          bbox: layer.bbox.length === 4 ? layer.bbox : null,
          style: layer.style,
          sourceFile: layer.sourceFile
            ? {
                originalName: layer.sourceFile.originalName,
                bytes: layer.sourceFile.bytes,
                format: layer.sourceFile.format,
                url: layer.sourceFile.url,
              }
            : null,
          withinPark: layer.withinPark,
        }
      : null,
    heritage: contribution.heritage ? { category: contribution.heritage.category } : null,
    publishedAt: iso(contribution.publishedAt),
    rejectedReason: contribution.rejectedReason ?? null,
    reviewedAt: iso(contribution.reviewedAt),
    viewCount: contribution.viewCount ?? 0,
    flagCount: contribution.flagCount ?? 0,
    createdAt: iso(contribution.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(contribution.updatedAt) ?? new Date().toISOString(),
  };
}

export function toOfficialLayer(layer: MaybeDocument<OfficialLayerAttributes>): OfficialLayerDto {
  return {
    layerId: layer.layerId,
    name: layer.name,
    group: layer.group,
    type: layer.type,
    color: layer.color,
    fillOpacity: layer.fillOpacity,
    weight: layer.weight,
    defaultVisible: layer.defaultVisible,
    official: true,
    order: layer.order,
    featureCount: layer.featureCount,
    bbox:
      layer.bbox.length === 4
        ? [layer.bbox[0] as number, layer.bbox[1] as number, layer.bbox[2] as number, layer.bbox[3] as number]
        : null,
    source: layer.source ?? null,
    updatedAt: iso(layer.updatedAt) ?? new Date().toISOString(),
  };
}

export function toSpeciesRecord(record: MaybeDocument<SpeciesAttributes>): SpeciesRecord {
  return {
    id: id(record._id),
    dataset: record.dataset,
    kind: record.kind,
    nom_scientifique: record.nom_scientifique ?? null,
    espece: record.espece ?? null,
    nom_commun: record.nom_commun ?? null,
    famille: record.famille ?? null,
    ordre: record.ordre ?? null,
    groupe: record.groupe ?? null,
    statut_uicn: record.statut_uicn ?? null,
    rarete: record.rarete ?? null,
    chorotype: record.chorotype ?? null,
    endemisme: record.endemisme ?? null,
  };
}
