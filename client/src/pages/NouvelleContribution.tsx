import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Check, Landmark, Layers, Leaf } from "lucide-react";
import {
  CONTRIBUTION_KINDS,
  HERITAGE_CATEGORIES,
  IUCN_STATUSES,
  type ContributionKind,
  type HeritageCategory,
  type IucnStatus,
} from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { SelectField, TextAreaField, TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { Spinner } from "../components/ui/Spinner";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { FileDropZone, type DropZoneMode } from "../features/upload/FileDropZone";
import { useCreateContribution } from "../lib/contributions";
import { formatBytes, formatCoordinate } from "../lib/format";
import { clsx } from "../lib/clsx";

/** La mini-carte embarque Leaflet : elle n'est chargée qu'à l'étape 3. */
const LocationPicker = lazy(() =>
  import("../features/upload/LocationPicker").then((module) => ({
    default: module.LocationPicker,
  })),
);

const KIND_META: Record<
  ContributionKind,
  { label: string; description: string; icon: typeof Camera; mode: DropZoneMode | null }
> = {
  photo: {
    label: "Photographie",
    description: "Un paysage, un peuplement, une formation remarquable du massif.",
    icon: Camera,
    mode: "image",
  },
  observation: {
    label: "Observation d'espèce",
    description: "Une plante ou un animal observé, avec sa détermination.",
    icon: Leaf,
    mode: "image",
  },
  heritage: {
    label: "Site patrimonial",
    description: "Un site naturel, archéologique, culturel, historique ou touristique.",
    icon: Landmark,
    mode: null,
  },
  layer: {
    label: "Couche SIG",
    description: "Un relevé GeoJSON ou une archive shapefile.",
    icon: Layers,
    mode: "gis",
  },
};

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Type",
  2: "Fichier et description",
  3: "Localisation",
};

