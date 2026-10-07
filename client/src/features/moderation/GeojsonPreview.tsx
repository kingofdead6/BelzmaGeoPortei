import { useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "@belezma/shared";
import { formatNumber, pluralize } from "../../lib/format";
import "../../styles/map.css";

/**
 * Aperçu d'une couche en attente : la géométrie sur une mini-carte, et sa
 * table attributaire en regard (§8).
 */
export function GeojsonPreview({
  geojson,
  color,
}: {
  geojson: FeatureCollection;
  color: string;
}) {
  const bounds = useMemo(() => {
    try {
      const box = L.geoJSON(geojson as never).getBounds();
      return box.isValid() ? box : null;
    } catch {
      return null;
    }
  }, [geojson]);

  // Colonnes de la table : union des clés des vingt premières entités.
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const feature of geojson.features.slice(0, 20)) {
      for (const key of Object.keys(feature.properties ?? {})) keys.add(key);
    }
    return [...keys].slice(0, 6);
  }, [geojson]);

  const rows = geojson.features.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="h-64 overflow-hidden rounded-card border border-forest-light/40">
        <MapContainer
          bounds={bounds ?? undefined}
          center={bounds ? undefined : [35.61, 6.05]}
          zoom={bounds ? undefined : 11}
          className="h-full w-full"
          boundsOptions={{ padding: [16, 16] }}
        >
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenTopoMap (CC-BY-SA)"
          />
          <GeoJSON
            data={geojson as never}
            style={() => ({ color, weight: 2, fillColor: color, fillOpacity: 0.35 })}
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 5,
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1,
              })
            }
          />
        </MapContainer>
      </div>

      <div>
        <p className="datum mb-2 text-2xs uppercase tracking-[0.1em] text-earth">
          Table attributaire — {pluralize(geojson.features.length, "entité")}
          {geojson.features.length > rows.length ? `, ${rows.length} premières affichées` : ""}
        </p>

        {columns.length === 0 ? (
          <p className="text-sm text-ink/60">
            Aucune entité de cette couche ne porte d'attribut.
          </p>
        ) : (
          <div className="max-h-56 overflow-auto border border-forest-light/30">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-sand">
                <tr>
                  <th
                    scope="col"
                    className="border-b border-forest-light/30 px-3 py-2 font-mono text-2xs uppercase tracking-[0.06em] text-earth"
                  >
                    Géométrie
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="border-b border-forest-light/30 px-3 py-2 font-mono text-2xs uppercase tracking-[0.06em] text-earth"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((feature, index) => (
                  <tr key={index} className="even:bg-sand/25">
                    <td className="datum border-b border-forest-light/15 px-3 py-1.5 text-2xs text-ink/70">
                      {feature.geometry?.type ?? "—"}
                    </td>
                    {columns.map((column) => {
                      const value = (feature.properties ?? {})[column];
                      return (
                        <td
                          key={column}
                          className="border-b border-forest-light/15 px-3 py-1.5 text-xs"
                        >
                          {value === null || value === undefined || value === "" ? (
                            <span className="text-ink/35">—</span>
                          ) : typeof value === "number" ? (
                            <span className="datum">{formatNumber(value)}</span>
                          ) : (
                            String(value)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
