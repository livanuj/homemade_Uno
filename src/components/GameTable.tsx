/**
 * GameTable — the shared game-table frame for both `03-game-2v2` and
 * `04-game-normal` (design.md §7.5–§7.7, §6).
 *
 * The table is a `relative` full-screen container with absolutely-positioned
 * layers, exactly as the design specifies: the felt oval, the top bar (room
 * chip · mode chip "Round N" · menu), the direction ring (SVG dashed circle in
 * the active suit color), the draw + discard piles, opponent seats (face-down
 * `CardBack`s with the 3D recipe from §6), the partner seat (2v2, face-up
 * hand), the turn pill (§5.5), your row (avatar + "LAST CARD!"), and your
 * fanned hand (§7.7). Everything is DERIVED from a `GameView` — no backend.
 *
 * Interactions (tap-to-play, draw, wild picker, last-card) are task 9; this
 * screen renders statically. The animation wrappers from task 7 (`MotionCard`
 * for the hand) are reused where the card can travel, but the table is stable
 * at rest so a Playwright capture matches the reference PNGs.
 *
 * REUSES: PlayingCard (hand/pile/partner), CardBack (draw-pile/side-seat/
 * top-seat), Avatar (ring + badge + `activeTurn` pulse), Chip (mode chip),
 * TurnPill, Button, IconButton, MotionCard. Tokens only (token-policy.md).
 */
