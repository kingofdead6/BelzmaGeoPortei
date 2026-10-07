import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Crosshair } from "lucide-react";
import { PARK_CENTER, PARK_DEFAULT_ZOOM } from "@belezma/shared";
import { Button } from "../../components/ui/Button";
import { formatCoordinate } from "../../lib/format";
import "../../styles/map.css";

const PIN = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html:
    '<span style="display:block;width:22px;height:22px;border-radius:11px;' +
    'background:#B8912C;border:3px solid #FBF9F4;box-shadow:0 1px 4px rgba(30,38,32,.45)"></span>',
});

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Mini-carte de l'assistant de dépôt. La position vient toujours d'un clic
 * explicite ou de la géolocalisation demandée, jamais des métadonnées de la
 * photographie (§7).
 */
export function LocationPicker({
  value,
  onChange,
  required = false,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number } | null) => void;
  required?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!locating) return;
    if (!("geolocation" in navigator)) {
      setGeolocationError("Votre navigateur ne permet pas la géolocalisation.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeolocationError(
          "La géolocalisation a été refusée. Cliquez directement la carte pour placer le point.",
        );
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }, [locating, onChange]);

  return (
    <div className="space-y-3">
      <div className="h-72 overflow-hidden rounded-card border border-forest-light/40">
        <MapContainer
          center={value ? [value.lat, value.lng] : [PARK_CENTER[0], PARK_CENTER[1]]}
          zoom={value ? 14 : PARK_DEFAULT_ZOOM}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenTopoMap (CC-BY-SA)"
          />
          <ClickCapture onPick={(lat, lng) => onChange({ lat, lng })} />
          {value ? <Marker position={[value.lat, value.lng]} icon={PIN} /> : null}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="datum flex-1 text-xs text-ink/70" aria-live="polite">
          {value
            ? `${formatCoordinate(value.lat, "lat")}  ${formatCoordinate(value.lng, "lng")}  ·  EPSG:4326`
            : required
              ? "Cliquez la carte pour placer le point."
              : "Cliquez la carte pour localiser cette contribution, ou laissez vide."}
        </p>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={locating}
          onClick={() => {
            setGeolocationError(null);
            setLocating(true);
          }}
        >
          <Crosshair className="h-4 w-4" aria-hidden />
          {locating ? "Localisation…" : "Utiliser ma position"}
        </Button>

        {value && !required ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Retirer le point
          </Button>
        ) : null}
      </div>

      {geolocationError ? (
        <p role="alert" className="text-xs text-iucn-cr">
          {geolocationError}
        </p>
      ) : null}
    </div>
  );
}
