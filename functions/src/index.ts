/**
 * Cloud Functions entry point (Task 4).
 *
 * Server-authoritative callables wrapping the PURE rules engine
 * (`src/game/engine`, imported via `./engine` — never duplicated). All game
 * mutations run here with the Admin SDK (bypassing Security Rules) inside
 * versioned Firestore transactions; the draw order lives only in
 * `private/deck` (Req 23.2).
 */
export { callLast, chooseColor, drawOne, keep, playCard } from "./actions";
export { enforceGrace } from "./grace";
export {
    continueWithout,
    endGame,
    leave, pause, playAgain, resume
} from "./lifecycle";
export { setConnection } from "./presence";
export { createRoom, join } from "./rooms";
export { startGame } from "./start";

