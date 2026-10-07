import { useState } from "react";
import { Link } from "react-router-dom";
import { Flag, X } from "lucide-react";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@belezma/shared";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/form/Field";
import { ErrorNotice } from "../../components/ui/ErrorNotice";
import { useReportContribution } from "../../lib/contributions";
import { useAuthStore } from "../../stores/auth-store";
import { clsx } from "../../lib/clsx";

/** Signalement d'une contribution publiée, réservé aux comptes connectés (§5). */
export function ReportButton({
  contributionId,
  ownerId,
}: {
  contributionId: string;
  ownerId: string;
}) {
  const user = useAuthStore((state) => state.user);
  const report = useReportContribution();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("donnee_erronee");
  const [note, setNote] = useState("");

  // On ne propose pas de signaler sa propre contribution.
  if (user && user.id === ownerId) return null;

  if (!user) {
    return (
      <p className="text-xs text-ink/60">
        <Link to="/connexion" className="text-forest no-underline hover:underline">
          Connectez-vous
        </Link>{" "}
        pour signaler un problème sur cette contribution.
      </p>
    );
  }

  if (report.isSuccess) {
    return (
      <p role="status" className="text-xs text-forest">
        Votre signalement est transmis à l'équipe du parc. Merci.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="px-2 text-ink/65" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Signaler un problème
      </Button>
    );
  }

  return (
    <div className="rounded-card border border-forest-light/35 bg-sand/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg">Signaler un problème</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink/55 hover:bg-paper"
          aria-label="Annuler le signalement"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {report.isError ? <ErrorNotice error={report.error} className="mt-3" /> : null}

      <fieldset className="mt-4">
        <legend className="font-mono text-2xs uppercase tracking-[0.1em] text-earth">Motif</legend>
        <ul className="mt-2 space-y-1.5">
          {REPORT_REASONS.map((value) => (
            <li key={value}>
              <label
                className={clsx(
                  "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-control border px-3 text-sm transition-colors duration-quick",
                  reason === value
                    ? "border-forest bg-forest/8 text-forest-deep"
                    : "border-forest-light/35 bg-paper text-ink/80 hover:bg-sand/60",
                )}
              >
                <input
                  type="radio"
                  name="motif"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="h-4 w-4 accent-[#2D6A4F]"
                />
                {REPORT_REASON_LABELS[value]}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-4">
        <TextAreaField
          label="Précisions"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Facultatif, mais utile : dites ce qui vous paraît erroné."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={report.isPending}
          onClick={() =>
            report.mutate({ id: contributionId, reason, note: note.trim() || undefined })
          }
        >
          {report.isPending ? "Envoi en cours…" : "Envoyer mon signalement"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
