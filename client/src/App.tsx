import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/layout/PublicLayout";
import { SessionBootstrap } from "./components/layout/SessionBootstrap";
import { RequireAuth } from "./components/layout/RequireAuth";
import { Spinner } from "./components/ui/Spinner";
import { Accueil } from "./pages/Accueil";
import { Biodiversite } from "./pages/Biodiversite";
import { Patrimoine } from "./pages/Patrimoine";
import { APropos } from "./pages/APropos";
import { Galerie } from "./pages/Galerie";
import { ContributionDetail } from "./pages/ContributionDetail";
import { Connexion } from "./pages/Connexion";
import { Inscription } from "./pages/Inscription";
import { MotDePasseOublie } from "./pages/MotDePasseOublie";
import { VerificationEmail } from "./pages/VerificationEmail";
import { Profil } from "./pages/Profil";
import { NonTrouve } from "./pages/NonTrouve";

/**
 * La carte et ses dépendances (Leaflet, turf) forment un fragment séparé :
 * les pages éditoriales ne les téléchargent jamais (§9, §13).
 */
const Geoportail = lazy(() =>
  import("./pages/Geoportail").then((module) => ({ default: module.Geoportail })),
);

function RouteFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-forest">
      <Spinner label={label} />
    </div>
  );
}

export function App() {
  return (
    <SessionBootstrap>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Accueil />} />
          <Route
            path="geoportail"
            element={
              <Suspense fallback={<RouteFallback label="Chargement de la carte" />}>
                <Geoportail />
              </Suspense>
            }
          />
          <Route path="biodiversite" element={<Biodiversite />} />
          <Route path="patrimoine" element={<Patrimoine />} />
          <Route path="galerie" element={<Galerie />} />
          <Route path="contributions/:id" element={<ContributionDetail />} />
          <Route path="a-propos" element={<APropos />} />

          <Route path="connexion" element={<Connexion />} />
          <Route path="inscription" element={<Inscription />} />
          <Route path="mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="reinitialiser-mot-de-passe" element={<MotDePasseOublie />} />
          <Route path="verification-email/:token" element={<VerificationEmail />} />

          {/* Espace personnel — l'accès est aussi contrôlé côté serveur (§13). */}
          <Route element={<RequireAuth />}>
            <Route path="mon-espace/profil" element={<Profil />} />
          </Route>

          {/* Ancienne adresse du prototype. */}
          <Route path="geoportal" element={<Navigate to="/geoportail" replace />} />
          <Route path="*" element={<NonTrouve />} />
        </Route>
      </Routes>
    </SessionBootstrap>
  );
}

