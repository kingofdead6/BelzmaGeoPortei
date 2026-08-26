import { Info, X } from "lucide-react";
import { ProvenanceChip } from "../../components/ui/ProvenanceChip";
import { useMapStore } from "../../stores/map-store";

/**
 * Panneau d'attributs de l'entité cliquée. Les valeurs numériques et les codes
 * s'affichent en mono ; le reste en texte courant.
 */
export function InfoPanel({ onClose }: { onClose?: () => void }) {
  const selection = useMapStore((state) => state.selection);
  const select = useMapStore((state) => state.select);

  if (!selection) {
    return (
      <div className="contours flex h-full flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <Info className="h-6 w-6 text-forest-light" aria-hidden />
        <p className="font-display text-lg text-forest-deep">Aucune entité sélectionnée</p>
        <p className="max-w-[16rem] text-sm leading-relaxed text-ink/65">
          Cliquez une entité sur la carte pour lire ses attributs et sa provenance.
        </p>
      </div>
    );
  }

  const entries = Object.entries(selection.properties).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex items-start gap-2 border-b border-forest-light/25 p-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug">{selection.title}</h2>
          <div className="mt-1.5">
            <ProvenanceChip provenance={selection.provenance} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            select(null);
            onClose?.();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink/55 hover:bg-sand hover:text-ink"
          aria-label="Fermer le panneau d'informations"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink/60">
            Cette entité ne porte aucun attribut dans le fichier source.
          </p>
        ) : (
          <dl>
            {entries.map(([key, value]) => (
              <div key={key} className="border-b border-forest-light/15 px-4 py-2.5">
                <dt className="font-mono text-2xs uppercase tracking-[0.08em] text-earth">{key}</dt>
                <dd className="mt-0.5 break-words text-sm text-ink/85">{renderValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function renderValue(value: unknown) {
  if (typeof value === "number") {
    return <span className="datum">{new Intl.NumberFormat("fr-FR").format(value)}</span>;
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string") {
    // Une valeur purement numérique reste une mesure : elle garde le mono.
    const numeric = Number(value.replace(",", "."));
    if (value.trim() !== "" && Number.isFinite(numeric)) {
      return <span className="datum">{value}</span>;
    }
    if (/^https?:\/\//.test(value)) {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="text-forest underline-offset-2 hover:underline">
          {value}
        </a>
      );
    }
    return value;
  }
  return <span className="datum">{JSON.stringify(value)}</span>;
}
