import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { REJECTION_PRESETS } from "@belezma/shared";
import { Button } from "../../components/ui/Button";
import { TextAreaField } from "../../components/form/Field";
import { clsx } from "../../lib/clsx";

const MIN_LENGTH = 10;

/**
 * Saisie du motif de refus : quatre motifs types, plus un texte libre. Le
 * motif est transmis au contributeur, d'où le minimum exigé (§8).
 */
export function RejectDialog({
  title,
  action,
  onCancel,
  onConfirm,
  pending,
}: {
  title: string;
  action: "reject" | "unpublish";
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstPresetRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstPresetRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const tooShort = reason.trim().length < MIN_LENGTH;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-forest-deep/50"
        onClick={onCancel}
        aria-label="Annuler"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-refus"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-forest-light/30 bg-paper p-6 shadow-raised"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titre-refus" className="text-2xl">
            {action === "reject" ? "Refuser cette contribution" : "Retirer de l'espace public"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink/55 hover:bg-sand"
            aria-label="Annuler"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <p className="mt-1.5 text-sm text-ink/70">
          « {title} » — le motif ci-dessous est transmis à son auteur.
        </p>

        <fieldset className="mt-5">
          <legend className="font-mono text-2xs uppercase tracking-[0.1em] text-earth">
            Motifs types
          </legend>
          <ul className="mt-2 space-y-1.5">
            {REJECTION_PRESETS.map((preset, index) => (
              <li key={preset}>
                <button
                  ref={index === 0 ? firstPresetRef : undefined}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={clsx(
                    "w-full rounded-control border px-3 py-2 text-left text-sm leading-snug transition-colors duration-quick",
                    reason === preset
                      ? "border-forest bg-forest/8 text-forest-deep"
                      : "border-forest-light/35 bg-paper text-ink/80 hover:bg-sand/60",
                  )}
                >
                  {preset}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mt-5">
          <TextAreaField
            label="Motif transmis au contributeur"
            required
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint={`Au moins ${MIN_LENGTH} caractères. Dites ce qui ne convient pas et ce qu'il faut corriger.`}
            error={
              reason.length > 0 && tooShort
                ? `Encore ${MIN_LENGTH - reason.trim().length} caractère(s) : le motif doit être compréhensible par son auteur.`
                : undefined
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="danger"
            disabled={tooShort || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending
              ? "Envoi en cours…"
              : action === "reject"
                ? "Refuser et prévenir l'auteur"
                : "Retirer et prévenir l'auteur"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
