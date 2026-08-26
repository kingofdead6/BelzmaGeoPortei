import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  ContributedLayer,
  Contribution,
  FeatureCollection,
  OfficialLayer,
  PageMeta,
  ParkStats,
  SpeciesDataset,
  SpeciesRecord,
  SpeciesStats,
} from "@belezma/shared";
import { fetchData, fetchPage } from "./api";
import { queryKeys } from "./query-client";

export function useParkStats(): UseQueryResult<ParkStats> {
  return useQuery({
    queryKey: queryKeys.parkStats,
    queryFn: () => fetchData<ParkStats>("/layers/park-stats"),
    staleTime: Infinity,
  });
}

export function useLayerCatalog(): UseQueryResult<OfficialLayer[]> {
  return useQuery({
    queryKey: queryKeys.layers,
    queryFn: () => fetchData<OfficialLayer[]>("/layers"),
    staleTime: Infinity,
  });
}

/**
 * Géométrie d'une couche, chargée seulement quand la couche est activée et
 * conservée ensuite en cache : les 19 couches n'entrent jamais toutes en
 * mémoire au premier rendu (§9).
 */
export function useLayerGeojson(layerId: string | null, enabled: boolean): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: queryKeys.layerGeojson(layerId ?? ""),
    queryFn: () => fetchData<FeatureCollection>(`/layers/${layerId}/geojson`),
    enabled: Boolean(layerId) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useContributedLayers(): UseQueryResult<ContributedLayer[]> {
  return useQuery({
    queryKey: queryKeys.contributedLayers,
    queryFn: () => fetchData<ContributedLayer[]>("/layers/contributed"),
  });
}

export function useContributedLayerGeojson(
  contributionId: string | null,
  enabled: boolean,
): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: queryKeys.contributedLayerGeojson(contributionId ?? ""),
    queryFn: () => fetchData<FeatureCollection>(`/layers/contributed/${contributionId}/geojson`),
    enabled: Boolean(contributionId) && enabled,
    staleTime: Infinity,
  });
}

export function useSpeciesDatasets(): UseQueryResult<SpeciesDataset[]> {
  return useQuery({
    queryKey: queryKeys.speciesDatasets,
    queryFn: () => fetchData<SpeciesDataset[]>("/species/datasets"),
    staleTime: Infinity,
  });
}

export function useSpeciesStats(): UseQueryResult<SpeciesStats> {
  return useQuery({
    queryKey: queryKeys.speciesStats,
    queryFn: () => fetchData<SpeciesStats>("/species/stats"),
    staleTime: Infinity,
  });
}

export interface SpeciesQuery extends Record<string, unknown> {
  dataset?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export function useSpecies(params: SpeciesQuery): UseQueryResult<{ data: SpeciesRecord[]; meta: PageMeta }> {
  return useQuery({
    queryKey: queryKeys.species(params),
    queryFn: () =>
      fetchPage<SpeciesRecord[], PageMeta>("/species", { params: cleanParams(params) }),
    placeholderData: (previous) => previous,
  });
}

export interface ContributionQuery extends Record<string, unknown> {
  kind?: string;
  q?: string;
  tags?: string;
  bbox?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export function useContributions(
  params: ContributionQuery,
): UseQueryResult<{ data: Contribution[]; meta: PageMeta }> {
  return useQuery({
    queryKey: queryKeys.contributions(params),
    queryFn: () =>
      fetchPage<Contribution[], PageMeta>("/contributions", { params: cleanParams(params) }),
    placeholderData: (previous) => previous,
  });
}

export function useContribution(id: string): UseQueryResult<Contribution> {
  return useQuery({
    queryKey: queryKeys.contribution(id),
    queryFn: () => fetchData<Contribution>(`/contributions/${id}`),
    enabled: Boolean(id),
  });
}

export function useMapFeatures(bbox?: string): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: queryKeys.mapFeatures({ bbox }),
    queryFn: () => fetchData<FeatureCollection>("/map/features", { params: cleanParams({ bbox }) }),
  });
}

/** Retire les paramètres vides pour ne pas polluer la clé de cache. */
function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "" && value !== null),
  ) as Partial<T>;
}
