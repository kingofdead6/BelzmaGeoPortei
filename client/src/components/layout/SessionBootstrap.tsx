import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { setSessionLostHandler } from "../../lib/api";
import { restoreSession } from "../../lib/auth";
import { useAuthStore } from "../../stores/auth-store";

/**
 * Rétablit la session au démarrage, puis renvoie vers la page de connexion
 * si le rafraîchissement échoue en cours de navigation (§6).
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      clearSession();
      const { pathname, search } = window.location;
      // Un visiteur consultant une page publique n'a pas à être dérangé.
      if (/^\/(mon-espace|moderation|admin)/.test(pathname)) {
        navigate("/connexion", { replace: true, state: { from: pathname + search } });
      }
    });
    return () => setSessionLostHandler(null);
  }, [navigate, clearSession]);

  return <>{children}</>;
}
