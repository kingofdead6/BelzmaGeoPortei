import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom n'implémente ni matchMedia ni ResizeObserver, sur lesquels s'appuient
// les requêtes de préférence de mouvement et Leaflet.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// jsdom n'implémente pas l'API des URL d'objets, dont dépend l'aperçu local
// des photographies avant envoi.
globalThis.URL.createObjectURL ??= () => "blob:apercu-de-test";
globalThis.URL.revokeObjectURL ??= () => undefined;

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;
