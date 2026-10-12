// Public API of the pure Homemade Uno rules engine.
//
// The engine is deterministic given an injected RNG and holds all game logic:
// deck build/shuffle, dealing, turn advancement, matching, wilds, stacking,
// draw, last-card, win detection, and the auto-pause predicate. Rejections are
// returned as values; transitions return new immutable state.

export type {
    Action,
    Card,
    CardValue,
    ConnectionSnapshot,
    ConnectionState,
    Direction,
    EngineContext,
    GameMode,
    GameState,
    NumberValue,
    PenaltyKind,
    Phase,
    Rejection,
    RejectionReason,
    Result,
    Rng,
    Seat,
    Success,
    Suit,
    Team,
    Winner
} from "./types.ts";

export { shouldAutoPause } from "./autopause.ts";
export { assignSeats, deal, HAND_SIZE } from "./deal.ts";
export type { DealInput } from "./deal.ts";
export { buildDeck, isNumberCard, isWildCard, shuffle, SUITS } from "./deck.ts";
export { reducer } from "./reducer.ts";
export { createSeededRng } from "./rng.ts";
export {
    discardTop,
    isLegalPlay,
    isLegalStack,
    matchesNonWild,
    penaltyKindOf,
    penaltyValue
} from "./rules.ts";
export { advanceActive, resolveReverse, resolveSkip, seatAfter } from "./turn.ts";

