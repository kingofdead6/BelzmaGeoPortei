#!/usr/bin/env node
/**
 * Audit d'accessibilité des pages publiques, sur navigateur réel.
 *
 * Contrôle, à 360 px et à 1440 px : l'absence de défilement horizontal, la
 * taille des cibles tactiles, l'alternative textuelle des images, l'unicité du
 * titre de niveau un, le nom accessible des boutons et la langue du document.
 *
 * Usage :
 *   npm run build --workspace @belezma/client
 *   npx vite preview --port 4173   # depuis client/
 *   node scripts/audit-accessibilite.mjs [url] [dossier-captures]
 *
 * Requiert `playwright-core` et un Chromium (variable PLAYWRIGHT_CHROMIUM, ou
 * le chemin par défaut de l'image de développement).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:4173";
const OUT = process.argv[3] ?? "audit-accessibilite";
const CHROMIUM =
  process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["/", "accueil"],
  ["/geoportail", "geoportail"],
  ["/biodiversite", "biodiversite"],
  ["/patrimoine", "patrimoine"],
  ["/galerie", "galerie"],
  ["/a-propos", "a-propos"],
  ["/connexion", "connexion"],
  ["/mon-espace", "mon-espace"],
];

const VIEWPORTS = [
  { name: "360", width: 360, height: 740 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });

const problems = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "fr-FR",
  });

  for (const [path, label] of PAGES) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 160));
    });
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 160)}`));

    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(900);

    // Débordement horizontal : la page ne doit jamais défiler latéralement.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const offenders = [];
      if (doc.scrollWidth > doc.clientWidth + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > doc.clientWidth + 1) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 70),
              right: Math.round(rect.right),
            });
          }
        }
      }
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders: offenders.slice(0, 4) };
    });

    // Cibles tactiles sous 44 px et images sans alternative textuelle.
    const audit = await page.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll('a, button, input:not([type="hidden"]), select, textarea, [role="tab"], [role="menuitem"]')) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width === 0 || style.visibility === "hidden" || style.display === "none") continue;
        // Un élément masqué visuellement (lien d'évitement) n'est pas une
        // cible tant qu'il n'a pas le focus : sa taille au repos ne compte pas.
        if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") continue;
        // Les liens au fil du texte ne sont pas des cibles isolées.
        if (el.tagName === "A" && el.closest("p, li, figcaption, dd")) continue;
        /*
         * Deux emplacements appliquent le minimum de 24 px de WCAG 2.5.8
         * (niveau AA) au lieu de 44 px, faute de place :
         *  — la barre d'état de la carte, haute de 32 px ;
         *  — le crédit cartographique de Leaflet, mention obligatoire posée
         *    dans un coin de la carte, qu'un bouton de 44 px masquerait.
         */
        const reduced =
          el.closest("[data-cible-reduite]") !== null ||
          el.closest(".leaflet-control-attribution") !== null;
        const floor = reduced ? 24 : 44;
        if (rect.height < floor || rect.width < 24) {
          small.push({ text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40), h: Math.round(rect.height), w: Math.round(rect.width) });
        }
      }
      const imagesWithoutAlt = [...document.querySelectorAll("img")].filter((img) => !img.hasAttribute("alt")).length;
      const headings = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => h.tagName);
      const h1Count = headings.filter((tag) => tag === "H1").length;
      const buttonsWithoutName = [...document.querySelectorAll("button")].filter((b) => {
        const rect = b.getBoundingClientRect();
        if (rect.width === 0) return false;
        return !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title");
      }).length;
      const lang = document.documentElement.lang;
      return { small: small.slice(0, 6), smallCount: small.length, imagesWithoutAlt, h1Count, buttonsWithoutName, lang, title: document.title };
    });

    await page.screenshot({ path: `${OUT}/${label}-${viewport.name}.png`, fullPage: viewport.name === "360" });

    const issues = [];
    if (overflow.scrollWidth > overflow.clientWidth + 1) {
      issues.push(`débordement horizontal ${overflow.scrollWidth}>${overflow.clientWidth} ${JSON.stringify(overflow.offenders)}`);
    }
    if (audit.smallCount > 0) issues.push(`${audit.smallCount} cible(s) < 44px ${JSON.stringify(audit.small)}`);
    if (audit.imagesWithoutAlt > 0) issues.push(`${audit.imagesWithoutAlt} image(s) sans alt`);
    if (audit.h1Count !== 1) issues.push(`${audit.h1Count} h1`);
    if (audit.buttonsWithoutName > 0) issues.push(`${audit.buttonsWithoutName} bouton(s) sans nom accessible`);
    if (audit.lang !== "fr") issues.push(`lang="${audit.lang}"`);
    const realErrors = consoleErrors.filter((e) => !/Failed to load resource|net::ERR|net::ERR_|404|503|ERR_CONNECTION/.test(e));
    if (realErrors.length) issues.push(`console: ${realErrors.slice(0, 2).join(" | ")}`);

    console.log(`${viewport.name.padEnd(5)} ${label.padEnd(14)} ${issues.length === 0 ? "conforme" : issues.join("  ||  ")}`);
    if (issues.length) problems.push({ viewport: viewport.name, label, issues });

    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(`\n${problems.length === 0 ? "Aucun manquement relevé." : problems.length + " page(s)/gabarit(s) à corriger."}`);
console.log(`Captures : ${OUT}`);
