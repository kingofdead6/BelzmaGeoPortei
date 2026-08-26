import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { clsx } from "../../lib/clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

/** Cible tactile ≥ 44 px, rayon 4 px, jamais `rounded-full` (DESIGN.md §4, §7). */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control border font-sans font-medium " +
  "transition-colors duration-quick ease-[var(--ease)] disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<Variant, string> = {
  primary: "border-forest bg-forest text-paper hover:bg-forest-deep",
  secondary: "border-forest/30 bg-paper text-forest-deep hover:bg-sand",
  ghost: "border-transparent bg-transparent text-forest-deep hover:bg-sand",
  danger: "border-iucn-cr/40 bg-iucn-cr/10 text-iucn-cr hover:bg-iucn-cr/20",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[44px] px-3 text-sm",
  md: "min-h-[44px] px-4 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return <button ref={ref} className={clsx(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
});

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={clsx(BASE, VARIANTS[variant], SIZES[size], "no-underline", className)} {...props} />;
}
