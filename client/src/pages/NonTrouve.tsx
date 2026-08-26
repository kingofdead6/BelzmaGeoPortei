import { Compass } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { ButtonLink } from "../components/ui/Button";
import { PageHead } from "../components/layout/PageHead";

export function NonTrouve() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-22">
      <PageHead title="Page introuvable" />
      <EmptyState
        icon={Compass}
        title="Cette page n'existe pas"
        description="L'adresse demandée ne correspond à aucune section du géoportail. Reprenez depuis la carte ou la page d'accueil."
        action={<ButtonLink to="/geoportail">Ouvrir le géoportail</ButtonLink>}
      />
    </div>
  );
}
