import { describe, expect, it } from "vitest";
import { IUCN_COLORS, IUCN_STATUSES, IUCN_TEXT_COLORS } from "@belezma/shared";

/**
 * Contrôle automatique des contrastes WCAG sur les paires de la palette
 * (DESIGN.md §2). Ces mesures ont été vérifiées plutôt que supposées : elles
 * ont révélé que `gold` sur `paper` ne tient que 2,80:1 — en deçà même du
 * seuil des grands corps — et que cinq des six pastilles UICN du prototype
 * échouaient sur leur propre fond.
 */

const PALETTE = {
  "forest-deep": "#16332A",
  forest: "#2D6A4F",
  "forest-light": "#74A78E",
  earth: "#8A5A34",
  sand: "#F1EAD9",
  paper: "#FBF9F4",
  gold: "#B8912C",
  ink: "#1E2620",
} as const;

type Channels = [number, number, number];

function channels(hex: string): Channels {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255) as Channels;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as Channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composition d'une couleur semi-transparente sur un fond opaque. */
function composite(foreground: string, background: string, alpha: number): string {
  const front = channels(foreground);
  const back = channels(background);
  return `#${front
    .map((channel, index) =>
      Math.round((channel * alpha + (back[index] as number) * (1 - alpha)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Opacité du fond des pastilles : `22` en hexadécimal, soit 13,3 %. */
const BADGE_ALPHA = 0x22 / 0xff;

describe("Contraste des paires employées pour du texte", () => {
  const AA = 4.5;

  it.each([
    ["ink", "paper"],
    ["ink", "sand"],
    ["forest", "paper"],
    ["forest", "sand"],
    ["earth", "paper"],
    ["earth", "sand"],
    ["forest-deep", "sand"],
  ] as const)("%s sur %s atteint AA", (foreground, background) => {
    expect(contrastRatio(PALETTE[foreground], PALETTE[background])).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["paper", "forest-deep"],
    ["forest-light", "forest-deep"],
    ["gold", "forest-deep"],
  ] as const)("%s sur %s atteint AA", (foreground, background) => {
    expect(contrastRatio(PALETTE[foreground], PALETTE[background])).toBeGreaterThanOrEqual(AA);
  });

  it("confirme que `gold` ne peut porter aucun texte sur fond clair", () => {
    // 2,80:1 sur paper, 2,46:1 sur sand : même le seuil des grands corps (3:1)
    // n'est pas atteint. `gold` ne sert donc qu'aux aplats et aux filets, et
    // `earth` prend le relais pour le texte d'accent.
    expect(contrastRatio(PALETTE.gold, PALETTE.paper)).toBeLessThan(3);
    expect(contrastRatio(PALETTE.gold, PALETTE.sand)).toBeLessThan(3);
    expect(contrastRatio(PALETTE.earth, PALETTE.paper)).toBeGreaterThanOrEqual(AA);
  });
});

describe("Contraste des pastilles UICN", () => {
  it.each(IUCN_STATUSES)("le texte de %s atteint AA sur son fond, sur paper", (status) => {
    const background = composite(IUCN_COLORS[status], PALETTE.paper, BADGE_ALPHA);
    expect(contrastRatio(IUCN_TEXT_COLORS[status], background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(IUCN_STATUSES)("le texte de %s atteint AA sur son fond, sur sand", (status) => {
    const background = composite(IUCN_COLORS[status], PALETTE.sand, BADGE_ALPHA);
    expect(contrastRatio(IUCN_TEXT_COLORS[status], background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(IUCN_STATUSES)("la bordure de %s atteint le seuil des composants", (status) => {
    // WCAG 1.4.11 : 3:1 suffit pour un élément d'interface non textuel.
    expect(contrastRatio(IUCN_TEXT_COLORS[status], PALETTE.paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(IUCN_TEXT_COLORS[status], PALETTE.sand)).toBeGreaterThanOrEqual(3);
  });

  it("conserve la teinte de chaque catégorie", () => {
    // La variante assombrie ne doit pas virer : le canal dominant de la
    // couleur canonique reste dominant.
    for (const status of IUCN_STATUSES) {
      const base = channels(IUCN_COLORS[status]);
      const text = channels(IUCN_TEXT_COLORS[status]);
      const dominant = base.indexOf(Math.max(...base));
      expect(text.indexOf(Math.max(...text)), status).toBe(dominant);
    }
  });

  it("couvre les six catégories de la Liste rouge", () => {
    expect(Object.keys(IUCN_TEXT_COLORS).sort()).toEqual([...IUCN_STATUSES].sort());
  });
});
