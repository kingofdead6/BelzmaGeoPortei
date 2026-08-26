import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { fetchData } from "../lib/api";
import { PageHead } from "../components/layout/PageHead";
import { AuthShell } from "../components/layout/AuthShell";
import { Spinner } from "../components/ui/Spinner";
import { ErrorNotice } from "../components/ui/ErrorNotice";

export function VerificationEmail() {
  const { token = "" } = useParams();
  const [state, setState] = useState<{ status: "pending" | "done" | "failed"; error?: unknown }>({
    status: "pending",
  });

  useEffect(() => {
    let cancelled = false;
    fetchData(`/auth/verify-email/${token}`)
      .then(() => {
        if (!cancelled) setState({ status: "done" });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "failed", error });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell title="Confirmation de votre adresse">
      <PageHead title="Confirmation de l'adresse" />

      {state.status === "pending" ? (
        <p className="flex items-center gap-2 text-sm text-ink/70">
          <Spinner label="Vérification en cours" />
          Vérification en cours…
        </p>
      ) : state.status === "done" ? (
        <div className="flex items-start gap-3 rounded-card border border-forest/25 bg-forest/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <p className="text-sm leading-relaxed text-ink/80">
            Votre adresse est confirmée. Vous pouvez désormais déposer des contributions.
          </p>
        </div>
      ) : (
        <ErrorNotice
          error={state.error}
          fallback="Ce lien de confirmation n'est plus valable. Votre adresse est peut-être déjà confirmée."
        />
      )}

      <p className="mt-6 text-sm">
        <Link to="/mon-espace" className="text-forest no-underline hover:underline">
          Aller à mon espace
        </Link>
      </p>
    </AuthShell>
  );
}