import type { AvatarRing } from "@/components/Avatar";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { CardBack, type CardBackVariant } from "@/components/CardBack";
import { Chip } from "@/components/Chip";
import { IconButton } from "@/components/IconButton";
import {
  LiveAnnouncer,
  useGameAnnouncements,
} from "@/components/LiveAnnouncer";
import { MotionCard } from "@/components/MotionCard";
import { OfflineAvatar } from "@/components/OfflineAvatar";
import { PlayingCard } from "@/components/PlayingCard";
import { TableStageContext } from "@/components/TableLayer";
import {
  TableEventLayer,
  tableEventText,
  unoCallText,
  useCatchEvent,
  useTableEvent,
  useUnoBursts,
} from "@/components/TableEventLayer";
import {
  TableFlights,
  useTableFlights,
  type FlightGeometry,
  type Point,
  type TableSnapshot,
} from "@/components/TableFlights";
import { TurnPill } from "@/components/TurnPill";
import { TurnTag } from "@/components/TurnTag";
import { cardAriaLabel, isWild, type Suit } from "@/design/suits";
import {
  DURATION,
  dealDelay,
  drawSlideTransition,
  handTurnState,
  handTurnTransition,
  illegalShake,
  motionTransition,
  playSpring,
  reversePulse,
  tableEventPop,
  unoBurst,
} from "@/design/motion";
import { penaltyPrompt } from "@/game/view/penalty";
import type {
  CardView,
  Direction,
  GameView,
  HandCardView,
  OpponentSeatView,
  PartnerSeatView,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import { useCompactLandscape, useLandscape } from "@/lib/useLandscape";
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  type MotionProps,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Static token maps (styling.md — the compiler must see whole class names).
// ---------------------------------------------------------------------------

/** Active-color → SVG stroke color var (direction ring, §7.5). */
const SUIT_STROKE: Record<Suit, string> = {
  red: "var(--color-suit-red)",
  yellow: "var(--color-suit-yellow)",
  green: "var(--color-suit-green)",
  blue: "var(--color-suit-blue)",
};

/** Team id → avatar ring token (2v2). */
const TEAM_RING: Record<"A" | "B", AvatarRing> = {
  A: "team-a",
  B: "team-b",
};

// ---------------------------------------------------------------------------
// Hand fan math (design.md §7.7).
// ---------------------------------------------------------------------------

const CARD_W = 70; // hand card width (§5.1)
const FAN_MARGIN = 34; // side margin used in the step clamp (§7.7)
const MAX_STEP = 42; // max horizontal spacing between cards (small hands)
/**
 * Minimum horizontal step for a LARGE hand (§7.7 tuned for ~7 cards; big hands
 * need a floor so cards don't collapse into an unreadable clump). Keeps at
 * least this much of each card's left edge visible. 18px leaves the suit index
 * / numeral column peeking out.
 */
const MIN_STEP = 18;
/** Half of the total angular spread of the fan, in degrees (constant arc). */
const FAN_HALF_ANGLE = 16;
/** Resting top offset of the center card (px) within the hand band. */
const FAN_BASE_TOP = 10;
/** How far the OUTERMOST cards rise above center (px) — a fixed, bounded arc. */
const FAN_ARC_RISE = 30;

/**
 * Spread-safe `{ suit, value }` for a card: with `exactOptionalPropertyTypes`,
 * a wild card's `suit === undefined` can't be passed to `suit?: Suit`, so we
 * omit the key entirely when there is no suit.
 */
function faceProps(card: { suit?: Suit; value: CardView["value"] }): {
  suit?: Suit;
  value: CardView["value"];
} {
  return card.suit
    ? { suit: card.suit, value: card.value }
    : { value: card.value };
}

interface FanSlot {
  left: number;
  rotate: number;
  top: number;
}

/**
 * Position of card `i` of `n` in the fan, for a container of width `w`
 * (design.md §7.7). A selected card overrides to `top: 0, rotate: 0` at the
 * call site. Returned in px / degrees.
 */
export function fanSlot(
  i: number,
  n: number,
  w: number,
  maxStep: number = MAX_STEP,
): FanSlot {
  // Horizontal step. Target the design spacing (fill the available width up to
  // MAX_STEP), with a readable floor (MIN_STEP) so medium hands don't collapse.
  // But the floor is SOFT: if MIN_STEP would push the run past the full width
  // (very large hands), fall back to whatever step fits edge-to-edge so no card
  // is clipped off-screen. Result: small hands fan wide, medium hands overlap
  // to a legible band, and huge hands pack tightly but stay fully visible.
  const available = w - FAN_MARGIN * 2 - CARD_W; // room for inter-card steps
  const fitStep = n <= 1 ? 0 : available / (n - 1); // exact fit within margins
  const step =
    n <= 1
      ? 0
      : fitStep >= MIN_STEP
        ? Math.min(maxStep, fitStep) // comfortable: clamp to the design max
        : Math.max(fitStep, (w - CARD_W) / (n - 1)); // tight: fit full width
  // Center the whole run within the container.
  const left = (w - (CARD_W + step * (n - 1))) / 2 + i * step;

  // Normalize the card's offset from center to u ∈ [-1, 1] so the fan's SHAPE
  // (angle + arc) is independent of card count — the extremes always sit at the
  // same angle and height whether the hand has 3 cards or 25 (fixes the
  // exploding parabola / vertical spill on big hands).
  const tMax = Math.max((n - 1) / 2, 1);
  const u = (i - (n - 1) / 2) / tMax;
  const rotate = u * FAN_HALF_ANGLE;
  const top = FAN_BASE_TOP + FAN_ARC_RISE * u * u;
  return { left, rotate, top };
}

// ---------------------------------------------------------------------------
// Table geometry — portrait (390×844 design) and landscape (1280×800 stage).
// ---------------------------------------------------------------------------

type SeatKind = "top" | "left" | "right";

interface SeatSlot {
  kind: SeatKind;
  style: CSSProperties;
}

/**
 * Every position on the table, per layout. Portrait is the phone design
 * (§7.5–§7.7) on a 390×844 stage; landscape is the wide-screen layout on a
 * 1280×800 stage, and compact the phone-on-its-side layout on a 900×440 stage.
 * `GameTable` scales each stage to fit the space it has. Class strings are whole static
 * literals (styling.md); px points feed the flight math.
 */
interface TableGeometry {
  /** Stage width in px — right-anchored seats measure from it. */
  width: number;
  /** Stage height in px. */
  height: number;
  /** Stage classes: the fixed stage size. */
  stage: string;
  /** Width of the hand band the fan lays out in (px). */
  handWidth: number;
  /** Partner seat (2v2) top offset. */
  partner: string;
  /** Max horizontal step between hand cards (§7.7). */
  maxStep: number;
  oval: string;
  topBar: string;
  ring: string;
  piles: string;
  turnPill: string;
  catchStrip: string;
  selfRow: string;
  hand: string;
  drawPileCenter: Point;
  discardSlot: Point;
  discardCenter: Point;
  partnerLandingY: number;
  /** Skip / reverse banner position (over the piles). */
  eventBanner: string;
  /** "You're skipped!" stamp position (centered on the piles). */
  eventStamp: string;
  /** 2v2: the two opponents' side seats. */
  teamSeats: [SeatSlot, SeatSlot];
  /** Normal: clockwise from your left — left, top-left, top-right, right. */
  normalSeats: SeatSlot[];
}

const SIDE_LEFT: SeatSlot = { kind: "left", style: { left: 8, top: 272, width: 76 } };
const SIDE_RIGHT: SeatSlot = { kind: "right", style: { right: 8, top: 272, width: 76 } };
const WIDE_LEFT: SeatSlot = { kind: "left", style: { left: 80, top: 236, width: 100 } };
const WIDE_RIGHT: SeatSlot = { kind: "right", style: { right: 80, top: 236, width: 100 } };

const TABLE_GEOMETRY: Record<"portrait" | "landscape" | "compact", TableGeometry> = {
  portrait: {
    width: 390,
    height: 844,
    stage: "h-[844px] w-[390px]",
    handWidth: 390,
    partner: "top-[70px]",
    maxStep: MAX_STEP,
    oval: "left-5 top-[150px] h-[470px] w-[350px]",
    topBar: "inset-x-4 top-4",
    ring: "left-[90px] top-[290px]",
    piles: "left-[105px] top-[340px]",
    turnPill: "top-[512px]",
    catchStrip: "inset-x-4 top-[552px]",
    selfRow: "inset-x-4 top-[596px]",
    hand: "left-0 w-full top-[664px] h-[180px]",
    drawPileCenter: { x: 147, y: 398 },
    discardSlot: { x: 204, y: 344 },
    discardCenter: { x: 241, y: 398 },
    partnerLandingY: 150,
    eventBanner: "top-[214px]",
    eventStamp: "top-[300px]",
    teamSeats: [SIDE_LEFT, SIDE_RIGHT],
    normalSeats: [
      SIDE_LEFT,
      { kind: "top", style: { left: 56, top: 72, width: 120 } },
      { kind: "top", style: { left: 214, top: 72, width: 120 } },
      SIDE_RIGHT,
    ],
  },
  landscape: {
    width: 1280,
    height: 800,
    stage: "h-[800px] w-[1280px]",
    handWidth: 1280,
    partner: "top-[70px]",
    maxStep: 64,
    oval: "left-[220px] top-[112px] h-[420px] w-[840px]",
    topBar: "inset-x-6 top-5",
    ring: "left-[535px] top-[217px]",
    piles: "left-[550px] top-[264px]",
    turnPill: "top-[470px]",
    catchStrip: "inset-x-10 top-[510px]",
    selfRow: "inset-x-10 top-[566px]",
    hand: "left-0 w-full top-[610px] h-[190px]",
    drawPileCenter: { x: 592, y: 322 },
    discardSlot: { x: 649, y: 268 },
    discardCenter: { x: 686, y: 322 },
    partnerLandingY: 140,
    eventBanner: "top-[214px]",
    eventStamp: "top-[226px]",
    teamSeats: [WIDE_LEFT, WIDE_RIGHT],
    normalSeats: [
      WIDE_LEFT,
      { kind: "top", style: { left: 400, top: 76, width: 160 } },
      { kind: "top", style: { left: 720, top: 76, width: 160 } },
      WIDE_RIGHT,
    ],
  },
  // A phone on its side: one short band. Opponents hug the left/right edges,
  // the partner (or top seats) sit just under the top bar, and the hand fans
  // in a 640px band between your avatar and the UNO button.
  compact: {
    width: 900,
    height: 440,
    stage: "h-[440px] w-[900px]",
    handWidth: 640,
    // Avatar + name beside the face-up cards, so the seat stays clear of the piles.
    partner: "top-[50px] flex-row justify-center gap-3",
    maxStep: 64,
    oval: "left-[150px] top-[64px] h-[260px] w-[600px]",
    topBar: "inset-x-4 top-3",
    ring: "left-[345px] top-[109px]",
    piles: "left-[360px] top-[156px]",
    turnPill: "top-[280px]",
    // Right end of the turn-pill row, clear of the seats and the hand.
    catchStrip: "right-4 top-[286px] justify-end",
    selfRow: "inset-x-4 top-[352px]",
    hand: "left-[130px] w-[640px] top-[320px] h-[120px]",
    drawPileCenter: { x: 402, y: 214 },
    discardSlot: { x: 459, y: 160 },
    discardCenter: { x: 496, y: 214 },
    partnerLandingY: 120,
    eventBanner: "top-[120px]",
    eventStamp: "top-[128px]",
    teamSeats: [
      { kind: "left", style: { left: 12, top: 60, width: 76 } },
      { kind: "right", style: { right: 12, top: 60, width: 76 } },
    ],
    normalSeats: [
      { kind: "left", style: { left: 12, top: 60, width: 76 } },
      { kind: "top", style: { left: 200, top: 56, width: 120 } },
      { kind: "top", style: { left: 580, top: 56, width: 120 } },
      { kind: "right", style: { right: 12, top: 60, width: 76 } },
    ],
  },
};

/**
 * Uniform scale that fits a `w`×`h` stage inside `container` (the table's own
 * box, so shell safe-area padding is respected). Falls back to the window
 * where `ResizeObserver` is unavailable (jsdom).
 */
function useStageScale(
  container: HTMLElement | null,
  w: number,
  h: number,
): number {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / w, window.innerHeight / h),
  );
  useEffect(() => {
    const update = () => {
      const box = container?.getBoundingClientRect();
      const cw = box?.width || window.innerWidth;
      const ch = box?.height || window.innerHeight;
      setScale(Math.min(cw / w, ch / h));
    };
    update();
    window.addEventListener("resize", update);
    const observer =
      container && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (container) observer?.observe(container);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [container, w, h]);
  return scale;
}

