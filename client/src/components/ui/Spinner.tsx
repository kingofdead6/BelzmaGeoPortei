import { clsx } from "../../lib/clsx";

/**
 * Indicateur de chargement. Sous `prefers-reduced-motion`, la rotation est
 * neutralisée par la règle globale et seul le tracé subsiste.
 */
export function Spinner({ className, label = "Chargement en cours" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={clsx("inline-flex items-center gap-2", className)}>
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
