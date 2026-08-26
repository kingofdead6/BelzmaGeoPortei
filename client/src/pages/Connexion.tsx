import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@belezma/shared";
import { PageHead } from "../components/layout/PageHead";
import { TextField } from "../components/form/Field";
import { Button } from "../components/ui/Button";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { useLogin } from "../lib/auth";
import { useAuthStore } from "../stores/auth-store";
import { AuthShell } from "../components/layout/AuthShell";

export function Connexion() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // La page d'origine est mémorisée par `RequireAuth` avant la redirection.
  const from = (location.state as { from?: string } | null)?.from ?? "/mon-espace";

  if (user) return <Navigate to={from} replace />;

  return (
    <AuthShell
      title="Se connecter"
      subtitle="Retrouvez vos contributions et suivez leur validation par l'équipe du parc."
    >
      <PageHead title="Connexion" />

      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          await login.mutateAsync(values);
          navigate(from, { replace: true });
        })}
      >
        {login.isError ? <ErrorNotice error={login.error} /> : null}

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
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" disabled={isSubmitting || login.isPending} className="w-full">
          {login.isPending ? "Connexion en cours…" : "Me connecter"}
        </Button>

        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link to="/mot-de-passe-oublie" className="text-forest no-underline hover:underline">
            Mot de passe oublié ?
          </Link>
          <Link to="/inscription" className="text-forest no-underline hover:underline">
            Créer un compte
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
