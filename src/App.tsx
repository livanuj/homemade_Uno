import { Layout } from "@/components/Layout";
import { UnsupportedViewport } from "@/components/UnsupportedViewport";
import { WideViewportFrame } from "@/components/WideViewportFrame";
import { RoomStoreProvider } from "@/game/view/store";
import { LandscapeContext } from "@/lib/useLandscape";
import { useViewportMode } from "@/lib/useViewportSupported";
import { GameOverRoute } from "@/routes/GameOverRoute";
import { GameRoute } from "@/routes/GameRoute";
import { HomeRoute } from "@/routes/HomeRoute";
import { HowToPlayRoute } from "@/routes/HowToPlayRoute";
import { LobbyRoute } from "@/routes/LobbyRoute";
import { NotFoundRoute } from "@/routes/NotFoundRoute";
import { SettingsRoute } from "@/routes/SettingsRoute";
import { BrowserRouter, Route, Routes } from "react-router-dom";

/**
 * App shell: router + global providers.
 *
 * Routes cover home, lobby, game, game-over, settings, and how-to-play.
 * Lobby sub-states (02a–02f) and game tables (03/04) are the same route
 * rendering different state; overlays (menu, sheets, dialogs, paused) are
 * components rendered over the table, not routes.
 *
 * `Layout` is the single full-viewport shell (`h-dvh` + safe-area padding).
 * The unsupported-viewport guard (task 1.4) renders inside this shell: a
 * portrait phone renders `Routes` in their portrait layout; a landscape wide
 * screen (desktop, laptop, tablet on its side) renders them in their landscape
 * layout (compacted for a phone on its side); an upright tablet renders the
 * portrait layout in a centered column; a too-narrow or very short screen
 * shows `UnsupportedViewport`.
 */
export function App() {
  return (
    <BrowserRouter>
      <RoomStoreProvider>
        <Layout>
          <ViewportGuard />
        </Layout>
      </RoomStoreProvider>
    </BrowserRouter>
  );
}

/**
 * Renders the routed content for a portrait phone, a landscape wide screen
 * (with `LandscapeContext` set), or an upright tablet (phone-width column);
 * otherwise renders the guard message
 * (Requirement 16.4 / 16.8). Lives inside `Layout` so the shell/safe-area
 * still frames the message.
 */
function ViewportGuard() {
  const mode = useViewportMode();

  if (mode === "unsupported") {
    return <UnsupportedViewport />;
  }
  if (mode === "landscape" || mode === "compact") {
    return (
      <LandscapeContext.Provider value={mode === "landscape" ? "wide" : "compact"}>
        <AppRoutes />
      </LandscapeContext.Provider>
    );
  }
  if (mode === "column") {
    return (
      <WideViewportFrame>
        <AppRoutes />
      </WideViewportFrame>
    );
  }
  return <AppRoutes />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="/how-to-play" element={<HowToPlayRoute />} />
      <Route path="/room/:code" element={<LobbyRoute />} />
      <Route path="/room/:code/game" element={<GameRoute />} />
      <Route path="/room/:code/game-over" element={<GameOverRoute />} />
      <Route path="*" element={<NotFoundRoute />} />
    </Routes>
  );
}
