import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, User as UserIcon } from "lucide-react";
import type { Contribution, PublicUser } from "@belezma/shared";
import { fetchData } from "../lib/api";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { formatDate, formatNumber } from "../lib/format";

interface ProfilePayload {
  user: PublicUser;
  contributions: Contribution[];
}

const ROLE_LABELS: Record<string, string> = {
  moderator: "Équipe scientifique du parc",
  admin: "Direction du parc",
};

export function ProfilPublic() {
  const { id = "" } = useParams();

  const profile = useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchData<ProfilePayload>(`/users/${id}`),
    enabled: Boolean(id),
  });

  if (profile.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-forest">
        <Spinner label="Chargement du profil" />
      </div>
    );
  }

  if (profile.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-18">
        <ErrorNotice error={profile.error} fallback="Ce profil n'existe pas." />
        <Link to="/galerie" className="mt-6 inline-flex items-center gap-2 text-sm text-forest">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Revenir à la galerie
        </Link>
      </div>
    );
  }

  const { user, contributions } = profile.data;
  const roleLabel = ROLE_LABELS[user.role];

  return (
    <>
      <PageHead
        title={user.displayName}
        description={`Contributions publiées par ${user.displayName} sur le géoportail du Parc National de Belezma.`}
      />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-6 px-4 py-12">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full border border-forest-light/40 object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-forest-light/40 bg-paper">
              <UserIcon className="h-8 w-8 text-forest-light" aria-hidden />
            </span>
          )}

          <div className="min-w-0 flex-1">
            {roleLabel ? (
              <p className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">{roleLabel}</p>
            ) : null}
            <h1 className="mt-1 text-4xl">{user.displayName}</h1>
            {user.organization ? (
              <p className="mt-1 text-lg text-ink/75">{user.organization}</p>
            ) : null}
            {user.bio ? (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/80">{user.bio}</p>
            ) : null}
            <p className="datum mt-4 text-xs text-ink/60">
              {formatNumber(user.stats.published)} contribution
              {user.stats.published > 1 ? "s" : ""} publiée{user.stats.published > 1 ? "s" : ""} ·
              membre depuis {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10">
        <h2 className="text-2xl">Contributions publiées</h2>

        <div className="mt-6">
          {contributions.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="Aucune contribution publiée pour l'instant"
              description={`${user.displayName} n'a pas encore de contribution validée par l'équipe du parc.`}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {contributions.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/contributions/${item.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-card border border-forest-light/30 bg-paper no-underline transition-colors duration-quick hover:border-forest/40"
                  >
                    <span className="block aspect-[4/3] overflow-hidden bg-sand">
                      {item.media ? (
                        <img
                          src={item.media.cardUrl}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-calm group-hover:scale-[1.03]"
                        />
                      ) : (
                        <span className="contours flex h-full items-center justify-center">
                          <span className="datum text-2xs uppercase tracking-[0.1em] text-forest-light">
                            {item.kind === "layer" ? "Couche SIG" : "Sans image"}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col gap-2 p-4">
                      <span className="flex items-center gap-2">
                        <ProvenanceChip provenance="CONTRIBUTION" />
                        {item.species?.iucnStatus ? (
                          <IucnBadge status={item.species.iucnStatus} />
                        ) : null}
                      </span>
                      <span className="line-clamp-2 font-display text-lg leading-snug text-forest-deep">
                        {item.title}
                      </span>
                      <span className="datum mt-auto pt-1 text-2xs text-ink/55">
                        {formatDate(item.publishedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
