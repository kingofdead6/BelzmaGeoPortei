import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  IUCN_LABELS,
  IUCN_STATUSES,
  RARITY_LABELS,
  SPECIES_COLUMNS,
  type SpeciesDataset,
  type SpeciesRecord,
} from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { useSpecies, useSpeciesDatasets, useSpeciesStats } from "../lib/queries";
import { formatNumber, pluralize } from "../lib/format";
import { clsx } from "../lib/clsx";

const PAGE_SIZE = 100;

export function Biodiversite() {
  const datasets = useSpeciesDatasets();
  const stats = useSpeciesStats();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const active: SpeciesDataset | undefined = useMemo(() => {
    if (!datasets.data?.length) return undefined;
    return datasets.data.find((dataset) => dataset.id === activeId) ?? datasets.data[0];
  }, [datasets.data, activeId]);

  const records = useSpecies({
    dataset: active?.id,
    q: search.length >= 2 ? search : undefined,
    page,
    limit: PAGE_SIZE,
  });

  const columns = active ? SPECIES_COLUMNS[active.kind] : [];

  function selectDataset(id: string): void {
    setActiveId(id);
    setPage(1);
  }

  return (
    <>
      <PageHead
        title="Biodiversité"
        description="Flore et faune du Parc National de Belezma : espèces protégées, statuts UICN, endémisme et rareté, d'après le Tome II — Milieu Biotique (2026)."
      />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <ProvenanceChip provenance="OFFICIEL" />
          <h1 className="mt-3 text-4xl">Biodiversité du massif</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink/75">
            Les listes ci-dessous sont extraites du Tome II — Milieu Biotique (2026). Elles couvrent la
            flore protégée par le décret exécutif 12-03, la flore évaluée par l'UICN, l'endémisme
            floristique et faunistique, ainsi que les invertébrés, reptiles, oiseaux et mammifères
            protégés.
          </p>
          {stats.data ? (
            <p className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="datum text-sm text-earth">{pluralize(stats.data.total, "fiche")}</span>
              {stats.data.byIucnStatus.map((entry) => (
                <span key={entry.status} className="flex items-center gap-1.5">
                  <IucnBadge status={entry.status} />
                  <span className="datum text-sm text-ink/70">{formatNumber(entry.count)}</span>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10">
        {datasets.isError ? <ErrorNotice error={datasets.error} /> : null}

        {/* Onglets des jeux de données */}
        {datasets.data ? (
          <div className="border-b border-forest-light/30">
            <ul role="tablist" aria-label="Jeux de données" className="-mb-px flex flex-wrap gap-x-1">
              {datasets.data.map((dataset) => {
                const selected = dataset.id === active?.id;
                return (
                  <li key={dataset.id} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`onglet-${dataset.id}`}
                      aria-selected={selected}
                      aria-controls="tableau-especes"
                      onClick={() => selectDataset(dataset.id)}
                      className={clsx(
                        "flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm transition-colors duration-quick",
                        selected
                          ? "border-forest font-medium text-forest-deep"
                          : "border-transparent text-ink/65 hover:border-forest-light/50 hover:text-forest-deep",
                      )}
                    >
                      {dataset.label}
                      <span className="datum text-2xs text-ink/50">{formatNumber(dataset.count)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="relative flex-1 sm:max-w-sm">
            <span className="sr-only">Rechercher une espèce</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nom scientifique ou nom commun"
              className="min-h-[44px] w-full rounded-control border border-forest-light/40 bg-paper pl-9 pr-3 text-sm placeholder:text-ink/40"
            />
          </label>
          {records.data ? (
            <p className="datum text-xs text-ink/60">
              {pluralize(records.data.meta.total, "résultat")}
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          {records.isError ? (
            <ErrorNotice error={records.error} />
          ) : records.isPending ? (
            <div className="flex justify-center py-16 text-forest">
              <Spinner label="Chargement des espèces" />
            </div>
          ) : records.data.data.length === 0 ? (
            <EmptyState
              title="Aucune espèce ne correspond à cette recherche"
              description={`Essayez un nom partiel — « Cedrus », « Aquila » — ou changez de jeu de données.`}
            />
          ) : (
            <SpeciesTable
              records={records.data.data}
              columns={columns}
              caption={active?.label ?? ""}
              grouped={active?.grouped ?? false}
            />
          )}
        </div>

        {records.data && records.data.meta.pageCount > 1 ? (
          <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Pagination">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Page précédente
            </Button>
            <p className="datum text-xs text-ink/60">
              Page {page} sur {records.data.meta.pageCount}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= records.data.meta.pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Page suivante
            </Button>
          </nav>
        ) : null}

        <IucnLegend />
      </div>
    </>
  );
}

/** Tableau `<table>` sémantique, en-têtes figés, défilement propre (DESIGN.md §7). */
function SpeciesTable({
  records,
  columns,
  caption,
  grouped,
}: {
  records: SpeciesRecord[];
  columns: { field: string; label: string; mono?: boolean }[];
  caption: string;
  grouped: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-forest-light/30">
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <caption className="border-b border-forest-light/25 bg-sand/60 px-4 py-3 text-left text-xs text-ink/70">
          {caption} — source : Tome II, Milieu Biotique (2026)
        </caption>
        <thead className="sticky top-0 z-10 bg-sand">
          <tr>
            {grouped ? (
              <th scope="col" className="border-b border-forest-light/30 px-4 py-2.5 font-mono text-2xs uppercase tracking-[0.08em] text-earth">
                Groupe
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.field}
                scope="col"
                className="border-b border-forest-light/30 px-4 py-2.5 font-mono text-2xs uppercase tracking-[0.08em] text-earth"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="even:bg-sand/25">
              {grouped ? (
                <td className="border-b border-forest-light/15 px-4 py-2 text-sm text-ink/70">
                  {record.groupe ?? "—"}
                </td>
              ) : null}
              {columns.map((column) => (
                <td key={column.field} className="border-b border-forest-light/15 px-4 py-2 text-sm">
                  <Cell record={record} field={column.field} mono={column.mono} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ record, field, mono }: { record: SpeciesRecord; field: string; mono?: boolean }) {
  const value = record[field as keyof SpeciesRecord];

  if (field === "statut_uicn") return <IucnBadge status={typeof value === "string" ? value : null} />;

  if (value === null || value === undefined || value === "") return <span className="text-ink/35">—</span>;

  if (field === "rarete" && typeof value === "string") {
    const label = RARITY_LABELS[value];
    return (
      <span className="datum text-xs" title={label ? `${value} — ${label}` : value}>
        {value}
        {label ? <span className="sr-only"> — {label}</span> : null}
      </span>
    );
  }

  if (field === "nom_scientifique" || field === "espece") {
    return <span className="italic text-forest-deep">{String(value)}</span>;
  }

  return <span className={mono ? "datum text-xs" : "text-ink/85"}>{String(value)}</span>;
}

function IucnLegend() {
  return (
    <section aria-labelledby="legende-uicn" className="mt-10 rounded-card border border-forest-light/25 bg-sand/40 p-5">
      <h2 id="legende-uicn" className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
        Catégories de la Liste rouge de l'UICN
      </h2>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {IUCN_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2 text-sm text-ink/80">
            <IucnBadge status={status} />
            {IUCN_LABELS[status]}
          </li>
        ))}
      </ul>
    </section>
  );
}
