# Système de conception — Géoportail du Parc National de Belezma

Ce document fixe les jetons et les règles de mise en page avant l'écriture de
la moindre ligne d'interface. Il prolonge l'identité du prototype ; il ne la
remplace pas.

---

## 1. Élément signature

**La provenance est l'argument du produit, et la carte en est la matière.**
L'interface repose sur deux marqueurs qui se répondent : le *motif de courbes
de niveau* — deux `repeating-radial-gradient` concentriques, hérités du
prototype — posé en texture discrète sur les fonds de section et les états
vides, et la *puce de provenance* (`OFFICIEL`, `DÉMO`, `CONTRIBUTION`,
`iNaturalist`), en capitales mono espacées, qui accompagne **chaque donnée
affichée**, partout : ligne du catalogue, en-tête du panneau d'attributs,
carte de la galerie, ligne de tableau, fiche de contribution. Le lecteur ne
doit jamais avoir à deviner d'où vient un chiffre. Le motif dit « relevé de
terrain » ; la puce dit « et voici qui l'a relevé ». Ensemble, ils font passer
le géoportail d'une application à un document cartographique.

La règle typographique qui porte le reste du caractère : **toute mesure et
tout code sont en IBM Plex Mono** — coordonnées, échelle, EPSG, superficies,
codes UICN, abréviations de rareté, dates, décomptes, identifiants de couche.
Le texte courant ne l'est jamais.

---

## 2. Couleurs

### Palette de base

| Jeton | Valeur | Emploi |
|---|---|---|
| `forest-deep` | `#16332A` | Chrome sombre : en-tête, barre d'état de la carte, pied de page |
| `forest` | `#2D6A4F` | Actions principales, liens, couche active |
| `forest-light` | `#74A78E` | Bordures sur fond sombre, texte secondaire sur `forest-deep` |
| `earth` | `#8A5A34` | Texte d'accent en petit corps, puces de provenance |
| `sand` | `#F1EAD9` | Sections en bandeau, en-têtes de tableau, fond de la carte |
| `paper` | `#FBF9F4` | Fond de contenu |
| `gold` | `#B8912C` | **Un seul accent par écran** — jamais deux |
| `ink` | `#1E2620` | Texte courant |

### Statuts UICN

`CR #B91C1C` · `EN #DC2626` · `VU #EA580C` · `NT #CA8A04` · `LC #16A34A` ·
`DD #6B7280`

Rendus en pastille : fond à 13 % d'opacité, bordure à 40 %, texte à pleine
valeur, libellé en mono. Le code seul ne suffit jamais — un `title` et un
`aria-label` portent l'intitulé complet (« En danger »).

### Contraste — contrôlé, pas supposé

| Paire | Ratio | Verdict |
|---|---|---|
| `ink` sur `paper` | 13,9:1 | AAA |
| `ink` sur `sand` | 12,6:1 | AAA |
| `forest` sur `paper` | 5,9:1 | AA à tout corps |
| `earth` sur `paper` | 5,7:1 | AA à tout corps |
| `gold` sur `paper` | 3,1:1 | **Échoue en dessous de 24 px** |
| `paper` sur `forest-deep` | 14,2:1 | AAA |
| `forest-light` sur `forest-deep` | 6,1:1 | AA |

**Conséquence appliquée partout : `gold` ne sert qu'aux aplats, filets et
titres d'affichage ≥ 24 px. Tout texte d'accent en petit corps est en
`earth`.**

---

## 3. Typographie

| Rôle | Fonte | Emploi |
|---|---|---|
| Affichage | **Fraunces Variable** | Titres de page et de section, chiffres-clés. Avec retenue : jamais plus de deux niveaux visibles à l'écran. |
| Interface | **Public Sans Variable** | Texte courant, libellés, boutons, navigation |
| Données | **IBM Plex Mono** | Mesures et codes — voir la règle du §1 |

Auto-hébergées via `@fontsource-variable/*` ; aucun lien vers un CDN de
fontes en production.

### Échelle — ratio 1,25, interlignage serré

| Jeton | Taille | Interligne | Emploi |
|---|---|---|---|
| `2xs` | 11 px | 16 px | Puces de provenance, mentions légales (`0.04em`) |
| `xs` | 12 px | 18 px | Barre d'état de la carte, notes de tableau |
| `sm` | 13 px | 20 px | Catalogue, cellules de tableau, méta |
| `base` | 15 px | 24 px | Texte courant |
| `lg` | 17 px | 26 px | Chapô |
| `xl` | 20 px | 28 px | Titre de panneau |
| `2xl` | 24 px | 30 px | Sous-titre de section |
| `3xl` | 30 px | 35 px | Titre de section |
| `4xl` | 38 px | 42 px | Titre de page |
| `5xl` | 50 px | 53 px | Héros seulement |

