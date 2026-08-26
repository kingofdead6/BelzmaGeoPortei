import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { PARK_BBOX } from "@belezma/shared";

export interface INaturalistObservation {
  id: number;
  lat: number;
  lng: number;
  scientificName: string;
  commonName: string | null;
  iconicTaxon: string | null;
  photoUrl: string | null;
  observedOn: string | null;
  observer: string | null;
  uri: string;
}

/** Couleurs par grand groupe taxonomique — reprises du prototype. */
export const INATURALIST_COLORS: Record<string, string> = {
  Plantae: "#73AC13",
  Aves: "#1E88E5",
  Mammalia: "#8A5A34",
  Reptilia: "#EA580C",
  Amphibia: "#00ACC1",
  Insecta: "#AB47BC",
  Arachnida: "#6D4C41",
  Mollusca: "#C2185B",
  Fungi: "#E91E63",
  Chromista: "#607D8B",
  Protozoa: "#607D8B",
  Actinopterygii: "#0277BD",
};

export const INATURALIST_DEFAULT_COLOR = "#74AC00";

export function iconicTaxonColor(taxon: string | null): string {
  return (taxon && INATURALIST_COLORS[taxon]) || INATURALIST_DEFAULT_COLOR;
}

const [minLng, minLat, maxLng, maxLat] = PARK_BBOX;

export const INATURALIST_EXPLORE_URL =
  `https://www.inaturalist.org/observations?swlat=${minLat}&swlng=${minLng}` +
  `&nelat=${maxLat}&nelng=${maxLng}&verifiable=true`;

interface RawObservation {
  id: number;
  location?: string | null;
  taxon?: { name?: string; preferred_common_name?: string; iconic_taxon_name?: string } | null;
  photos?: { url?: string }[];
  observed_on?: string | null;
  user?: { login?: string; name?: string } | null;
  uri?: string;
}

/**
 * Observations chargées en direct depuis iNaturalist, sur l'emprise de la
 * limite officielle. Conservées dix minutes côté client (§9).
 */
export function useINaturalist(enabled: boolean): UseQueryResult<INaturalistObservation[]> {
  return useQuery({
    queryKey: ["inaturalist", PARK_BBOX],
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const url =
        `https://api.inaturalist.org/v1/observations?swlat=${minLat}&swlng=${minLng}` +
        `&nelat=${maxLat}&nelng=${maxLng}&photos=true&verifiable=true&order_by=observed_on` +
        `&per_page=200&locale=fr`;

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`iNaturalist a répondu ${response.status}`);
      }

      const payload = (await response.json()) as { results?: RawObservation[] };

      return (payload.results ?? []).flatMap((observation): INaturalistObservation[] => {
        const [lat, lng] = (observation.location ?? "").split(",").map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

        const rawPhoto = observation.photos?.[0]?.url ?? null;
        return [
          {
            id: observation.id,
            lat: lat as number,
            lng: lng as number,
            scientificName: observation.taxon?.name ?? "Espèce non identifiée",
            commonName: observation.taxon?.preferred_common_name ?? null,
            iconicTaxon: observation.taxon?.iconic_taxon_name ?? null,
            photoUrl: rawPhoto ? rawPhoto.replace("square", "small") : null,
            observedOn: observation.observed_on ?? null,
            observer: observation.user?.name || observation.user?.login || null,
            uri: observation.uri ?? `https://www.inaturalist.org/observations/${observation.id}`,
          },
        ];
      });
    },
  });
}
