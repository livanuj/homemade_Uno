import { useParams } from "react-router-dom";

/**
 * Game over route — screen 07-game-over and its variants.
 * Placeholder for task 1.1; wired to state in task 8.6.
 */
export function GameOverRoute() {
  const { code } = useParams();
  return (
    <main>
      <h1>Game over</h1>
      <p>Room {code}</p>
    </main>
  );
}
