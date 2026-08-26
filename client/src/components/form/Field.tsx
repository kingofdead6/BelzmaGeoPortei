import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { clsx } from "../../lib/clsx";

const CONTROL =
  "min-h-[44px] w-full rounded-control border bg-paper px-3 text-base text-ink " +
  "placeholder:text-ink/40 disabled:bg-sand/60 disabled:text-ink/50";

function borderFor(invalid: boolean): string {
  return invalid ? "border-iucn-cr/60" : "border-forest-light/40";
}

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Étiquette, aide et message d'erreur reliés au champ par `aria-describedby`. */
export function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = error ? `${id}-erreur` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-forest-deep">
        {label}
        {required ? (
          <span className="ml-1 text-earth" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs text-ink/60">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-iucn-cr">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          {...props}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={clsx(CONTROL, borderFor(invalid), className)}
        />
      )}
    </FieldShell>
  );
});

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, error, hint, className, required, rows = 4, ...props }, ref) {
    return (
      <FieldShell label={label} error={error} hint={hint} required={required}>
        {({ id, describedBy, invalid }) => (
          <textarea
            {...props}
            id={id}
            ref={ref}
            rows={rows}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={clsx(CONTROL, "min-h-[6rem] py-2 leading-relaxed", borderFor(invalid), className)}
          />
        )}
      </FieldShell>
    );
  },
);

export interface SelectFieldProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, className, required, children, ...props },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          {...props}
          id={id}
          ref={ref}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={clsx(CONTROL, borderFor(invalid), className)}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
});
