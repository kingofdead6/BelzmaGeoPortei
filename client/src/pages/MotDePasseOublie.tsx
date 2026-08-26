import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordInput, type ResetPasswordInput } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { useForgotPassword, useResetPassword } from "../lib/auth";
import { AuthShell } from "../components/layout/AuthShell";

export function MotDePasseOublie() {
  const [params] = useSearchParams();
  const token = params.get("token");

  return token ? <ResetForm token={token} /> : <RequestForm />;
}

function RequestForm() {
  const request = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  if (request.isSuccess) {
    return (
      <AuthShell title="Vérifiez votre boîte de réception">
        <PageHead title="Mot de passe oublié" />
        <div className="flex items-start gap-3 rounded-card border border-forest/25 bg-forest/5 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <p className="text-sm leading-relaxed text-ink/80">{request.data.message}</p>
        </div>
        <p className="mt-6 text-sm">
          <Link to="/connexion" className="text-forest no-underline hover:underline">
            Revenir à la connexion
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Indiquez l'adresse de votre compte : nous vous enverrons un lien de réinitialisation valable une heure."
    >
      <PageHead title="Mot de passe oublié" />

      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit((values) => request.mutateAsync(values))}
      >
        {request.isError ? <ErrorNotice error={request.error} /> : null}

        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <Button type="submit" disabled={isSubmitting || request.isPending} className="w-full">
          {request.isPending ? "Envoi en cours…" : "M'envoyer un lien"}
        </Button>

        <p className="text-sm">
          <Link to="/connexion" className="text-forest no-underline hover:underline">
            Revenir à la connexion
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function ResetForm({ token }: { token: string }) {
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Pick<ResetPasswordInput, "password">>({
    resolver: zodResolver(resetPasswordSchema.pick({ password: true })),
  });

  if (reset.isSuccess) {
    return (
      <AuthShell title="Mot de passe modifié">
        <PageHead title="Mot de passe modifié" />
        <p className="text-sm leading-relaxed text-ink/80">{reset.data.message}</p>
        <Button
          type="button"
          className="mt-6 w-full"
          onClick={() => {
            window.location.href = "/connexion";
          }}
        >
          Me connecter
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choisir un nouveau mot de passe"
      subtitle="Vos autres sessions seront fermées : vous devrez vous reconnecter partout."
    >
      <PageHead title="Nouveau mot de passe" />

      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit((values) => reset.mutateAsync({ token, password: values.password }))}
      >
        {reset.isError ? <ErrorNotice error={reset.error} /> : null}

        <TextField
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          hint="Au moins 10 caractères."
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" disabled={isSubmitting || reset.isPending} className="w-full">
          {reset.isPending ? "Enregistrement…" : "Enregistrer mon nouveau mot de passe"}
        </Button>
      </form>
    </AuthShell>
  );
}
