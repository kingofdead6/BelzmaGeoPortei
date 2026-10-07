import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  AdminStats,
  Contribution,
  ContributionKind,
  FeatureCollection,
  ModerationLogEntry,
  ModerationAction,
  PageMeta,
  PublicUser,
  Report,
  UserRole,
  UserStatus,
} from "@belezma/shared";
import { api, fetchData, fetchPage } from "./api";

/** Un élément de la file porte le droit du relecteur à statuer dessus (§8). */
export type QueueItem = Contribution & { reviewableByViewer: boolean };

export function useModerationQueue(params: {
  kind?: ContributionKind;
  sort?: "oldest" | "recent";
  page?: number;
}): UseQueryResult<{ data: QueueItem[]; meta: PageMeta }> {
  return useQuery({
    queryKey: ["moderation", "queue", params],
    queryFn: () =>
      fetchPage<QueueItem[], PageMeta>("/moderation/queue", { params: clean(params) }),
    placeholderData: (previous) => previous,
    // La file bouge sous plusieurs relecteurs : on ne la garde pas longtemps.
    staleTime: 15_000,
  });
}

/** Géométrie d'une couche en attente — réservée aux relecteurs. */
export function usePendingGeojson(
  id: string | null,
  enabled: boolean,
): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: ["moderation", id, "geojson"],
    queryFn: () => fetchData<FeatureCollection>(`/moderation/${id}/geojson`),
    enabled: Boolean(id) && enabled,
    staleTime: Infinity,
  });
}

function useQueueInvalidation(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["moderation"] });
    void queryClient.invalidateQueries({ queryKey: ["contributions"] });
    void queryClient.invalidateQueries({ queryKey: ["map-features"] });
    void queryClient.invalidateQueries({ queryKey: ["layers", "contributed"] });
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
}

export type ReviewDecision =
  | { id: string; action: "approve" }
  | { id: string; action: "reject" | "unpublish"; reason: string };

export function useReview(): UseMutationResult<
  { data: Contribution; meta?: { message?: string } },
  unknown,
  ReviewDecision
> {
  const invalidate = useQueueInvalidation();

  return useMutation({
    mutationFn: async (decision) => {
      const body = decision.action === "approve" ? undefined : { reason: decision.reason };
      const response = await api.post<{ data: Contribution; meta?: { message?: string } }>(
        `/moderation/${decision.id}/${decision.action}`,
        body,
      );
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useReports(status: "open" | "closed" = "open"): UseQueryResult<{
  data: Report[];
  meta: PageMeta;
}> {
  return useQuery({
    queryKey: ["moderation", "reports", status],
    queryFn: () => fetchPage<Report[], PageMeta>("/moderation/reports", { params: { status } }),
  });
}

export function useCloseReport(): UseMutationResult<unknown, unknown, { id: string; note?: string }> {
  const invalidate = useQueueInvalidation();

  return useMutation({
    mutationFn: ({ id, note }) =>
      api.post(`/moderation/reports/${id}/close`, note ? { note } : {}),
    onSuccess: invalidate,
  });
}

export function useModerationLog(params: {
  action?: ModerationAction;
  page?: number;
}): UseQueryResult<{ data: ModerationLogEntry[]; meta: PageMeta }> {
  return useQuery({
    queryKey: ["moderation", "log", params],
    queryFn: () =>
      fetchPage<ModerationLogEntry[], PageMeta>("/moderation/log", { params: clean(params) }),
    placeholderData: (previous) => previous,
  });
}

/* --- Administration ---------------------------------------------------- */

export type AdminUser = PublicUser & { email: string; status: UserStatus };

export function useAdminUsers(params: {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
}): UseQueryResult<{ data: AdminUser[]; meta: PageMeta }> {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => fetchPage<AdminUser[], PageMeta>("/admin/users", { params: clean(params) }),
    placeholderData: (previous) => previous,
  });
}

export function useAdminStats(): UseQueryResult<AdminStats> {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchData<AdminStats>("/admin/stats"),
  });
}

export function useChangeRole(): UseMutationResult<
  AdminUser,
  unknown,
  { id: string; role: UserRole }
> {
  const invalidate = useQueueInvalidation();

  return useMutation({
    mutationFn: async ({ id, role }) => {
      const response = await api.patch<{ data: AdminUser }>(`/admin/users/${id}/role`, { role });
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useChangeStatus(): UseMutationResult<
  AdminUser,
  unknown,
  { id: string; status: UserStatus; reason?: string }
> {
  const invalidate = useQueueInvalidation();

  return useMutation({
    mutationFn: async ({ id, status, reason }) => {
      const response = await api.patch<{ data: AdminUser }>(`/admin/users/${id}/status`, {
        status,
        ...(reason ? { reason } : {}),
      });
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteOfficialLayer(): UseMutationResult<unknown, unknown, string> {
  const invalidate = useQueueInvalidation();

  return useMutation({
    mutationFn: (layerId: string) => api.delete(`/admin/layers/${layerId}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateOfficialLayer(): UseMutationResult<
  unknown,
  unknown,
  { layerId: string; changes: Record<string, unknown> }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ layerId, changes }) => api.patch(`/admin/layers/${layerId}`, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["layers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

function clean<T extends Record<string, unknown>>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<T>;
}
