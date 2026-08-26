import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ImageUp, MailWarning, User as UserIcon } from "lucide-react";
import { updateProfileSchema, type UpdateProfileInput } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { TextAreaField, TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { useUpdateProfile, useUploadAvatar } from "../lib/auth";
import { useAuthStore } from "../stores/auth-store";
import { formatDate, formatNumber } from "../lib/format";

export function Profil() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      displayName: user?.displayName ?? "",
      organization: user?.organization ?? "",
      bio: user?.bio ?? "",
    },
  });

  if (!user) return null;

  return (
    <>
      <PageHead title="Mon profil" />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-4xl">Mon profil</h1>
          <p className="mt-2 text-sm text-ink/70">
            Ces informations accompagnent vos contributions publiées.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {!user.emailVerified ? (
          <div className="mb-8 flex items-start gap-3 rounded-card border border-gold/40 bg-gold/8 p-4">
            <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-earth" aria-hidden />
            <p className="text-sm leading-relaxed text-ink/80">
              Votre adresse <span className="datum">{user.email}</span> n'est pas encore confirmée.
              Ouvrez le lien reçu par courrier électronique pour finaliser la création de votre compte.
            </p>
          </div>
        ) : null}

        {/* --- Photographie de profil ------------------------------------ */}
        <section aria-labelledby="avatar" className="flex flex-wrap items-center gap-5">
          <h2 id="avatar" className="sr-only">Photographie de profil</h2>

          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full border border-forest-light/40 object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-forest-light/40 bg-sand">
              <UserIcon className="h-8 w-8 text-forest-light" aria-hidden />
            </span>
          )}

          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar.mutateAsync(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={uploadAvatar.isPending}
            >
              <ImageUp className="h-4 w-4" aria-hidden />
              {uploadAvatar.isPending ? "Envoi en cours…" : "Changer ma photographie"}
            </Button>
            <p className="mt-1.5 text-xs text-ink/60">JPEG, PNG ou WebP — 10 Mo au maximum.</p>
          </div>
        </section>

        {uploadAvatar.isError ? <ErrorNotice error={uploadAvatar.error} className="mt-4" /> : null}

        {/* --- Informations ---------------------------------------------- */}
        <form
          noValidate
          className="mt-10 space-y-6"
          onSubmit={handleSubmit(async (values) => {
            await updateProfile.mutateAsync(values);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 4000);
          })}
        >
          {updateProfile.isError ? <ErrorNotice error={updateProfile.error} /> : null}

          <TextField
            label="Nom affiché"
            required
            error={errors.displayName?.message}
            {...register("displayName")}
          />

          <TextField
            label="Organisme"
            hint="Université, association, administration — laissez vide si vous contribuez à titre personnel."
            error={errors.organization?.message}
            {...register("organization")}
          />

          <TextAreaField
            label="Présentation"
            rows={4}
            hint="Quelques lignes sur votre lien au massif : elles apparaissent sur votre profil public."
            error={errors.bio?.message}
            {...register("bio")}
          />

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={isSubmitting || updateProfile.isPending || !isDirty}>
              {updateProfile.isPending ? "Enregistrement…" : "Enregistrer mes informations"}
            </Button>
            {saved ? (
              <p role="status" className="flex items-center gap-1.5 text-sm text-forest">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Informations enregistrées.
              </p>
            ) : null}
          </div>
        </form>

        {/* --- Compte ----------------------------------------------------- */}
        <section aria-labelledby="compte" className="mt-12">
          <h2 id="compte" className="font-mono text-2xs uppercase tracking-[0.12em] text-earth">
            Compte
          </h2>
          <dl className="mt-3 grid gap-px border border-forest-light/25 bg-forest-light/25 sm:grid-cols-2">
            <Field label="Adresse e-mail">
              <span className="datum">{user.email}</span>
            </Field>
            <Field label="Adresse confirmée">{user.emailVerified ? "Oui" : "Non"}</Field>
            <Field label="Rôle">
              {user.role === "admin"
                ? "Administration"
                : user.role === "moderator"
                  ? "Modération"
                  : "Contributeur"}
            </Field>
            <Field label="Inscription">
              <span className="datum">{formatDate(user.createdAt)}</span>
            </Field>
            <Field label="Contributions déposées">
              <span className="datum">{formatNumber(user.stats.contributions)}</span>
            </Field>
            <Field label="Contributions publiées">
              <span className="datum">{formatNumber(user.stats.published)}</span>
            </Field>
          </dl>
        </section>
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
