import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CircleSlash,
  ClipboardList,
  Flag,
  Inbox,
  Keyboard,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  CONTRIBUTION_KINDS,
  REPORT_REASON_LABELS,
  type ContributionKind,
  type ReportReason,
} from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Button } from "../components/ui/Button";
import { RejectDialog } from "../features/moderation/RejectDialog";
import {
  useCloseReport,
  useModerationLog,
  useModerationQueue,
  usePendingGeojson,
  useReports,
  useReview,
  type QueueItem,
} from "../lib/moderation";
import { useAuthStore } from "../stores/auth-store";
import { formatBytes, formatCoordinate, formatDateTime, formatRelative, pluralize } from "../lib/format";
import { clsx } from "../lib/clsx";

const GeojsonPreview = lazy(() =>
  import("../features/moderation/GeojsonPreview").then((module) => ({
    default: module.GeojsonPreview,
  })),
);

const KIND_LABELS: Record<ContributionKind, string> = {
  photo: "Photographie",
  observation: "Observation",
  heritage: "Site patrimonial",
  layer: "Couche SIG",
};

type Panel = "queue" | "reports" | "log";

export function Moderation() {
  const [panel, setPanel] = useState<Panel>("queue");

  return (
    <>
      <PageHead title="Modération" />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-forest" aria-hidden />
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
              Équipe du parc
            </span>
          </div>
          <h1 className="mt-2 text-4xl">Modération</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Relisez les contributions soumises par le public. Chaque décision est consignée au
            journal, et tout refus est motivé auprès de son auteur.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4">
        <div className="border-b border-forest-light/30">
          <ul role="tablist" aria-label="Sections de modération" className="-mb-px flex flex-wrap">
            {(
              [
                { value: "queue", label: "File de validation", icon: Inbox },
                { value: "reports", label: "Signalements", icon: Flag },
                { value: "log", label: "Journal", icon: ScrollText },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const selected = panel === item.value;
              return (
                <li key={item.value} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setPanel(item.value)}
                    className={clsx(
                      "flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm transition-colors duration-quick",
                      selected
                        ? "border-forest font-medium text-forest-deep"
                        : "border-transparent text-ink/65 hover:border-forest-light/50 hover:text-forest-deep",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {panel === "queue" ? <Queue /> : null}
      {panel === "reports" ? <Reports /> : null}
      {panel === "log" ? <AuditLog /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * File de validation — deux volets (§8)
 * ------------------------------------------------------------------ */
function Queue() {
  const [kind, setKind] = useState<ContributionKind | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<"reject" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const queue = useModerationQueue({ kind, sort: "oldest" });
  const review = useReview();

  // Mémoïsé pour que le tableau garde son identité entre deux rendus : sans
  // cela, la sélection et l'effet de recalage se réexécuteraient à chaque fois.
  const items = useMemo(() => queue.data?.data ?? [], [queue.data]);
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  // La sélection suit la file quand l'élément relu en disparaît.
  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  }, [items, selectedId]);

  const canReview = selected?.reviewableByViewer ?? false;

  async function approve(): Promise<void> {
    if (!selected || !canReview) return;
    const result = await review.mutateAsync({ id: selected.id, action: "approve" });
    setNotice(result.meta?.message ?? null);
  }

  async function reject(reason: string): Promise<void> {
    if (!selected) return;
    const result = await review.mutateAsync({ id: selected.id, action: "reject", reason });
    setRejecting(null);
    setNotice(result.meta?.message ?? null);
  }

  // Raccourcis « a » et « r » (§8). Ignorés dès qu'un champ a le focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        rejecting ||
        target?.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      if (event.key === "a" && canReview) {
        event.preventDefault();
        void approve();
      }
      if (event.key === "r" && canReview) {
        event.preventDefault();
        setRejecting("reject");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={kind === undefined} onClick={() => setKind(undefined)}>
            Tout
          </FilterChip>
          {CONTRIBUTION_KINDS.map((value) => (
            <FilterChip key={value} active={kind === value} onClick={() => setKind(value)}>
              {KIND_LABELS[value]}
            </FilterChip>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-ink/60">
          <Keyboard className="h-3.5 w-3.5" aria-hidden />
          <kbd className="datum rounded-control border border-forest-light/40 bg-sand px-1.5 py-0.5 text-2xs">
            a
          </kbd>
          approuver
          <kbd className="datum ml-1.5 rounded-control border border-forest-light/40 bg-sand px-1.5 py-0.5 text-2xs">
            r
          </kbd>
          refuser
        </p>
      </div>

      {notice ? (
        <p role="status" className="mb-5 rounded-card border border-forest/25 bg-forest/5 px-4 py-3 text-sm text-ink/80">
          {notice}
        </p>
      ) : null}
      {review.isError ? <ErrorNotice error={review.error} className="mb-5" /> : null}

      {queue.isError ? (
        <ErrorNotice error={queue.error} />
      ) : queue.isPending ? (
        <div className="flex justify-center py-16 text-forest">
          <Spinner label="Chargement de la file" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="La file est vide"
          description="Aucune contribution n'attend de validation. Les nouvelles demandes apparaîtront ici, de la plus ancienne à la plus récente."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Volet gauche : la file */}
          <div>
            <p className="datum mb-2 text-xs text-ink/60">
              {pluralize(queue.data.meta.total, "contribution en attente", "contributions en attente")}
            </p>
            <ul className="border border-forest-light/30">
              {items.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <li key={item.id} className="border-b border-forest-light/20 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-current={active ? "true" : undefined}
                      className={clsx(
                        "flex w-full items-start gap-3 p-3 text-left transition-colors duration-quick",
                        active ? "bg-forest/8" : "bg-paper hover:bg-sand/50",
                      )}
                    >
                      <span className="h-12 w-16 shrink-0 overflow-hidden bg-sand">
                        {item.media ? (
                          <img
                            src={item.media.thumbUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="contours block h-full w-full" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-forest-deep">
                          {item.title}
                        </span>
                        <span className="datum mt-0.5 block text-2xs uppercase tracking-[0.06em] text-earth">
                          {KIND_LABELS[item.kind]} · {formatRelative(item.updatedAt)}
                        </span>
                        <span className="mt-1 block truncate text-2xs text-ink/60">
                          {item.owner.displayName}
                        </span>
                        {!item.reviewableByViewer ? (
                          <span className="mt-1 flex items-center gap-1 text-2xs text-earth">
                            <CircleSlash className="h-3 w-3" aria-hidden />
                            Votre contribution
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Volet droit : relecture */}
          {selected ? (
            <ReviewPane
              item={selected}
              canReview={canReview}
              pending={review.isPending}
              onApprove={() => void approve()}
              onReject={() => setRejecting("reject")}
            />
          ) : null}
        </div>
      )}

      {rejecting && selected ? (
        <RejectDialog
          title={selected.title}
          action="reject"
          pending={review.isPending}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason) => void reject(reason)}
        />
      ) : null}
    </div>
  );
}

function ReviewPane({
  item,
  canReview,
  pending,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  canReview: boolean;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const geojson = usePendingGeojson(item.id, item.kind === "layer");

  return (
    <article className="rounded-card border border-forest-light/30 bg-paper p-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="datum text-2xs uppercase tracking-[0.1em] text-earth">
            {KIND_LABELS[item.kind]}
          </span>
          <ProvenanceChip provenance="CONTRIBUTION" />
          {item.species?.iucnStatus ? <IucnBadge status={item.species.iucnStatus} /> : null}
        </div>
        <h2 className="mt-2 text-3xl">{item.title}</h2>
        <p className="mt-1.5 text-sm text-ink/65">
          Déposée par{" "}
          <Link
            to={`/contributions/${item.id}`}
            className="font-medium text-forest no-underline hover:underline"
          >
            {item.owner.displayName}
          </Link>
          {item.owner.organization ? ` · ${item.owner.organization}` : ""} ·{" "}
          <span className="datum">{formatDateTime(item.updatedAt)}</span>
        </p>
      </header>

      {!canReview ? (
        <p className="mt-4 flex items-start gap-2 rounded-card border border-gold/40 bg-gold/8 p-3 text-sm text-ink/80">
          <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-earth" aria-hidden />
          Vous êtes l'auteur de cette contribution : un administrateur doit statuer à votre place.
        </p>
      ) : null}

      {/* Aperçu */}
      {item.media ? (
        <figure className="mt-5">
          <img
            src={item.media.url}
            alt={item.title}
            className="max-h-[32rem] w-full rounded-card border border-forest-light/30 bg-sand object-contain"
          />
          <figcaption className="datum mt-2 text-2xs text-ink/55">
            {item.media.width} × {item.media.height} px · {formatBytes(item.media.bytes)} ·{" "}
            {item.media.exifStripped ? "métadonnées EXIF retirées" : "métadonnées conservées"}
          </figcaption>
        </figure>
      ) : null}

      {item.kind === "layer" ? (
        <div className="mt-5">
          {geojson.isError ? (
            <ErrorNotice error={geojson.error} />
          ) : geojson.isPending ? (
            <div className="flex h-64 items-center justify-center rounded-card border border-forest-light/40 text-forest">
              <Spinner label="Chargement de la géométrie" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center rounded-card border border-forest-light/40 text-forest">
                  <Spinner label="Chargement de la carte" />
                </div>
              }
            >
              <GeojsonPreview
                geojson={geojson.data}
                color={item.layer?.style.color ?? "#B8912C"}
              />
            </Suspense>
          )}
        </div>
      ) : null}

      {item.description ? (
        <p className="mt-5 leading-relaxed text-ink/85">{item.description}</p>
      ) : null}

      <dl className="mt-5 grid gap-px border border-forest-light/25 bg-forest-light/25 sm:grid-cols-2">
        {item.species ? (
          <>
            <Field label="Nom scientifique">
              <span className="italic">{item.species.scientificName}</span>
            </Field>
            {item.species.commonName ? (
              <Field label="Nom commun">{item.species.commonName}</Field>
            ) : null}
          </>
        ) : null}
        {item.heritage ? <Field label="Catégorie">{item.heritage.category}</Field> : null}
        {item.layer ? (
          <>
            <Field label="Entités">
              <span className="datum">{pluralize(item.layer.featureCount, "entité")}</span>
            </Field>
            <Field label="Géométries">
              <span className="datum">{item.layer.geometryTypes.join(", ")}</span>
            </Field>
            <Field label="Recoupe l'emprise du parc">
              {item.layer.withinPark ? (
                "Oui"
              ) : (
                <span className="text-iucn-cr">Non — à vérifier avant publication</span>
              )}
            </Field>
            {item.layer.sourceFile ? (
              <Field label="Fichier source">
                <span className="datum break-all">{item.layer.sourceFile.originalName}</span>{" "}
                <span className="text-ink/55">({formatBytes(item.layer.sourceFile.bytes)})</span>
              </Field>
            ) : null}
          </>
        ) : null}
        <Field label="Localisation">
          {item.location ? (
            <span className="datum">
              {formatCoordinate(item.location.coordinates[1], "lat")}{" "}
              {formatCoordinate(item.location.coordinates[0], "lng")}
            </span>
          ) : (
            <span className="text-ink/55">Non localisée</span>
          )}
        </Field>
        {item.tags.length > 0 ? (
          <Field label="Étiquettes">
            <span className="datum">{item.tags.join(", ")}</span>
          </Field>
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-forest-light/25 pt-5">
        <Button type="button" disabled={!canReview || pending} onClick={onApprove}>
          <Check className="h-4 w-4" aria-hidden />
          Publier cette contribution
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={!canReview || pending}
          onClick={onReject}
        >
          <X className="h-4 w-4" aria-hidden />
          Refuser avec un motif
        </Button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * Signalements
 * ------------------------------------------------------------------ */
function Reports() {
  const reports = useReports("open");
  const close = useCloseReport();

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      {close.isError ? <ErrorNotice error={close.error} className="mb-5" /> : null}

      {reports.isError ? (
        <ErrorNotice error={reports.error} />
      ) : reports.isPending ? (
        <div className="flex justify-center py-16 text-forest">
          <Spinner label="Chargement des signalements" />
        </div>
      ) : reports.data.data.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Aucun signalement ouvert"
          description="Les contributions signalées par les visiteurs apparaîtront ici avec leur motif."
        />
      ) : (
        <ul className="border border-forest-light/30">
          {reports.data.data.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-start justify-between gap-4 border-b border-forest-light/20 bg-paper p-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="datum text-2xs uppercase tracking-[0.08em] text-earth">
                  {REPORT_REASON_LABELS[report.reason as ReportReason] ?? report.reason}
                </p>
                <h2 className="mt-1 text-lg leading-snug">
                  {report.contribution ? (
                    <Link
                      to={`/contributions/${report.contribution.id}`}
                      className="text-forest-deep no-underline hover:underline"
                    >
                      {report.contribution.title}
                    </Link>
                  ) : (
                    <span className="text-ink/60">Contribution supprimée</span>
                  )}
                </h2>
                {report.note ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{report.note}</p>
                ) : null}
                <p className="datum mt-2 text-2xs text-ink/55">
                  Signalé par {report.reporter?.displayName ?? "un compte supprimé"} ·{" "}
                  {formatDateTime(report.createdAt)}
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={close.isPending}
                onClick={() => close.mutate({ id: report.id })}
              >
                Clore le signalement
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Journal d'audit
 * ------------------------------------------------------------------ */
const ACTION_LABELS: Record<string, string> = {
  approve: "Publication",
  reject: "Refus",
  unpublish: "Retrait",
  delete: "Suppression",
  suspend_user: "Suspension de compte",
  role_change: "Changement de rôle",
};

function AuditLog() {
  const [page, setPage] = useState(1);
  const log = useModerationLog({ page });
  const role = useAuthStore((state) => state.user?.role);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      {log.isError ? (
        <ErrorNotice error={log.error} />
      ) : log.isPending ? (
        <div className="flex justify-center py-16 text-forest">
          <Spinner label="Chargement du journal" />
        </div>
      ) : log.data.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Le journal est vide"
          description="Chaque publication, refus, retrait ou changement de droits y sera consigné, avec son auteur et son motif."
        />
      ) : (
        <>
          <p className="datum mb-3 text-xs text-ink/60">
            {pluralize(log.data.meta.total, "décision consignée", "décisions consignées")}
            {role === "admin" ? "" : " — journal en lecture seule"}
          </p>
          <div className="overflow-x-auto border border-forest-light/30">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <thead className="bg-sand">
                <tr>
                  {["Date", "Décision", "Auteur de la décision", "Cible", "Motif"].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="border-b border-forest-light/30 px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.08em] text-earth"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.data.data.map((entry) => {
                  const snapshot = entry.snapshot as { title?: string; displayName?: string } | null;
                  return (
                    <tr key={entry.id} className="even:bg-sand/25">
                      <td className="datum border-b border-forest-light/15 px-3 py-2 text-xs text-ink/70">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="border-b border-forest-light/15 px-3 py-2 text-sm">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="border-b border-forest-light/15 px-3 py-2 text-sm">
                        {entry.actor?.displayName ?? "—"}
                      </td>
                      <td className="border-b border-forest-light/15 px-3 py-2 text-sm">
                        {snapshot?.title ?? snapshot?.displayName ?? (
                          <span className="datum text-xs text-ink/55">{entry.target.id}</span>
                        )}
                      </td>
                      <td className="border-b border-forest-light/15 px-3 py-2 text-xs leading-snug text-ink/75">
                        {entry.reason ?? <span className="text-ink/35">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {log.data.meta.pageCount > 1 ? (
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
                Page {page} sur {log.data.meta.pageCount}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= log.data.meta.pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Page suivante
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="font-mono text-2xs uppercase tracking-[0.08em] text-earth">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink/85">{children}</dd>
    </div>
  );
}
