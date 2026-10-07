import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import {
  HERITAGE_CATEGORIES,
  IUCN_STATUSES,
  type HeritageCategory,
  type IucnStatus,
} from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { SelectField, TextAreaField, TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Spinner } from "../components/ui/Spinner";
import { VisibilityBadge } from "../components/ui/VisibilityBadge";
import { useContribution } from "../lib/queries";
import { useUpdateContribution } from "../lib/contributions";

const LocationPicker = lazy(() =>
  import("../features/upload/LocationPicker").then((module) => ({
    default: module.LocationPicker,
  })),
);

export function ModifierContribution() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const contribution = useContribution(id);
  const update = useUpdateContribution();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [iucnStatus, setIucnStatus] = useState<IucnStatus | "">("");
  const [category, setCategory] = useState<HeritageCategory | "">("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Les champs sont renseignés une seule fois, à l'arrivée de la contribution :
  // une saisie en cours ne doit pas être écrasée par un rafraîchissement.
  useEffect(() => {
    if (hydrated || !contribution.data) return;
    const item = contribution.data;
    setTitle(item.title);
    setDescription(item.description ?? "");
    setTagsInput(item.tags.join(", "));
    setScientificName(item.species?.scientificName ?? "");
    setCommonName(item.species?.commonName ?? "");
    setIucnStatus((item.species?.iucnStatus as IucnStatus | undefined) ?? "");
    setCategory(item.heritage?.category ?? "");
    setLocation(
      item.location
        ? { lat: item.location.coordinates[1], lng: item.location.coordinates[0] }
        : null,
    );
    setHydrated(true);
  }, [contribution.data, hydrated]);

  if (contribution.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-forest">
        <Spinner label="Chargement de la contribution" />
      </div>
    );
  }

  if (contribution.isError || !contribution.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-18">
        <ErrorNotice
          error={contribution.error}
          fallback="Cette contribution n'existe pas, ou ne vous appartient pas."
        />
        <Link to="/mon-espace" className="mt-6 inline-flex items-center gap-2 text-sm text-forest">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Revenir à mon espace
        </Link>
      </div>
    );
  }

  const item = contribution.data;
  const locationRequired = item.kind === "heritage";

  async function save(): Promise<void> {
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    await update.mutateAsync({
      id,
      changes: {
        title: title.trim(),
        description: description.trim() || null,
        tags,
        ...(location ? { lng: location.lng, lat: location.lat } : { lng: null, lat: null }),
        ...(item.kind === "observation"
          ? {
              species: {
                scientificName: scientificName.trim(),
                ...(commonName.trim() ? { commonName: commonName.trim() } : {}),
                ...(iucnStatus ? { iucnStatus } : {}),
              },
            }
          : {}),
        ...(item.kind === "heritage" && category ? { heritageCategory: category } : {}),
      },
    });

    navigate("/mon-espace", { replace: true });
  }

  return (
    <>
      <PageHead title={`Modifier — ${item.title}`} />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Link
            to="/mon-espace"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm text-forest no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Mon espace
          </Link>
          <h1 className="mt-2 text-4xl">Modifier ma contribution</h1>
          <div className="mt-3">
            <VisibilityBadge visibility={item.visibility} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {item.visibility === "public" ? (
          <div className="mb-7 flex items-start gap-3 rounded-card border border-gold/40 bg-gold/8 p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-earth" aria-hidden />
            <p className="text-sm leading-relaxed text-ink/80">
              Cette contribution est publiée. En l'enregistrant, elle repassera en validation :
              l'équipe du parc relira la version modifiée avant de la publier à nouveau.
            </p>
          </div>
        ) : null}

        {item.visibility === "rejected" && item.rejectedReason ? (
          <div className="mb-7 rounded-card border border-iucn-cr/30 bg-iucn-cr/5 p-4">
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-iucn-cr">
              Motif du refus
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{item.rejectedReason}</p>
            <p className="mt-3 text-sm text-ink/70">
              Corrigez ce qui est signalé, enregistrez, puis demandez à nouveau la publication
              depuis votre espace.
            </p>
          </div>
        ) : null}

        {update.isError ? <ErrorNotice error={update.error} className="mb-6" /> : null}

        <form
          noValidate
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <TextField
            label="Titre"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <TextAreaField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <TextField
            label="Étiquettes"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            hint="Séparées par des virgules."
          />

          {item.kind === "observation" ? (
            <>
              <TextField
                label="Nom scientifique"
                required
                value={scientificName}
                onChange={(event) => setScientificName(event.target.value)}
              />
              <TextField
                label="Nom commun"
                value={commonName}
                onChange={(event) => setCommonName(event.target.value)}
              />
              <SelectField
                label="Statut UICN"
                value={iucnStatus}
                onChange={(event) => setIucnStatus(event.target.value as IucnStatus | "")}
              >
                <option value="">Non renseigné</option>
                {IUCN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectField>
            </>
          ) : null}

          {item.kind === "heritage" ? (
            <SelectField
              label="Catégorie du site"
              required
              value={category}
              onChange={(event) => setCategory(event.target.value as HeritageCategory | "")}
            >
              <option value="">Choisissez une catégorie</option>
              {HERITAGE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
          ) : null}

          <div>
            <p className="mb-2 block text-sm font-medium text-forest-deep">Localisation</p>
            <Suspense
              fallback={
                <div className="flex h-72 items-center justify-center rounded-card border border-forest-light/40 text-forest">
                  <Spinner label="Chargement de la carte" />
                </div>
              }
            >
              <LocationPicker value={location} onChange={setLocation} required={locationRequired} />
            </Suspense>
          </div>

          <p className="text-xs leading-relaxed text-ink/60">
            Le fichier déposé ne peut pas être remplacé ici. Pour changer de photographie ou de
            couche, supprimez cette contribution et déposez-en une nouvelle.
          </p>

          <div className="flex flex-wrap gap-3 border-t border-forest-light/25 pt-5">
            <Button
              type="submit"
              disabled={update.isPending || title.trim().length < 3 || (locationRequired && !location)}
            >
              {update.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/mon-espace")}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
