import { Link } from "react-router-dom";
import { PARK_CREATED_YEAR, PARK_MAB_YEAR } from "@belezma/shared";

export function Footer() {
  return (
    <footer className="on-dark mt-auto border-t border-forest-light/20 bg-forest-deep text-forest-light">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg text-paper">Parc National de Belezma</p>
          <p className="mt-2 text-sm leading-relaxed">
            Wilaya de Batna, Algérie. Créé en <span className="datum">{PARK_CREATED_YEAR}</span>, inscrit au
            réseau mondial des réserves de biosphère de l'UNESCO en{" "}
            <span className="datum">{PARK_MAB_YEAR}</span>.
          </p>
        </div>

        <nav aria-label="Sections du site">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/70">Consulter</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/geoportail" className="no-underline hover:text-paper">Géoportail</Link></li>
            <li><Link to="/biodiversite" className="no-underline hover:text-paper">Biodiversité</Link></li>
            <li><Link to="/patrimoine" className="no-underline hover:text-paper">Patrimoine</Link></li>
            <li><Link to="/galerie" className="no-underline hover:text-paper">Galerie</Link></li>
          </ul>
        </nav>

        <nav aria-label="Contribuer">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/70">Contribuer</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/inscription" className="no-underline hover:text-paper">Créer un compte</Link></li>
            <li><Link to="/connexion" className="no-underline hover:text-paper">Se connecter</Link></li>
            <li><Link to="/mon-espace" className="no-underline hover:text-paper">Mon espace</Link></li>
          </ul>
        </nav>

        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-paper/70">Sources</p>
          <p className="mt-3 text-sm leading-relaxed">
            Limite officielle, zonage MAB et occupation du sol : shapefiles et KMZ du parc. Espèces :
            Tome II — Milieu Biotique (2026).{" "}
            <Link to="/a-propos" className="no-underline underline-offset-2 hover:text-paper hover:underline">
              Méthodologie
            </Link>
          </p>
        </div>
      </div>

      <div className="border-t border-forest-light/15">
        <p className="mx-auto max-w-[1600px] px-4 py-4 font-mono text-2xs text-forest-light/80">
          EPSG:4326 — WGS 84 · Données cartographiques sous licence des producteurs respectifs
        </p>
      </div>
    </footer>
  );
}
