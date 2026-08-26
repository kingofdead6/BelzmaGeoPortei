import { IUCN_COLORS, IUCN_LABELS, type IucnStatus } from "@belezma/shared";
import { clsx } from "../../lib/clsx";

const KNOWN = Object.keys(IUCN_COLORS) as IucnStatus[];

export function isIucnStatus(value: string | null | undefined): value is IucnStatus {
  return typeof value === "string" && KNOWN.includes(value as IucnStatus);
}

/**
 * Pastille de statut UICN. Le code seul ne suffit jamais : l'intitulé complet
 * est porté par `title` et par un texte réservé aux lecteurs d'écran
 * (DESIGN.md §2).
 */
export function IucnBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!isIucnStatus(status)) {
    return <span className="text-ink/40">—</span>;
  }

  const color = IUCN_COLORS[status];
  const label = IUCN_LABELS[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-control border px-1.5 py-0.5 font-mono text-2xs font-medium",
        className,
      )}
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}22` }}
      title={`${status} — ${label}`}
    >
      {status}
      <span className="sr-only"> — {label}</span>
    </span>
  );
}
