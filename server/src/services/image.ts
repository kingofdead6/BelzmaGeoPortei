import { ApiError } from "../utils/errors.js";
import { UPLOAD_LIMITS } from "@belezma/shared";

/**
 * Signatures d'octets des formats acceptés. Le type MIME déclaré par le
 * navigateur ne fait pas foi : il est trivial à falsifier (§7).
 */
const SIGNATURES: { format: string; test: (buffer: Buffer) => boolean }[] = [
  { format: "jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    format: "png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    format: "webp",
    test: (b) =>
      b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

export interface PreparedImage {
  buffer: Buffer;
  format: string;
  exifStripped: boolean;
}

/**
 * Vérifie le format réel puis retire les métadonnées EXIF. La localisation
 * d'une observation doit venir du formulaire, jamais des métadonnées de la
 * photographie à l'insu de son auteur (§7).
 */
export async function prepareImage(buffer: Buffer, originalName: string): Promise<PreparedImage> {
  if (buffer.length === 0) {
    throw ApiError.badRequest("Le fichier reçu est vide.");
  }

  if (buffer.length > UPLOAD_LIMITS.imageBytes) {
    throw ApiError.payloadTooLarge(
      `Cette image pèse ${(buffer.length / (1024 * 1024)).toFixed(1)} Mo — la limite est de 10 Mo. ` +
        "Réduisez sa définition avant de la déposer.",
    );
  }

  const detected = SIGNATURES.find((signature) => signature.test(buffer));
  if (!detected) {
    throw ApiError.unsupportedMediaType(
      `« ${originalName} » n'est pas une image JPEG, PNG ou WebP. ` +
        "Convertissez-la dans l'un de ces formats avant de la déposer.",
    );
  }

  return {
    buffer: detected.format === "jpeg" ? stripJpegMetadata(buffer) : buffer,
    format: detected.format,
    exifStripped: true,
  };
}

/**
 * Retire les segments APPn d'un JPEG — EXIF (APP1, qui porte les coordonnées
 * GPS), JFIF, profils ICC et données constructeur — en conservant les
 * segments nécessaires au décodage.
 */
function stripJpegMetadata(buffer: Buffer): Buffer {
  const segments: Buffer[] = [buffer.subarray(0, 2)]; // SOI
  let offset = 2;

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) break;

    const marker = buffer[offset + 1];
    if (marker === undefined) break;

    // Début du flux compressé : tout le reste est conservé tel quel.
    if (marker === 0xda) {
      segments.push(buffer.subarray(offset));
      break;
    }

    // Marqueurs sans charge utile.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      segments.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2 || offset + 2 + size > buffer.length) break;

    // APP0–APP15 (0xE0–0xEF) et COM (0xFE) sont écartés : c'est là que
    // vivent EXIF, GPS, XMP et les commentaires.
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) {
      segments.push(buffer.subarray(offset, offset + 2 + size));
    }
    offset += 2 + size;
  }

  return Buffer.concat(segments);
}

export { stripJpegMetadata };
