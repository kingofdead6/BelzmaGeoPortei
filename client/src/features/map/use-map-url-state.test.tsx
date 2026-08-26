import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { PARK_CENTER, PARK_DEFAULT_ZOOM } from "@belezma/shared";
import { useMapStore } from "../../stores/map-store";
import { useMapUrlState } from "./use-map-url-state";

/** Composant sonde : applique le hook et expose l'URL courante. */
function Probe() {
  useMapUrlState();
  const location = useLocation();
  return <output data-testid="url">{`${location.pathname}${location.search}`}</output>;
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Probe />
    </MemoryRouter>,
  );
}

describe("Partage de la vue par l'URL", () => {
  beforeEach(() => {
    useMapStore.setState({
      center: [PARK_CENTER[0], PARK_CENTER[1]],
      zoom: PARK_DEFAULT_ZOOM,
      basemap: "osm",
      activeLayers: [],
    });
  });

  it("restaure le centre, le zoom, le fond et les couches depuis l'URL", () => {
    renderAt("/geoportail?lat=35.5931&lng=6.0091&z=14&fond=topo&couches=boundary,cedraie");

    const state = useMapStore.getState();
    expect(state.center[0]).toBeCloseTo(35.5931, 4);
    expect(state.center[1]).toBeCloseTo(6.0091, 4);
    expect(state.zoom).toBe(14);
    expect(state.basemap).toBe("topo");
    expect(state.activeLayers).toEqual(["boundary", "cedraie"]);
  });

  it("écrit l'état de la carte dans l'URL, prêt à être copié", () => {
    renderAt("/geoportail");

    const url = screen.getByTestId("url").textContent ?? "";
    expect(url).toContain("lat=35.61000");
    expect(url).toContain("lng=6.05000");
    expect(url).toContain(`z=${PARK_DEFAULT_ZOOM}`);
    expect(url).toContain("fond=osm");
  });

  it("ignore un fond de carte inconnu plutôt que de rompre l'affichage", () => {
    renderAt("/geoportail?fond=inexistant");

    expect(useMapStore.getState().basemap).toBe("osm");
  });

  it("respecte une liste de couches vide transmise explicitement", () => {
    useMapStore.setState({ activeLayers: ["boundary"] });
    renderAt("/geoportail?couches=");

    // `couches=` distingue « aucune couche » de « paramètre absent » : sans
    // cela, les couches visibles par défaut se réactiveraient au partage.
    expect(useMapStore.getState().activeLayers).toEqual([]);
  });

  it("ignore des coordonnées non numériques", () => {
    renderAt("/geoportail?lat=nord&lng=est");

    expect(useMapStore.getState().center[0]).toBeCloseTo(PARK_CENTER[0], 4);
  });
});
