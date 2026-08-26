import axios from "axios";
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import type { ApiErrorBody, ApiErrorCode } from "@belezma/shared";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

/**
 * Le jeton d'accès vit en mémoire, jamais dans `localStorage` : une faille XSS
 * ne doit pas pouvoir l'exfiltrer (§6).
 */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

export const api = axios.create({
  baseURL: BASE_URL,
  // Indispensable pour que le cookie de rafraîchissement circule.
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** Erreur normalisée exposée aux composants. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode | "NETWORK_ERROR";
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: ApiErrorCode | "NETWORK_ERROR", status: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

/** Une seule tentative de rafraîchissement à la fois, partagée par les requêtes concurrentes. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= axios
    .post<{ data: { accessToken: string } }>(`${BASE_URL}/auth/refresh`, null, {
      withCredentials: true,
    })
    .then((response) => {
      const token = response.data.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;

    // Sur 401 : une tentative de rafraîchissement, puis rejeu de la requête (§6).
    const isRefreshCall = config?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && config && !config._retried && !isRefreshCall) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return api.request(config);
      }
      onSessionLost?.();
    }

    if (!error.response) {
      throw new ApiRequestError(
        "Le serveur est injoignable. Vérifiez votre connexion, puis réessayez.",
        "NETWORK_ERROR",
        0,
      );
    }

    const body = error.response.data;
    throw new ApiRequestError(
      body?.error?.message ?? "Une erreur inattendue est survenue.",
      body?.error?.code ?? "INTERNAL_ERROR",
      error.response.status,
      body?.error?.details,
    );
  },
);

/** Extrait `data` de l'enveloppe de réponse. */
export async function fetchData<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<{ data: T }>(url, config);
  return response.data.data;
}

/** Extrait `data` et `meta` — pour les listes paginées. */
export async function fetchPage<T, M>(url: string, config?: AxiosRequestConfig): Promise<{ data: T; meta: M }> {
  const response = await api.get<{ data: T; meta: M }>(url, config);
  return { data: response.data.data, meta: response.data.meta };
}
