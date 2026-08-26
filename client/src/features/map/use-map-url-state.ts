import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMapStore } from "../../stores/map-store";
import { BASEMAPS, type BasemapId } from "../../stores/map-store";

const BASEMAP_IDS = new Set(BASEMAPS.map((basemap) => basemap.id));

/**
 * Synchronise l'état de la carte avec la chaîne de requête, de sorte qu'une
 * vue soit partageable par simple copie de l'URL (§9, §13).
 *
 *   /geoportail?lat=35.5931&lng=6.0091&z=13&fond=topo&couches=boundary,cedraie
 */
export function useMapUrlState(): void {
  const [params, setParams] = useSearchParams();
  const hydrated = useRef(false);

  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const basemap = useMapStore((state) => state.basemap);
  const activeLayers = useMapStore((state) => state.activeLayers);

  // Lecture initiale : l'URL fait foi au premier rendu.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const store = useMapStore.getState();
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const z = Number(params.get("z"));
    const fond = params.get("fond");
    const couches = params.get("couches");

    if (Number.isFinite(lat) && Number.isFinite(lng) && params.get("lat") && params.get("lng")) {
      store.setView([lat, lng], Number.isFinite(z) && z > 0 ? z : store.zoom);
    }
    if (fond && BASEMAP_IDS.has(fond as BasemapId)) {
      store.setBasemap(fond as BasemapId);
    }
    if (couches !== null) {
      store.setActiveLayers(couches.split(",").map((value) => value.trim()).filter(Boolean));
    }
  }, [params]);

  // Écriture : l'état de la carte se reflète dans l'URL, sans empiler
  // d'entrées dans l'historique du navigateur.
  useEffect(() => {
    if (!hydrated.current) return;

    const next = new URLSearchParams();
    next.set("lat", center[0].toFixed(5));
    next.set("lng", center[1].toFixed(5));
    next.set("z", String(zoom));
    next.set("fond", basemap);
    if (activeLayers.length > 0) next.set("couches", activeLayers.join(","));

    setParams(next, { replace: true });
  }, [center, zoom, basemap, activeLayers, setParams]);
}
