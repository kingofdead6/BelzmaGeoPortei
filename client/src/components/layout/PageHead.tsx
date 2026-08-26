import { useEffect } from "react";

const SUFFIX = "Géoportail du Parc National de Belezma";

/**
 * Renseigne le titre du document et la méta-description. Léger et suffisant
 * pour une application de cette taille — pas de dépendance supplémentaire.
 */
export function PageHead({ title, description }: { title?: string; description?: string }) {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
  }, [title]);

  useEffect(() => {
    if (!description) return;
    const tag = document.querySelector('meta[name="description"]');
    const previous = tag?.getAttribute("content") ?? null;
    tag?.setAttribute("content", description);
    return () => {
      if (previous !== null) tag?.setAttribute("content", previous);
    };
  }, [description]);

  return null;
}
