import type { ReactNode } from "react";
import { Mountain } from "lucide-react";
import { Link } from "react-router-dom";

/** Cadre commun aux écrans de compte, sur fond texturé de courbes de niveau. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="contours flex min-h-[calc(100dvh-3.5rem)] items-start justify-center bg-sand/50 px-4 py-14">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center gap-2 no-underline">
          <Mountain className="h-5 w-5 text-forest" aria-hidden />
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-earth">
            Parc National de Belezma
          </span>
        </Link>

        <div className="rounded-card border border-forest-light/30 bg-paper p-6 shadow-panel sm:p-8">
          <h1 className="text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-ink/70">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
