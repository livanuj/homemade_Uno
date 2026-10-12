/**
 * Single import boundary onto the PURE rules engine.
 *
 * The engine lives in `src/game/engine` at the repo root and is backend-agnostic
 * (no React, no I/O, no globals, no time — see steering `game-engine.md`). The
 * Cloud Functions here compile it in via the functions `tsconfig.json`
 * (`include` reaches `../src/game/engine/**`, `rootDir` is the repo root) and
 * import it through this one module so nothing is duplicated. If the engine
 * changes, the functions pick it up on the next `tsc` build.
 */
export {
    advanceActive, assignSeats, buildDeck,
    deal, HAND_SIZE,
    isNumberCard,
    isWildCard, reducer, resolveReverse,
    resolveSkip,
    seatAfter, shouldAutoPause, shuffle, SUITS
} from "../../src/game/engine/index";

export type {
    Action,
    Card,
    ConnectionSnapshot, Direction, ConnectionState as EngineConnectionState, EngineContext,
    GameMode,
    GameState,
    PenaltyKind,
    Phase,
    Rejection,
    RejectionReason,
    Result,
    Rng,
    Seat,
    Suit,
    Team,
    Winner
} from "../../src/game/engine/types";

