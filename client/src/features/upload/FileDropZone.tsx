import { useEffect, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { UPLOAD_LIMITS } from "@belezma/shared";
import { Button } from "../../components/ui/Button";
import { formatBytes } from "../../lib/format";
import { clsx } from "../../lib/clsx";

export type DropZoneMode = "image" | "gis";

const ACCEPT: Record<DropZoneMode, string> = {
  image: "image/jpeg,image/png,image/webp",
  gis: ".geojson,.json,.zip,application/geo+json,application/json,application/zip",
};

const HINT: Record<DropZoneMode, string> = {
  image: `JPEG, PNG ou WebP — ${UPLOAD_LIMITS.imageBytes / (1024 * 1024)} Mo au maximum.`,
  gis:
    `Fichier .geojson (${UPLOAD_LIMITS.geojsonBytes / (1024 * 1024)} Mo au maximum) ou archive ` +
    `.zip contenant un shapefile (${UPLOAD_LIMITS.shapefileZipBytes / (1024 * 1024)} Mo au maximum).`,
};

/** Contrôle côté client avant l'envoi ; le serveur refait le même contrôle. */
function validate(file: File, mode: DropZoneMode): string | null {
  if (mode === "image") {
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      return `« ${file.name} » n'est pas une image JPEG, PNG ou WebP. Convertissez-la avant de la déposer.`;
    }
    if (file.size > UPLOAD_LIMITS.imageBytes) {
      return (
        `Cette image pèse ${formatBytes(file.size)} — la limite est de ` +
        `${UPLOAD_LIMITS.imageBytes / (1024 * 1024)} Mo. Réduisez sa définition avant de la déposer.`
      );
    }
    return null;
  }

  const isArchive = /\.zip$/i.test(file.name);
  if (!isArchive && !/\.(geo)?json$/i.test(file.name)) {
    return (
      `Le format de « ${file.name} » n'est pas pris en charge. Déposez un fichier .geojson, ` +
      "ou une archive .zip contenant un shapefile."
    );
  }
  const limit = isArchive ? UPLOAD_LIMITS.shapefileZipBytes : UPLOAD_LIMITS.geojsonBytes;
  if (file.size > limit) {
    return (
      `Ce fichier pèse ${formatBytes(file.size)} — la limite est de ${limit / (1024 * 1024)} Mo ` +
      `pour ${isArchive ? "une archive shapefile" : "un GeoJSON"}.`
    );
  }
  return null;
}

export function FileDropZone({
  mode,
  file,
  onChange,
}: {
  mode: DropZoneMode;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Aperçu local : l'image n'est pas envoyée avant la validation du formulaire.
  useEffect(() => {
    if (!file || mode !== "image") {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);

  function accept(candidate: File | undefined): void {
    if (!candidate) return;
    const message = validate(candidate, mode);
    setError(message);
    onChange(message ? null : candidate);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files[0]);
        }}
        className={clsx(
          "rounded-card border-2 border-dashed p-6 text-center transition-colors duration-quick",
          dragging ? "border-forest bg-forest/5" : "border-forest-light/45 bg-sand/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[mode]}
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {file ? (
          <div className="space-y-3">
            {preview ? (
              <img
                src={preview}
                alt="Aperçu de la photographie déposée"
                className="mx-auto max-h-56 rounded-control border border-forest-light/30 object-contain"
              />
            ) : (
              <FileUp className="mx-auto h-7 w-7 text-forest" aria-hidden />
            )}
            <p className="datum break-all text-sm text-forest-deep">{file.name}</p>
            <p className="datum text-2xs text-ink/60">{formatBytes(file.size)}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="h-4 w-4" aria-hidden />
              Retirer ce fichier
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <FileUp className="mx-auto h-7 w-7 text-forest-light" aria-hidden />
            <p className="text-sm text-ink/80">
              Glissez votre fichier ici, ou choisissez-le sur votre appareil.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              Choisir un fichier
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-ink/60">{HINT[mode]}</p>

      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-iucn-cr">
          {error}
        </p>
      ) : null}

      {mode === "image" ? (
        <p className="text-xs leading-relaxed text-ink/60">
          Les métadonnées EXIF, y compris les coordonnées GPS éventuelles, sont retirées avant
          l'envoi. La localisation ne vient que de l'étape suivante.
        </p>
      ) : null}
    </div>
  );
}
