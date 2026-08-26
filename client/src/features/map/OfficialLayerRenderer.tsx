import { useEffect, useMemo } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, OfficialLayer } from "@belezma/shared";
import { useLayerGeojson } from "../../lib/queries";
import { useMapStore } from "../../stores/map-store";

/**
 * Une couche officielle. La géométrie n'est demandée qu'au moment où la
 * couche est activée, puis conservée en cache par TanStack Query (§9).
 */
export function OfficialLayerRenderer({ layer }: { layer: OfficialLayer }) {
  const geojson = useLayerGeojson(layer.layerId, true);
  const select = useMapStore((state) => state.select);
  const highlighted = useMapStore((state) => state.highlightedLayer);
  const isHighlighted = highlighted === layer.layerId;

  const style = useMemo(
    () => ({
      color: isHighlighted ? "#B8912C" : layer.color,
      weight: isHighlighted ? layer.weight + 2 : layer.weight,
      fillColor: layer.color,
      fillOpacity: layer.fillOpacity,
    }),
    [layer.color, layer.weight, layer.fillOpacity, isHighlighted],
  );

  if (!geojson.data) return null;

  return (
    <GeoJSON
      // Le style dépend de la mise en avant : la clé force le re-rendu.
      key={`${layer.layerId}-${isHighlighted ? "on" : "off"}`}
      data={geojson.data as never}
      style={() => style}
      pointToLayer={(_feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 5,
          color: style.color,
          fillColor: layer.color,
          fillOpacity: 0.9,
          weight: 1,
        })
      }
      onEachFeature={(feature, leafletLayer) => {
        leafletLayer.on("click", () => {
          select({
            title: layer.name,
            provenance: "OFFICIEL",
            properties: (feature.properties ?? {}) as Record<string, unknown>,
          });
        });
      }}
    />
  );
}

/** Recentre la carte sur l'emprise de la limite officielle au premier chargement. */
export function FitToBoundary({ boundary }: { boundary: FeatureCollection | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!boundary) return;
    try {
      const bounds = L.geoJSON(boundary as never).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    } catch {
      // Une géométrie dégradée ne doit pas empêcher l'affichage de la carte.
    }
  }, [boundary, map]);

  return null;
}
