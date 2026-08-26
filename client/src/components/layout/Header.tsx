import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, Mountain, X } from "lucide-react";
import { clsx } from "../../lib/clsx";

const NAV = [
  { to: "/", label: "Accueil", end: true },
  { to: "/geoportail", label: "Géoportail" },
  { to: "/biodiversite", label: "Biodiversité" },
  { to: "/patrimoine", label: "Patrimoine" },
  { to: "/galerie", label: "Galerie" },
  { to: "/a-propos", label: "À propos" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="on-dark sticky top-0 z-[1000] border-b border-forest-light/20 bg-forest-deep shadow-inset">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 no-underline"
          onClick={() => setOpen(false)}
        >
          <Mountain className="h-5 w-5 text-gold" aria-hidden />
          <span className="leading-none">
            <span className="block font-display text-lg font-semibold text-paper">Belezma</span>
            <span className="block font-mono text-2xs uppercase tracking-[0.14em] text-forest-light">
              Parc national
            </span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      "flex min-h-[44px] items-center rounded-control px-3 text-sm no-underline transition-colors duration-quick",
                      isActive
                        ? "bg-forest/40 font-medium text-paper"
                        : "text-forest-light hover:bg-forest/25 hover:text-paper",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-control text-paper lg:hidden"
          aria-expanded={open}
          aria-controls="navigation-mobile"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav
          id="navigation-mobile"
          aria-label="Navigation principale"
          className="border-t border-forest-light/20 lg:hidden"
        >
          <ul className="mx-auto max-w-[1600px] px-4 py-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      "flex min-h-[44px] items-center rounded-control px-3 text-base no-underline",
                      isActive ? "bg-forest/40 font-medium text-paper" : "text-forest-light",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
