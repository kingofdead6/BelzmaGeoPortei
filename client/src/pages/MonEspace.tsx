import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  EyeOff,
  Layers as LayersIcon,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Contribution, ContributionKind, Visibility } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { VisibilityBadge } from "../components/ui/VisibilityBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Button, ButtonLink } from "../components/ui/Button";
import {
  useDeleteContribution,
  useMyContributions,
  useVisibilityAction,
} from "../lib/contributions";
import { useAuthStore } from "../stores/auth-store";
import { formatDate, formatNumber, pluralize } from "../lib/format";
import { clsx } from "../lib/clsx";

const KIND_LABELS: Record<ContributionKind, string> = {
  photo: "Photo",
  observation: "Observation",
  heritage: "Site patrimonial",
  layer: "Couche",
};

const TABS: { value: Visibility | "all"; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "private", label: "Privé" },
  { value: "pending", label: "En attente" },
  { value: "public", label: "Publié" },
  { value: "rejected", label: "Refusé" },
];

export function MonEspace() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Visibility | "all">("all");
  const [page, setPage] = useState(1);

  const contributions = useMyContributions({
    visibility: tab === "all" ? undefined : tab,
    page,
    limit: 20,
  });

  const counts = contributions.data?.meta.counts ?? {};
  const total = contributions.data?.meta.total ?? 0;

  return (
    <>
      <PageHead title="Mon espace" />

      {/* --- Bandeau ---------------------------------------------------- */}
      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-6 px-4 py-12">
          <div>
            <h1 className="text-4xl">Mon espace</h1>
            <p className="mt-1.5 text-sm text-ink/70">
              {user?.displayName}
              {user?.organization ? ` · ${user.organization}` : ""}
            </p>
            <dl className="mt-6 flex gap-10">
              <div>
                <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-earth">
                  Contributions
                </dt>
                <dd className="datum mt-1 text-2xl text-forest-deep">
                  {formatNumber(user?.stats.contributions ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-earth">
                  Publiées
                </dt>
                <dd className="datum mt-1 text-2xl text-forest-deep">
                  {formatNumber(user?.stats.published ?? 0)}
                </dd>
              </div>
            </dl>
          </div>

          <ButtonLink to="/mon-espace/nouveau" className="border-gold bg-gold text-forest-deep hover:bg-gold/85">
            <Plus className="h-4 w-4" aria-hidden />
            Déposer une contribution
          </ButtonLink>
        </div>
      </section>

      {/* --- Onglets d'état --------------------------------------------- */}
      <div className="mx-auto max-w-[1600px] px-4">
        <div className="border-b border-forest-light/30">
          <ul role="tablist" aria-label="Filtrer par état" className="-mb-px flex flex-wrap">
            {TABS.map((item) => {
              const count = item.value === "all" ? total : (counts[item.value] ?? 0);
              const selected = tab === item.value;
              return (
                <li key={item.value} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setTab(item.value);
                      setPage(1);
                    }}
                    className={clsx(
                      "flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm transition-colors duration-quick",
                      selected
                        ? "border-forest font-medium text-forest-deep"
                        : "border-transparent text-ink/65 hover:border-forest-light/50 hover:text-forest-deep",
                    )}
                  >
                    {item.label}
                    <span className="datum text-2xs text-ink/50">{formatNumber(count)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* --- Registre --------------------------------------------------- */}
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        {contributions.isError ? (
          <ErrorNotice error={contributions.error} />
        ) : contributions.isPending ? (
          <div className="flex justify-center py-16 text-forest">
            <Spinner label="Chargement de vos contributions" />
          </div>
        ) : contributions.data.data.length === 0 ? (
          <EmptyState
            icon={Camera}
            title={
              tab === "all"
                ? "Aucune contribution pour l'instant"
                : `Aucune contribution dans cet état`
            }
            description={
              tab === "all"
                ? "Ajoutez la première photo du massif — cédraie de Tichaou, falaises, pelouses d'altitude — ou déposez un relevé GPS."
                : "Changez d'onglet pour retrouver vos autres contributions."
            }
            action={
              tab === "all" ? (
                <ButtonLink to="/mon-espace/nouveau">Déposer une contribution</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="datum mb-3 text-xs text-ink/60">
              {pluralize(contributions.data.meta.total, "contribution")}
            </p>
            <ul className="border border-forest-light/30">
              {contributions.data.data.map((item) => (
                <ContributionRow key={item.id} contribution={item} />
              ))}
            </ul>

            {contributions.data.meta.pageCount > 1 ? (
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
    </>
  );
}

/** Ligne de registre : rayon 0, filet d'un pixel, densité serrée (DESIGN.md §6). */
function ContributionRow({ contribution }: { contribution: Contribution }) {
  const visibilityAction = useVisibilityAction();
  const remove = useDeleteContribution();
  const [confirming, setConfirming] = useState(false);

  const canRequest = contribution.visibility !== "pending" && contribution.visibility !== "public";
  const canWithdraw = contribution.visibility === "pending" || contribution.visibility === "public";
  const busy = visibilityAction.isPending || remove.isPending;

  return (
    <li className="grid gap-4 border-b border-forest-light/20 bg-paper p-4 last:border-b-0 sm:grid-cols-[120px_1fr_auto]">
      {/* Vignette */}
      <div className="h-[90px] w-[120px] overflow-hidden bg-sand">
        {contribution.media ? (
          <img
            src={contribution.media.thumbUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="contours flex h-full flex-col items-center justify-center gap-1">
            <LayersIcon className="h-4 w-4 text-forest-light" aria-hidden />
            {contribution.layer ? (
              <span className="datum text-2xs text-ink/55">
                {formatNumber(contribution.layer.featureCount)} ent.
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="min-w-0">
        <h2 className="text-lg leading-snug">
          {contribution.visibility === "public" ? (
            <Link
              to={`/contributions/${contribution.id}`}
              className="text-forest-deep no-underline hover:underline"
            >
              {contribution.title}
            </Link>
          ) : (
            contribution.title
          )}
        </h2>

        <p className="datum mt-1 text-2xs uppercase tracking-[0.06em] text-earth">
          {KIND_LABELS[contribution.kind]} · {formatDate(contribution.createdAt)}
          {contribution.visibility === "public"
            ? ` · ${formatNumber(contribution.viewCount)} vues`
            : ""}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ProvenanceChip provenance="CONTRIBUTION" />
          {contribution.species?.iucnStatus ? (
            <IucnBadge status={contribution.species.iucnStatus} />
          ) : null}
          {contribution.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-control border border-forest-light/40 bg-sand/60 px-1.5 py-0.5 font-mono text-2xs text-ink/65"
            >
              {tag}
            </span>
          ))}
        </div>

        {contribution.visibility === "rejected" && contribution.rejectedReason ? (
          <div className="mt-3 flex items-start gap-2 rounded-control border border-iucn-cr/30 bg-iucn-cr/5 p-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-iucn-cr" aria-hidden />
            <p className="text-xs leading-relaxed text-ink/80">{contribution.rejectedReason}</p>
          </div>
        ) : null}

        {contribution.layer && !contribution.layer.withinPark ? (
          <p className="mt-2 flex items-start gap-1.5 text-2xs leading-snug text-earth">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            L'emprise de cette couche ne recoupe pas la limite officielle du parc.
          </p>
        ) : null}

        {contribution.flagCount > 0 ? (
          <p className="datum mt-2 text-2xs text-earth">
            {pluralize(contribution.flagCount, "signalement")} en cours d'examen
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <VisibilityBadge visibility={contribution.visibility} />

        {visibilityAction.isError ? (
          <ErrorNotice error={visibilityAction.error} className="max-w-xs" />
        ) : null}
        {remove.isError ? <ErrorNotice error={remove.error} className="max-w-xs" /> : null}

        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <ButtonLink
            to={`/mon-espace/${contribution.id}/modifier`}
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Modifier
          </ButtonLink>

          {canRequest ? (
            <Button
              variant="secondary"
              size="sm"
              className="px-2"
              disabled={busy}
              onClick={() =>
                visibilityAction.mutate({ id: contribution.id, action: "share" })
              }
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {contribution.visibility === "rejected"
                ? "Redemander la publication"
                : "Demander la publication"}
            </Button>
          ) : null}

          {canWithdraw ? (
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              disabled={busy}
              onClick={() =>
                visibilityAction.mutate({ id: contribution.id, action: "unshare" })
              }
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Repasser en privé
            </Button>
          ) : null}

          {confirming ? (
            <span className="flex items-center gap-1.5">
              <Button
                variant="danger"
                size="sm"
                className="px-2"
                disabled={busy}
                onClick={() => remove.mutate(contribution.id)}
              >
                Confirmer la suppression
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={() => setConfirming(false)}
              >
                Annuler
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-iucn-cr"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
