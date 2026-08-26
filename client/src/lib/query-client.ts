import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry(failureCount, error) {
        // Inutile de réessayer une requête refusée ou introuvable.
        if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export const queryKeys = {
  parkStats: ["park-stats"] as const,
  layers: ["layers"] as const,
  layerGeojson: (layerId: string) => ["layers", layerId, "geojson"] as const,
  contributedLayers: ["layers", "contributed"] as const,
  contributedLayerGeojson: (id: string) => ["layers", "contributed", id, "geojson"] as const,
  speciesDatasets: ["species", "datasets"] as const,
  speciesStats: ["species", "stats"] as const,
  species: (params: Record<string, unknown>) => ["species", params] as const,
  contributions: (params: Record<string, unknown>) => ["contributions", params] as const,
  contribution: (id: string) => ["contributions", id] as const,
  mapFeatures: (params: Record<string, unknown>) => ["map-features", params] as const,
  inaturalist: ["inaturalist"] as const,
  me: ["auth", "me"] as const,
  myContributions: (params: Record<string, unknown>) => ["contributions", "mine", params] as const,
} as const;