export function NouvelleContribution() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateContribution();

  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<ContributionKind | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [iucnStatus, setIucnStatus] = useState<IucnStatus | "">("");
  const [category, setCategory] = useState<HeritageCategory | "">("");
  const [progress, setProgress] = useState(0);

  // Un clic droit sur la carte du géoportail pré-remplit les coordonnées (§9).
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => {
    const lng = Number(params.get("lng"));
    const lat = Number(params.get("lat"));
    return Number.isFinite(lng) && Number.isFinite(lat) && params.get("lng") && params.get("lat")
      ? { lat, lng }
      : null;
  });

  const meta = kind ? KIND_META[kind] : null;
  const locationRequired = kind === "heritage";

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    [tagsInput],
  );

  const stepTwoComplete =
    title.trim().length >= 3 &&
    (meta?.mode === null || file !== null) &&
    (kind !== "observation" || scientificName.trim().length >= 3) &&
    (kind !== "heritage" || category !== "");

  const canSubmit = stepTwoComplete && (!locationRequired || location !== null);

  async function submit(requestPublication: boolean): Promise<void> {
    if (!kind || !canSubmit) return;
    setProgress(0);

    const created = await create.mutateAsync({
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      tags,
      lng: location?.lng,
      lat: location?.lat,
      species:
        kind === "observation"
          ? {
              scientificName: scientificName.trim(),
              commonName: commonName.trim() || undefined,
              iucnStatus: iucnStatus || undefined,
            }
          : undefined,
      heritageCategory: kind === "heritage" ? category || undefined : undefined,
      requestPublication,
      file,
      onProgress: setProgress,
    });

    navigate("/mon-espace", {
      replace: true,
      state: { created: created.id, requestedPublication: requestPublication },
    });
  }

  return (
    <>
      <PageHead title="Déposer une contribution" />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-4xl">Déposer une contribution</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Votre dépôt reste privé par défaut. Vous pourrez demander sa publication maintenant ou
            plus tard, depuis votre espace.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Progression */}
        <ol className="mb-8 flex items-center gap-2" aria-label="Étapes du dépôt">
          {([1, 2, 3] as Step[]).map((value) => {
            const done = value < step;
            const current = value === step;
            return (
              <li key={value} className="flex flex-1 items-center gap-2">
                <span
                  aria-current={current ? "step" : undefined}
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-control border font-mono text-xs",
                    current
                      ? "border-forest bg-forest text-paper"
                      : done
                        ? "border-forest/40 bg-forest/10 text-forest"
                        : "border-forest-light/40 bg-paper text-ink/45",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : value}
                </span>
                <span
                  className={clsx(
                    "truncate text-sm",
                    current ? "font-medium text-forest-deep" : "text-ink/60",
                  )}
                >
                  {STEP_LABELS[value]}
                </span>
                {value < 3 ? <span className="h-px flex-1 bg-forest-light/35" aria-hidden /> : null}
              </li>
            );
          })}
        </ol>

        {create.isError ? <ErrorNotice error={create.error} className="mb-6" /> : null}

        {/* --- Étape 1 : type ------------------------------------------- */}
        {step === 1 ? (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-2xl">Que souhaitez-vous déposer ?</legend>
            {CONTRIBUTION_KINDS.map((value) => {
              const item = KIND_META[value];
              const Icon = item.icon;
              const selected = kind === value;
              return (
                <label
                  key={value}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors duration-quick",
                    selected
                      ? "border-forest bg-forest/5"
                      : "border-forest-light/35 bg-paper hover:bg-sand/50",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={selected}
                    onChange={() => {
                      setKind(value);
                      setFile(null);
                    }}
                    className="mt-1 h-4 w-4 accent-[#2D6A4F]"
                  />
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
                  <span>
                    <span className="block font-medium text-forest-deep">{item.label}</span>
                    <span className="mt-0.5 block text-sm text-ink/70">{item.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        {/* --- Étape 2 : fichier et description ------------------------- */}
        {step === 2 && kind && meta ? (
          <div className="space-y-6">
            <h2 className="text-2xl">{meta.label}</h2>

            {meta.mode ? (
              <FileDropZone mode={meta.mode} file={file} onChange={setFile} />
            ) : null}

            <TextField
              label="Titre"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              hint="Nommez précisément ce que l'on voit : « Cédraie de Tichaou sous la neige »."
            />

            <TextAreaField
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              hint="Contexte, date d'observation, conditions du relevé — tout ce qui aide à comprendre la donnée."
            />

            <TextField
              label="Étiquettes"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              hint="Séparées par des virgules : cédraie, tichaou, hiver."
            />

            {kind === "observation" ? (
              <>
                <TextField
                  label="Nom scientifique"
                  required
                  value={scientificName}
                  onChange={(event) => setScientificName(event.target.value)}
                  hint="Genre et espèce, par exemple « Cedrus atlantica »."
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
                  hint="Laissez vide si vous ne le connaissez pas : l'équipe du parc le complétera."
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

            {kind === "heritage" ? (
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
          </div>
        ) : null}

        {/* --- Étape 3 : localisation et récapitulatif ------------------ */}
        {step === 3 && kind && meta ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl">Localisation</h2>
              <p className="mt-1.5 text-sm text-ink/70">
                {locationRequired
                  ? "Un site patrimonial doit être localisé sur la carte."
                  : "Facultative, mais elle permet d'afficher votre contribution sur la carte du géoportail."}
              </p>
            </div>

            <Suspense
              fallback={
                <div className="flex h-72 items-center justify-center rounded-card border border-forest-light/40 text-forest">
                  <Spinner label="Chargement de la carte" />
                </div>
              }
            >
              <LocationPicker value={location} onChange={setLocation} required={locationRequired} />
            </Suspense>

            {/* Récapitulatif */}
            <section aria-labelledby="recapitulatif">
              <h2 id="recapitulatif" className="text-2xl">
                Récapitulatif
              </h2>
              <dl className="mt-3 grid gap-px border border-forest-light/25 bg-forest-light/25 sm:grid-cols-2">
                <Field label="Type">{meta.label}</Field>
                <Field label="Titre">{title}</Field>
                {file ? (
                  <Field label="Fichier">
                    <span className="datum break-all">{file.name}</span>{" "}
                    <span className="text-ink/55">({formatBytes(file.size)})</span>
                  </Field>
                ) : null}
                {kind === "observation" ? (
                  <Field label="Espèce">
                    <span className="italic">{scientificName}</span>
                    {iucnStatus ? <span className="datum"> · {iucnStatus}</span> : null}
                  </Field>
                ) : null}
                {kind === "heritage" && category ? (
                  <Field label="Catégorie">{category}</Field>
                ) : null}
                {tags.length > 0 ? (
                  <Field label="Étiquettes">
                    <span className="datum">{tags.join(", ")}</span>
                  </Field>
                ) : null}
                <Field label="Localisation">
                  {location ? (
                    <span className="datum">
                      {formatCoordinate(location.lat, "lat")} {formatCoordinate(location.lng, "lng")}
                    </span>
                  ) : (
                    <span className="text-ink/55">Non localisée</span>
                  )}
                </Field>
                <Field label="Provenance affichée">
                  <ProvenanceChip provenance="CONTRIBUTION" />
                </Field>
              </dl>
            </section>

            {create.isPending && progress > 0 ? (
              <div>
                <div className="h-1.5 overflow-hidden rounded-control bg-sand">
                  <div
                    className="h-full bg-forest transition-[width] duration-quick"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p
                  className="datum mt-1.5 text-xs text-ink/65"
                  role="status"
                  aria-live="polite"
                >
                  Envoi en cours — {progress} %
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!canSubmit || create.isPending}
                onClick={() => void submit(true)}
              >
                {create.isPending ? "Envoi en cours…" : "Enregistrer et demander la publication"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canSubmit || create.isPending}
                onClick={() => void submit(false)}
              >
                Enregistrer en privé
              </Button>
            </div>
          </div>
        ) : null}

        {/* Navigation entre étapes */}
        <div className="mt-9 flex items-center justify-between gap-3 border-t border-forest-light/25 pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1 || create.isPending}
            onClick={() => setStep((value) => (value - 1) as Step)}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Étape précédente
          </Button>

          {step < 3 ? (
            <Button
              type="button"
              disabled={step === 1 ? kind === null : !stepTwoComplete}
              onClick={() => setStep((value) => (value + 1) as Step)}
            >
              Étape suivante
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </>
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
