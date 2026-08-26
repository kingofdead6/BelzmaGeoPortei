import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContributedLayer, OfficialLayer } from "@belezma/shared";
import { renderWithProviders } from "../../test/render";
import { useMapStore } from "../../stores/map-store";
import { LayerCatalog } from "./LayerCatalog";

const officialLayers: OfficialLayer[] = [
  layer({ layerId: "boundary", name: "Limite du parc", group: "Limites", featureCount: 1, defaultVisible: true }),
  layer({ layerId: "cedraie", name: "Cédraie", group: "Végétation", featureCount: 64, color: "#1B4332" }),
  layer({ layerId: "chenaie", name: "Chênaie verte", group: "Végétation", featureCount: 419, color: "#4C7A3D" }),
  layer({ layerId: "routes", name: "Routes et pistes", group: "Infrastructures", featureCount: 193, type: "line" }),
];

const contributedLayers: ContributedLayer[] = [
  {
    layerId: "contribution:6710f0000000000000000001",
    contributionId: "6710f0000000000000000001",
    name: "Postes de vigie — relevé GPS de terrain",
    group: "Contributions",
    type: "point",
    color: "#B8912C",
    fillOpacity: 0.4,
    weight: 2,
    defaultVisible: false,
    official: false,
    featureCount: 3,
    bbox: [5.99, 35.58, 6.19, 35.6],
    owner: { id: "u1", displayName: "Karim Lounis" },
    publishedAt: "2026-02-15T10:00:00.000Z",
  },
];

const idleINaturalist = { status: "idle" as const, count: 0 };

function renderCatalog(overrides: Partial<Parameters<typeof LayerCatalog>[0]> = {}) {
  return renderWithProviders(
    <LayerCatalog
      official={officialLayers}
      contributed={contributedLayers}
      loading={false}
      inaturalistState={idleINaturalist}
      onRetryINaturalist={() => {}}
      {...overrides}
    />,
  );
}

describe("Catalogue des couches", () => {
  beforeEach(() => {
    useMapStore.setState({ activeLayers: [], highlightedLayer: null });
  });

  it("regroupe les couches par catégorie SIG, dans l'ordre du catalogue", () => {
    renderCatalog();

    const groups = screen.getAllByRole("button", { expanded: true }).map((button) => button.textContent);

    expect(groups[0]).toContain("Limites");
    expect(groups.some((label) => label?.includes("Végétation"))).toBe(true);
    expect(groups.some((label) => label?.includes("Contributions"))).toBe(true);
  });

  it("affiche le nombre d'entités de chaque couche en chiffres", () => {
    renderCatalog();

    // 419 entités pour la chênaie — mise en forme française.
    expect(screen.getByText(/419 ent\./)).toBeInTheDocument();
    expect(screen.getByText(/64 ent\./)).toBeInTheDocument();
  });

  it("distingue la provenance officielle de la contribution", () => {
    renderCatalog();

    expect(screen.getAllByTitle(/shapefiles et KMZ officiels/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/déposée par un contributeur/i).length).toBeGreaterThan(0);
  });

  it("nomme le contributeur d'une couche déposée", () => {
    renderCatalog();

    expect(screen.getByText("Déposée par Karim Lounis")).toBeInTheDocument();
  });

  it("active et désactive une couche par sa case à cocher", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const checkbox = screen.getByRole("checkbox", { name: /Cédraie/ });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(useMapStore.getState().activeLayers).toContain("cedraie");

    await user.click(checkbox);
    expect(useMapStore.getState().activeLayers).not.toContain("cedraie");
  });

  it("filtre le catalogue par la recherche", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByRole("searchbox", { name: /rechercher une couche/i }), "chên");

    expect(screen.getByRole("checkbox", { name: /Chênaie verte/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Routes et pistes/ })).not.toBeInTheDocument();
  });

  it("propose une piste concrète quand la recherche ne donne rien", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByRole("searchbox", { name: /rechercher une couche/i }), "zzzz");

    expect(screen.getByText(/Essayez « cédraie », « piste » ou « zone »/)).toBeInTheDocument();
  });

  it("replie et déplie un groupe", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const vegetation = screen.getByRole("button", { name: /Végétation/ });
    expect(screen.getByRole("checkbox", { name: /Cédraie/ })).toBeInTheDocument();

    await user.click(vegetation);
    expect(vegetation).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: /Cédraie/ })).not.toBeInTheDocument();

    await user.click(vegetation);
    expect(screen.getByRole("checkbox", { name: /Cédraie/ })).toBeInTheDocument();
  });

  it("compte les couches actives", () => {
    useMapStore.setState({ activeLayers: ["boundary", "cedraie"] });
    renderCatalog();

    expect(screen.getByText(/2 actives sur/)).toBeInTheDocument();
  });

  it("explique l'échec d'iNaturalist et propose de réessayer", async () => {
    const user = userEvent.setup();
    let retried = false;
    useMapStore.setState({ activeLayers: ["inaturalist"] });

    renderCatalog({
      inaturalistState: {
        status: "error",
        count: 0,
        message: "iNaturalist n'a pas répondu. Vérifiez votre connexion, puis réessayez.",
      },
      onRetryINaturalist: () => {
        retried = true;
      },
    });

    expect(screen.getByText(/iNaturalist n'a pas répondu/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /réessayer/i }));
    expect(retried).toBe(true);
  });

  it("annonce le nombre d'observations une fois iNaturalist chargé", () => {
    useMapStore.setState({ activeLayers: ["inaturalist"] });
    renderCatalog({ inaturalistState: { status: "ready", count: 187 } });

    const row = screen.getByRole("checkbox", { name: /Observations iNaturalist/ }).closest("label");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("187")).toBeInTheDocument();
  });
});

function layer(overrides: Partial<OfficialLayer>): OfficialLayer {
  return {
    layerId: "layer",
    name: "Couche",
    group: "Limites",
    type: "polygon",
    color: "#16332A",
    fillOpacity: 0.1,
    weight: 2,
    defaultVisible: false,
    official: true,
    order: 10,
    featureCount: 0,
    bbox: null,
    source: "Shapefiles officiels",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}
