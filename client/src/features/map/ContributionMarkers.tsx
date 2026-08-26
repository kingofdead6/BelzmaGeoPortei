import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Link } from "react-router-dom";
import type { FeatureCollection } from "@belezma/shared";
import { formatDate } from "../../lib/format";

interface PointProperties {
  id: string;
  kind: string;
  title: string;
  thumbUrl: string | null;
  scientificName: string | null;
  commonName: string | null;
  iucnStatus: string | null;
  category: string | null;
  author: string;
  publishedAt: string | null;
}

const KIND_COLOR: Record<string, string> = {
  photo: "#2D6A4F",
  observation: "#8A5A34",
  heritage: "#B8912C",
};

/** Pastille dessinée en SVG : aucun émoji, conformément au §10. */
function pointIcon(kind: string): L.DivIcon {
  const color = KIND_COLOR[kind] ?? "#2D6A4F";
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html:
      `<span style="display:block;width:18px;height:18px;border-radius:9px;` +
      `background:${color};border:2px solid #FBF9F4;box-shadow:0 1px 3px rgba(30,38,32,.4)"></span>`,
  });
}

/** Points publics groupés — photographies, observations et sites patrimoniaux. */
export function ContributionMarkers({ features }: { features: FeatureCollection }) {
  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={48}>
      {features.features.map((feature) => {
        if (feature.geometry?.type !== "Point") return null;
        const [lng, lat] = feature.geometry.coordinates;
        const properties = feature.properties as unknown as PointProperties;

        return (
          <Marker
            key={properties.id}
            position={[lat as number, lng as number]}
            icon={pointIcon(properties.kind)}
          >
            <Popup>
              <div className="w-56 p-3">
                {properties.thumbUrl ? (
                  <img
                    src={properties.thumbUrl}
                    alt={properties.title}
                    className="mb-2 h-28 w-full rounded-control object-cover"
                    loading="lazy"
                  />
                ) : null}
                <p className="text-sm font-medium text-forest-deep">{properties.title}</p>
                {properties.scientificName ? (
                  <p className="text-xs italic text-forest">{properties.scientificName}</p>
                ) : null}
                {properties.category ? (
                  <p className="text-xs text-ink/70">{properties.category}</p>
                ) : null}
                <p className="datum mt-1.5 text-2xs text-ink/60">
                  {properties.author} · {formatDate(properties.publishedAt)}
                </p>
                <Link
                  to={`/contributions/${properties.id}`}
                  className="mt-2 inline-block text-xs text-forest underline-offset-2 hover:underline"
                >
                  Ouvrir la fiche
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
