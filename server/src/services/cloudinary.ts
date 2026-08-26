import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { OrphanedAsset } from "../models/OrphanedAsset.js";

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function assertConfigured(): void {
  if (!env.cloudinaryEnabled) {
    throw new ApiError(
      503,
      "UPSTREAM_ERROR",
      "Le dépôt de fichiers n'est pas configuré sur ce serveur. Renseignez les variables CLOUDINARY_* puis redémarrez l'API.",
    );
  }
}

/**
 * Les URL sont dérivées du `publicId` à chaque lecture : aucune URL
 * transformée n'est stockée en base (§7).
 */
export function buildImageUrls(publicId: string): { url: string; thumbUrl: string; cardUrl: string } {
  if (!env.cloudinaryEnabled) {
    return { url: publicId, thumbUrl: publicId, cardUrl: publicId };
  }
  return {
    thumbUrl: cloudinary.url(publicId, {
      secure: true,
      transformation: [{ width: 400, height: 300, crop: "fill", quality: "auto", fetch_format: "auto" }],
    }),
    cardUrl: cloudinary.url(publicId, {
      secure: true,
      transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }],
    }),
    url: cloudinary.url(publicId, {
      secure: true,
      transformation: [{ width: 1600, quality: "auto", fetch_format: "auto" }],
    }),
  };
}

export interface UploadedImage {
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export async function uploadImage(
  buffer: Buffer,
  options: { userId: string; kind: string },
): Promise<UploadedImage> {
  assertConfigured();

  const response = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${options.userId}/${options.kind}`,
        resource_type: "image",
        // Les métadonnées EXIF sont déjà retirées côté serveur ; on demande à
        // Cloudinary de ne rien conserver non plus.
        image_metadata: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Réponse Cloudinary vide"));
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  }).catch((error: unknown) => {
    logger.error({ err: error }, "Échec du dépôt d'image sur Cloudinary");
    throw ApiError.upstream("Le dépôt de l'image a échoué. Réessayez dans un instant.");
  });

  return {
    publicId: response.public_id,
    width: response.width,
    height: response.height,
    bytes: response.bytes,
    format: response.format,
  };
}

export interface UploadedRawFile {
  publicId: string;
  url: string;
  bytes: number;
  format: string;
}

/** Le fichier SIG d'origine est archivé tel quel, en `resource_type: "raw"`. */
export async function uploadRawFile(
  buffer: Buffer,
  options: { userId: string; filename: string },
): Promise<UploadedRawFile> {
  assertConfigured();

  const response = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${options.userId}/layer`,
        resource_type: "raw",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Réponse Cloudinary vide"));
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  }).catch((error: unknown) => {
    logger.error({ err: error }, "Échec de l'archivage du fichier SIG sur Cloudinary");
    throw ApiError.upstream("L'archivage du fichier source a échoué. Réessayez dans un instant.");
  });

  return {
    publicId: response.public_id,
    url: response.secure_url,
    bytes: response.bytes,
    format: response.format ?? "raw",
  };
}

/**
 * Supprime un fichier. Un échec est consigné dans `orphaned_assets` plutôt que
 * de faire échouer la requête — ou pire, d'être ignoré silencieusement (§7).
 */
export async function destroyAsset(
  publicId: string,
  resourceType: "image" | "raw",
  context: { contributionId?: string } = {},
): Promise<void> {
  if (!env.cloudinaryEnabled) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary a répondu « ${result.result} »`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error({ publicId, resourceType, reason }, "Suppression Cloudinary impossible — fichier orphelin consigné");
    await OrphanedAsset.updateOne(
      { publicId },
      {
        $set: {
          resourceType,
          reason,
          contributionId: context.contributionId ?? null,
          lastAttemptAt: new Date(),
        },
        $inc: { attempts: 1 },
      },
      { upsert: true },
    ).catch((logError: unknown) => {
      logger.error({ err: logError, publicId }, "Consignation du fichier orphelin impossible");
    });
  }
}

/**
 * Signature d'envoi direct navigateur → Cloudinary, pour les images
 * volumineuses qui n'ont pas à transiter par l'API (§7).
 */
export function signDirectUpload(options: { userId: string; kind: string }): {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  assertConfigured();

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${env.CLOUDINARY_FOLDER}/${options.userId}/${options.kind}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET as string,
  );

  return {
    timestamp,
    signature,
    apiKey: env.CLOUDINARY_API_KEY as string,
    cloudName: env.CLOUDINARY_CLOUD_NAME as string,
    folder,
  };
}
