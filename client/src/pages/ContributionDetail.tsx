import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { IucnBadge } from "../components/ui/IucnBadge";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { useContribution } from "../lib/queries";
import { formatBytes, formatCoordinate, formatDate, formatNumber, pluralize } from "../lib/format";

const KIND_LABELS = {
  photo: "Photographie",
  observation: "Observation d'espèce",
  heritage: "Site patrimonial",
  layer: "Couche SIG",
} as const;

export function ContributionDetail() {
  const { id = "" } = useParams();
  const contribution = useContribution(id);

  if (contribution.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-forest">
        <Spinner label="Chargement de la contribution" />
      </div>
    );
  }

  if (contribution.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-18">
        <ErrorNotice
          error={contribution.error}
          fallback="Cette contribution n'existe pas ou n'est pas publiée."
        />
        <Link to="/galerie" className="mt-6 inline-flex items-center gap-2 text-sm text-forest">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Revenir à la galerie
        </Link>
      </div>
    );
  }

  const item = contribution.data;
  const isDemo = item.tags.includes("démonstration");
  const mapLink = item.location
    ? `/geoportail?lng=${item.location.coordinates[0]}&lat=${item.location.coordinates[1]}&z=15`
    : null;

  return (
    <>
      <PageHead title={item.title} description={item.description ?? undefined} />

      <div className="mx-auto max-w-[1100px] px-4 py-10">
        <Link
          to="/galerie"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-forest no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Galerie
        </Link>

        <article className="mt-4">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="datum text-2xs uppercase tracking-[0.1em] text-earth">
                {KIND_LABELS[item.kind]}
              </span>
              <ProvenanceChip provenance={isDemo ? "DÉMO" : "CONTRIBUTION"} />
              {item.species?.iucnStatus ? <IucnBadge status={item.species.iucnStatus} /> : null}
            </div>
            <h1 className="mt-3 text-4xl">{item.title}</h1>
            <p className="mt-2 text-sm text-ink/65">
              Déposée par{" "}
              <span className="font-medium text-forest-deep">{item.owner.displayName}</span>
              {item.owner.organization ? ` · ${item.owner.organization}` : ""} ·{" "}
              <span className="datum">{formatDate(item.publishedAt)}</span>
            </p>
          </header>

          {item.media ? (
            <figure className="mt-7">
              <img
                src={item.media.url}
                alt={item.title}
                width={item.media.width}
                height={item.media.height}
                className="w-full rounded-card border border-forest-light/30 bg-sand"
              />
              <figcaption className="mt-2 font-mono text-2xs text-ink/55">
                {item.media.width} × {item.media.height} px · {formatBytes(item.media.bytes)} ·{" "}
                {item.media.exifStripped ? "métadonnées EXIF retirées" : "métadonnées conservées"}
              </figcaption>
            </figure>
          ) : null}

          {item.description ? (
            <p className="mt-7 max-w-3xl text-lg leading-relaxed text-ink/85">{item.description}</p>
          ) : null}

          <dl className="mt-9 grid gap-px border border-forest-light/25 bg-forest-light/25 sm:grid-cols-2">
            {item.species ? (
              <>
                <Field label="Nom scientifique">
                  <span className="italic">{item.species.scientificName}</span>
                </Field>
                {item.species.commonName ? (
                  <Field label="Nom commun">{item.species.commonName}</Field>
                ) : null}
                {item.species.group ? <Field label="Groupe">{item.species.group}</Field> : null}
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
                <Field label="Dans l'emprise du parc">
                  {item.layer.withinPark ? "Oui" : "Partiellement ou hors emprise"}
                </Field>
                {item.layer.sourceFile ? (
                  <Field label="Fichier source">
                    <span className="datum">{item.layer.sourceFile.originalName}</span>{" "}
                    <span className="text-ink/55">({formatBytes(item.layer.sourceFile.bytes)})</span>
                  </Field>
                ) : null}
              </>
            ) : null}

            {item.location ? (
              <Field label="Localisation">
                <span className="datum">
                  {formatCoordinate(item.location.coordinates[1], "lat")}{" "}
                  {formatCoordinate(item.location.coordinates[0], "lng")}
                </span>
                {mapLink ? (
                  <Link
                    to={mapLink}
                    className="mt-1 flex items-center gap-1.5 text-sm text-forest no-underline hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Voir sur la carte
                  </Link>
                ) : null}
              </Field>
            ) : null}

            <Field label="Consultations">
              <span className="datum">{formatNumber(item.viewCount)}</span>
            </Field>
          </dl>

          {item.tags.length > 0 ? (
            <p className="mt-6 flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-ink/45" aria-hidden />
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-control border border-forest-light/40 bg-sand/60 px-2 py-0.5 font-mono text-2xs text-ink/70"
                >
                  {tag}
                </span>
              ))}
            </p>
          ) : null}
        </article>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper px-4 py-3.5">
      <dt className="font-mono text-2xs uppercase tracking-[0.08em] text-earth">{label}</dt>
      <dd className="mt-1 text-sm text-ink/85">{children}</dd>
    </div>
  );
}
