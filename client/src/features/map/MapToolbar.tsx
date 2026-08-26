import { Crosshair, Layers, Maximize, Minimize, Ruler, Trash2 } from "lucide-react";
import { BASEMAPS, useMapStore, type BasemapId } from "../../stores/map-store";
import { clsx } from "../../lib/clsx";

/**
 * Commandes de la carte. Toutes les icônes viennent de `lucide-react` : le
 * prototype utilisait des émoji (📏, ⛶), proscrits au §10.
 */
export function MapToolbar({
  fullscreen,
  onToggleFullscreen,
  onRecenter,
  onOpenCatalog,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onRecenter: () => void;
  onOpenCatalog: () => void;
}) {
  const measuring = useMapStore((state) => state.measuring);
  const setMeasuring = useMapStore((state) => state.setMeasuring);
  const measurePoints = useMapStore((state) => state.measurePoints);
  const clearMeasure = useMapStore((state) => state.clearMeasure);
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);

  return (
    <>
      <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-control border border-forest-light/40 bg-paper shadow-panel">
          <ToolButton
            label={measuring ? "Arrêter la mesure" : "Mesurer une distance"}
            active={measuring}
            onClick={() => setMeasuring(!measuring)}
          >
            <Ruler className="h-4 w-4" aria-hidden />
          </ToolButton>

          {measurePoints.length > 0 ? (
            <ToolButton label="Effacer la mesure" onClick={clearMeasure}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </ToolButton>
          ) : null}

          <ToolButton label="Recentrer sur le parc" onClick={onRecenter}>
            <Crosshair className="h-4 w-4" aria-hidden />
          </ToolButton>

          <ToolButton
            label={fullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? (
              <Minimize className="h-4 w-4" aria-hidden />
            ) : (
              <Maximize className="h-4 w-4" aria-hidden />
            )}
          </ToolButton>
        </div>

        <label className="pointer-events-auto flex items-center gap-2 rounded-control border border-forest-light/40 bg-paper px-2 shadow-panel">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-earth">Fond</span>
          <select
            value={basemap}
            onChange={(event) => setBasemap(event.target.value as BasemapId)}
            className="min-h-[44px] border-0 bg-transparent pr-1 text-sm text-ink focus:outline-none"
            aria-label="Fond de carte"
          >
            {BASEMAPS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Ouverture du catalogue en feuille du bas, sous 1024 px (DESIGN.md §5). */}
      <button
        type="button"
        onClick={onOpenCatalog}
        className="absolute bottom-4 left-1/2 z-[500] flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-control border border-forest-light/40 bg-paper px-4 text-sm shadow-raised lg:hidden"
      >
        <Layers className="h-4 w-4 text-forest" aria-hidden />
        Couches
      </button>
    </>
  );
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "flex h-11 w-11 items-center justify-center border-r border-forest-light/25 last:border-r-0 transition-colors duration-quick",
        active ? "bg-gold/20 text-earth" : "text-forest-deep hover:bg-sand",
      )}
    >
      {children}
    </button>
  );
}