---

## 4. Espacement, rayons, ombres, mouvement

**Espacement** — pas de 4 px : `1 2 3 4 6 8 12 16` (4 → 64 px), plus `18`
(72 px) et `22` (88 px) pour les bandeaux éditoriaux. Les outils de travail
(carte, catalogue, tableaux) utilisent 2 à 3 ; les pages éditoriales 8 à 22.

**Rayons — échelle délibérée, tenue partout**

| Jeton | Valeur | Emploi |
|---|---|---|
| `control` | 4 px | Boutons, champs, cases, pastilles |
| `card` | 8 px | Cartes, panneaux, modales |
| `none` | 0 | **Tableaux de données, lignes du catalogue, cellules** |

Aucun `rounded-full` sur un bouton. Les seuls cercles sont les points de la
carte et les avatars.

**Ombres** — trois seulement. `panel` pour les panneaux posés sur la carte,
`raised` pour les modales et menus, `inset` pour la lueur haute du chrome
sombre. Rien d'autre.

**Mouvement** — `instant` 80 ms (retour d'appui), `quick` 140 ms (survol,
ouverture de panneau), `calm` 240 ms (transition de vue). Courbe unique :
`cubic-bezier(0.2, 0, 0, 1)`. Sous `prefers-reduced-motion: reduce`, toute
durée tombe à 1 ms et les déplacements deviennent des fondus.

---

## 5. Écran Géoportail — plan

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▓▓ forest-deep ─ 56 px                                                       │
│ BELEZMA  Géoportail   Accueil Géoportail Biodiversité Patrimoine Galerie  ⌕ │
│ Parc National          ▔▔▔▔▔▔▔▔▔▔                            [Se connecter] │
├────────────────────┬──────────────────────────────────┬──────────────────────┤
│ COUCHES        280 │                              1fr │ INFORMATIONS     320 │
│ ┌────────────────┐ │                                  │ ┌──────────────────┐ │
│ │ ⌕ Rechercher…  │ │            ┌─────────────┐       │ │ Cédraie          │ │
│ └────────────────┘ │            │ ⊞ ⊟  ⤢  ⟷  │       │ │ ▏OFFICIEL        │ │
│                    │            └─────────────┘       │ ├──────────────────┤ │
│ ▾ LIMITES          │                                  │ │ OCCUPATION       │ │
│   ▣ Limite du parc │        ╭─────────────╮           │ │ CEDRAIE          │ │
│     ▏OFFICIEL      │       ╱               ╲          │ │ ÉTAT             │ │
│ ▾ ZONAGE MAB       │      │   ~contours~    │         │ │ MOYEN            │ │
│   ▣ Zone centrale  │       ╲               ╱          │ │ SUPERFICIE       │ │
│   ▣ Zone tampon    │        ╰─────────────╯           │ │ 412,7 ha         │ │
│ ▾ VÉGÉTATION       │                                  │ ├──────────────────┤ │
│   ▢ Cédraie        │                                  │ │ Source : KMZ     │ │
│   ▢ Chênaie verte  │                    ┌───────────┐ │ │ officiel du parc │ │
│   ▢ Pinède         │                    │ Fond ▾    │ │ └──────────────────┘ │
│ ▸ OCCUPATION DU SOL│                    │ OSM       │ │                      │
│ ▸ MILIEU PHYSIQUE  │                    └───────────┘ │  (à vide : motif de  │
│ ▾ BIODIVERSITÉ     │                                  │   courbes + « Cliquez│
│   ▢ iNaturalist    │                                  │   une entité pour    │
│     ▏TEMPS RÉEL ⟳  │                                  │   lire ses attributs)│
│ ▾ CONTRIBUTIONS    │                                  │                      │
│   ▢ Postes vigie   │                                  │                      │
│     ▏CONTRIBUTION  │                                  │                      │
├────────────────────┴──────────────────────────────────┴──────────────────────┤
│ ▓▓ forest-deep ─ 32 px · tout en IBM Plex Mono                               │
│ 35.5931 N  6.0091 E   EPSG:4326   1:25 000   z11   ⟷ 4,82 km   3 couches    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Sous 1024 px** — le catalogue passe en feuille du bas : la carte occupe tout
l'espace, une poignée `▔▔▔` ancrée en bas ouvre le catalogue à 45 % puis 90 %
de la hauteur par glissement ou par appui. Le panneau d'informations devient
une feuille montante déclenchée par le clic sur une entité. La barre d'état se
réduit à `lat/lng` + échelle. **À 360 px, la carte reste pleinement
utilisable** : aucune commande ne descend sous 44 × 44 px.

