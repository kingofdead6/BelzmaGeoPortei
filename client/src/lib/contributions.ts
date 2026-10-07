import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Contribution, ContributionKind, PageMeta, Visibility } from "@belezma/shared";
import { api, fetchPage } from "./api";
import { queryKeys } from "./query-client";

export interface MineQuery extends Record<string, unknown> {
  kind?: ContributionKind;
  visibility?: Visibility;
  page?: number;
  limit?: number;
}

export interface MineMeta extends PageMeta {
  counts: Partial<Record<Visibility, number>>;
}

export function useMyContributions(
  params: MineQuery,
): UseQueryResult<{ data: Contribution[]; meta: MineMeta }> {
  return useQuery({
    queryKey: queryKeys.myContributions(params),
    queryFn: () =>
      fetchPage<Contribution[], MineMeta>("/contributions/mine", {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
        ),
      }),
    placeholderData: (previous) => previous,
  });
}

/** Invalide tout ce qui dépend des contributions après une écriture. */
function useContributionInvalidation(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["contributions"] });
    void queryClient.invalidateQueries({ queryKey: ["map-features"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.contributedLayers });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

export interface CreateContributionPayload {
  kind: ContributionKind;
  title: string;
  description?: string;
  tags?: string[];
  lng?: number;
  lat?: number;
  species?: { scientificName: string; commonName?: string; iucnStatus?: string; group?: string };
  heritageCategory?: string;
  requestPublication: boolean;
  file?: File | null;
  onProgress?: (percent: number) => void;
}

export function useCreateContribution(): UseMutationResult<
  Contribution,
  unknown,
  CreateContributionPayload
> {
  const invalidate = useContributionInvalidation();

  return useMutation({
    mutationFn: async ({ onProgress, ...payload }) => {
      const form = new FormData();
      form.append("kind", payload.kind);
      form.append("title", payload.title);
      form.append("requestPublication", String(payload.requestPublication));

      if (payload.description) form.append("description", payload.description);
      if (payload.tags?.length) form.append("tags", payload.tags.join(","));
      if (payload.lng !== undefined) form.append("lng", String(payload.lng));
      if (payload.lat !== undefined) form.append("lat", String(payload.lat));
      if (payload.species) form.append("species", JSON.stringify(payload.species));
      if (payload.heritageCategory) form.append("heritageCategory", payload.heritageCategory);
      if (payload.file) form.append("file", payload.file);

      const response = await api.post<{ data: Contribution }>("/contributions", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
        },
      });
      return response.data.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateContribution(): UseMutationResult<
  { data: Contribution; meta: { returnedToReview: boolean; message?: string } },
  unknown,
  { id: string; changes: Record<string, unknown> }
> {
  const invalidate = useContributionInvalidation();

  return useMutation({
    mutationFn: async ({ id, changes }) => {
      const response = await api.patch<{
        data: Contribution;
        meta: { returnedToReview: boolean; message?: string };
      }>(`/contributions/${id}`, changes);
      return response.data;
    },
    onSuccess: invalidate,
  });
}

/** `share` demande la publication, `unshare` remet la contribution en privé. */
export function useVisibilityAction(): UseMutationResult<
  { data: Contribution; meta?: { message?: string } },
  unknown,
  { id: string; action: "share" | "unshare" }
> {
  const invalidate = useContributionInvalidation();

  return useMutation({
    mutationFn: async ({ id, action }) => {
      const response = await api.post<{ data: Contribution; meta?: { message?: string } }>(
        `/contributions/${id}/${action}`,
      );
      return response.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteContribution(): UseMutationResult<unknown, unknown, string> {
  const invalidate = useContributionInvalidation();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/contributions/${id}`),
    onSuccess: invalidate,
  });
}

export function useReportContribution(): UseMutationResult<
  unknown,
  unknown,
  { id: string; reason: string; note?: string }
> {
  return useMutation({
    mutationFn: ({ id, reason, note }) =>
      api.post(`/contributions/${id}/report`, { reason, ...(note ? { note } : {}) }),
  });
}
