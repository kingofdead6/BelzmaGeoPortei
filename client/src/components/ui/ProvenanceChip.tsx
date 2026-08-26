import { clsx } from "../../lib/clsx";

export type Provenance = "OFFICIEL" | "DÉMO" | "CONTRIBUTION" | "iNaturalist";

const STYLES: Record<Provenance, string> = {
  OFFICIEL: "border-forest/35 bg-forest/10 text-forest",
  "DÉMO": "border-earth/35 bg-earth/10 text-earth",
  CONTRIBUTION: "border-gold/45 bg-gold/12 text-earth",
  iNaturalist: "border-[#74AC00]/45 bg-[#74AC00]/12 text-[#4d7200]",
};

const TITLES: Record<Provenance, string> = {
  OFFICIEL: "Donnée issue des shapefiles et KMZ officiels du parc",
  "DÉMO": "Donnée de démonstration, non relevée sur le terrain",
  CONTRIBUTION: "Donnée déposée par un contributeur et validée par l'équipe du parc",
  iNaturalist: "Observation chargée en direct depuis iNaturalist",
};

/**
 * Puce de provenance — élément signature. Elle accompagne chaque donnée
 * affichée, partout : catalogue, panneau d'attributs, galerie, tableaux
 * (DESIGN.md §1).
 */
export function ProvenanceChip({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 border-l-2 border-y-0 border-r-0 py-0.5 pl-1.5 pr-2",
        "font-mono text-2xs uppercase tracking-[0.08em]",
        STYLES[provenance],
        className,
      )}
      title={TITLES[provenance]}
    >
      {provenance}
    </span>
  );
}
