import { useState } from "react";
import { Landmark, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { HERITAGE_CATEGORIES, type HeritageCategory } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { ButtonLink } from "../components/ui/Button";
import { useContributions } from "../lib/queries";
import { formatCoordinate, formatDate } from "../lib/format";
import { clsx } from "../lib/clsx";

/** Couleur d'accent par catégorie — puisée dans la palette, jamais inventée. */
const CATEGORY_TONE: Record<HeritageCategory, string> = {
  Naturel: "border-forest/35 bg-forest/8 text-forest",
  "Archéologique": "border-earth/35 bg-earth/8 text-earth",
  Culturel: "border-gold/45 bg-gold/10 text-earth",
  Historique: "border-earth/35 bg-earth/8 text-earth",
  Touristique: "border-forest-light/50 bg-forest-light/12 text-forest",
  Scientifique: "border-forest/35 bg-forest/8 text-forest",
};

export function Patrimoine() {
  const [category, setCategory] = useState<HeritageCategory | null>(null);
  const sites = useContributions({ kind: "heritage", limit: 60 });

  const filtered = sites.data?.data.filter(
    (site) => !category || site.heritage?.category === category,
  );

  return (
    <>
      <PageHead
        title="Patrimoine"
        description="Sites naturels, archéologiques, culturels, historiques, touristiques et scientifiques recensés dans le Parc National de Belezma."
      />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <h1 className="text-4xl">Patrimoine du Belezma</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink/75">
            Le massif conserve un patrimoine naturel — cédraies séculaires, falaises, grottes — mais
            aussi archéologique, historique et culturel. Les sites présentés ici sont soit des repères
            de démonstration issus du prototype, soit des contributions validées par l'équipe du parc.
            Chaque fiche indique laquelle des deux.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            Toutes les catégories
          </FilterChip>
          {HERITAGE_CATEGORIES.map((value) => (
            <FilterChip key={value} active={category === value} onClick={() => setCategory(value)}>
              {value}
            </FilterChip>
          ))}
        </div>

        <div className="mt-8">
          {sites.isError ? (
            <ErrorNotice error={sites.error} />
          ) : sites.isPending ? (
            <div className="flex justify-center py-16 text-forest">
              <Spinner label="Chargement des sites" />
            </div>
          ) : !filtered || filtered.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title={
                category
                  ? `Aucun site « ${category} » pour l'instant`
                  : "Aucun site patrimonial pour l'instant"
              }
              description="Signalez un site que vous connaissez : une source, une grotte, un vestige, un point de vue remarquable. Votre contribution sera relue par l'équipe du parc avant publication."
              action={<ButtonLink to="/mon-espace/nouveau">Proposer un site</ButtonLink>}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((site) => {
                const isDemo = site.tags.includes("démonstration");
                const heritageCategory = site.heritage?.category;
                return (
                  <li key={site.id}>
                    <Link
                      to={`/contributions/${site.id}`}
                      className="flex h-full flex-col gap-3 rounded-card border border-forest-light/30 bg-paper p-5 no-underline transition-colors duration-quick hover:bg-sand/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {heritageCategory ? (
                          <span
                            className={clsx(
                              "rounded-control border px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.06em]",
                              CATEGORY_TONE[heritageCategory],
                            )}
                          >
                            {heritageCategory}
                          </span>
                        ) : null}
                        <ProvenanceChip provenance={isDemo ? "DÉMO" : "CONTRIBUTION"} />
                      </div>

                      <h2 className="text-xl leading-snug">{site.title}</h2>
                      {site.description ? (
                        <p className="line-clamp-3 text-sm leading-relaxed text-ink/75">{site.description}</p>
                      ) : null}

                      <div className="mt-auto space-y-1.5 pt-2">
                        {site.location ? (
                          <p className="flex items-center gap-1.5 text-xs text-ink/60">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="datum">
                              {formatCoordinate(site.location.coordinates[1], "lat")}{" "}
                              {formatCoordinate(site.location.coordinates[0], "lng")}
                            </span>
                          </p>
                        ) : null}
                        <p className="datum text-2xs text-ink/50">{formatDate(site.publishedAt)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
