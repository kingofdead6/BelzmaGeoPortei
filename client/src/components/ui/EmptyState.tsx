import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { clsx } from "../../lib/clsx";

/**
 * État vide : le motif de courbes de niveau en fond, une invitation plutôt
 * qu'un constat (DESIGN.md §1, §8).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "contours flex flex-col items-center justify-center gap-3 rounded-card border border-forest-light/25 bg-sand/40 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-7 w-7 text-forest-light" aria-hidden /> : null}
      <p className="font-display text-xl text-forest-deep">{title}</p>
      {description ? <p className="max-w-md text-sm leading-relaxed text-ink/70">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
