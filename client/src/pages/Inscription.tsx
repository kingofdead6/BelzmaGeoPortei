import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { useRegister } from "../lib/auth";
import { useAuthStore } from "../stores/auth-store";
import { AuthShell } from "../components/layout/AuthShell";

export function Inscription() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const createAccount = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  if (user) return <Navigate to="/mon-espace" replace />;

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Déposez vos photographies, observations et relevés SIG du massif. Vos contributions restent privées jusqu'à ce que vous en demandiez la publication."
    >
      <PageHead title="Créer un compte" />

      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          await createAccount.mutateAsync(values);
          navigate("/mon-espace", { replace: true });
        })}
      >
        {createAccount.isError ? <ErrorNotice error={createAccount.error} /> : null}

        <TextField
          label="Nom affiché"
          autoComplete="name"
          required
          hint="Il accompagnera chacune de vos contributions publiées."
          error={errors.displayName?.message}
          {...register("displayName")}
        />

        <TextField
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          required
          hint="Au moins 10 caractères. Une phrase que vous seul retenez fait un excellent mot de passe."
          error={errors.password?.message}
          {...register("password")}
        />

        <TextField
          label="Organisme (facultatif)"
          autoComplete="organization"
          hint="Université, association, administration — si vous en représentez un."
          error={errors.organization?.message}
          {...register("organization")}
        />

        <Button type="submit" disabled={isSubmitting || createAccount.isPending} className="w-full">
          {createAccount.isPending ? "Création en cours…" : "Créer mon compte"}
        </Button>

        <p className="text-sm text-ink/70">
          Vous avez déjà un compte ?{" "}
          <Link to="/connexion" className="text-forest no-underline hover:underline">
            Se connecter
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
