/**
 * Single import boundary onto the PURE rules engine.
 *
 * The engine lives in `src/game/engine` at the repo root and is backend-agnostic
 * (no React, no I/O, no globals, no time — see steering `game-engine.md`). The
 * Edge Function imports it straight from `src/` through this one module so
 * nothing is duplicated. Locally, restart `supabase start` after adding a new
 * engine file so the function's import graph is picked up.
 */
export {
    advanceActive, assignSeats, buildDeck,
    deal, HAND_SIZE,
    isNumberCard,
    isWildCard, reducer, resolveReverse,
    resolveSkip,
    seatAfter, shouldAutoPause, shuffle, SUITS
} from "../../../src/game/engine/index.ts";

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
} from "../../../src/game/engine/types.ts";

