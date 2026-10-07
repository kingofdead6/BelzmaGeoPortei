import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/render";
import { NouvelleContribution } from "./NouvelleContribution";

/** La mini-carte embarque Leaflet, inexploitable sous jsdom : on la remplace. */
vi.mock("../features/upload/LocationPicker", () => ({
  LocationPicker: ({
    value,
    onChange,
    required,
  }: {
    value: { lat: number; lng: number } | null;
    onChange: (value: { lat: number; lng: number } | null) => void;
    required?: boolean;
  }) => (
    <div data-testid="carte">
      <p>{value ? `${value.lat}, ${value.lng}` : required ? "Point requis" : "Point facultatif"}</p>
      <button type="button" onClick={() => onChange({ lat: 35.5353, lng: 5.9689 })}>
        Simuler un clic sur la carte
      </button>
    </div>
  ),
}));

const createMutation = vi.fn();

vi.mock("../lib/contributions", () => ({
  useCreateContribution: () => ({
    mutateAsync: createMutation,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function jpeg(name = "cedraie.jpg", bytes = 2048): File {
  // Octets magiques JPEG, pour que le contrôle côté client passe.
  const buffer = new Uint8Array(bytes);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return new File([buffer], name, { type: "image/jpeg" });
}

describe("Assistant de dépôt", () => {
  beforeEach(() => {
    createMutation.mockReset();
    createMutation.mockResolvedValue({ id: "6710f0000000000000000001" });
  });

  it("ouvre sur le choix du type, avec l'étape suivante bloquée", () => {
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    expect(screen.getByText("Que souhaitez-vous déposer ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /étape suivante/i })).toBeDisabled();
  });

  it("propose les quatre types de contribution", () => {
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    for (const label of ["Photographie", "Observation d'espèce", "Site patrimonial", "Couche SIG"]) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("débloque l'étape suivante dès qu'un type est choisi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));

    expect(screen.getByRole("button", { name: /étape suivante/i })).toBeEnabled();
  });

  it("exige un fichier et un titre avant la localisation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const next = screen.getByRole("button", { name: /étape suivante/i });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText(/^Titre/), "Cédraie de Tichaou sous la neige");
    // Le titre seul ne suffit pas : la photographie est obligatoire.
    expect(next).toBeDisabled();
  });

  it("annonce le retrait des métadonnées EXIF sur une photographie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    expect(screen.getByText(/métadonnées EXIF.*retirées avant/is)).toBeInTheDocument();
  });

  it("refuse un fichier qui n'est pas une image, avec un message explicite", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    // Le champ porte un attribut `accept` que `user.upload` applique comme le
    // ferait le navigateur : on déclenche l'événement directement pour
    // éprouver la validation du composant, que le serveur refait de son côté.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["PK"], "couche.zip", { type: "application/zip" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/n'est pas une image JPEG, PNG ou WebP/);
  });

  it("chiffre la limite dépassée quand l'image est trop lourde", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg("enorme.jpg", 11 * 1024 * 1024));

    expect(screen.getByRole("alert")).toHaveTextContent(/la limite est de 10 Mo/);
  });

  it("demande la détermination de l'espèce pour une observation", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Observation d'espèce/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg());
    await user.type(screen.getByLabelText(/^Titre/), "Aigle royal au-dessus de Bouilef");

    const next = screen.getByRole("button", { name: /étape suivante/i });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText(/Nom scientifique/), "Aquila chrysaetos");
    expect(next).toBeEnabled();
  });

  it("impose une localisation à un site patrimonial", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NouvelleContribution />, { route: "/mon-espace/nouveau" });

    await user.click(screen.getByRole("radio", { name: /Site patrimonial/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    await user.type(screen.getByLabelText(/^Titre/), "Grotte de Bouilef");
    await user.selectOptions(screen.getByLabelText(/Catégorie du site/), "Archéologique");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    expect(screen.getByText("Point requis")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Enregistrer et demander la publication/ }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Simuler un clic sur la carte/ }));
    expect(
      screen.getByRole("button", { name: /Enregistrer et demander la publication/ }),
    ).toBeEnabled();
  });

  it("pré-remplit les coordonnées venues de la carte du géoportail", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau?lng=6.0091&lat=35.5931",
    });

    await user.click(screen.getByRole("radio", { name: /Site patrimonial/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));
    await user.type(screen.getByLabelText(/^Titre/), "Source de Bordjem");
    await user.selectOptions(screen.getByLabelText(/Catégorie du site/), "Naturel");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    expect(screen.getByText("35.5931, 6.0091")).toBeInTheDocument();
  });

  it("enregistre en privé sans demander la publication", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg());
    await user.type(screen.getByLabelText(/^Titre/), "Cédraie de Tichaou sous la neige");
    await user.type(screen.getByLabelText(/Étiquettes/), "cédraie, tichaou, hiver");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));
    await user.click(screen.getByRole("button", { name: /^Enregistrer en privé$/ }));

    await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
    expect(createMutation.mock.calls[0]?.[0]).toMatchObject({
      kind: "photo",
      title: "Cédraie de Tichaou sous la neige",
      tags: ["cédraie", "tichaou", "hiver"],
      requestPublication: false,
    });
  });

  it("enregistre et demande la publication", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg());
    await user.type(screen.getByLabelText(/^Titre/), "Falaises de Tarbaat");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));
    await user.click(
      screen.getByRole("button", { name: /Enregistrer et demander la publication/ }),
    );

    await waitFor(() => expect(createMutation).toHaveBeenCalledTimes(1));
    expect(createMutation.mock.calls[0]?.[0]).toMatchObject({ requestPublication: true });
  });

  it("récapitule le dépôt avec sa puce de provenance", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg("tichaou.jpg"));
    await user.type(screen.getByLabelText(/^Titre/), "Cédraie de Tichaou");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const summary = screen.getByText("Récapitulatif").closest("section") as HTMLElement;
    expect(within(summary).getByText("tichaou.jpg")).toBeInTheDocument();
    expect(within(summary).getByText("CONTRIBUTION")).toBeInTheDocument();
    expect(within(summary).getByText("Non localisée")).toBeInTheDocument();
  });

  it("permet de revenir en arrière sans perdre la saisie", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<NouvelleContribution />, {
      route: "/mon-espace/nouveau",
    });

    await user.click(screen.getByRole("radio", { name: /Photographie/ }));
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, jpeg());
    await user.type(screen.getByLabelText(/^Titre/), "Pelouses de Bordjem");
    await user.click(screen.getByRole("button", { name: /étape suivante/i }));
    await user.click(screen.getByRole("button", { name: /étape précédente/i }));

    expect(screen.getByLabelText(/^Titre/)).toHaveValue("Pelouses de Bordjem");
  });
});
