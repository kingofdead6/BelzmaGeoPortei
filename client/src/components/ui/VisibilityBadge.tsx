import type { Visibility } from "@belezma/shared";
import { clsx } from "../../lib/clsx";

/** Même grammaire visuelle que les pastilles UICN : fond ténu, bordure, libellé lisible. */
const TONE: Record<Visibility, string> = {
  private: "border-ink/25 bg-ink/[0.06] text-ink/75",
  pending: "border-gold/50 bg-gold/12 text-earth",
  public: "border-forest/40 bg-forest/10 text-forest",
  rejected: "border-iucn-cr/40 bg-iucn-cr/8 text-iucn-cr",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Privé",
  pending: "En attente de validation",
  public: "Publié",
  rejected: "Refusé",
};

export function VisibilityBadge({
  visibility,
  className,
}: {
  visibility: Visibility;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-0.5 text-xs",
        TONE[visibility],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {VISIBILITY_LABEL[visibility]}
    </span>
  );
}
