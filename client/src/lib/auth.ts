import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  SessionUser,
  UpdateProfileInput,
} from "@belezma/shared";
import { api, setAccessToken } from "./api";
import { useAuthStore } from "../stores/auth-store";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.post<{ data: T }>(url, body ?? {});
  return response.data.data;
}

/**
 * Rétablit la session au chargement de l'application, à partir du seul cookie
 * de rafraîchissement : aucun jeton n'est conservé dans `localStorage` (§6).
 */
export async function restoreSession(): Promise<SessionUser | null> {
  const store = useAuthStore.getState();
  try {
    const session = await post<AuthResponse>("/auth/refresh");
    store.setSession(session.user, session.accessToken);
    return session.user;
  } catch {
    store.clearSession();
    return null;
  }
}

export function useLogin(): UseMutationResult<AuthResponse, unknown, LoginInput> {
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => post<AuthResponse>("/auth/login", input),
    onSuccess: (session) => {
      setSession(session.user, session.accessToken);
      // Les listes dépendent du compte : on repart d'un cache propre.
      void queryClient.invalidateQueries();
    },
  });
}

export function useRegister(): UseMutationResult<AuthResponse, unknown, RegisterInput> {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: RegisterInput) => post<AuthResponse>("/auth/register", input),
    onSuccess: (session) => setSession(session.user, session.accessToken),
  });
}

export function useLogout(): UseMutationResult<unknown, unknown, void> {
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => post("/auth/logout"),
    onSettled: () => {
      // La session est abandonnée côté client même si l'appel échoue.
      clearSession();
      setAccessToken(null);
      queryClient.clear();
    },
  });
}

export function useForgotPassword(): UseMutationResult<{ message: string }, unknown, { email: string }> {
  return useMutation({
    mutationFn: (input) => post<{ message: string }>("/auth/forgot-password", input),
  });
}

export function useResetPassword(): UseMutationResult<
  { message: string },
  unknown,
  { token: string; password: string }
> {
  return useMutation({
    mutationFn: (input) => post<{ message: string }>("/auth/reset-password", input),
  });
}

export function useUpdateProfile(): UseMutationResult<SessionUser, unknown, UpdateProfileInput> {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const response = await api.patch<{ data: SessionUser }>("/users/me", input);
      return response.data.data;
    },
    // Seul le profil change : le jeton d'accès en cours reste valable.
    onSuccess: (user) => setUser(user),
  });
}

export function useUploadAvatar(): UseMutationResult<SessionUser, unknown, File> {
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const response = await api.post<{ data: SessionUser }>("/users/me/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.data;
    },
    onSuccess: (user) => setUser(user),
  });
}
