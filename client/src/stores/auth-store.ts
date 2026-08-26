import { create } from "zustand";
import type { SessionUser, UserRole } from "@belezma/shared";
import { setAccessToken } from "../lib/api";

interface AuthState {
  user: SessionUser | null;
  /** `true` tant que la session n'a pas été rétablie au chargement. */
  restoring: boolean;
  setSession: (user: SessionUser, accessToken: string) => void;
  /** Rafraîchit le profil sans toucher au jeton d'accès en cours. */
  setUser: (user: SessionUser) => void;
  clearSession: () => void;
  setRestoring: (restoring: boolean) => void;
  hasRole: (minimum: UserRole) => boolean;
}

const ROLE_RANK: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  restoring: true,

  setSession: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, restoring: false });
  },

  setUser: (user) => set({ user }),

  clearSession: () => {
    setAccessToken(null);
    set({ user: null, restoring: false });
  },

  setRestoring: (restoring) => set({ restoring }),

  /**
   * Confort d'affichage seulement. L'autorisation réelle est refaite par le
   * serveur sur chaque route : masquer un bouton ne protège rien (§6).
   */
  hasRole: (minimum) => {
    const { user } = get();
    return user ? ROLE_RANK[user.role] >= ROLE_RANK[minimum] : false;
  },
}));
