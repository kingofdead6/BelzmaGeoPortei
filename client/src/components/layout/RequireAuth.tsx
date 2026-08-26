import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@belezma/shared";
import { useAuthStore } from "../../stores/auth-store";
import { Spinner } from "../ui/Spinner";
import { EmptyState } from "../ui/EmptyState";
import { ButtonLink } from "../ui/Button";
import { ShieldAlert } from "lucide-react";

/**
 * Garde de navigation. Elle évite d'afficher une page vide : l'autorisation
 * réelle est refaite par le serveur sur chaque appel (§6, §13).
 */
export function RequireAuth({ minimumRole }: { minimumRole?: UserRole }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const restoring = useAuthStore((state) => state.restoring);
  const hasRole = useAuthStore((state) => state.hasRole);

  if (restoring) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-forest">
        <Spinner label="Vérification de votre session" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  }

  if (minimumRole && !hasRole(minimumRole)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-22">
        <EmptyState
          icon={ShieldAlert}
          title="Cette section est réservée à l'équipe du parc"
          description="Votre compte n'a pas les droits nécessaires. Si vous pensez qu'il s'agit d'une erreur, contactez la direction du parc."
          action={<ButtonLink to="/mon-espace">Revenir à mon espace</ButtonLink>}
        />
      </div>
    );
  }

  return <Outlet />;
}
