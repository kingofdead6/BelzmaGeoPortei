import L from "leaflet";
import { GeoJSON } from "react-leaflet";
import type { ContributedLayer } from "@belezma/shared";
import { useContributedLayerGeojson } from "../../lib/queries";
import { useMapStore } from "../../stores/map-store";

/** Couche issue d'une contribution publiée, chargée à l'activation. */
export function ContributedLayerRenderer({ layer }: { layer: ContributedLayer }) {
  const geojson = useContributedLayerGeojson(layer.contributionId, true);
  const select = useMapStore((state) => state.select);

  if (!geojson.data) return null;

  const style = {
    color: layer.color,
    weight: layer.weight,
    fillColor: layer.color,
    fillOpacity: layer.fillOpacity,
  };

  return (
    <GeoJSON
      data={geojson.data as never}
      style={() => style}
      pointToLayer={(_feature, latlng) =>
        L.circleMarker(latlng, { radius: 5, ...style, fillOpacity: 0.9 })
      }
      onEachFeature={(feature, leafletLayer) => {
        leafletLayer.on("click", () => {
          select({
            title: layer.name,
            provenance: "CONTRIBUTION",
            properties: {
              "Déposée par": layer.owner.displayName,
              ...((feature.properties ?? {}) as Record<string, unknown>),
            },
          });
        });
      }}
    />
  );
}
