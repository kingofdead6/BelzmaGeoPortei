import { describe, expect, it } from "vitest";
import { VISIBILITIES, VISIBILITY_TRANSITIONS, type Visibility } from "@belezma/shared";
import {
  assertTransition,
  canTransition,
  VISIBILITY_LABELS,
} from "../src/services/contribution-lifecycle.js";
import { ApiError } from "../src/utils/errors.js";

/** Ces contrôles portent sur la machine à états seule, sans base. */
describe("Cycle de vie d'une contribution", () => {
  it("nomme les quatre états en français", () => {
    expect(VISIBILITY_LABELS).toEqual({
      private: "Privé",
      pending: "En attente de validation",
      public: "Publié",
      rejected: "Refusé",
    });
    expect(Object.keys(VISIBILITY_LABELS).sort()).toEqual([...VISIBILITIES].sort());
  });

  it("n'autorise le passage au public que depuis la file de validation", () => {
    expect(canTransition("pending", "public")).toBe(true);
    // Une contribution ne peut jamais être publiée sans relecture (§8).
    expect(canTransition("private", "public")).toBe(false);
    expect(canTransition("rejected", "public")).toBe(false);
  });

  it("permet de demander la publication depuis chaque état non publié", () => {
    expect(canTransition("private", "pending")).toBe(true);
    expect(canTransition("rejected", "pending")).toBe(true);
    expect(canTransition("public", "pending")).toBe(true);
  });

  it("permet de repasser en privé depuis n'importe quel état", () => {
    for (const from of ["pending", "public", "rejected"] as Visibility[]) {
      expect(canTransition(from, "private")).toBe(true);
    }
  });

  it("réserve le refus à la file de validation", () => {
    expect(canTransition("pending", "rejected")).toBe(true);
    expect(canTransition("private", "rejected")).toBe(false);
    expect(canTransition("public", "rejected")).toBe(false);
  });

  it("refuse une transition vers l'état courant en le nommant", () => {
    try {
      assertTransition("public", "public");
      expect.unreachable("la transition vers soi-même doit être refusée");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).message).toContain("déjà « publié »");
    }
  });

  it("refuse une transition interdite en nommant les deux états", () => {
    try {
      assertTransition("private", "public");
      expect.unreachable("privé → publié doit être refusé");
    } catch (error) {
      const message = (error as ApiError).message;
      expect(message).toContain("privé");
      expect(message).toContain("publié");
    }
  });

  it("ne déclare aucune transition sortant de soi-même", () => {
    for (const [from, targets] of Object.entries(VISIBILITY_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });

  it("rend chaque état atteignable depuis l'état initial", () => {
    // Parcours en largeur depuis « privé », l'état de création.
    const seen = new Set<Visibility>(["private"]);
    const queue: Visibility[] = ["private"];
    while (queue.length > 0) {
      const current = queue.shift() as Visibility;
      for (const next of VISIBILITY_TRANSITIONS[current] as readonly Visibility[]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...VISIBILITIES].sort());
  });
});
