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
} from "./types";

export { shouldAutoPause } from "./autopause";
export { assignSeats, deal, HAND_SIZE } from "./deal";
export type { DealInput } from "./deal";
export { buildDeck, isNumberCard, isWildCard, shuffle, SUITS } from "./deck";
export { reducer } from "./reducer";
export { createSeededRng } from "./rng";
export {
    discardTop,
    isLegalPlay,
    isLegalStack,
    matchesNonWild,
    penaltyKindOf,
    penaltyValue
} from "./rules";
export { advanceActive, resolveReverse, resolveSkip, seatAfter } from "./turn";

