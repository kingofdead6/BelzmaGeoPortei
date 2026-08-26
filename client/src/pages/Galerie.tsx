import { useState } from "react";
import { Camera, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { CONTRIBUTION_KINDS, type ContributionKind } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Button, ButtonLink } from "../components/ui/Button";
import { useContributions } from "../lib/queries";
import { formatDate, pluralize } from "../lib/format";
import { clsx } from "../lib/clsx";

const KIND_LABELS: Record<ContributionKind, string> = {
  photo: "Photographies",
  observation: "Observations",
  heritage: "Sites patrimoniaux",
  layer: "Couches SIG",
};

export function Galerie() {
  const [kind, setKind] = useState<ContributionKind | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const contributions = useContributions({
    kind: kind ?? undefined,
    q: search.length >= 2 ? search : undefined,
    page,
    limit: 24,
  });

  return (
    <>
      <PageHead
        title="Galerie"
        description="Photographies, observations d'espèces et sites patrimoniaux déposés par les visiteurs du Parc National de Belezma et validés par l'équipe du parc."
      />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <h1 className="text-4xl">Contributions publiées</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink/75">
            Chaque élément présenté ici a été déposé par un contributeur puis relu par l'équipe
            scientifique du parc. Les observations d'espèces et les sites patrimoniaux apparaissent
            également sur la carte du géoportail.
          </p>
          <div className="mt-6">
            <ButtonLink to="/mon-espace/nouveau">Déposer une contribution</ButtonLink>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={kind === null} onClick={() => { setKind(null); setPage(1); }}>
              Tout
            </FilterChip>
            {CONTRIBUTION_KINDS.map((value) => (
              <FilterChip
                key={value}
                active={kind === value}
                onClick={() => { setKind(value); setPage(1); }}
              >
                {KIND_LABELS[value]}
              </FilterChip>
            ))}
          </div>

          <label className="relative w-full sm:w-72">
            <span className="sr-only">Rechercher dans les contributions</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Titre, description, étiquette"
              className="min-h-[44px] w-full rounded-control border border-forest-light/40 bg-paper pl-9 pr-3 text-sm placeholder:text-ink/40"
            />
          </label>
        </div>

        <div className="mt-8">
          {contributions.isError ? (
            <ErrorNotice error={contributions.error} />
          ) : contributions.isPending ? (
            <div className="flex justify-center py-16 text-forest">
              <Spinner label="Chargement des contributions" />
            </div>
          ) : contributions.data.data.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="Aucune contribution pour l'instant"
              description="Ajoutez la première photo du massif — cédraie de Tichaou, falaises, pelouses d'altitude — ou signalez une observation d'espèce."
              action={<ButtonLink to="/mon-espace/nouveau">Déposer une contribution</ButtonLink>}
            />
          ) : (
            <>
              <p className="datum mb-4 text-xs text-ink/60">
                {pluralize(contributions.data.meta.total, "contribution")}
              </p>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {contributions.data.data.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/contributions/${item.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-card border border-forest-light/30 bg-paper no-underline transition-colors duration-quick hover:border-forest/40"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-sand">
                        {item.media ? (
                          <img
                            src={item.media.cardUrl}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-calm group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="contours flex h-full items-center justify-center">
                            <span className="datum text-2xs uppercase tracking-[0.1em] text-forest-light">
                              {item.kind === "layer" ? "Couche SIG" : KIND_LABELS[item.kind]}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <div className="flex items-center gap-2">
                          <ProvenanceChip
                            provenance={item.tags.includes("démonstration") ? "DÉMO" : "CONTRIBUTION"}
                          />
                          {item.species?.iucnStatus ? <IucnBadge status={item.species.iucnStatus} /> : null}
                        </div>

                        <h2 className="line-clamp-2 text-lg leading-snug">{item.title}</h2>

                        {item.species ? (
                          <p className="text-sm italic text-forest">{item.species.scientificName}</p>
                        ) : null}

                        <p className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-ink/60">
                          <span>{item.owner.displayName}</span>
                          <span className="datum">{formatDate(item.publishedAt)}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {contributions.data.meta.pageCount > 1 ? (
                <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Page précédente
                  </Button>
                  <p className="datum text-xs text-ink/60">
                    Page {page} sur {contributions.data.meta.pageCount}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= contributions.data.meta.pageCount}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Page suivante
                  </Button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex min-h-[44px] items-center rounded-control border px-3 text-sm transition-colors duration-quick",
        active
          ? "border-forest bg-forest text-paper"
          : "border-forest-light/40 bg-paper text-ink/75 hover:bg-sand",
      )}
    >
      {children}
    </button>
  );
}
