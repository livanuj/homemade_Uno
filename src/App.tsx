import { Layout } from "@/components/Layout";
import { UnsupportedViewport } from "@/components/UnsupportedViewport";
import { useViewportSupported } from "@/lib/useViewportSupported";
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
 * The unsupported-viewport guard (task 1.4) renders inside this shell: when
 * the viewport is out of range or landscape it shows `UnsupportedViewport`
 * and suppresses the routed game/lobby content; otherwise it renders `Routes`.
 */
export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ViewportGuard />
      </Layout>
    </BrowserRouter>
  );
}

/**
 * Renders the routed content only when the viewport is a supported portrait
 * phone size; otherwise renders the guard message (Requirement 16.4 / 16.8).
 * Lives inside `Layout` so the shell/safe-area still frames the message.
 */
function ViewportGuard() {
  const supported = useViewportSupported();

  if (!supported) {
    return <UnsupportedViewport />;
  }

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
