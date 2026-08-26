import { PageHead } from "../components/layout/PageHead";
import { ProvenanceChip } from "../components/ui/ProvenanceChip";
import { useParkStats, useSpeciesStats } from "../lib/queries";
import { formatDecimal, formatNumber } from "../lib/format";

export function APropos() {
  const parkStats = useParkStats();
  const speciesStats = useSpeciesStats();

  return (
    <>
      <PageHead
        title="À propos"
        description="Provenance des données, méthodologie de traitement et architecture du géoportail du Parc National de Belezma."
      />

      <section className="contours border-b border-forest-light/20 bg-sand">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <h1 className="text-4xl">Provenance et méthodologie</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink/75">
            Ce géoportail ne produit aucune donnée. Il met en forme des sources existantes et affiche,
            pour chacune, d'où elle vient. Cette page décrit ces sources, les traitements appliqués et
            le fonctionnement des contributions.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14">
        <article className="space-y-12">
          <Section title="Le parc">
            <p>
              Le Parc National de Belezma s'étend sur le massif du même nom, dans la wilaya de Batna, au
              nord-est des Aurès. Créé en 1984, il a été inscrit en 2015 au réseau mondial des réserves
              de biosphère de l'UNESCO, au titre du programme sur l'homme et la biosphère (MAB).
            </p>
            <p>
              Sa superficie est de{" "}
              <strong className="datum font-medium text-forest-deep">
                {parkStats.data ? `${formatDecimal(parkStats.data.areaHa, 1)} ha` : "—"}
              </strong>{" "}
              et son périmètre de{" "}
              <strong className="datum font-medium text-forest-deep">
                {parkStats.data ? `${formatDecimal(parkStats.data.perimeterKm, 1)} km` : "—"}
              </strong>
              . Ces deux valeurs sont <em>recalculées à chaque affichage</em> à partir de la géométrie
              de la limite officielle, sur l'ellipsoïde WGS 84 ; elles ne sont pas recopiées d'un
              document. L'écart avec la superficie portée par la table attributaire du shapefile
              (26 631,9 ha) reste inférieur à 2 %, ce qui correspond aux arrondis de la source.
            </p>
          </Section>

          <Section title="Données cartographiques">
            <p className="flex items-center gap-2">
              <ProvenanceChip provenance="OFFICIEL" />
              <span className="text-sm text-ink/70">Shapefiles et KMZ fournis par le parc</span>
            </p>
            <p>
              La limite officielle, le zonage MAB (zone centrale, zone tampon), les formations
              végétales (cédraie, chênaie verte, pinède, pelouses de montagne), l'occupation du sol
              (friches et cultures, terrains nus), le milieu physique (falaises, réseau
              hydrographique), le patrimoine géologique (grottes, gisements, mines) et les
              infrastructures (routes, pistes, lignes électriques, postes de vigie, tranchées
              pare-feu, circuits touristiques) proviennent des fichiers officiels du parc.
            </p>
            <p>
              Chaque couche a été validée à l'import : structure GeoJSON conforme au RFC 7946,
              fermeture des anneaux polygonaux, ordre des coordonnées en <span className="datum">[lng, lat]</span>{" "}
              et cohérence de l'emprise avec la limite officielle. Quatre couches présentes dans les
              fichiers d'origine — <em>junipéraie</em>, <em>secteur de conservation</em>, <em>urbain</em>{" "}
              et <em>zone de transition</em> — étaient vides ; elles ne figurent donc pas au catalogue.
            </p>
            <p>
              Deux couches contiennent des entités qui débordent de la limite du parc :{" "}
              <em>mines et grottes</em> et <em>circuits touristiques</em>, dont l'inventaire couvre la
              wilaya de Batna au-delà des seules limites du massif. C'est une propriété de la source,
              pas une erreur de géoréférencement.
            </p>
          </Section>

          <Section title="Espèces">
            <p className="flex items-center gap-2">
              <ProvenanceChip provenance="OFFICIEL" />
              <span className="text-sm text-ink/70">Tome II — Milieu Biotique (2026)</span>
            </p>
            <p>
              Les{" "}
              <strong className="datum font-medium text-forest-deep">
                {speciesStats.data ? formatNumber(speciesStats.data.total) : "—"}
              </strong>{" "}
              fiches d'espèces sont réparties en dix jeux de données : flore protégée par le décret
              exécutif 12-03, flore évaluée par l'UICN, flore endémique et rare, invertébrés, reptiles,
              oiseaux et mammifères protégés, vertébrés et invertébrés menacés selon l'UICN, et
              endémisme faunistique.
            </p>
            <p>
              Les noms de champs de la source sont conservés à l'identique — <span className="datum">nom_scientifique</span>,{" "}
              <span className="datum">famille</span>, <span className="datum">statut_uicn</span>,{" "}
              <span className="datum">rarete</span>, <span className="datum">chorotype</span>,{" "}
              <span className="datum">endemisme</span> — sans traduction ni normalisation, afin que
              toute comparaison avec le document d'origine reste possible.
            </p>
          </Section>

          <Section title="Observations iNaturalist">
            <p className="flex items-center gap-2">
              <ProvenanceChip provenance="iNaturalist" />
              <span className="text-sm text-ink/70">Chargées en direct, non validées par le parc</span>
            </p>
            <p>
              La couche iNaturalist interroge l'API publique du réseau au moment de son activation, sur
              l'emprise de la limite officielle. Elle affiche les deux cents observations vérifiables
              les plus récentes accompagnées d'une photographie, colorées par grand groupe
              taxonomique. Ces observations relèvent de la communauté iNaturalist : elles ne sont ni
              relevées ni validées par le parc, et le géoportail ne les conserve pas.
            </p>
          </Section>

          <Section title="Données de démonstration">
            <p className="flex items-center gap-2">
              <ProvenanceChip provenance="DÉMO" />
              <span className="text-sm text-ink/70">Repères indicatifs, non relevés sur le terrain</span>
            </p>
            <p>
              Quelques points patrimoniaux et observations d'espèces sont hérités du prototype et
              servent à illustrer le fonctionnement de la carte. Leur localisation est indicative :
              certains tombent volontairement hors de la limite officielle. La puce{" "}
              <ProvenanceChip provenance="DÉMO" className="align-middle" /> les signale partout où ils
              apparaissent. Ils seront remplacés au fur et à mesure par des relevés réels.
            </p>
          </Section>

          <Section title="Contributions">
            <p className="flex items-center gap-2">
              <ProvenanceChip provenance="CONTRIBUTION" />
              <span className="text-sm text-ink/70">Déposées par le public, validées par l'équipe du parc</span>
            </p>
            <p>
              Toute personne disposant d'un compte peut déposer des photographies, des observations
              d'espèces, des sites patrimoniaux ou des couches SIG (GeoJSON, archives shapefile).
              Une contribution est <strong>privée par défaut</strong> : elle n'est visible que de son
              auteur.
            </p>
            <p>
              Son auteur peut ensuite en demander la publication. Elle entre alors dans une file de
              validation où un membre de l'équipe scientifique du parc l'examine, puis l'approuve ou la
              refuse en motivant sa décision. Le motif de refus est transmis à l'auteur, qui peut
              corriger sa contribution et la soumettre à nouveau. Un modérateur ne peut jamais valider
              sa propre contribution.
            </p>
            <p>
              Les coordonnées d'une observation proviennent toujours du formulaire, jamais des
              métadonnées EXIF de la photographie : celles-ci sont retirées avant tout envoi, afin
              qu'une localisation ne soit jamais publiée à l'insu de son auteur.
            </p>
          </Section>

          <Section title="Architecture">
            <p>
              Le géoportail est une application React (Vite, TypeScript) adossée à une API Express
              également écrite en TypeScript. Les données sont conservées dans MongoDB : les géométries
              y sont indexées en <span className="datum">2dsphere</span>, ce qui permet les recherches
              par emprise et par proximité. Les photographies et les fichiers SIG déposés sont archivés
              sur Cloudinary ; seul l'identifiant du fichier est conservé en base, les URL d'affichage
              étant recalculées à la lecture.
            </p>
            <p>
              La géométrie des couches n'est jamais chargée d'avance : le catalogue ne transporte que
              des métadonnées, et chaque couche n'est téléchargée qu'au moment où vous l'activez, puis
              conservée en cache pour la durée de votre visite. Les schémas de validation sont partagés
              entre le client et le serveur, de sorte qu'une donnée refusée à l'affichage l'est aussi à
              l'enregistrement.
            </p>
            <p>
              Le système de référence est <span className="datum">EPSG:4326</span> (WGS 84), en degrés
              décimaux, conformément aux fichiers sources.
            </p>
          </Section>
        </article>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}
