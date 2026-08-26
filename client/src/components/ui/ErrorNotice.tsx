import { AlertTriangle } from "lucide-react";
import { ApiRequestError } from "../../lib/api";
import { clsx } from "../../lib/clsx";

/** Message d'erreur : ce qui s'est passé, puis quoi faire (DESIGN.md §8). */
export function ErrorNotice({
  error,
  fallback = "Le chargement a échoué. Réessayez dans un instant.",
  className,
}: {
  error: unknown;
  fallback?: string;
  className?: string;
}) {
  const message = error instanceof ApiRequestError ? error.message : fallback;

  return (
    <div
      role="alert"
      className={clsx(
        "flex items-start gap-3 rounded-card border border-iucn-cr/30 bg-iucn-cr/5 px-4 py-3 text-sm text-ink",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-iucn-cr" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
