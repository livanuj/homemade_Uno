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
import { MotionCard } from "@/components/MotionCard";
import { PlayingCard } from "@/components/PlayingCard";
import { TurnPill, type TurnPillTone } from "@/components/TurnPill";
import type { Suit } from "@/design/suits";
import type {
  CardView,
  Direction,
  GameView,
  OpponentSeatView,
  PartnerSeatView,
} from "@/game/view/types";
import { cn } from "@/lib/cn";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Static token maps (styling.md — the compiler must see whole class names).
// ---------------------------------------------------------------------------

/** Active-color → dashed ring / turn-pill dot tone. */
const SUIT_TONE: Record<Suit, TurnPillTone> = {
  red: "red",
  yellow: "yellow",
  green: "green",
  blue: "blue",
};

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
const MAX_STEP = 42; // max horizontal spacing between cards

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
export function fanSlot(i: number, n: number, w: number): FanSlot {
  const step =
    n <= 1 ? 0 : Math.min(MAX_STEP, (w - FAN_MARGIN * 2 - CARD_W) / (n - 1));
  const left = (w - (CARD_W + step * (n - 1))) / 2 + i * step;
  const t = i - (n - 1) / 2;
  const rotate = t * (30 / Math.max(n - 1, 1));
  const top = 22 + 2.4 * t * t;
  return { left, rotate, top };
}

// ---------------------------------------------------------------------------
// 3D-recipe face-down back rows (design.md §6).
// ---------------------------------------------------------------------------

/** At most 7 backs are drawn per seat regardless of the real count (§6). */
const MAX_BACKS = 7;

type SeatKind = "top" | "left" | "right";

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

/** One opponent seat — avatar (ring + real-count badge) + name + face-down backs. */
function OpponentSeat({
  seat,
  kind,
  ring,
  activeTurn,
  style,
}: {
  seat: OpponentSeatView;
  kind: SeatKind;
  ring: AvatarRing;
  activeTurn: boolean;
  style: CSSProperties;
}) {
  return (
    <div className="absolute flex flex-col items-center gap-1" style={style}>
      <Avatar
        name={seat.name}
        size={44}
        ring={ring}
        cardCount={seat.cardCount}
        activeTurn={activeTurn}
      />
      <span className="text-caption font-bold text-ink">{seat.name}</span>
      <div className={kind === "top" ? undefined : "mt-1.5"}>
        <BackStack kind={kind} count={seat.cardCount} />
      </div>
    </div>
  );
}

