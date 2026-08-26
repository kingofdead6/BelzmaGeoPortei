import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PublicLayout() {
  const { pathname } = useLocation();
  // Le géoportail occupe toute la hauteur disponible et gère son propre
  // défilement : le pied de page l'encombrerait.
  const isMap = pathname.startsWith("/geoportail");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a href="#contenu" className="skip-link">Aller au contenu principal</a>
      <Header />
      <main id="contenu" className={isMap ? "flex min-h-0 flex-1 flex-col" : "flex-1"}>
        <Outlet />
      </main>
      {isMap ? null : <Footer />}
    </div>
  );
}
