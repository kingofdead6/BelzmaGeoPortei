import { length, lineString } from "@turf/turf";

/**
 * Longueur cumulée d'un tracé de mesure, en mètres.
 * Deux points au moins sont nécessaires.
 */
export function measureLength(points: [number, number][]): number {
  if (points.length < 2) return 0;
  // turf attend des positions [lng, lat] ; le magasin conserve [lat, lng].
  const coordinates = points.map(([lat, lng]) => [lng, lat] as [number, number]);
  return length(lineString(coordinates), { units: "kilometers" }) * 1000;
}