// ---------------------------------------------------------------------------
// 3D-recipe face-down back rows (design.md §6).
// ---------------------------------------------------------------------------

/** At most 7 backs are drawn per seat regardless of the real count (§6). */
const MAX_BACKS = 7;

/** Per-seat 3D transform + back variant + overlap offset (§6). */
const SEAT_RECIPE: Record<
  SeatKind,
  {
    perspective: string;
    transform: string;
    origin: string;
    column: boolean;
    variant: CardBackVariant;
    overlap: string;
  }
> = {
  top: {
    perspective: "360px",
    transform: "rotateX(48deg)",
    origin: "50% 0",
    column: false,
    variant: "top-seat",
    overlap: "-22px",
  },
  left: {
    perspective: "360px",
    transform: "rotateY(52deg)",
    origin: "0 50%",
    column: true,
    variant: "side-seat",
    overlap: "-42px",
  },
  right: {
    perspective: "360px",
    transform: "rotateY(-52deg)",
    origin: "100% 50%",
    column: true,
    variant: "side-seat",
    overlap: "-42px",
  },
};

/**
 * A face-down back row/column with the seat's 3D recipe (§6). The perspective
 * lives on the parent and the rotation on the row/column of cards.
 */
function BackStack({ kind, count }: { kind: SeatKind; count: number }) {
  const recipe = SEAT_RECIPE[kind];
  const shown = Math.min(count, MAX_BACKS);
  return (
    <div style={{ perspective: recipe.perspective }}>
      <div
        className={cn(
          "flex",
          recipe.column ? "flex-col items-center" : "items-center",
        )}
        style={{ transform: recipe.transform, transformOrigin: recipe.origin }}
        aria-hidden="true"
      >
        {Array.from({ length: shown }).map((_, i) => (
          <CardBack
            key={i}
            variant={recipe.variant}
            {...(i === 0
              ? {}
              : {
                  style: recipe.column
                    ? { marginTop: recipe.overlap }
                    : { marginLeft: recipe.overlap },
                })}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seats.
// ---------------------------------------------------------------------------

/** A penalty that just landed on a seat: skipped, or caught without UNO. */
type SeatPenalty = "skip" | "caught" | null;

const PENALTY_GLYPH: Record<"skip" | "caught", string> = {
  skip: "⊘",
  caught: "+2",
};

const PENALTY_TAG: Record<"skip" | "caught", string> = {
  skip: "Skipped",
  caught: "Caught!",
};

/**
 * A badge that pops onto a player's avatar while a skip (⊘, Req 6.4/6.5) or a
 * catch (+2, Req 11.3) callout is on screen.
 */
function PenaltyBadge({
  penalty,
  reduced,
}: {
  penalty: SeatPenalty;
  reduced: boolean;
}) {
  return (
    <AnimatePresence>
      {penalty && (
        <motion.span
          variants={tableEventPop}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...(reduced ? { transition: { duration: 0 } } : {})}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-full bg-danger font-display text-sheet text-surface"
        >
          {PENALTY_GLYPH[penalty]}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * The red "UNO!" tag above a player's avatar while their UNO call stands
 * (Req 11): from the moment they call it until their hand grows past one card
 * (a draw or penalty — the engine then clears the call). It pops in when the
 * call is made, on every screen; a call already standing when the table loads
 * just appears. Announced through the live region instead.
 */
function UnoBurst({ show, reduced }: { show: boolean; reduced: boolean }) {
  const className =
    "pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-surface bg-suit-red px-2.5 py-0.5 font-display text-body whitespace-nowrap text-surface uppercase shadow-cta";
  // Reduced motion: no pop and no fade — the tag simply appears and goes.
  if (reduced) {
    return show ? (
      <span aria-hidden="true" className={cn(className, "-rotate-6")}>
        UNO!
      </span>
    ) : null;
  }
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          variants={unoBurst}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-hidden="true"
          className={className}
        >
          UNO!
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * The avatar box a seat's badges hang off; it shakes when the player is caught
 * without calling UNO (Req 11.3).
 */
function SeatAvatarBox({
  caught,
  reduced,
  children,
}: {
  caught: boolean;
  reduced: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="relative"
      variants={illegalShake}
      initial={false}
      animate={caught && !reduced ? "shake" : "still"}
    >
      {children}
    </motion.div>
  );
}

/**
 * One opponent seat — avatar (ring + real-count badge) + name + face-down
 * backs. When the seat is disconnected (`seat.connection === "offline"`, Req
 * 15.1) it renders the faded `OfflineAvatar` instead, with the grace
 * `CountdownRing` when a `countdown` is supplied (its turn, §5.20); the name
 * line reads "· offline" and the seat is the `06c-player-disconnected` state.
 */
function OpponentSeat({
  seat,
  kind,
  ring,
  activeTurn,
  penalty,
  unoCalled,
  reduced,
  countdown,
  style,
}: {
  seat: OpponentSeatView;
  kind: SeatKind;
  ring: AvatarRing;
  activeTurn: boolean;
  /** A skip (⊘) or catch (+2) just landed here — badge + tag. */
  penalty: SeatPenalty;
  /** This player just called UNO — "UNO!" burst. */
  unoCalled: boolean;
  reduced: boolean;
  countdown?: { progress: number; secondsLeft: number };
  style: CSSProperties;
}) {
  const offline = seat.connection === "offline";
  return (
    // Seats that aren't playing fade back so the active one stands out.
    <div
      className={cn(
        "absolute flex flex-col items-center gap-1",
        !activeTurn && !penalty && "opacity-60",
      )}
      style={style}
    >
      <SeatAvatarBox caught={penalty === "caught"} reduced={reduced}>
        {offline ? (
          <OfflineAvatar
            name={seat.name}
            cardCount={seat.cardCount}
            {...(countdown ? { countdown } : {})}
          />
        ) : (
          <Avatar
            name={seat.name}
            size={44}
            ring={ring}
            cardCount={seat.cardCount}
            activeTurn={activeTurn}
          />
        )}
        <PenaltyBadge penalty={penalty} reduced={reduced} />
        <UnoBurst show={unoCalled} reduced={reduced} />
      </SeatAvatarBox>
      <span className="text-caption font-bold text-ink">
        {offline ? `${seat.name} · offline` : seat.name}
      </span>
      {/* Whose turn: a "Playing" tag under the active player (an offline
          active player shows its grace countdown instead); a just-skipped
          player shows "Skipped". */}
      {penalty ? (
        <TurnTag className="bg-danger text-surface">
          {PENALTY_TAG[penalty]}
        </TurnTag>
      ) : (
        activeTurn && !offline && <TurnTag>Playing</TurnTag>
      )}
      <div className={kind === "top" ? undefined : "mt-1.5"}>
        <BackStack kind={kind} count={seat.cardCount} />
      </div>
    </div>
  );
}

/** The partner seat (2v2, top) — face-up hand with the partner 3D recipe (§6). */
function PartnerSeat({
  partner,
  activeTurn,
  penalty,
  unoCalled,
  reduced,
  className,
}: {
  partner: PartnerSeatView;
  /** The partner just called UNO — "UNO!" burst. */
  unoCalled: boolean;
  /** Whether it is the partner's turn — pulse + "Playing" tag; else faded. */
  activeTurn: boolean;
  /** A skip (⊘) or catch (+2) just landed on the partner — badge + tag. */
  penalty: SeatPenalty;
  reduced: boolean;
  /** Top offset (per table layout). */
  className: string;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 flex w-full flex-col items-center gap-1",
        !activeTurn && !penalty && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <SeatAvatarBox caught={penalty === "caught"} reduced={reduced}>
          <Avatar
            name={partner.name}
            size={40}
            ring={TEAM_RING[partner.team]}
            activeTurn={activeTurn}
          />
          <PenaltyBadge penalty={penalty} reduced={reduced} />
          <UnoBurst show={unoCalled} reduced={reduced} />
        </SeatAvatarBox>
        <div className="flex flex-col">
          <span className="text-body text-ink">{partner.name}</span>
          <span
            className={cn(
              "text-micro font-semibold",
              partner.team === "A" ? "text-team-a" : "text-team-b",
            )}
          >
            Partner · {partner.hand.length} cards
          </span>
        </div>
        {penalty ? (
          <TurnTag className="bg-danger text-surface">
            {PENALTY_TAG[penalty]}
          </TurnTag>
        ) : (
          activeTurn && <TurnTag>Playing</TurnTag>
        )}
      </div>
      {/* Partner recipe: perspective on the parent, rotateX on the card row. */}
      <div style={{ perspective: "420px", paddingTop: 2 }}>
        <div
          className="flex"
          style={{ transform: "rotateX(42deg)", transformOrigin: "50% 100%" }}
        >
          {partner.hand.map((card, i) => (
            <div key={card.id} style={i === 0 ? undefined : { marginLeft: -8 }}>
              <PlayingCard variant="partner" {...faceProps(card)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piles + direction ring.
// ---------------------------------------------------------------------------

/** Direction arrows round the piles in the active color; they flip when reversed. */
function DirectionRing({
  color,
  direction,
  className,
  reduced,
}: {
  color: Suit;
  direction: Direction;
  /** Position classes (per table layout). */
  className: string;
  reduced: boolean;
}) {
  const stroke = SUIT_STROKE[color];
  return (
    // Keyed by direction: a reverse remounts it, so the arrows pulse
    // (§ reversePulse) as they flip to the new direction.
    <motion.div
      key={direction}
      className={cn("absolute size-[210px]", className)}
      variants={reversePulse}
      initial={reduced ? false : "initial"}
      animate="animate"
      aria-hidden="true"
    >
      <svg
        width="210"
        height="210"
        viewBox="0 0 210 210"
        fill="none"
        className="overflow-visible"
      >
        {/* Two small curved arrows, pointing the way play moves (clockwise);
            mirrored when play is counter-clockwise. */}
        <g
          stroke={stroke}
          strokeOpacity="0.9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={
            direction === -1 ? "translate(210 0) scale(-1 1)" : undefined
          }
        >
          {/* Two short arcs: one above the piles, one below, pointing the
              opposite ways round the table. */}
          <path d="M49.9 26.4 A96 96 0 0 1 160.1 26.4" />
          <path d="M154.9 13 L160.1 26.4 L145.7 26.1" />
          <path d="M160.1 183.6 A96 96 0 0 1 49.9 183.6" />
          <path d="M55.1 197.1 L49.9 183.6 L64.3 183.9" />
        </g>
      </svg>
    </motion.div>
  );
}

/** Draw pile (tappable back stack) + discard pile (prev at −12°, top at +8° with a suit glow). */
function Piles({
  discardTop: latestTop,
  discardPrev: latestPrev,
  holdTopId = null,
  onDraw,
  reduced = false,
  className,
  chosenColor,
  drawPenalty,
}: {
  /** Position classes (per table layout). */
  className: string;
  /** A +2/+4 pending on you: the deck reads "Draw N" (tap to take them). */
  drawPenalty?: number | undefined;
  /** The color chosen for a wild on top of the pile (shown on the card). */
  chosenColor?: Suit | undefined;
  discardTop: CardView;
  discardPrev?: CardView;
  /**
   * While an opponent's played card is still flying in, keep showing the card
   * it lands on; the new top appears when the flight completes.
   */
  holdTopId?: string | null;
  onDraw?: () => void;
  /** Honor reduced motion (Req 17.6) — drops the throw flight when true. */
  reduced?: boolean;
}) {
  const holding = holdTopId === latestTop.id && latestPrev !== undefined;
  const discardTop = holding ? latestPrev : latestTop;
  const discardPrev = holding ? undefined : latestPrev;
  return (
    <div
      className={cn(
        "absolute flex h-[116px] w-[180px] items-center justify-center gap-[22px]",
        className,
      )}
    >
      <div className="relative">
        <CardBack
          variant="draw-pile"
          {...(drawPenalty
            ? { "aria-label": `Draw ${drawPenalty} cards` }
            : {})}
          {...(onDraw ? { onClick: onDraw } : {})}
        />
        {drawPenalty ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-surface bg-danger px-2 py-0.5 text-micro font-extrabold whitespace-nowrap text-surface shadow-cta"
          >
            Draw {drawPenalty}
          </span>
        ) : null}
      </div>
      <div className="relative h-[108px] w-[74px]">
        {discardPrev && (
          <div
            className="absolute inset-0"
            style={{ transform: "rotate(-12deg)" }}
          >
            <PlayingCard variant="pile" {...faceProps(discardPrev)} />
          </div>
        )}
        {/*
         * The discard TOP is the landing target for a played card's shared-
         * layout flight (Req 17.1): it carries `layoutId={card.id}`, matching
         * the hand `MotionCard` that was just played, so Motion springs the
         * card from the hand to here. `AnimatePresence` keys on the card id so
         * each newly-played card animates in. Reduced motion drops the shared
         * layoutId (the card simply appears). This is a presentational
         * `motion.div` wrapper — the pile card itself stays non-interactive.
         */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={discardTop.id}
            {...(reduced ? {} : { layoutId: discardTop.id, layout: true })}
            className="absolute inset-0"
            style={{
              transform: "rotate(8deg)",
              filter: "drop-shadow(0 0 16px var(--pile-glow))",
            }}
            transition={motionTransition(reduced, playSpring)}
          >
            <PlayingCard
              variant="pile"
              {...faceProps(discardTop)}
              {...(chosenColor && isWild(discardTop.value)
                ? { chosenColor }
                : {})}
              tabIndex={-1}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your hand fan (§7.7).
// ---------------------------------------------------------------------------

/**
 * Track which hand-card ids are NEW since the previous render, and how many
 * arrived together, so freshly drawn cards can animate in from the draw pile
 * (Req 10.6) and a multi-card penalty draw (+2/+4/forgot-UNO) fans in with a
 * stagger (reusing the deal timing). Returns, per current card id, the 0-based
 * index among the cards that arrived in the latest batch (or `null` if the card
 * is not new). Cards that were already present do not re-animate.
 */
export function useDrawInOrder(handIds: string[]): Map<string, number> {
  // Diff the current ids against the ids committed on the previous render. Any
  // id not present before is "new" and gets its 0-based position among the
  // additions (the stagger order). A render with no additions (a play, or an
  // incidental re-render) yields an empty map, so cards animate in exactly once
  // and never re-animate. The commit happens in an effect AFTER the render that
  // exposed the batch, so the newly-drawn cards' motion wrappers mount with
  // their `initial` and the batch is consumed by that same render.
  // Lazily seed the committed ids with the OPENING hand so the first render
  // (and the dealt hand) is not mistaken for a draw — only later additions are.
  const committedRef = useRef<string[] | null>(null);
  if (committedRef.current === null) committedRef.current = handIds;
  const prev = new Set(committedRef.current);
  const added = handIds.filter((id) => !prev.has(id));
  const order = new Map(added.map((id, i) => [id, i] as const));

  useEffect(() => {
    committedRef.current = handIds;
    // The id list is a fresh array each render; join to a stable string so the
    // effect only re-commits when the actual id SEQUENCE changes.
  }, [handIds.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps

  return order;
}

/** A hand card at rest in its fan slot (the draw-in flight's end state). */
const DRAW_IN_REST = { opacity: 1, y: 0, x: 0, rotateY: 0 } as const;
/** Where a drawn card starts: up/left toward the draw pile, face-down. */
const DRAW_IN_FROM = { opacity: 0.6, y: -320, x: 40, rotateY: 180 } as const;

/**
 * Motion props for a hand card's draw-in wrapper (Req 10.6). `animate` and
 * `transition` stay the same on EVERY render; only `initial` (read once, at
 * mount) depends on whether the card just arrived. Dropping `animate` on the
 * re-render after the batch is consumed would make Motion animate the removed
 * keys back to their `initial` values, leaving the card stuck at the draw pile.
 */
export function drawInMotionProps(
  batchIndex: number | undefined,
  reduced: boolean,
  /** Extra delay (s), e.g. a caught player's cards wait for the punishment. */
  holdBack = 0,
): Pick<MotionProps, "initial" | "animate" | "transition"> {
  const isDrawnIn = batchIndex !== undefined && !reduced;
  return {
    // Held-back cards start hidden so they don't wait in view at the pile.
    initial: isDrawnIn ? (holdBack ? { ...DRAW_IN_FROM, opacity: 0 } : DRAW_IN_FROM) : false,
    animate: DRAW_IN_REST,
    transition: {
      ...drawSlideTransition,
      delay: holdBack + dealDelay(batchIndex ?? 0),
    },
  };
}

/** Drag a card at least this far up (px) and release to throw it. */
const THROW_DISTANCE = 90;
/** …or flick it up this fast (px/s), past a small minimum distance. */
const THROW_FLICK_VELOCITY = 600;
const THROW_FLICK_MIN_DISTANCE = 24;

/**
 * Whether a touch drag of a hand card, released with this offset / velocity,
 * throws the card (up is negative): far enough up, or a quick upward flick.
 */
export function isThrowGesture({
  offsetY,
  velocityY,
}: {
  offsetY: number;
  velocityY: number;
}): boolean {
  if (offsetY <= -THROW_DISTANCE) return true;
  return (
    offsetY <= -THROW_FLICK_MIN_DISTANCE && velocityY <= -THROW_FLICK_VELOCITY
  );
}

/**
 * The caller's fanned hand (§7.7). Each card is a `MotionCard` positioned
 * absolutely by the fan math. A played card flies to the discard via its shared
 * `layoutId` (Req 17.1); a freshly drawn card slides/flips in from the draw
 * pile (Req 10.6), and a multi-card penalty draw fans in with a 60ms stagger.
 * Unplayable cards are dimmed only when `highlight` is on (Req 7.5/7.6); the
 * selected card is raised to `top: 0, rotate: 0` with the team-colored lift
 * ring. Reduced motion (Req 17.6) makes every move instant.
 *
 * Playing is guarded against stray taps: a tap or click LIFTS a card, and a
 * second tap on the lifted card throws it (tapping anywhere else drops it).
 * On touch, a card can also be dragged up and released to throw it.
 */
function HandFan({
  view,
  highlight,
  isYourTurn,
  penaltyLock,
  width,
  maxStep,
  holdBack,
  className,
  onPlayCard,
  shakeCardId,
  reduced = false,
}: {
  view: GameView;
  highlight: boolean;
  /** Your turn: the hand rises to full strength; otherwise it sinks and fades. */
  isYourTurn: boolean;
  /**
   * A +2/+4 is pending on you: only cards that can stack on it stay enabled
   * (the rest are dimmed and disabled whatever the highlight setting).
   */
  penaltyLock: boolean;
  width: number;
  /** Max horizontal step between cards (§7.7; wider in landscape). */
  maxStep: number;
  /** Seconds newly drawn cards wait (a catch's punishment plays first). */
  holdBack: number;
  /** Position + height classes for the hand band (per table layout). */
  className: string;
  /** Tap a hand card → attempt to play it (Task 9.4). */
  onPlayCard?: (cardId: string) => void;
  /** The card id currently shaking after an illegal-tap rejection (Req 7.3). */
  shakeCardId?: string | null;
  /** Honor reduced motion (Req 17.6). */
  reduced?: boolean;
}) {
  const n = view.hand.length;
  const liftRing =
    view.selfTeam === "B" ? "var(--color-team-b)" : "var(--color-team-a)";
  const drawInOrder = useDrawInOrder(view.hand.map((c) => c.id));

  // The card lifted by a first tap. Ignored once it leaves the hand.
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const lifted = view.hand.some((c) => c.id === liftedId) ? liftedId : null;

  // A press anywhere other than the lifted card drops it back into the fan.
  useEffect(() => {
    if (!lifted) return;
    const drop = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(`[data-hand-card="${lifted}"]`)) setLiftedId(null);
    };
    document.addEventListener("pointerdown", drop, true);
    return () => document.removeEventListener("pointerdown", drop, true);
  }, [lifted]);

  const throwCard = (cardId: string) => {
    setLiftedId(null);
    onPlayCard?.(cardId);
  };

  return (
    <motion.div
      className={cn("absolute", className)}
      variants={handTurnState}
      initial={false}
      animate={isYourTurn ? "active" : "waiting"}
      transition={motionTransition(reduced, handTurnTransition)}
    >
      {view.hand.map((card, i) => {
        const slot = fanSlot(i, n, width, maxStep);
        const selected = !!card.selected || card.id === lifted;
        const style: CSSProperties = {
          position: "absolute",
          left: slot.left,
          top: selected ? 0 : slot.top,
          transform: `rotate(${selected ? 0 : slot.rotate}deg)`,
          zIndex: selected ? 20 : i,
          ...(selected
            ? {
                boxShadow: `0 0 0 3px ${liftRing}, 0 14px 24px rgba(40,30,40,0.25)`,
                borderRadius: 12,
              }
            : {}),
        };

        return (
          <HandCardSlot
            key={card.id}
            card={card}
            style={style}
            selected={selected}
            dim={(highlight || penaltyLock) && isYourTurn && !card.playable}
            disabled={penaltyLock && !card.playable}
            shake={shakeCardId === card.id}
            reduced={reduced}
            // Draw-in flight (Req 10.6): a newly arrived card slides up/in from
            // the draw-pile direction and flips face-up. For a multi-card
            // penalty draw, each card is delayed by its batch index.
            drawInProps={drawInMotionProps(
              drawInOrder.get(card.id),
              reduced,
              holdBack,
            )}
            {...(onPlayCard && !(penaltyLock && !card.playable)
              ? {
                  onTap: () =>
                    card.id === lifted
                      ? throwCard(card.id)
                      : setLiftedId(card.id),
                  onThrow: () => throwCard(card.id),
                }
              : {})}
          />
        );
      })}
    </motion.div>
  );
}

/**
 * One card in the hand fan. The outer div owns the fan POSITION/rotation
 * (plain CSS transform); the drag wrapper owns the touch drag offset; the inner
 * motion wrapper owns only the draw-in flight (opacity / y / x / rotateY), so
 * the transforms never fight.
 *
 * Touch drag (pointerType "touch" only — a mouse keeps click-to-lift): the
 * card follows the finger; released per `isThrowGesture` it is thrown and
 * stays where it was let go until the play resolves (the shared-layout flight
 * carries it to the discard). A short drag, or a rejected play (shake / the
 * optimistic raise clearing), springs it back into the fan.
 */
function HandCardSlot({
  card,
  style,
  selected,
  dim,
  disabled,
  shake,
  reduced,
  drawInProps,
  onTap,
  onThrow,
}: {
  card: HandCardView;
  style: CSSProperties;
  selected: boolean;
  dim: boolean;
  /** Can't be played right now (e.g. can't stack on a pending +2/+4). */
  disabled: boolean;
  shake: boolean;
  reduced: boolean;
  drawInProps: Pick<MotionProps, "initial" | "animate" | "transition">;
  /** Tap / click / Enter: lift, or throw when already lifted. */
  onTap?: () => void;
  /** A touch drag released as a throw. */
  onThrow?: () => void;
}) {
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const thrown = useRef(false);
  const dragging = useRef(false);
  const wasSelected = useRef(selected);
  const canDrag = !!onThrow;

  const springBack = () => {
    thrown.current = false;
    const transition = motionTransition(reduced, playSpring);
    animate(x, 0, transition);
    animate(y, 0, transition);
  };

  // A thrown card that is rejected (shake) or whose optimistic raise clears
  // while it is still in the hand goes back to its slot.
  useEffect(() => {
    if (shake && thrown.current) springBack();
  }, [shake]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (thrown.current && wasSelected.current && !selected) springBack();
    wasSelected.current = selected;
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={style} data-hand-card={card.id}>
      <motion.div
        style={{ x, y }}
        drag={canDrag}
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className={canDrag ? "touch-none" : undefined}
        onPointerDown={(e) => {
          if (canDrag && e.pointerType === "touch") dragControls.start(e);
        }}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={(_, info) => {
          if (isThrowGesture({ offsetY: info.offset.y, velocityY: info.velocity.y })) {
            thrown.current = true;
            onThrow?.();
          } else {
            springBack();
          }
          // The click that follows a drag release is part of the drag.
          window.setTimeout(() => {
            dragging.current = false;
          }, 0);
        }}
      >
        <motion.div {...drawInProps}>
          <MotionCard
            cardId={card.id}
            {...faceProps(card)}
            variant="hand"
            selected={selected}
            dim={dim}
            disabled={disabled}
            shake={shake}
            reduced={reduced}
            {...(onTap
              ? {
                  onClick: () => {
                    if (!dragging.current) onTap();
                  },
                }
              : {})}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameTable.
// ---------------------------------------------------------------------------

export interface GameTableProps {
  /** The projected game state to render (2v2 vs. normal via `room.mode`). */
  view: GameView;
  /**
   * Whether the "Highlight playable cards" setting is on — dims unplayable
   * hand cards (Req 7.5/7.6). Defaults to on (matches the reference).
   */
  highlight?: boolean;
  /** Open the in-game menu (task 8.5 renders the drawer). */
  onMenu?: () => void;
  /** Draw a card (task 9 wires the flow). */
  onDraw?: () => void;
  /** Call "UNO" — the last-card call (task 9 wires the flow). */
  onCallLastCard?: () => void;
  /** Catch an opponent on 1 card who has not called (they draw 2, Req 11.3). */
  onCatch?: (targetPlayerId: string) => void;
  /** Tap a hand card → attempt to play it (Task 9.4). */
  onPlayCard?: (cardId: string) => void;
  /** The card id currently shaking after an illegal-tap rejection (Req 7.3). */
  shakeCardId?: string | null;
  /**
   * Grace countdown for a disconnected opponent whose turn it is (§5.20, Req
   * 15.3): maps the seat id to `{ progress, secondsLeft }` so its
   * `OfflineAvatar` drains a `CountdownRing`. Additive seam used by the
   * `06c-player-disconnected` overlay (task 8.5); the live value is task 5.
   */
  seatCountdown?: Record<string, { progress: number; secondsLeft: number }>;
  /**
   * Overlay slot rendered OVER the table (task 8.5 menu/sheets, 8.7 paused).
   * Left as a clean seam here; 8.4 does not implement any overlay.
   */
  overlay?: ReactNode;
  /**
   * Honor reduced motion (Req 17.6) — pass from `usePrefersReducedMotion()`.
   * When true, the throw flight and draw-in become instant moves. Defaults to
   * `true` so static renders (Playwright captures, fixtures) stay at rest and
   * match the design reference PNGs; `GameRoute` passes the live preference.
   */
  reduced?: boolean;
}

export function GameTable({
  view,
  highlight = true,
  onMenu,
  onDraw,
  onCallLastCard,
  onCatch,
  onPlayCard,
  shakeCardId,
  seatCountdown,
  overlay,
  reduced = true,
}: GameTableProps) {
  const isTeam = view.room.mode === "team";
  const landscape = useLandscape();
  const compact = useCompactLandscape();
  const geo =
    TABLE_GEOMETRY[compact ? "compact" : landscape ? "landscape" : "portrait"];
  const [tableEl, setTableEl] = useState<HTMLDivElement | null>(null);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const stageScale = useStageScale(tableEl, geo.width, geo.height);
  // Landscape lays out on a fixed stage, so the fan and seats measure that.
  const tableWidth = geo.width;
  const handWidth = geo.handWidth;
  const isYourTurn = view.activeSeatId === view.selfId;

  // Screen-reader announcements (Req 18.4/18.7): mirror the visible turn pill
  // and the current card in play into a polite live region. The discard top is
  // the "card just played" surface, phrased via the shared card label
  // ("Red 7", "Wild draw four"). Composed so a card play landing with a turn
  // change keeps the newest of each.
  // Skip / reverse callouts on every player's screen (Req 6.2–6.5).
  // A catch without a UNO call (Req 11.3) plays its punishment first; it
  // takes over the callout while it shows.
  const catchEvent = useCatchEvent(view);
  const playEvent = useTableEvent(view);
  const tableEvent = catchEvent.shown ?? playEvent;
  const penaltyFor = (id: string): SeatPenalty => {
    const e = tableEvent?.event;
    if (!e || e.kind === "reverse" || e.seatId !== id) return null;
    return e.kind;
  };
  // Your own new cards wait for your punishment stamp before sliding in.
  const handHoldBack =
    !reduced && catchEvent.justCaught.includes(view.selfId)
      ? DURATION.catchPunish
      : 0;
  // Who has a standing UNO call: their "UNO!" tag stays until it clears.
  const unoCalled = new Set(view.unoCalledIds ?? []);
  // Fresh calls, for a one-off announcement (Req 11).
  const unoBursts = useUnoBursts(view);

  // A +2/+4 pending on you: stack with an eligible card, or take it from the
  // deck; with nothing to stack, the route draws it for you (Req 9.4).
  const penalty = penaltyPrompt(view);

  const announcement = useGameAnnouncements({
    turnText: view.turnText,
    lastPlay: `Top card ${cardAriaLabel(view.discardTop.value, view.discardTop.suit)}${
      isWild(view.discardTop.value) && !view.colorPending
        ? `, ${view.activeColor} chosen`
        : ""
    }${tableEvent ? `. ${tableEventText(tableEvent.event, view)}` : ""}${unoBursts
      .map((id) => `. ${unoCallText(id, view)}`)
      .join("")}${
      penalty && !penalty.canStack
        ? `. Nothing to stack, drawing ${penalty.count}`
        : ""
    }`,
  });

  // Opponent draw / play flights (Req 10.6 / 17.2).
  const placedSeats = seatLayout(view, geo);
  const flights = useTableFlights(tableSnapshot(view), reduced);

  // Mode chip text (Req 12.6): "2v2 · Round N" or "Normal · N players".
  const modeChip = isTeam
    ? `2v2 · Round ${view.room.roundNumber}`
    : `Normal · ${view.room.players.length} players`;

  // Your row ring: team color in 2v2, else `ink` for you; pulse on your turn.
  const selfRing: AvatarRing = isTeam ? TEAM_RING[view.selfTeam ?? "A"] : "ink";
  const selfCount = view.hand.length;
  const selfMeta =
    view.selfMeta ??
    (isTeam
      ? `Team ${view.selfTeam ?? "A"} · ${selfCount} cards`
      : `${selfCount} cards`);

  const table = (
    <>
      {/* Felt table oval. */}
      <div
        className={cn(
          "absolute rounded-[50%] border-2 border-felt-edge bg-felt inset-shadow-felt",
          geo.oval,
        )}
      />

      {/* Top bar — room chip · mode chip ("Round N") · menu. */}
      <div
        className={cn(
          "absolute flex h-11 items-center justify-between",
          geo.topBar,
        )}
      >
        <Chip variant="info">ROOM · {view.room.code}</Chip>
        <Chip variant="outline">{modeChip}</Chip>
        <IconButton aria-label="Menu" onClick={onMenu}>
          <MenuIcon />
        </IconButton>
      </div>

      {/* Partner seat (2v2 only) — face-up hand at the top. */}
      {isTeam && view.partner && (
        <PartnerSeat
          className={geo.partner}
          activeTurn={view.activeSeatId === view.partner.id}
          penalty={penaltyFor(view.partner.id)}
          unoCalled={unoCalled.has(view.partner.id)}
          reduced={reduced}
          partner={{
            ...view.partner,
            // Drawn cards still in the air are shown once they land.
            hand: view.partner.hand.slice(
              0,
              view.partner.hand.length - (flights.inFlightTo[view.partner.id] ?? 0),
            ),
          }}
        />
      )}

      {/* Opponent seats — face-down backs with the 3D recipe (§6). */}
      {placedSeats.map(({ seat: latestSeat, kind, style }) => {
        // Cards still flying in are added to the seat only as they land.
        const seat = {
          ...latestSeat,
          cardCount: latestSeat.cardCount - (flights.inFlightTo[latestSeat.id] ?? 0),
        };
        const seatActive = view.activeSeatId === seat.id;
        const countdown = seatCountdown?.[seat.id];
        return (
          <OpponentSeat
            key={seat.id}
            seat={seat}
            kind={kind}
            ring={ringForOpponent(seat, isTeam, seatActive)}
            activeTurn={seatActive}
            penalty={penaltyFor(seat.id)}
            unoCalled={unoCalled.has(seat.id)}
            reduced={reduced}
            {...(countdown ? { countdown } : {})}
            style={style}
          />
        );
      })}

      {/* Direction ring — dashed circle in the active color; arrows flip when reversed. */}
      <DirectionRing
        color={view.activeColor}
        direction={view.direction}
        className={geo.ring}
        reduced={reduced}
      />

      {/* Piles — draw (left) + discard (right). Glow var drives the top-card glow. */}
      <div
        style={{ "--pile-glow": glowFor(view.activeColor) } as CSSProperties}
      >
        <Piles
          className={geo.piles}
          drawPenalty={penalty?.count}
          // A wild on top shows the color its player chose (once chosen).
          chosenColor={view.colorPending ? undefined : view.activeColor}
          discardTop={view.discardTop}
          {...(view.discardPrev ? { discardPrev: view.discardPrev } : {})}
          holdTopId={flights.holdTopId}
          {...(onDraw ? { onDraw } : {})}
          reduced={reduced}
        />
      </div>

      {/* Turn pill (§5.5) — on other players' turns only. On your turn the
          prompt moves to your own row, by your hand, instead of the felt. */}
      {!isYourTurn && (
        <div
          className={cn("absolute left-0 flex w-full justify-center", geo.turnPill)}
        >
          <TurnPill tone="turn">{view.turnText}</TurnPill>
        </div>
      )}

      {/* Catch strip — one button per opponent sitting on 1 card without calling
          (Req 11.3). It disappears once they call, draw, or someone catches them. */}
      {view.catchTargets.length > 0 && (
        <div
          className={cn("absolute flex justify-center gap-2", geo.catchStrip)}
        >
          {view.catchTargets.map((target) => (
            <Button
              key={target.id}
              variant="danger"
              className="h-10 bg-surface font-display uppercase tracking-[0.04em]"
              onClick={() => onCatch?.(target.id)}
            >
              Catch {target.name}!
            </Button>
          ))}
        </div>
      )}

      {/* Your row — avatar (team/turn ring + pulse), "You", meta, round "UNO" button. */}
      <div
        className={cn(
          "absolute flex h-12 items-center justify-between",
          geo.selfRow,
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar
              name={view.selfName}
              size={44}
              ring={isYourTurn && !isTeam ? "turn" : selfRing}
              activeTurn={isYourTurn}
            />
            <UnoBurst show={unoCalled.has(view.selfId)} reduced={reduced} />
          </div>
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-body text-ink">
              You
              {isYourTurn && (
                <TurnTag className="text-label">Your turn</TurnTag>
              )}
            </span>
            <span
              className={cn(
                "text-micro font-semibold",
                isTeam
                  ? view.selfTeam === "B"
                    ? "text-team-b"
                    : "text-team-a"
                  : "text-ink-muted",
              )}
            >
              {selfMeta}
            </span>
          </div>
        </div>
        {/* Only relevant near the end of a hand: hidden above 2 cards. */}
        {view.hand.length <= 2 && (
          <Button
            variant="outline"
            className={cn(
              "mr-4 size-14 px-0 font-display text-cta uppercase transition-colors",
              view.canCallLastCard
                ? "border-suit-red bg-suit-red text-surface shadow-cta"
                : "border-line bg-surface text-ink-faint",
            )}
            disabled={!view.canCallLastCard}
            onClick={onCallLastCard}
          >
            <span className="-rotate-6">UNO</span>
          </Button>
        )}
      </div>

      {/* Your hand fan (§7.7). */}
      <HandFan
        view={view}
        highlight={highlight}
        isYourTurn={isYourTurn}
        penaltyLock={!!penalty}
        width={handWidth}
        maxStep={geo.maxStep}
        holdBack={handHoldBack}
        className={geo.hand}
        reduced={reduced}
        {...(onPlayCard ? { onPlayCard } : {})}
        {...(shakeCardId !== undefined ? { shakeCardId } : {})}
      />

      {/* Cards flying between the piles and the other players' seats. */}
      {/* Nothing in your hand can stack on the pending +2/+4: say so while
          the route draws it for you. */}
      {penalty && !penalty.canStack && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 z-30 flex justify-center",
            geo.eventBanner,
          )}
        >
          <motion.span
            variants={tableEventPop}
            initial={reduced ? false : "hidden"}
            animate="visible"
            className="inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-body text-surface shadow-cta"
          >
            Nothing to stack · drawing {penalty.count}
          </motion.span>
        </div>
      )}

      {/* Skip / reverse callouts over the piles. */}
      <TableEventLayer
        shown={tableEvent}
        view={view}
        bannerClassName={geo.eventBanner}
        stampClassName={geo.eventStamp}
        reduced={reduced}
      />

      <TableFlights
        flights={flights.flights}
        geometry={flightGeometry(view, placedSeats, tableWidth, geo)}
        onDone={flights.done}
      />
    </>
  );

  return (
    <div
      ref={setTableEl}
      // Fills the shell's padded box (safe areas included) so the scaled
      // stage never runs under a notch or past the bottom edge.
      className="relative h-full w-full select-none overflow-hidden bg-paper"
      style={{ touchAction: "manipulation" }}
    >
      {/* Polite live region — turn changes + the card in play (Req 18.4/18.7). */}
      <LiveAnnouncer message={announcement} />

      {/* The table is laid out on a fixed stage (390×844 portrait, 1280×800
          landscape, 900×440 on a phone on its side), centered and scaled
          uniformly to fit — so short screens (Safari with its toolbars, a
          notch) still show the whole table, hand included (Req 16.4). */}
      <div
        ref={setStageEl}
        className={cn(
          "absolute top-1/2 left-1/2 origin-center -translate-x-1/2 -translate-y-1/2 scale-(--stage-scale)",
          geo.stage,
        )}
        style={{ "--stage-scale": stageScale } as CSSProperties}
      >
        {table}
      </div>

      {/* Overlay slot — task 8.5 / 8.7 render here over the table (outside
          the landscape stage, so they cover the whole window unscaled;
          table-anchored pieces portal into the stage via `TableLayer`). */}
      <TableStageContext.Provider value={stageEl}>
        {overlay}
      </TableStageContext.Provider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seat layout + ring helpers.
// ---------------------------------------------------------------------------

interface PlacedSeat {
  seat: OpponentSeatView;
  kind: SeatKind;
  style: CSSProperties;
}

/**
 * Where flying cards land at a seat: the middle of its face-down back stack,
 * below the avatar and name (§7.5/§7.6 positions).
 */
function seatLanding({ kind, style }: PlacedSeat, width: number): Point {
  const w = Number(style.width);
  const x =
    style.left !== undefined
      ? Number(style.left) + w / 2
      : width - Number(style.right) - w / 2;
  return { x, y: Number(style.top) + (kind === "top" ? 88 : 100) };
}

/** Table coordinates for the opponent draw / play flights. */
function flightGeometry(
  view: GameView,
  placed: PlacedSeat[],
  width: number,
  geo: TableGeometry,
): FlightGeometry {
  const seats: Record<string, Point> = {};
  for (const p of placed) seats[p.seat.id] = seatLanding(p, width);
  if (view.partner) seats[view.partner.id] = { x: width / 2, y: geo.partnerLandingY };
  return {
    drawPile: geo.drawPileCenter,
    discardSlot: geo.discardSlot,
    discardCenter: geo.discardCenter,
    seats,
  };
}

/** The pieces of the view the flights diff between renders. */
function tableSnapshot(view: GameView): TableSnapshot {
  const counts: Record<string, number> = {};
  for (const o of view.opponents) counts[o.id] = o.cardCount;
  if (view.partner) counts[view.partner.id] = view.partner.hand.length;
  return {
    selfId: view.selfId,
    activeSeatId: view.activeSeatId,
    counts,
    discardTop: view.discardTop,
    penaltyCount: view.penaltyCount ?? 0,
  };
}

/**
 * Place opponent seats around the table. In 2v2 both opponents sit on the sides
 * (left / right, §7.5). In Normal, seats fill clockwise from the viewer's left:
 * left, top-left, top-right, right, then the far side (§7.6). Positions come
 * from the layout's table geometry.
 */
function seatLayout(view: GameView, geo: TableGeometry): PlacedSeat[] {
  const isTeam = view.room.mode === "team";
  if (isTeam) {
    // Team mode: partner is separate; the two opponents are the side seats.
    const [left, right] = view.opponents;
    const placed: PlacedSeat[] = [];
    if (left) placed.push({ seat: left, ...geo.teamSeats[0] });
    if (right) placed.push({ seat: right, ...geo.teamSeats[1] });
    return placed;
  }

  // Normal: clockwise from your left — left, top-left, top-right, right.
  const slots = geo.normalSeats;
  return view.opponents.slice(0, slots.length).map((seat, i) => ({
    seat,
    kind: slots[i].kind,
    style: slots[i].style,
  }));
}

/**
 * Opponent avatar ring. In 2v2 it's the team color (§7.5 — rings carry team
 * identity, Req 6.6). In Normal every ring is `ink-muted` EXCEPT the active
 * player, who gets the `turn` ring (§7.6 / Req 6.4/6.5).
 */
function ringForOpponent(
  seat: OpponentSeatView,
  isTeam: boolean,
  active: boolean,
): AvatarRing {
  if (isTeam) return seat.team ? TEAM_RING[seat.team] : "ink-muted";
  return active ? "turn" : "ink-muted";
}

/** Suit → discard-top glow color (rgba around the played card, §7.5). */
function glowFor(color: Suit): string {
  switch (color) {
    case "red":
      return "rgba(212, 83, 59, 0.45)";
    case "yellow":
      return "rgba(224, 164, 35, 0.45)";
    case "green":
      return "rgba(91, 143, 78, 0.45)";
    case "blue":
      return "rgba(54, 89, 143, 0.45)";
  }
}

/** 20px menu glyph (design.md §5.4 icon button). */
function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
