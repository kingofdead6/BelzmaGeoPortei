/** Concaténation conditionnelle de classes — évite une dépendance de plus. */
export function clsx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
