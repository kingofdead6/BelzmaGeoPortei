import L from "leaflet";
import { CircleMarker, Popup } from "react-leaflet";
import { formatDate } from "../../lib/format";
import { iconicTaxonColor, type INaturalistObservation } from "./use-inaturalist";

/**
 * Observations iNaturalist, colorées par grand groupe taxonomique. L'infobulle
 * porte la photographie, le nom, la date et le lien vers la fiche d'origine.
 */
export function INaturalistLayer({ observations }: { observations: INaturalistObservation[] }) {
  return (
    <>
      {observations.map((observation) => {
        const color = iconicTaxonColor(observation.iconicTaxon);
        return (
          <CircleMarker
            key={observation.id}
            center={L.latLng(observation.lat, observation.lng)}
            radius={6}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 1 }}
          >
            <Popup>
              <div className="w-56 p-3">
                {observation.photoUrl ? (
                  <img
                    src={observation.photoUrl}
                    alt={observation.scientificName}
                    className="mb-2 h-32 w-full rounded-control object-cover"
                    loading="lazy"
                  />
                ) : null}
                <p className="text-sm font-medium italic text-forest-deep">
                  {observation.scientificName}
                </p>
                {observation.commonName ? (
                  <p className="text-xs text-ink/70">{observation.commonName}</p>
                ) : null}
                <p className="datum mt-1.5 text-2xs text-ink/60">
                  {formatDate(observation.observedOn)}
                  {observation.observer ? ` · ${observation.observer}` : ""}
                </p>
                <a
                  href={observation.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-forest underline-offset-2 hover:underline"
                >
                  Voir sur iNaturalist
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
