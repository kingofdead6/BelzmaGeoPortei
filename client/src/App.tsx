import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/layout/PublicLayout";
import { Spinner } from "./components/ui/Spinner";
import { Accueil } from "./pages/Accueil";
import { Biodiversite } from "./pages/Biodiversite";
import { Patrimoine } from "./pages/Patrimoine";
import { APropos } from "./pages/APropos";
import { Galerie } from "./pages/Galerie";
import { ContributionDetail } from "./pages/ContributionDetail";
import { NonTrouve } from "./pages/NonTrouve";

/**
 * La carte et ses dépendances (Leaflet, turf) forment un fragment séparé :
 * les pages éditoriales ne les téléchargent jamais (§9, §13).
 */
const Geoportail = lazy(() =>
  import("./pages/Geoportail").then((module) => ({ default: module.Geoportail })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-forest">
      <Spinner label="Chargement de la carte" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Accueil />} />
        <Route
          path="geoportail"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Geoportail />
            </Suspense>
          }
        />
        <Route path="biodiversite" element={<Biodiversite />} />
        <Route path="patrimoine" element={<Patrimoine />} />
        <Route path="galerie" element={<Galerie />} />
        <Route path="contributions/:id" element={<ContributionDetail />} />
        <Route path="a-propos" element={<APropos />} />
        {/* Ancienne adresse du prototype. */}
        <Route path="geoportal" element={<Navigate to="/geoportail" replace />} />
        <Route path="*" element={<NonTrouve />} />
      </Route>
    </Routes>
  );
}