/** The partner seat (2v2, top) — face-up hand with the partner 3D recipe (§6). */
function PartnerSeat({ partner }: { partner: PartnerSeatView }) {
  return (
    <div className="absolute left-0 top-[70px] flex w-full flex-col items-center gap-1">
      <div className="flex items-center gap-2.5">
        <Avatar name={partner.name} size={40} ring={TEAM_RING[partner.team]} />
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

/** SVG dashed direction ring in the active color; arrowheads flip when reversed. */
function DirectionRing({
  color,
  direction,
}: {
  color: Suit;
  direction: Direction;
}) {
  const stroke = SUIT_STROKE[color];
  return (
    <svg
      className="absolute left-[90px] top-[290px]"
      width="210"
      height="210"
      viewBox="0 0 210 210"
      fill="none"
      aria-hidden="true"
      style={
        direction === -1
          ? { transform: "scaleX(-1)", transformOrigin: "center" }
          : undefined
      }
    >
      <circle
        cx="105"
        cy="105"
        r="96"
        stroke={stroke}
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeDasharray="10 12"
      />
      <path
        d="M190 70 l6 14 l-15 -2"
        stroke={stroke}
        strokeOpacity="0.8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 140 l-6 -14 l15 2"
        stroke={stroke}
        strokeOpacity="0.8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Draw pile (tappable back stack) + discard pile (prev at −12°, top at +8° with a suit glow). */
function Piles({
  discardTop,
  discardPrev,
  onDraw,
}: {
  discardTop: CardView;
  discardPrev?: CardView;
  onDraw?: () => void;
}) {
  return (
    <div className="absolute left-[105px] top-[340px] flex h-[116px] w-[180px] items-center justify-center gap-[22px]">
      <CardBack variant="draw-pile" {...(onDraw ? { onClick: onDraw } : {})} />
      <div className="relative h-[108px] w-[74px]">
        {discardPrev && (
          <div
            className="absolute inset-0"
            style={{ transform: "rotate(-12deg)" }}
          >
            <PlayingCard variant="pile" {...faceProps(discardPrev)} />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            transform: "rotate(8deg)",
            filter: "drop-shadow(0 0 16px var(--pile-glow))",
          }}
        >
          <PlayingCard variant="pile" {...faceProps(discardTop)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your hand fan (§7.7).
// ---------------------------------------------------------------------------

/**
 * The caller's fanned hand (§7.7). Each card is a `MotionCard` (so task 9 can
 * animate a play) positioned absolutely by the fan math. Unplayable cards are
 * dimmed only when `highlight` is on (Req 7.5/7.6); the selected card is raised
 * to `top: 0, rotate: 0` with the team-colored lift ring.
 */
function HandFan({
  view,
  highlight,
  width,
}: {
  view: GameView;
  highlight: boolean;
  width: number;
}) {
  const n = view.hand.length;
  const liftRing =
    view.selfTeam === "B" ? "var(--color-team-b)" : "var(--color-team-a)";
  return (
    <div className="absolute left-0 top-[664px] h-[180px] w-full">
      {view.hand.map((card, i) => {
        const slot = fanSlot(i, n, width);
        const selected = !!card.selected;
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
          <div key={card.id} style={style}>
            <MotionCard
              cardId={card.id}
              {...faceProps(card)}
              variant="hand"
              selected={selected}
              dim={highlight && !card.playable}
              reduced
            />
          </div>
        );
      })}
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
  /** Container width in px for the fan math (§7.7). Defaults to 390 (design). */
  width?: number;
  /** Open the in-game menu (task 8.5 renders the drawer). */
  onMenu?: () => void;
  /** Draw a card (task 9 wires the flow). */
  onDraw?: () => void;
  /** Call "LAST CARD!" (task 9 wires the flow). */
  onCallLastCard?: () => void;
  /**
   * Overlay slot rendered OVER the table (task 8.5 menu/sheets, 8.7 paused).
   * Left as a clean seam here; 8.4 does not implement any overlay.
   */
  overlay?: ReactNode;
}

export function GameTable({
  view,
  highlight = true,
  width = 390,
  onMenu,
  onDraw,
  onCallLastCard,
  overlay,
}: GameTableProps) {
  const isTeam = view.room.mode === "team";
  const tone = SUIT_TONE[view.activeColor];
  const isYourTurn = view.activeSeatId === view.selfId;

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

  return (
    <div
      className="relative h-dvh w-full select-none overflow-hidden bg-paper"
      style={{ touchAction: "manipulation" }}
    >
      {/* Felt table oval. */}
      <div className="absolute left-5 top-[150px] h-[470px] w-[350px] rounded-[50%] border-2 border-felt-edge bg-felt inset-shadow-felt" />

      {/* Top bar — room chip · mode chip ("Round N") · menu. */}
      <div className="absolute inset-x-4 top-4 flex h-11 items-center justify-between">
        <Chip variant="info">ROOM · {view.room.code}</Chip>
        <Chip variant="outline">{modeChip}</Chip>
        <IconButton aria-label="Menu" onClick={onMenu}>
          <MenuIcon />
        </IconButton>
      </div>

      {/* Partner seat (2v2 only) — face-up hand at the top. */}
      {isTeam && view.partner && <PartnerSeat partner={view.partner} />}

      {/* Opponent seats — face-down backs with the 3D recipe (§6). */}
      {seatLayout(view).map(({ seat, kind, style }) => {
        const seatActive = view.activeSeatId === seat.id;
        return (
          <OpponentSeat
            key={seat.id}
            seat={seat}
            kind={kind}
            ring={ringForOpponent(seat, isTeam, seatActive)}
            activeTurn={seatActive}
            style={style}
          />
        );
      })}

      {/* Direction ring — dashed circle in the active color; arrows flip when reversed. */}
      <DirectionRing color={view.activeColor} direction={view.direction} />

      {/* Piles — draw (left) + discard (right). Glow var drives the top-card glow. */}
      <div
        style={{ "--pile-glow": glowFor(view.activeColor) } as CSSProperties}
      >
        <Piles
          discardTop={view.discardTop}
          {...(view.discardPrev ? { discardPrev: view.discardPrev } : {})}
          {...(onDraw ? { onDraw } : {})}
        />
      </div>

      {/* Turn pill (§5.5). */}
      <div className="absolute left-0 top-[512px] flex w-full justify-center">
        <TurnPill tone={isYourTurn ? tone : "turn"}>{view.turnText}</TurnPill>
      </div>

      {/* Your row — avatar (team/turn ring + pulse), "You", meta, "LAST CARD!". */}
      <div className="absolute inset-x-4 top-[596px] flex h-12 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar
            name={view.selfName}
            size={44}
            ring={isYourTurn && !isTeam ? "turn" : selfRing}
            activeTurn={isYourTurn}
          />
          <div className="flex flex-col">
            <span className="text-body text-ink">You</span>
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
        <Button
          variant="outline"
          className="h-11 font-display uppercase tracking-[0.04em]"
          disabled={!view.canCallLastCard}
          onClick={onCallLastCard}
        >
          LAST CARD!
        </Button>
      </div>

      {/* Your hand fan (§7.7). */}
      <HandFan view={view} highlight={highlight} width={width} />

      {/* Overlay slot — task 8.5 / 8.7 render here over the table. */}
      {overlay}
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
 * Place opponent seats around the table. In 2v2 both opponents sit on the sides
 * (left / right, §7.5). In Normal, seats fill clockwise from the viewer's left:
 * left, top-left, top-right, right, then the far side (§7.6). Positions come
 * straight from the design layout table.
 */
function seatLayout(view: GameView): PlacedSeat[] {
  const isTeam = view.room.mode === "team";
  if (isTeam) {
    // Team mode: partner is separate; the two opponents are the side seats.
    const [left, right] = view.opponents;
    const placed: PlacedSeat[] = [];
    if (left)
      placed.push({
        seat: left,
        kind: "left",
        style: { left: 8, top: 272, width: 76 },
      });
    if (right)
      placed.push({
        seat: right,
        kind: "right",
        style: { right: 8, top: 272, width: 76 },
      });
    return placed;
  }

  // Normal: clockwise from your left — left, top-left, top-right, right.
  const slots: { kind: SeatKind; style: CSSProperties }[] = [
    { kind: "left", style: { left: 8, top: 272, width: 76 } },
    { kind: "top", style: { left: 56, top: 72, width: 120 } },
    { kind: "top", style: { left: 214, top: 72, width: 120 } },
    { kind: "right", style: { right: 8, top: 272, width: 76 } },
  ];
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
