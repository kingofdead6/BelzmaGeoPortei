/**
 * Mise en forme française. Toute valeur produite ici est une mesure ou un
 * code : elle s'affiche en IBM Plex Mono (classe `datum`).
 */

const numberFormat = new Intl.NumberFormat("fr-FR");
const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatHectares(value: number): string {
  return `${decimalFormat.format(value)} ha`;
}

export function formatKilometres(value: number): string {
  return `${decimalFormat.format(value)} km`;
}

/** Distance en mètres sous 1 km, en kilomètres au-delà. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${numberFormat.format(Math.round(metres))} m`;
  return `${decimalFormat.format(metres / 1000)} km`;
}

/** Coordonnée décimale avec hémisphère, telle qu'elle s'affiche sur la carte. */
export function formatCoordinate(value: number, axis: "lat" | "lng"): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "O";
  return `${Math.abs(value).toFixed(4)} ${hemisphere}`;
}

/** Dénominateur d'échelle pour un niveau de zoom Leaflet. */
export function scaleDenominator(zoom: number): number {
  return Math.round(559_082_264 / 2 ** zoom);
}

export function formatScale(zoom: number): string {
  return `1:${numberFormat.format(scaleDenominator(zoom))}`;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormat.format(new Date(value));
}

/** Ancienneté relative : « il y a 2 jours ». */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${decimalFormat.format(bytes / 1024)} Ko`;
  return `${decimalFormat.format(bytes / (1024 * 1024))} Mo`;
}

/** « 1 entité » / « 3 entités » — accord automatique. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count > 1 ? plural : singular}`;
}
