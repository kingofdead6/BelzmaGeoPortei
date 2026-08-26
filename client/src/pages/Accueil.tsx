import { ArrowRight, Camera, Landmark, Leaf, Map as MapIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PARK_CREATED_YEAR, PARK_MAB_YEAR } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { ButtonLink } from "../components/ui/Button";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { useContributions, useParkStats, useSpeciesStats } from "../lib/queries";
import { formatDecimal, formatNumber, pluralize } from "../lib/format";
import heroImage from "../assets/hero-belezma.jpg";

export function Accueil() {
  const parkStats = useParkStats();
  const speciesStats = useSpeciesStats();
  const gallery = useContributions({ kind: "photo", limit: 6 });

  return (
    <>
      <PageHead
        title="Accueil"
        description="Cartographie officielle, biodiversité et patrimoine du Parc National de Belezma, réserve de biosphère de l'UNESCO dans les Aurès."
      />

      {/* --- Héros ---------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-forest-deep">
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[center_62%]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,35,28,0.72) 0%, rgba(15,35,28,0.55) 45%, rgba(15,35,28,0.86) 100%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1600px] px-4 py-22 lg:py-[7.5rem]">
          <div className="max-w-3xl">
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-gold">
              Wilaya de Batna · Massif des Aurès · Algérie
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-paper lg:text-5xl">
              Le Parc National de Belezma, relevé couche par couche
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper/85">
              Vingt couches cartographiques officielles, {speciesStats.data ? formatNumber(speciesStats.data.total) : "près de 470"}{" "}
              fiches d'espèces et les sites patrimoniaux du massif, réunis dans un géoportail
              consultable par tous. Chaque donnée porte sa provenance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/geoportail" className="border-gold bg-gold text-forest-deep hover:bg-gold/85">
                Ouvrir la carte
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink
                to="/biodiversite"
                variant="secondary"
                className="border-paper/30 bg-transparent text-paper hover:bg-paper/10"
              >
                Consulter la biodiversité
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* --- Chiffres-clés -------------------------------------------- */}
      <section aria-labelledby="chiffres" className="border-b border-forest-light/20 bg-sand">
        <h2 id="chiffres" className="sr-only">Chiffres-clés du parc</h2>
        <dl className="mx-auto grid max-w-[1600px] grid-cols-2 gap-px bg-forest-light/25 lg:grid-cols-4">
          <KeyFigure
            label="Superficie"
            value={parkStats.data ? formatDecimal(parkStats.data.areaHa, 1) : null}
            unit="hectares"
            note="calculée depuis la limite officielle"
            accent
          />
          <KeyFigure label="Création" value={String(PARK_CREATED_YEAR)} unit="décret" note="parc national" />
          <KeyFigure
            label="Réserve de biosphère"
            value={String(PARK_MAB_YEAR)}
            unit="UNESCO"
            note="programme sur l'homme et la biosphère"
          />
          <KeyFigure
            label="Couches cartographiques"
            value={parkStats.data ? String(parkStats.data.layerCount) : null}
            unit="officielles"
            note="issues des shapefiles et KMZ du parc"
          />
        </dl>
      </section>

      {/* --- Trois entrées -------------------------------------------- */}
      <section className="mx-auto max-w-[1600px] px-4 py-18">
        <div className="grid gap-px bg-forest-light/25 md:grid-cols-3">
          <SectionCard
            icon={MapIcon}
            to="/geoportail"
            title="Géoportail"
            description="La limite officielle, le zonage MAB, la végétation, l'occupation du sol, l'hydrographie et les infrastructures — superposables sur cinq fonds de carte, avec mesure de distance et lecture des attributs."
            meta={parkStats.data ? `${parkStats.data.layerCount} couches` : "Chargement…"}
          />
          <SectionCard
            icon={Leaf}
            to="/biodiversite"
            title="Biodiversité"
            description="Flore protégée par le décret 12-03, flore évaluée par l'UICN, endémisme, invertébrés, reptiles, oiseaux et mammifères protégés — avec les statuts de conservation."
            meta={speciesStats.data ? pluralize(speciesStats.data.total, "fiche") : "Chargement…"}
          />
          <SectionCard
            icon={Landmark}
            to="/patrimoine"
            title="Patrimoine"
            description="Sites naturels, archéologiques, culturels, historiques, touristiques et scientifiques recensés dans le massif et alimentés par les contributions validées."
            meta="Sites recensés"
          />
        </div>
      </section>

      {/* --- Galerie --------------------------------------------------- */}
      <section aria-labelledby="paysages" className="contours border-t border-forest-light/20 bg-sand/50">
        <div className="mx-auto max-w-[1600px] px-4 py-18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="paysages" className="text-3xl">Paysages du Belezma</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
                Les photographies publiées ici proviennent des contributions validées par l'équipe du
                parc. Vous pouvez y ajouter les vôtres.
              </p>
            </div>
            <Link
              to="/galerie"
              className="flex min-h-[44px] items-center gap-1.5 text-sm text-forest no-underline hover:underline"
            >
              Voir toute la galerie
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-8">
            {gallery.isPending ? (
              <div className="flex justify-center py-12 text-forest">
                <Spinner />
              </div>
            ) : gallery.data && gallery.data.data.length > 0 ? (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {gallery.data.data.map((photo) => (
                  <li key={photo.id}>
                    <Link
                      to={`/contributions/${photo.id}`}
                      className="group block overflow-hidden rounded-card border border-forest-light/30 no-underline"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-sand">
                        {photo.media ? (
                          <img
                            src={photo.media.cardUrl}
                            alt={photo.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-calm group-hover:scale-[1.03]"
                          />
                        ) : null}
                      </div>
                      <div className="bg-paper px-3 py-2.5">
                        <p className="line-clamp-1 text-sm font-medium text-forest-deep">{photo.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <ProvenanceChip provenance="CONTRIBUTION" />
                          <span className="datum text-2xs text-ink/60">{photo.owner.displayName}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Camera}
                title="Aucune photographie pour l'instant"
                description="Ajoutez la première photo du massif : cédraie, falaises, pelouses d'altitude ou faune observée sur les sentiers."
                action={<ButtonLink to="/mon-espace/nouveau">Déposer une photographie</ButtonLink>}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function KeyFigure({
  label,
  value,
  unit,
  note,
  accent = false,
}: {
  label: string;
  value: string | null;
  unit: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-sand px-4 py-7 lg:px-6">
      <dt className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">{label}</dt>
      <dd className="mt-2">
        <span
          className={`datum block text-3xl font-medium leading-none lg:text-4xl ${accent ? "text-gold" : "text-forest-deep"}`}
        >
          {value ?? "—"}
        </span>
        <span className="mt-1.5 block font-mono text-xs text-ink/70">{unit}</span>
        <span className="mt-2 block text-xs leading-snug text-ink/60">{note}</span>
      </dd>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  to,
  title,
  description,
  meta,
}: {
  icon: typeof MapIcon;
  to: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 bg-paper p-6 no-underline transition-colors duration-quick hover:bg-sand/60 lg:p-8"
    >
      <Icon className="h-6 w-6 text-forest" aria-hidden />
      <h3 className="text-2xl">{title}</h3>
      <p className="text-sm leading-relaxed text-ink/75">{description}</p>
      <p className="mt-auto flex items-center gap-2 pt-3">
        <span className="datum text-xs text-earth">{meta}</span>
        <ArrowRight
          className="h-4 w-4 text-forest transition-transform duration-quick group-hover:translate-x-1"
          aria-hidden
        />
      </p>
    </Link>
  );
}

