import { useEffect } from "react";
import { Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { useMapStore } from "../../stores/map-store";

/**
 * Écoute les événements de la carte : déplacement du curseur, changement de
 * vue, clics de mesure, clic droit pour déposer une contribution.
 */
export function MapEvents() {
  const setCursor = useMapStore((state) => state.setCursor);
  const setView = useMapStore((state) => state.setView);
  const measuring = useMapStore((state) => state.measuring);
  const addMeasurePoint = useMapStore((state) => state.addMeasurePoint);
  const navigate = useNavigate();

  const map = useMapEvents({
    mousemove(event) {
      setCursor({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    mouseout() {
      setCursor(null);
    },
    moveend() {
      const center = map.getCenter();
      setView([center.lat, center.lng], map.getZoom());
    },
    zoomend() {
      const center = map.getCenter();
      setView([center.lat, center.lng], map.getZoom());
    },
    click(event) {
      if (measuring) addMeasurePoint([event.latlng.lat, event.latlng.lng]);
    },
    contextmenu(event) {
      // « Ajouter une contribution ici » : les coordonnées pré-remplissent
      // l'assistant de dépôt (§9).
      event.originalEvent.preventDefault();
      navigate(
        `/mon-espace/nouveau?lng=${event.latlng.lng.toFixed(6)}&lat=${event.latlng.lat.toFixed(6)}`,
      );
    },
  });

  // Le curseur devient une croix pendant la mesure.
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = measuring ? "crosshair" : "";
    return () => {
      container.style.cursor = "";
    };
  }, [measuring, map]);

  return null;
}

/** Tracé de mesure en cours. */
export function MeasureOverlay() {
  const points = useMapStore((state) => state.measurePoints);
  if (points.length === 0) return null;

  return (
    <>
      <Polyline positions={points} pathOptions={{ color: "#B8912C", weight: 3, dashArray: "6 4" }} />
      {points.map((point, index) => (
        <CircleMarker
          key={`${point[0]}-${point[1]}-${index}`}
          center={point}
          radius={4}
          pathOptions={{ color: "#B8912C", fillColor: "#FBF9F4", fillOpacity: 1, weight: 2 }}
        />
      ))}
    </>
  );
}

/** Applique un changement de vue déclenché hors de la carte (URL, recentrage). */
export function ViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    const current = map.getCenter();
    const moved =
      Math.abs(current.lat - center[0]) > 1e-5 || Math.abs(current.lng - center[1]) > 1e-5;
    if (moved || map.getZoom() !== zoom) {
      map.setView(center, zoom, { animate: false });
    }
    // Volontairement limité au montage : ensuite, c'est la carte qui pilote
    // l'état, et non l'inverse — sans quoi les deux se renvoient la vue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
