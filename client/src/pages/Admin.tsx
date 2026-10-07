import { useState } from "react";
import { BarChart3, Layers as LayersIcon, Search, Shield, Trash2, Users } from "lucide-react";
import { USER_ROLES, type UserRole, type UserStatus } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Button } from "../components/ui/Button";
import { TextAreaField } from "../components/form/Field";
import {
  useAdminStats,
  useAdminUsers,
  useChangeRole,
  useChangeStatus,
  useDeleteOfficialLayer,
  type AdminUser,
} from "../lib/moderation";
import { useLayerCatalog } from "../lib/queries";
import { useAuthStore } from "../stores/auth-store";
import { formatBytes, formatDate, formatNumber, pluralize } from "../lib/format";
import { clsx } from "../lib/clsx";

const ROLE_LABELS: Record<UserRole, string> = {
  user: "Contributeur",
  moderator: "Modération",
  admin: "Administration",
};

type Panel = "stats" | "users" | "layers";

export function Admin() {
  const [panel, setPanel] = useState<Panel>("stats");

  return (
    <>
      <PageHead title="Administration" />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-forest" aria-hidden />
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
              Direction du parc
            </span>
          </div>
          <h1 className="mt-2 text-4xl">Administration</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Comptes, catalogue officiel et activité du géoportail.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4">
        <div className="border-b border-forest-light/30">
          <ul role="tablist" aria-label="Sections d'administration" className="-mb-px flex flex-wrap">
            {(
              [
                { value: "stats", label: "Activité", icon: BarChart3 },
                { value: "users", label: "Comptes", icon: Users },
                { value: "layers", label: "Catalogue officiel", icon: LayersIcon },
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

      {panel === "stats" ? <Stats /> : null}
      {panel === "users" ? <UsersPanel /> : null}
      {panel === "layers" ? <LayersPanel /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Activité
 * ------------------------------------------------------------------ */
function Stats() {
  const stats = useAdminStats();

  if (stats.isError) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <ErrorNotice error={stats.error} />
      </div>
    );
  }

  if (stats.isPending) {
    return (
      <div className="flex justify-center py-16 text-forest">
        <Spinner label="Chargement des statistiques" />
      </div>
    );
  }

  const data = stats.data;
  const peak = Math.max(1, ...data.uploadsPerWeek.map((entry) => entry.count));

  return (
    <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8">
      <section aria-labelledby="synthese">
        <h2 id="synthese" className="sr-only">
          Synthèse
        </h2>
        <dl className="grid gap-px border border-forest-light/25 bg-forest-light/25 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="Comptes" value={formatNumber(data.users.total)} note={`dont ${formatNumber(data.users.suspended)} suspendus`} />
          <Figure
            label="Contributions"
            value={formatNumber(data.contributions.total)}
            note={`${formatNumber(data.contributions.byVisibility.public ?? 0)} publiées`}
          />
          <Figure
            label="En attente"
            value={formatNumber(data.queue.pending)}
            note={
              data.queue.oldestPendingAt
                ? `la plus ancienne depuis le ${formatDate(data.queue.oldestPendingAt)}`
                : "file vide"
            }
            accent={data.queue.pending > 0}
          />
          <Figure
            label="Signalements ouverts"
            value={formatNumber(data.queue.openReports)}
            note="à examiner en modération"
          />
        </dl>
      </section>

      <section aria-labelledby="depots">
        <h2 id="depots" className="text-2xl">
          Dépôts par semaine
        </h2>
        <p className="mt-1 text-sm text-ink/65">Douze dernières semaines, en semaines ISO.</p>

        {data.uploadsPerWeek.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">Aucun dépôt sur la période.</p>
        ) : (
          <table className="mt-5 w-full max-w-2xl border-collapse text-left">
            <caption className="sr-only">Nombre de contributions déposées par semaine</caption>
            <thead>
              <tr>
                <th scope="col" className="pb-2 font-mono text-2xs uppercase tracking-[0.08em] text-earth">
                  Semaine
                </th>
                <th scope="col" className="pb-2 font-mono text-2xs uppercase tracking-[0.08em] text-earth">
                  Dépôts
                </th>
              </tr>
            </thead>
            <tbody>
              {data.uploadsPerWeek.map((entry) => (
                <tr key={entry.week}>
                  <th
                    scope="row"
                    className="datum border-b border-forest-light/15 py-1.5 pr-4 text-xs font-normal text-ink/70"
                  >
                    {entry.week}
                  </th>
                  <td className="border-b border-forest-light/15 py-1.5">
                    <span className="flex items-center gap-2">
                      {/* Barre proportionnelle : la valeur reste lisible en texte. */}
                      <span
                        className="h-2.5 bg-forest"
                        style={{ width: `${Math.round((entry.count / peak) * 100)}%`, minWidth: "2px" }}
                        aria-hidden
                      />
                      <span className="datum text-xs text-ink/75">{formatNumber(entry.count)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <Breakdown title="Comptes par rôle" entries={Object.entries(data.users.byRole)} labels={ROLE_LABELS} />
        <Breakdown
          title="Contributions par type"
          entries={Object.entries(data.contributions.byKind)}
          labels={{
            photo: "Photographies",
            observation: "Observations",
            heritage: "Sites patrimoniaux",
            layer: "Couches SIG",
          }}
        />
        <section aria-labelledby="stockage">
          <h2 id="stockage" className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
            Stockage
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/75">Photographies</dt>
              <dd className="datum">{formatBytes(data.storage.mediaBytes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/75">Fichiers SIG archivés</dt>
              <dd className="datum">{formatBytes(data.storage.sourceFileBytes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/75">Entités en base</dt>
              <dd className="datum">{formatNumber(data.storage.geometryBytes)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-forest-light/25 pt-2">
              <dt className="text-ink/75">Couches</dt>
              <dd className="datum">
                {formatNumber(data.layers.official)} officielles ·{" "}
                {formatNumber(data.layers.contributed)} contribuées
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper px-4 py-5">
      <dt className="font-mono text-2xs uppercase tracking-[0.1em] text-earth">{label}</dt>
      <dd>
        <span
          className={clsx(
            "datum mt-1.5 block text-3xl leading-none",
            accent ? "text-gold" : "text-forest-deep",
          )}
        >
          {value}
        </span>
        <span className="mt-2 block text-xs leading-snug text-ink/60">{note}</span>
      </dd>
    </div>
  );
}

function Breakdown({
  title,
  entries,
  labels,
}: {
  title: string;
  entries: [string, number][];
  labels: Record<string, string>;
}) {
  const id = title.replace(/\s+/g, "-").toLowerCase();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
        {title}
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        {entries.length === 0 ? (
          <p className="text-ink/60">Aucune donnée.</p>
        ) : (
          entries.map(([key, count]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-ink/75">{labels[key] ?? key}</dt>
              <dd className="datum">{formatNumber(count)}</dd>
            </div>
          ))
        )}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Comptes
 * ------------------------------------------------------------------ */
function UsersPanel() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const users = useAdminUsers({ q: search.length >= 2 ? search : undefined, page });
  const currentUserId = useAuthStore((state) => state.user?.id);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <label className="relative block max-w-sm">
        <span className="sr-only">Rechercher un compte</span>
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
          placeholder="Nom, adresse e-mail ou organisme"
          className="min-h-[44px] w-full rounded-control border border-forest-light/40 bg-paper pl-9 pr-3 text-sm placeholder:text-ink/40"
        />
      </label>

      <div className="mt-6">
        {users.isError ? (
          <ErrorNotice error={users.error} />
        ) : users.isPending ? (
          <div className="flex justify-center py-16 text-forest">
            <Spinner label="Chargement des comptes" />
          </div>
        ) : users.data.data.length === 0 ? (
          <EmptyState icon={Users} title="Aucun compte ne correspond à cette recherche" />
        ) : (
          <>
            <p className="datum mb-3 text-xs text-ink/60">
              {pluralize(users.data.meta.total, "compte")}
            </p>
            <ul className="border border-forest-light/30">
              {users.data.data.map((user) => (
                <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
              ))}
            </ul>

            {users.data.meta.pageCount > 1 ? (
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
                  Page {page} sur {users.data.meta.pageCount}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= users.data.meta.pageCount}
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
  );
}

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const changeRole = useChangeRole();
  const changeStatus = useChangeStatus();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState("");

  const busy = changeRole.isPending || changeStatus.isPending;

  return (
    <li className="border-b border-forest-light/20 bg-paper p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug">
            {user.displayName}
            {isSelf ? <span className="ml-2 text-xs text-ink/55">(votre compte)</span> : null}
          </h2>
          <p className="datum mt-0.5 text-xs text-ink/65">{user.email}</p>
          {user.organization ? (
            <p className="mt-0.5 text-sm text-ink/70">{user.organization}</p>
          ) : null}
          <p className="datum mt-1.5 text-2xs text-ink/55">
            Inscrit le {formatDate(user.createdAt)} · {formatNumber(user.stats.contributions)}{" "}
            contributions, {formatNumber(user.stats.published)} publiées
          </p>
          {user.status === "suspended" ? (
            <p className="mt-2 inline-flex rounded-control border border-iucn-cr/40 bg-iucn-cr/8 px-2 py-0.5 text-xs text-iucn-cr">
              Compte suspendu
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-mono text-2xs uppercase tracking-[0.08em] text-earth">Rôle</span>
            <select
              value={user.role}
              disabled={isSelf || busy}
              onChange={(event) =>
                changeRole.mutate({ id: user.id, role: event.target.value as UserRole })
              }
              className="min-h-[44px] rounded-control border border-forest-light/40 bg-paper px-2 text-sm disabled:bg-sand/60 disabled:text-ink/50"
              aria-label={`Rôle de ${user.displayName}`}
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          {!isSelf ? (
            user.status === "active" ? (
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-iucn-cr"
                disabled={busy}
                onClick={() => setSuspending(true)}
              >
                Suspendre ce compte
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  changeStatus.mutate({ id: user.id, status: "active" as UserStatus })
                }
              >
                Réactiver ce compte
              </Button>
            )
          ) : null}
        </div>
      </div>

      {changeRole.isError ? <ErrorNotice error={changeRole.error} className="mt-3" /> : null}
      {changeStatus.isError ? <ErrorNotice error={changeStatus.error} className="mt-3" /> : null}

      {suspending ? (
        <div className="mt-4 rounded-card border border-iucn-cr/30 bg-iucn-cr/5 p-4">
          <TextAreaField
            label={`Motif de la suspension de ${user.displayName}`}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="Consigné au journal d'audit. Au moins 10 caractères."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={reason.trim().length < 10 || busy}
              onClick={async () => {
                await changeStatus.mutateAsync({
                  id: user.id,
                  status: "suspended" as UserStatus,
                  reason: reason.trim(),
                });
                setSuspending(false);
                setReason("");
              }}
            >
              Suspendre et fermer ses sessions
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSuspending(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Catalogue officiel
 * ------------------------------------------------------------------ */
function LayersPanel() {
  const catalog = useLayerCatalog();
  const remove = useDeleteOfficialLayer();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-ink/70">
        Les couches officielles proviennent des shapefiles et KMZ du parc, chargées par{" "}
        <span className="datum">npm run seed</span>. La limite officielle ne peut pas être
        supprimée : elle sert de référence à la superficie affichée, au cadrage de la carte et au
        contrôle des dépôts.
      </p>

      {remove.isError ? <ErrorNotice error={remove.error} className="mb-5" /> : null}

      {catalog.isError ? (
        <ErrorNotice error={catalog.error} />
      ) : catalog.isPending ? (
        <div className="flex justify-center py-16 text-forest">
          <Spinner label="Chargement du catalogue" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-forest-light/30">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <caption className="sr-only">Couches du catalogue officiel</caption>
            <thead className="bg-sand">
              <tr>
                {["Identifiant", "Nom", "Groupe", "Type", "Entités", "Visible", "Action"].map(
                  (header) => (
                    <th
                      key={header}
                      scope="col"
                      className="border-b border-forest-light/30 px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.08em] text-earth"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {catalog.data.map((layer) => (
                <tr key={layer.layerId} className="even:bg-sand/25">
                  <td className="datum border-b border-forest-light/15 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-black/15"
                        style={{ backgroundColor: layer.color }}
                        aria-hidden
                      />
                      {layer.layerId}
                    </span>
                  </td>
                  <td className="border-b border-forest-light/15 px-3 py-2 text-sm">{layer.name}</td>
                  <td className="border-b border-forest-light/15 px-3 py-2 text-sm text-ink/75">
                    {layer.group}
                  </td>
                  <td className="datum border-b border-forest-light/15 px-3 py-2 text-xs text-ink/70">
                    {layer.type}
                  </td>
                  <td className="datum border-b border-forest-light/15 px-3 py-2 text-xs">
                    {formatNumber(layer.featureCount)}
                  </td>
                  <td className="border-b border-forest-light/15 px-3 py-2 text-sm text-ink/75">
                    {layer.defaultVisible ? "Oui" : "Non"}
                  </td>
                  <td className="border-b border-forest-light/15 px-3 py-2">
                    {layer.layerId === "boundary" ? (
                      <span className="text-xs text-ink/45">Protégée</span>
                    ) : confirming === layer.layerId ? (
                      <span className="flex flex-wrap gap-1.5">
                        <Button
                          variant="danger"
                          size="sm"
                          className="px-2"
                          disabled={remove.isPending}
                          onClick={async () => {
                            await remove.mutateAsync(layer.layerId);
                            setConfirming(null);
                          }}
                        >
                          Confirmer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => setConfirming(null)}
                        >
                          Annuler
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-iucn-cr"
                        onClick={() => setConfirming(layer.layerId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Retirer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-5 flex items-center gap-2 text-xs text-ink/60">
        <ProvenanceChip provenance="OFFICIEL" />
        Chaque couche porte cette provenance partout où elle s'affiche.
      </p>
    </div>
  );
}
