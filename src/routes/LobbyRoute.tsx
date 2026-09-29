import { useParams } from "react-router-dom";

/**
 * Lobby route — screens 02a–02f (mode/host/guest are state, not routes).
 * Placeholder for task 1.1; wired to state in task 8.3.
 */
export function LobbyRoute() {
  const { code } = useParams();
  return (
    <main>
      <h1>Lobby</h1>
      <p>Room {code}</p>
    </main>
  );
}
