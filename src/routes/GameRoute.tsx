import { useParams } from "react-router-dom";

/**
 * Game route — screens 03/04 table plus all overlays rendered over the table.
 * Placeholder for task 1.1; wired to state in task 8.4.
 */
export function GameRoute() {
  const { code } = useParams();
  return (
    <main>
      <h1>Game</h1>
      <p>Room {code}</p>
    </main>
  );
}