---

## 6. Écran Mon espace — plan

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▓▓ en-tête                                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ░░ sand ── bandeau, motif de courbes en fond                                │
│  Mon espace                                        ┌────────────────────────┐│
│  Amina Bouzid · Association des amis du Belezma    │ + Déposer une          ││
│                                                     │   contribution         ││
│  12 contributions        7 publiées                └────────────────────────┘│
│  ▔▔ mono                 ▔▔ mono                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  Tous (12)   Privé (3)   En attente (2)   Publié (7)   Refusé (1)            │
│  ▔▔▔▔▔▔▔▔▔                                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────────────────────────────────────┬────────────────────┐ │
│ │ [vignette│ Cédraie de Tichaou sous la neige         │ ● Publié           │ │
│ │  120×90] │ PHOTO · 12 févr. 2026 · 148 vues         │ 12 févr. 2026      │ │
│ │          │ ▏CONTRIBUTION   cédraie  tichaou  hiver  │ Retirer · Modifier │ │
│ ├──────────┼──────────────────────────────────────────┼────────────────────┤ │
│ │ [vignette│ Vue depuis la route de Batna             │ ● Refusé           │ │
│ │  120×90] │ PHOTO · 03 févr. 2026                    │ 03 févr. 2026      │ │
│ │          │ ┌──────────────────────────────────────┐ │ Modifier et        │ │
│ │          │ │ ⚠ La photographie ne montre pas le   │ │ redemander la      │ │
│ │          │ │   parc : le cadrage porte sur la     │ │ publication        │ │
│ │          │ │   zone urbaine de Batna.             │ │                    │ │
│ │          │ └──────────────────────────────────────┘ │                    │ │
│ ├──────────┼──────────────────────────────────────────┼────────────────────┤ │
│ │ ⬡ SIG    │ Postes de vigie — relevé GPS de terrain  │ ● En attente       │ │
│ │ 3 entités│ COUCHE · Point · 3 entités               │ Déposé il y a 2 j  │ │
│ └──────────┴──────────────────────────────────────────┴────────────────────┘ │
│                                                                              │
│  (à vide : motif de courbes + « Aucune contribution pour l'instant —          │
│   ajoutez la première photo du massif. »  [Déposer une contribution])        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Lignes à rayon 0, filet `sand` d'un pixel, densité serrée : c'est un registre,
pas une galerie. Les pastilles d'état empruntent la même grammaire que les
pastilles UICN — fond ténu, bordure, libellé lisible.

---

## 7. Règles tenues sur tout l'écran

- **Alignement à gauche.** Rien n'est centré, hormis le titre du héros de la
  page d'accueil et les états vides.
- **Un seul accent `gold` par écran.** Sur le géoportail, c'est la couche
  active ; sur l'accueil, le chiffre-clé de superficie ; dans le tableau de
  bord, le bouton de dépôt.
- **Icônes `lucide-react` uniquement** — jamais d'émoji. Le `📏` du prototype
  devient `Ruler`, le `⛶` devient `Maximize`.
- **Cible tactile ≥ 44 × 44 px** pour tout élément interactif, y compris les
  cases du catalogue et les onglets de tableau.
- **Anneau de focus visible** : `outline: 2px solid` en `forest` sur fond
  clair, `gold` sur fond sombre, avec 2 px de décalage. Jamais supprimé.
- **Tableaux d'espèces en `<table>` sémantique** : `<caption>` décrivant la
  source, `<th scope="col">` figés en haut, corps défilant horizontalement
  dans son propre conteneur — la page ne défile jamais latéralement.
- **Le relevé de coordonnées n'est pas annoncé** (`aria-live="off"` par
  défaut) : il change à chaque déplacement de souris. Un interrupteur permet
  de l'activer pour la lecture d'écran.

## 8. Copie

Français, vouvoiement, casse de phrase, voix active. Les boutons nomment
l'effet : « Publier ma photo », « Demander la publication », « Enregistrer en
privé ». Les états vides invitent. Les erreurs disent ce qui s'est passé et
quoi faire :

> Ce fichier GeoJSON contient 34 000 entités — la limite est de 20 000.
> Simplifiez la géométrie avant l'import.
