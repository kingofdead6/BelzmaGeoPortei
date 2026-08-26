import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { X } from "lucide-react";
import { PARK_CENTER, PARK_DEFAULT_ZOOM } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import {
  useContributedLayers,
  useLayerCatalog,
  useLayerGeojson,
  useMapFeatures,
} from "../lib/queries";
import { basemapById, useMapStore } from "../stores/map-store";
import {
  CONTRIBUTIONS_LAYER_ID,
  INATURALIST_LAYER_ID,
  LayerCatalog,
} from "../features/map/LayerCatalog";
import { InfoPanel } from "../features/map/InfoPanel";
import { StatusBar } from "../features/map/StatusBar";
import { MapToolbar } from "../features/map/MapToolbar";
import { MapEvents, MeasureOverlay, ViewController } from "../features/map/MapEvents";
import { FitToBoundary, OfficialLayerRenderer } from "../features/map/OfficialLayerRenderer";
import { ContributedLayerRenderer } from "../features/map/ContributedLayerRenderer";
import { ContributionMarkers } from "../features/map/ContributionMarkers";
import { INaturalistLayer } from "../features/map/INaturalistLayer";
import { useINaturalist } from "../features/map/use-inaturalist";
import { useMapUrlState } from "../features/map/use-map-url-state";
import { clsx } from "../lib/clsx";
import "../styles/map.css";

