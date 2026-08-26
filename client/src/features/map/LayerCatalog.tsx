import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { CATALOG_GROUPS, type ContributedLayer, type OfficialLayer } from "@belezma/shared";
import { ProvenanceChip } from "../../components/ui/ProvenanceChip";
import { Spinner } from "../../components/ui/Spinner";
import { useMapStore } from "../../stores/map-store";
import { formatNumber } from "../../lib/format";
import { clsx } from "../../lib/clsx";
import { INATURALIST_EXPLORE_URL } from "./use-inaturalist";

export const INATURALIST_LAYER_ID = "inaturalist";
export const CONTRIBUTIONS_LAYER_ID = "contributions-points";

const GROUP_ORDER = new Map(CATALOG_GROUPS.map((group, index) => [group, index]));

export interface CatalogEntry {
  id: string;
  name: string;
  group: string;
  color: string;
  featureCount: number | null;
  provenance: "OFFICIEL" | "CONTRIBUTION" | "iNaturalist" | "DÉMO";
  note?: string;
}

export function LayerCatalog({
  official,
  contributed,
  loading,
  inaturalistState,
  onRetryINaturalist,
}: {
  official: OfficialLayer[] | undefined;
  contributed: ContributedLayer[] | undefined;
  loading: boolean;
  inaturalistState: { status: "idle" | "loading" | "error" | "ready"; count: number; message?: string };
  onRetryINaturalist: () => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const activeLayers = useMapStore((state) => state.activeLayers);
  const toggleLayer = useMapStore((state) => state.toggleLayer);
  const highlighted = useMapStore((state) => state.highlightedLayer);
  const highlightLayer = useMapStore((state) => state.highlightLayer);

  const entries = useMemo<CatalogEntry[]>(() => {
    const list: CatalogEntry[] = (official ?? []).map((layer) => ({
      id: layer.layerId,
      name: layer.name,
      group: layer.group,
      color: layer.color,
      featureCount: layer.featureCount,
      provenance: "OFFICIEL",
    }));

    list.push({
      id: CONTRIBUTIONS_LAYER_ID,
      name: "Contributions du public",
      group: "Contributions",
      color: "#B8912C",
      featureCount: null,
      provenance: "CONTRIBUTION",
      note: "Photographies, observations et sites validés",
    });

    for (const layer of contributed ?? []) {
      list.push({
        id: layer.layerId,
        name: layer.name,
        group: "Contributions",
        color: layer.color,
        featureCount: layer.featureCount,
        provenance: "CONTRIBUTION",
        note: `Déposée par ${layer.owner.displayName}`,
      });
    }

    list.push({
      id: INATURALIST_LAYER_ID,
      name: "Observations iNaturalist",
      group: "Biodiversité",
      color: "#74AC00",
      featureCount: inaturalistState.count || null,
      provenance: "iNaturalist",
      note: "Chargées en direct, non validées par le parc",
    });

    return list;
  }, [official, contributed, inaturalistState.count]);

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching = needle
      ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
      : entries;

    const map = new Map<string, CatalogEntry[]>();
    for (const entry of matching) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }

    return [...map.entries()].sort(
      ([a], [b]) => (GROUP_ORDER.get(a as never) ?? 99) - (GROUP_ORDER.get(b as never) ?? 99),
    );
  }, [entries, search]);

  function toggleGroup(group: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="border-b border-forest-light/25 p-3">
        <label className="relative block">
          <span className="sr-only">Rechercher une couche</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une couche"
            className="min-h-[44px] w-full rounded-control border border-forest-light/40 bg-paper pl-9 pr-3 text-sm placeholder:text-ink/40"
          />
        </label>
        <p className="datum mt-2 text-2xs text-ink/55">
          {formatNumber(activeLayers.length)} active{activeLayers.length > 1 ? "s" : ""} sur{" "}
          {formatNumber(entries.length)}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10 text-forest">
            <Spinner label="Chargement du catalogue" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink/60">
            Aucune couche ne porte ce nom. Essayez « cédraie », « piste » ou « zone ».
          </p>
        ) : (
          grouped.map(([group, groupEntries]) => {
            const isCollapsed = collapsed.has(group) && !search;
            return (
              <section key={group}>
                <h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    aria-expanded={!isCollapsed}
                    className="flex min-h-[44px] w-full items-center gap-1.5 border-b border-forest-light/20 bg-sand/50 px-3 text-left font-mono text-2xs uppercase tracking-[0.1em] text-earth"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {group}
                    <span className="ml-auto text-ink/45">{groupEntries.length}</span>
                  </button>
                </h3>

                {isCollapsed ? null : (
                  <ul>
                    {groupEntries.map((entry) => {
                      const active = activeLayers.includes(entry.id);
                      const isHighlighted = highlighted === entry.id;
                      const isINaturalist = entry.id === INATURALIST_LAYER_ID;

                      return (
                        <li key={entry.id} className="border-b border-forest-light/12">
                          <div
                            className={clsx(
                              "flex items-start gap-2.5 px-3 py-2 transition-colors duration-quick",
                              isHighlighted ? "bg-gold/12" : active ? "bg-forest/6" : "hover:bg-sand/40",
                            )}
                          >
                            <label className="flex min-h-[44px] flex-1 cursor-pointer items-start gap-2.5 py-1">
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleLayer(entry.id)}
                                onFocus={() => highlightLayer(entry.id)}
                                onBlur={() => highlightLayer(null)}
                                className="mt-1 h-4 w-4 shrink-0 rounded-[2px] accent-[#2D6A4F]"
                              />
                              <span
                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[2px] border border-black/15"
                                style={{ backgroundColor: entry.color }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm leading-snug text-ink">{entry.name}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <ProvenanceChip provenance={entry.provenance} />
                                  {entry.featureCount !== null ? (
                                    <span className="datum text-2xs text-ink/50">
                                      {formatNumber(entry.featureCount)} ent.
                                    </span>
                                  ) : null}
                                </span>
                                {entry.note ? (
                                  <span className="mt-1 block text-2xs leading-snug text-ink/55">
                                    {entry.note}
                                  </span>
                                ) : null}

                                {isINaturalist && active ? (
                                  <INaturalistStatus
                                    state={inaturalistState}
                                    onRetry={onRetryINaturalist}
                                  />
                                ) : null}
                              </span>
                            </label>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

/** État de la couche temps réel, affiché dans sa propre ligne (§9). */
function INaturalistStatus({
  state,
  onRetry,
}: {
  state: { status: "idle" | "loading" | "error" | "ready"; count: number; message?: string };
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <span className="mt-1.5 flex items-center gap-1.5 text-2xs text-ink/60">
        <Spinner label="Interrogation d'iNaturalist" />
        Interrogation d'iNaturalist…
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span className="mt-1.5 block rounded-control border border-iucn-cr/30 bg-iucn-cr/5 p-2">
        <span className="flex items-start gap-1.5 text-2xs leading-snug text-ink/80">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-iucn-cr" aria-hidden />
          {state.message ??
            "iNaturalist est injoignable. Les autres couches restent consultables."}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onRetry();
          }}
          className="mt-1.5 flex items-center gap-1 text-2xs text-forest underline-offset-2 hover:underline"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Réessayer
        </button>
      </span>
    );
  }

  if (state.status === "ready") {
    return (
      <span className="mt-1.5 block text-2xs text-ink/60">
        <span className="datum">{formatNumber(state.count)}</span> observations chargées ·{" "}
        <a
          href={INATURALIST_EXPLORE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-forest underline-offset-2 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          explorer sur iNaturalist
        </a>
      </span>
    );
  }

  return null;
}
