import { create } from "zustand";
import { PARK_CENTER, PARK_DEFAULT_ZOOM } from "@belezma/shared";

export type BasemapId = "osm" | "satellite" | "topo" | "light" | "dark";

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  url: string;
  attribution: string;
}

/** Cinq fonds de carte, repris à l'identique du prototype. */
export const BASEMAPS = [
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  {
    id: "satellite",
    label: "Satellite (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "topo",
    label: "Topographique",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap (CC-BY-SA)",
  },
  {
    id: "light",
    label: "Clair (CARTO)",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO",
  },
  {
    id: "dark",
    label: "Sombre (CARTO)",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; CARTO",
  },
] as const satisfies readonly BasemapDefinition[];

export const DEFAULT_BASEMAP: BasemapDefinition = BASEMAPS[0];

/** Fond de carte par identifiant, avec repli sur OpenStreetMap. */
export function basemapById(id: BasemapId): BasemapDefinition {
  return BASEMAPS.find((basemap) => basemap.id === id) ?? DEFAULT_BASEMAP;
}

export interface FeatureSelection {
  title: string;
  provenance: "OFFICIEL" | "DÉMO" | "CONTRIBUTION" | "iNaturalist";
  properties: Record<string, unknown>;
}

interface MapState {
  center: [number, number];
  zoom: number;
  basemap: BasemapId;
  activeLayers: string[];
  /** Couche mise en avant : l'unique accent `gold` de l'écran (DESIGN.md §7). */
  highlightedLayer: string | null;
  selection: FeatureSelection | null;
  measuring: boolean;
  measurePoints: [number, number][];
  cursor: { lat: number; lng: number } | null;
  announceCursor: boolean;
  catalogOpen: boolean;

  setView: (center: [number, number], zoom: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  toggleLayer: (layerId: string) => void;
  setActiveLayers: (layerIds: string[]) => void;
  highlightLayer: (layerId: string | null) => void;
  select: (selection: FeatureSelection | null) => void;
  setMeasuring: (measuring: boolean) => void;
  addMeasurePoint: (point: [number, number]) => void;
  clearMeasure: () => void;
  setCursor: (cursor: { lat: number; lng: number } | null) => void;
  toggleAnnounceCursor: () => void;
  setCatalogOpen: (open: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [PARK_CENTER[0], PARK_CENTER[1]],
  zoom: PARK_DEFAULT_ZOOM,
  basemap: "osm",
  activeLayers: [],
  highlightedLayer: null,
  selection: null,
  measuring: false,
  measurePoints: [],
  cursor: null,
  // Le relevé de coordonnées change à chaque déplacement : il n'est pas
  // annoncé par défaut (DESIGN.md §7).
  announceCursor: false,
  catalogOpen: false,

  setView: (center, zoom) => set({ center, zoom }),
  setBasemap: (basemap) => set({ basemap }),
  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layerId)
        ? state.activeLayers.filter((value) => value !== layerId)
        : [...state.activeLayers, layerId],
    })),
  setActiveLayers: (activeLayers) => set({ activeLayers }),
  highlightLayer: (highlightedLayer) => set({ highlightedLayer }),
  select: (selection) => set({ selection }),
  setMeasuring: (measuring) =>
    set(measuring ? { measuring } : { measuring, measurePoints: [] }),
  addMeasurePoint: (point) => set((state) => ({ measurePoints: [...state.measurePoints, point] })),
  clearMeasure: () => set({ measurePoints: [] }),
  setCursor: (cursor) => set({ cursor }),
  toggleAnnounceCursor: () => set((state) => ({ announceCursor: !state.announceCursor })),
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
}));
