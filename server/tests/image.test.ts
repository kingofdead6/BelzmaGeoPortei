import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImage, stripJpegMetadata } from "../src/services/image.js";
import { ApiError } from "../src/utils/errors.js";

const here = dirname(fileURLToPath(import.meta.url));
/** Photographie réelle extraite du prototype. */
const realPhoto = readFileSync(join(here, "../../client/src/assets/hero-belezma.jpg"));

/** Construit un JPEG minimal portant un segment EXIF avec des coordonnées GPS. */
function jpegWithExifGps(): Buffer {
  const gpsPayload = Buffer.from(
    "Exif\0\0MM\0*\0\0\0\x08GPSLatitude 35.6584 GPSLongitude 5.9912",
    "latin1",
  );
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    lengthPrefix(gpsPayload),
    gpsPayload,
  ]);

  const comment = Buffer.from("Appareil photo — numéro de série 12345", "latin1");
  const com = Buffer.concat([Buffer.from([0xff, 0xfe]), lengthPrefix(comment), comment]);

  // Segment de quantification : indispensable au décodage, il doit survivre.
  const dqtPayload = Buffer.alloc(65, 0x10);
  const dqt = Buffer.concat([Buffer.from([0xff, 0xdb]), lengthPrefix(dqtPayload), dqtPayload]);

  const scan = Buffer.concat([Buffer.from([0xff, 0xda]), Buffer.from([0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), Buffer.from([0x12, 0x34, 0xff, 0xd9])]);

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, com, dqt, scan]);
}

function lengthPrefix(payload: Buffer): Buffer {
  const header = Buffer.alloc(2);
  header.writeUInt16BE(payload.length + 2);
  return header;
}

describe("Retrait des métadonnées EXIF", () => {
  it("supprime les coordonnées GPS d'un JPEG", () => {
    const original = jpegWithExifGps();
    expect(original.toString("latin1")).toContain("GPSLatitude");

    const stripped = stripJpegMetadata(original);

    expect(stripped.toString("latin1")).not.toContain("GPSLatitude");
    expect(stripped.toString("latin1")).not.toContain("GPSLongitude");
    expect(stripped.toString("latin1")).not.toContain("Exif");
  });

  it("supprime aussi les commentaires libres", () => {
    const stripped = stripJpegMetadata(jpegWithExifGps());

    expect(stripped.toString("latin1")).not.toContain("numéro de série");
  });

  it("conserve les segments nécessaires au décodage", () => {
    const stripped = stripJpegMetadata(jpegWithExifGps());

    // SOI en tête, table de quantification conservée, EOI en fin.
    expect(stripped[0]).toBe(0xff);
    expect(stripped[1]).toBe(0xd8);
    expect(stripped.includes(Buffer.from([0xff, 0xdb]))).toBe(true);
    expect(stripped.subarray(-2).equals(Buffer.from([0xff, 0xd9]))).toBe(true);
  });

  it("laisse intacte une photographie réelle du parc, en la raccourcissant", () => {
    const stripped = stripJpegMetadata(realPhoto);

    expect(stripped.length).toBeGreaterThan(0);
    expect(stripped.length).toBeLessThanOrEqual(realPhoto.length);
    expect(stripped[0]).toBe(0xff);
    expect(stripped[1]).toBe(0xd8);
    expect(stripped.subarray(-2).equals(Buffer.from([0xff, 0xd9]))).toBe(true);
  });
});

describe("Contrôle du format déposé", () => {
  it("accepte un JPEG et signale les métadonnées retirées", async () => {
    const prepared = await prepareImage(realPhoto, "cedraie.jpg");

    expect(prepared.format).toBe("jpeg");
    expect(prepared.exifStripped).toBe(true);
  });

  it("accepte un PNG", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64),
    ]);

    const prepared = await prepareImage(png, "carte.png");
    expect(prepared.format).toBe("png");
  });

  it("accepte un WebP", async () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WEBP", "ascii"),
      Buffer.alloc(32),
    ]);

    const prepared = await prepareImage(webp, "vue.webp");
    expect(prepared.format).toBe("webp");
  });

  it("refuse un fichier dont le type MIME ment sur le contenu", async () => {
    // Une archive ZIP renommée en .jpg : les octets magiques la trahissent.
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

    await expect(prepareImage(zip, "photo.jpg")).rejects.toThrowError(ApiError);
    await expect(prepareImage(zip, "photo.jpg")).rejects.toThrow(/JPEG, PNG ou WebP/);
  });

  it("refuse un fichier vide", async () => {
    await expect(prepareImage(Buffer.alloc(0), "vide.jpg")).rejects.toThrow(/vide/);
  });

  it("refuse une image de plus de 10 Mo en indiquant son poids", async () => {
    const tooLarge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(11 * 1024 * 1024),
    ]);

    await expect(prepareImage(tooLarge, "enorme.jpg")).rejects.toThrow(/11\.0 Mo — la limite est de 10 Mo/);
  });
});
