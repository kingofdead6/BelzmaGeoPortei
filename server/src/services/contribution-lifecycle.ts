import { VISIBILITY_TRANSITIONS, type Visibility } from "@belezma/shared";
import { ApiError } from "../utils/errors.js";

/** Formulations françaises des états, telles qu'elles apparaissent à l'écran. */
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: "Privé",
  pending: "En attente de validation",
  public: "Publié",
  rejected: "Refusé",
};

export function canTransition(from: Visibility, to: Visibility): boolean {
  return (VISIBILITY_TRANSITIONS[from] as readonly Visibility[]).includes(to);
}

/**
 * Vérifie une transition du cycle de vie et refuse en nommant l'état courant :
 * « privé → publié » n'existe pas, la validation reste obligatoire (§8).
 */
export function assertTransition(from: Visibility, to: Visibility): void {
  if (from === to) {
    throw ApiError.conflict(
      `Cette contribution est déjà « ${VISIBILITY_LABELS[to].toLowerCase()} ».`,
    );
  }
  if (!canTransition(from, to)) {
    throw ApiError.conflict(
      `Impossible de passer de « ${VISIBILITY_LABELS[from].toLowerCase()} » à ` +
        `« ${VISIBILITY_LABELS[to].toLowerCase()} ».`,
    );
  }
}