export function Geoportail() {
  useMapUrlState();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const catalog = useLayerCatalog();
  const contributed = useContributedLayers();
  const mapFeatures = useMapFeatures();

  const activeLayers = useMapStore((state) => state.activeLayers);
  const setActiveLayers = useMapStore((state) => state.setActiveLayers);
  const basemap = useMapStore((state) => state.basemap);
  const center = useMapStore((state) => state.center);
  const zoom = useMapStore((state) => state.zoom);
  const selection = useMapStore((state) => state.selection);
  const select = useMapStore((state) => state.select);
  const catalogOpen = useMapStore((state) => state.catalogOpen);
  const setCatalogOpen = useMapStore((state) => state.setCatalogOpen);

  const inaturalistActive = activeLayers.includes(INATURALIST_LAYER_ID);
  const inaturalist = useINaturalist(inaturalistActive);

  // La limite officielle sert à cadrer la carte au premier affichage.
  const boundary = useLayerGeojson("boundary", Boolean(catalog.data));

  // Au premier chargement du catalogue, on active les couches marquées
  // « visibles par défaut » — sauf si l'URL en impose déjà une liste.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !catalog.data) return;
    initialised.current = true;
    if (useMapStore.getState().activeLayers.length === 0) {
      setActiveLayers(
        catalog.data.filter((layer) => layer.defaultVisible).map((layer) => layer.layerId),
      );
    }
  }, [catalog.data, setActiveLayers]);

  const activeOfficial = useMemo(
    () => (catalog.data ?? []).filter((layer) => activeLayers.includes(layer.layerId)),
    [catalog.data, activeLayers],
  );

  const activeContributed = useMemo(
    () => (contributed.data ?? []).filter((layer) => activeLayers.includes(layer.layerId)),
    [contributed.data, activeLayers],
  );

  const basemapDefinition = basemapById(basemap);

  const inaturalistState = useMemo(() => {
    if (!inaturalistActive) return { status: "idle" as const, count: 0 };
    if (inaturalist.isPending) return { status: "loading" as const, count: 0 };
    if (inaturalist.isError) {
      return {
        status: "error" as const,
        count: 0,
        message:
          "iNaturalist n'a pas répondu. Vérifiez votre connexion, puis réessayez — les couches officielles restent consultables hors ligne.",
      };
    }
    return { status: "ready" as const, count: inaturalist.data?.length ?? 0 };
  }, [inaturalistActive, inaturalist.isPending, inaturalist.isError, inaturalist.data]);

  const toggleFullscreen = useCallback(() => {
    const element = wrapperRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = (): void => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const recenter = useCallback(() => {
    // `ViewController` n'agit qu'au montage : on repositionne directement la
    // carte, et `moveend` répercutera la nouvelle vue dans le magasin.
    mapRef.current?.setView([PARK_CENTER[0], PARK_CENTER[1]], PARK_DEFAULT_ZOOM);
  }, []);

  return (
    <>
      <PageHead
        title="Géoportail"
        description="Carte interactive du Parc National de Belezma : limite officielle, zonage MAB, végétation, occupation du sol, infrastructures et observations naturalistes."
      />

      <div ref={wrapperRef} className="flex min-h-0 flex-1 flex-col bg-paper">
        <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr_320px]">
          {/* Catalogue — colonne de gauche sur grand écran */}
          <aside
            aria-label="Catalogue des couches"
            className="hidden min-h-0 border-r border-forest-light/25 lg:block"
          >
            {catalog.isError ? (
              <ErrorNotice error={catalog.error} className="m-3" />
            ) : (
              <LayerCatalog
                official={catalog.data}
                contributed={contributed.data}
                loading={catalog.isPending}
                inaturalistState={inaturalistState}
                onRetryINaturalist={() => void inaturalist.refetch()}
              />
            )}
          </aside>

          {/* Carte */}
          <div className="relative min-h-[24rem] bg-sand">
            <MapContainer
              center={center}
              zoom={zoom}
              className="h-full w-full"
              ref={mapRef}
              zoomControl
              // Le défilement de la page prime tant que la carte n'a pas le
              // focus : sur mobile, la carte ne capture pas le geste.
              scrollWheelZoom
            >
              <TileLayer
                key={basemapDefinition.id}
                url={basemapDefinition.url}
                attribution={basemapDefinition.attribution}
              />

              <ViewController center={center} zoom={zoom} />
              <MapEvents />
              <MeasureOverlay />
              <FitToBoundary boundary={boundary.data} />

              {activeOfficial.map((layer) => (
                <OfficialLayerRenderer key={layer.layerId} layer={layer} />
              ))}

              {activeContributed.map((layer) => (
                <ContributedLayerRenderer key={layer.layerId} layer={layer} />
              ))}

              {activeLayers.includes(CONTRIBUTIONS_LAYER_ID) && mapFeatures.data ? (
                <ContributionMarkers features={mapFeatures.data} />
              ) : null}

              {inaturalistActive && inaturalist.data ? (
                <INaturalistLayer observations={inaturalist.data} />
              ) : null}
            </MapContainer>

            <MapToolbar
              fullscreen={fullscreen}
              onToggleFullscreen={toggleFullscreen}
              onRecenter={recenter}
              onOpenCatalog={() => setCatalogOpen(true)}
            />
          </div>

          {/* Panneau d'informations — colonne de droite sur grand écran */}
          <aside
            aria-label="Informations sur l'entité sélectionnée"
            className="hidden min-h-0 border-l border-forest-light/25 lg:block"
          >
            <InfoPanel />
          </aside>
        </div>

        <StatusBar />
      </div>

      {/* Feuille du bas : catalogue sur petit écran (DESIGN.md §5) */}
      {catalogOpen ? (
        <BottomSheet title="Couches" onClose={() => setCatalogOpen(false)}>
          <LayerCatalog
            official={catalog.data}
            contributed={contributed.data}
            loading={catalog.isPending}
            inaturalistState={inaturalistState}
            onRetryINaturalist={() => void inaturalist.refetch()}
          />
        </BottomSheet>
      ) : null}

      {/* Feuille du bas : attributs de l'entité cliquée sur petit écran */}
      {selection ? (
        <BottomSheet title="Informations" onClose={() => select(null)} className="lg:hidden">
          <InfoPanel onClose={() => select(null)} />
        </BottomSheet>
      ) : null}
    </>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={clsx("fixed inset-0 z-[1100] lg:hidden", className)} role="dialog" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-forest-deep/45"
        onClick={onClose}
        aria-label="Fermer"
      />
      <div className="absolute inset-x-0 bottom-0 flex h-[70vh] flex-col rounded-t-card border-t border-forest-light/30 bg-paper shadow-raised">
        <div className="flex items-center justify-between border-b border-forest-light/25 px-3 py-2">
          <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-forest-light/40" />
          <h2 className="mt-1 text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink/60 hover:bg-sand"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
