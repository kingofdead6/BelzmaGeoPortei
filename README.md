# Géoportail du Parc National de Belezma

Géoportail public du **Parc National de Belezma** (wilaya de Batna, Algérie),
réserve de biosphère de l'UNESCO depuis 2015. Il réunit la cartographie
officielle du massif, les listes d'espèces du Tome II — Milieu Biotique (2026),
le patrimoine recensé, et une couche de contributions déposées par le public
puis validées par l'équipe du parc.

Chaque donnée affichée porte sa provenance : `OFFICIEL`, `DÉMO`,
`CONTRIBUTION` ou `iNaturalist`.

---

## Sommaire

- [Démarrage](#démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Peuplement de la base](#peuplement-de-la-base)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Données et provenance](#données-et-provenance)
- [Tests](#tests)
- [Déploiement](#déploiement)

---

## Démarrage

Pré-requis : **Node 20 ou plus**, et un MongoDB accessible (Docker suffit).

```bash
git clone <dépôt> && cd BelzmaGeoPortei
npm install

# MongoDB local
docker compose up -d

# Configuration de l'API
cp .env.example server/.env
# Générez les deux secrets JWT :
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# puis renseignez JWT_ACCESS_SECRET et JWT_REFRESH_SECRET dans server/.env

# Extraction des données du prototype vers les fichiers de seed
npm run extract

# Peuplement de la base
npm run seed

# API sur http://localhost:4000, client sur http://localhost:5173
npm run dev
```

Le client relaie `/api` vers `http://localhost:4000` en développement : aucune
configuration supplémentaire n'est nécessaire.

### Comptes de démonstration

`npm run seed` crée quatre comptes, tous avec le mot de passe
`belezma-demo-2026` (modifiable par la variable `SEED_PASSWORD`) :

| Adresse | Rôle | Usage |
|---|---|---|
| `admin@belezma.dz` | administrateur | catalogue, comptes, statistiques |
| `moderation@belezma.dz` | modérateur | file de validation |
| `amina.bouzid@exemple.dz` | contributeur | contributions dans chaque état |
| `karim.lounis@exemple.dz` | contributeur | observations et couche SIG |

Ces identifiants ne valent que pour un environnement local.

---

## Variables d'environnement

Toutes sont décrites dans [`.env.example`](.env.example), et validées par zod
au démarrage : le serveur refuse de démarrer avec une configuration incomplète
plutôt que d'échouer à la première requête.

| Variable | Requise | Rôle |
|---|---|---|
| `MONGODB_URI` | oui | chaîne de connexion MongoDB |
| `JWT_ACCESS_SECRET` | oui | signature du jeton d'accès (32 caractères minimum) |
| `JWT_REFRESH_SECRET` | oui | signature du jeton de rafraîchissement |
| `CLIENT_ORIGIN` | non | liste blanche CORS, séparée par des virgules |
| `PORT` | non | port d'écoute, 4000 par défaut |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | non | dépôt de fichiers ; sans elles, les dépôts sont refusés avec un message explicite |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `SMTP_FROM` | non | courrier sortant ; sans configuration, les messages sont journalisés |
| `NODE_ENV`, `LOG_LEVEL`, `TRUST_PROXY` | non | exploitation |

Aucun secret n'est versionné. `TRUST_PROXY=true` est nécessaire derrière un
proxy (Render, Railway, Nginx) pour que la limitation de débit voie la vraie
adresse IP du client.

---

## Peuplement de la base

Le prototype `belezma-geoportail_13.html` est la source des données. Le script
d'extraction le lit, valide chaque couche et émet les fichiers de seed :

```bash
npm run extract   # prototype → server/seed/ et client/src/assets/
npm run seed      # server/seed/ → MongoDB
npm run seed -- --keep-users   # recharge couches et espèces seulement
```

`npm run extract` imprime un inventaire complet : identifiant de couche, nombre
d'entités, types de géométrie, taille, et signale toute anomalie (anneau non
fermé, coordonnée hors plage, emprise hors parc).

---

## Scripts

Tous s'exécutent depuis la racine.

| Script | Effet |
|---|---|
| `npm run dev` | API et client en parallèle |
| `npm run build` | construit `shared`, `server` puis `client` |
| `npm run typecheck` | TypeScript en mode strict sur les trois espaces de travail |
| `npm run lint` | ESLint — interdit `any` et `console.log` hors scripts |
| `npm test` | Vitest côté serveur et côté client |
| `npm run extract` | extraction du prototype |
| `npm run seed` | peuplement de la base |

---

## Architecture

```
/shared     schémas zod et types — source unique des contrats d'API
/server     API Express + Mongoose
/client     application React + Vite
/scripts    extraction depuis le prototype
```

**`/shared`** porte les schémas zod utilisés des deux côtés : une donnée
refusée à la saisie l'est aussi à l'enregistrement, et inversement. Les deux
autres espaces en dépendent par `@belezma/shared`.

**`/server`** — Express 4, Mongoose 8. Chaque route valide son entrée avec zod
en `.strict()`, ce qui écarte les champs inconnus : une élévation de privilège
par le corps de la requête est impossible. Les erreurs passent par un
gestionnaire centralisé qui ne laisse filtrer ni pile d'appels ni erreur Mongo.
Journalisation structurée par pino, avec un identifiant par requête.

- **Authentification** : jeton d'accès JWT de 15 minutes renvoyé dans le corps
  de la réponse ; jeton de rafraîchissement de 7 jours en cookie
  `httpOnly + secure + sameSite=strict`, suivi en base et **tourné à chaque
  usage**. Le rejeu d'un jeton déjà consommé révoque toute la famille.
  bcrypt à coût 12.
- **Autorisation** : `requireAuth`, `requireRole`, `requireOwnerOrRole`. Le
  rôle et le statut sont relus en base à chaque requête — une suspension prend
  effet immédiatement, sans attendre l'expiration du jeton.
- **Géométries** : stockées dans MongoDB avec un index `2dsphere`, ce qui
  permet les recherches par emprise et par proximité. Seul le fichier déposé
  à l'origine part sur Cloudinary, en `resource_type: "raw"`.
- **Images** : contrôle des octets magiques — le type MIME déclaré ne fait pas
  foi — puis retrait des segments EXIF, XMP et des commentaires avant envoi.
  La localisation d'une observation vient du formulaire, jamais des
  métadonnées de la photographie.
- **Fichiers orphelins** : si Cloudinary refuse une suppression, l'incident
  est consigné dans la collection `orphaned_assets` plutôt qu'ignoré.

**`/client`** — React 18, Vite, Tailwind. TanStack Query pour l'état serveur,
Zustand pour l'état de la carte et la session. Le jeton d'accès ne vit qu'en
mémoire : jamais dans `localStorage`, où une faille XSS pourrait le lire. La
session est rétablie au chargement à partir du seul cookie de rafraîchissement.

Découpage du bundle : Leaflet, turf et leur feuille de style ne sont
téléchargés qu'avec la route `/geoportail` ; la modération et l'administration
forment leurs propres fragments. Les pages éditoriales ne chargent rien de
tout cela.

Les géométries sont chargées à la demande : le catalogue ne transporte que des
métadonnées, et chaque couche n'est téléchargée qu'au moment où elle est
activée, puis conservée en cache. `/layers/:layerId/geojson` répond avec un
ETag et `Cache-Control: public, max-age=86400`.

### Cycle de vie d'une contribution

```
                   demande de publication
  privé ─────────────────────────────────────► en attente
    ▲                                            │   │
    │ retrait                        validation  │   │ refus motivé
    │                                            ▼   ▼
    └──────────────────────────────────────► publié  refusé
                                                 │      │
                              modification par   │      │ correction
                              l'auteur ──────────┴──────┘
                                     (retour en attente)
```

Une contribution naît **privée**. Elle ne devient publique qu'après relecture :
`privé → publié` n'existe pas. Modifier une contribution publiée la renvoie en
validation — ce qui a été relu n'est plus ce qui serait affiché. Un modérateur
ne peut pas statuer sur sa propre contribution ; un administrateur doit s'en
charger. Chaque décision est consignée au journal d'audit avec un instantané.

---

## Données et provenance

| Provenance | Source |
|---|---|
| `OFFICIEL` | shapefiles et KMZ du parc : limite officielle, zonage MAB, végétation, occupation du sol, milieu physique, patrimoine géologique, infrastructures. Espèces : Tome II — Milieu Biotique (2026). |
| `CONTRIBUTION` | déposée par un compte, validée par l'équipe du parc |
| `DÉMO` | repères hérités du prototype, non relevés sur le terrain |
| `iNaturalist` | observations chargées en direct, non validées par le parc |

**20 couches** (limite officielle + 19 couches thématiques), **5 149 entités**,
**470 fiches d'espèces** réparties en 10 jeux de données.

Quelques points relevés à l'extraction, conservés tels quels car ils relèvent
de la source :

- L'emprise réelle de la limite officielle s'étend jusqu'à **lng 6,3094**, plus
  à l'est que l'emprise nominale souvent citée (5,87–6,15). C'est l'emprise
  calculée qui fait foi partout dans l'application.
- `superficie` vaut `0.0` dans la table attributaire du shapefile : la
  superficie affichée est **recalculée depuis la géométrie** avec turf, sur
  l'ellipsoïde WGS 84. L'écart avec `superficie_ha` (26 631,9 ha) reste
  inférieur à 2 %, ce que vérifie un test.
- `mines_grottes` et `circuits_touristiques` contiennent des entités hors
  limite : leur inventaire couvre la wilaya de Batna au-delà du massif.
- Junipéraie, secteur de conservation, urbain et zone de transition étaient
  vides dans les fichiers d'origine : ils ne figurent pas au catalogue.
- Le prototype ne contient qu'**une seule photographie** réelle, réutilisée
  pour le héros et la galerie. La galerie de l'accueil affiche donc les
  contributions publiées, avec un état vide invitant à déposer la première.

Le système de référence est **EPSG:4326** (WGS 84), conformément aux sources.

---

## Tests

```bash
npm test                              # serveur puis client
npm test --workspace @belezma/server
npm test --workspace @belezma/client
```

Côté serveur, les suites se répartissent en deux familles :

- **Sans base** — validation GeoJSON sur les données réelles extraites,
  superficie et périmètre calculés, retrait des métadonnées EXIF, contrôle des
  octets magiques, machine à états du cycle de vie, amorçage de l'application.
  Elles s'exécutent partout.
- **Avec base** — authentification, rotation et détection de réutilisation des
  jetons, cloisonnement entre comptes, cycle de vie complet, modération et
  administration. Elles utilisent `mongodb-memory-server`.

Si aucun MongoDB n'est joignable — réseau bloquant le téléchargement du binaire
`mongod`, par exemple — les suites d'intégration **sont ignorées de façon
visible** dans le rapport plutôt que de faire échouer la campagne. Pour les
exécuter contre une instance existante :

```bash
docker compose up -d
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm test --workspace @belezma/server
```

Côté client, Vitest et Testing Library couvrent le catalogue de couches, le
partage de la vue par l'URL, l'assistant de dépôt, et les contrastes de la
palette — ces derniers calculés, non supposés.

### Audit d'accessibilité sur navigateur

`scripts/audit-accessibilite.mjs` parcourt les pages publiques à 360 px et à
1440 px avec un Chromium réel, et vérifie l'absence de défilement horizontal,
la taille des cibles, l'alternative textuelle des images, l'unicité du titre de
niveau un, le nom accessible des boutons et la langue du document.

```bash
npm run build --workspace @belezma/client
npx vite preview --port 4173 --strictPort   # depuis client/
node scripts/audit-accessibilite.mjs
```

Deux emplacements appliquent le minimum de 24 px de WCAG 2.5.8 plutôt que les
44 px du système, faute de place, et l'audit le déclare explicitement : la
barre d'état de la carte, haute de 32 px, et le crédit cartographique
obligatoire de Leaflet.

---

## Déploiement

### Base de données — MongoDB Atlas

Créez un cluster, un utilisateur dédié, puis autorisez les adresses IP de
l'hébergeur de l'API. Reportez la chaîne de connexion dans `MONGODB_URI`.
Les index sont créés automatiquement hors production ; en production, lancez
`npm run seed` une fois, ou créez-les depuis Atlas d'après les déclarations des
modèles.

### API — Render ou Railway

| Réglage | Valeur |
|---|---|
| Commande de construction | `npm install && npm run build:shared && npm run build --workspace @belezma/server` |
| Commande de démarrage | `npm run start --workspace @belezma/server` |
| Version de Node | 20 ou plus |

Renseignez toutes les variables de `.env.example`, avec `NODE_ENV=production`,
`TRUST_PROXY=true` et `CLIENT_ORIGIN` pointant sur l'URL publique du client.
`/api/v1/health` sert de sonde : elle répond `200` quand la base est connectée,
`503` sinon.

### Client — Vercel ou Netlify

| Réglage | Valeur |
|---|---|
| Répertoire | racine du dépôt |
| Commande de construction | `npm install && npm run build:shared && npm run build --workspace @belezma/client` |
| Répertoire publié | `client/dist` |
| Variable | `VITE_API_BASE_URL=https://<api>/api/v1` |

L'application utilise des routes côté client : configurez la réécriture de
toutes les requêtes vers `/index.html`. Les fichiers de configuration
[`vercel.json`](vercel.json) et [`netlify.toml`](netlify.toml) s'en chargent.

### Fichiers — Cloudinary

Un compte gratuit suffit pour commencer. Les photographies vont dans
`belezma/{idUtilisateur}/{type}`, et les fichiers SIG d'origine dans
`belezma/{idUtilisateur}/layer` en `resource_type: "raw"`. Aucune URL
transformée n'est stockée : elles sont dérivées du `publicId` à la lecture.
