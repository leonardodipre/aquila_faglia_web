import { Suspense, lazy } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

const OverviewPage = lazy(() =>
  import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })),
);
const ModelsPage = lazy(() =>
  import("./pages/ModelsPage").then((module) => ({ default: module.ModelsPage })),
);

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">Frontend + backend static explorer</p>
          <h1>Aquila Fault + GNSS Explorer</h1>
          <p className="topbar-subtitle">
            Curated GNSS stations across Italy and lightweight 3D inspection of selected PINN fault
            models.
          </p>
        </div>

        <nav className="topbar-nav" aria-label="Primary navigation">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-pill nav-pill-active" : "nav-pill")}>
            Overview GNSS
          </NavLink>
          <NavLink
            to="/modelli"
            className={({ isActive }) => (isActive ? "nav-pill nav-pill-active" : "nav-pill")}
          >
            Modelli 3D
          </NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Suspense fallback={<div className="loading-state">Loading interface…</div>}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/modelli" element={<ModelsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
