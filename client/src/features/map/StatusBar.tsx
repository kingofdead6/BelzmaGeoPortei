import { Ruler, Volume2, VolumeX } from "lucide-react";
import { useMapStore } from "../../stores/map-store";
import { formatCoordinate, formatDistance, formatScale, pluralize } from "../../lib/format";
import { measureLength } from "./MeasureTool";
import { clsx } from "../../lib/clsx";

/**
 * Barre d'état — tout y est mesure ou code, donc tout y est en mono
 * (DESIGN.md §1). Le relevé de coordonnées n'est pas annoncé par défaut :
 * il changerait à chaque mouvement de souris.
 */
export function StatusBar() {
  const cursor = useMapStore((state) => state.cursor);
  const zoom = useMapStore((state) => state.zoom);
  const activeLayers = useMapStore((state) => state.activeLayers);
  const measuring = useMapStore((state) => state.measuring);
  const measurePoints = useMapStore((state) => state.measurePoints);
  const announceCursor = useMapStore((state) => state.announceCursor);
  const toggleAnnounceCursor = useMapStore((state) => state.toggleAnnounceCursor);

  const distance = measureLength(measurePoints);

  return (
    <div className="on-dark flex min-h-8 flex-wrap items-center gap-x-5 gap-y-1 border-t border-forest-light/20 bg-forest-deep px-3 py-1.5 font-mono text-2xs text-forest-light">
      <span
        aria-live={announceCursor ? "polite" : "off"}
        aria-atomic="true"
        className="tabular-nums text-paper/90"
      >
        {cursor
          ? `${formatCoordinate(cursor.lat, "lat")}  ${formatCoordinate(cursor.lng, "lng")}`
          : "Déplacez le curseur sur la carte"}
      </span>

      <button
        type="button"
        onClick={toggleAnnounceCursor}
        aria-pressed={announceCursor}
        title={
          announceCursor
            ? "Ne plus annoncer les coordonnées aux lecteurs d'écran"
            : "Annoncer les coordonnées aux lecteurs d'écran"
        }
        className="flex h-6 items-center gap-1 rounded-control px-1 text-forest-light hover:text-paper"
      >
        {announceCursor ? (
          <Volume2 className="h-3 w-3" aria-hidden />
        ) : (
          <VolumeX className="h-3 w-3" aria-hidden />
        )}
        <span className="sr-only">
          {announceCursor ? "Annonce des coordonnées activée" : "Annonce des coordonnées désactivée"}
        </span>
      </button>

      <span title="Système de référence des coordonnées">EPSG:4326</span>
      <span title="Échelle approximative">{formatScale(zoom)}</span>
      <span title="Niveau de zoom">z{zoom}</span>

      {measuring || distance > 0 ? (
        <span
          className={clsx("flex items-center gap-1.5", distance > 0 ? "text-gold" : "text-paper/80")}
          aria-live="polite"
        >
          <Ruler className="h-3 w-3" aria-hidden />
          {measurePoints.length < 2
            ? "Cliquez deux points pour mesurer"
            : `${formatDistance(distance)} · ${pluralize(measurePoints.length, "point")}`}
        </span>
      ) : null}

      <span className="ml-auto text-paper/70">
        {activeLayers.length === 0
          ? "Aucune couche active"
          : pluralize(activeLayers.length, "couche active", "couches actives")}
      </span>
    </div>
  );
}
