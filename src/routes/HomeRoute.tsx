/**
 * Home route — screens `01-home`, `01b-home-room-not-found`, room-full, and
 * `01c-game-already-started` (design.md §7.3 / §7.9).
 *
 * The screen reads/creates rooms through the injectable `RoomStore`
 * (`@/game/view/store`) rather than talking to a backend directly — the
 * realtime layer + Cloud Functions (tasks 4/5/9) plug into that same seam
 * later. Today the store is fixture-backed.
 *
 * Screen states are driven by URL so Playwright (and links) can reach them:
 * - `?code=K7QX` pre-fills the join code from an invite link (Req 2.1/2.2).
 * - `?state=game-already-started&code=K7QX` renders the full-screen `01c`
 *   blocked state (Req 3.5); it is also shown after a join returns
 *   `game-already-started`.
 *
 * Tokens only, built to the PNGs (design-fidelity.md / token-policy.md); reuses
 * `PlayingCard`, `CardBack`, `Input`, `Button`, `IconButton`, `Chip`.
 */
import { Button } from "@/components/Button";
import { CardBack } from "@/components/CardBack";
import { Chip } from "@/components/Chip";
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { PlayingCard } from "@/components/PlayingCard";
import type { CardValue, Suit } from "@/design/suits";
import { useRoomStore } from "@/game/view/store";
import type { JoinFailureReason } from "@/game/view/types";
import { cn } from "@/lib/cn";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

/** Exactly 4 uppercase A–Z / 0–9 characters (Room_Code, Req 2.3/2.4). */
const ROOM_CODE_MAX = 4;

/** Strip to A–Z / 0–9, uppercase, cap at 4 chars as the player types (Req 2.4). */
function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_MAX);
}

/** A name is valid once trimmed of surrounding whitespace and non-empty (Req 1.12/2.7). */
function trimmedName(raw: string): string {
  return raw.trim();
}

/** Human-readable message for each join failure (design.md §5.21 / §7.9). */
function joinFailureMessage(reason: JoinFailureReason, code: string): string {
  switch (reason) {
    case "room-not-found":
      return `No room uses the code ${code}. Check the code with your friend and try again.`;
    case "room-full":
      return "This room is full. It already has 8 players.";
    case "game-already-started":
      // Surfaced as the full-screen 01c state, not an inline error.
      return "This game has already started.";
  }
}

export function HomeRoute() {
  const [params] = useSearchParams();
  const store = useRoomStore();
  const navigate = useNavigate();

  const prefillCode = sanitizeCode(params.get("code") ?? "");
  const blockedState = params.get("state");

  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode);
  const [nameError, setNameError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // 01c is a full-screen takeover (reached via invite link to an in-progress
  // game, or after a join returns game-already-started).
  if (blockedState === "game-already-started") {
    return (
      <GameAlreadyStarted
        code={prefillCode}
        onBackHome={() => navigate("/", { replace: true })}
      />
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const clean = trimmedName(name);
    if (!clean) {
      setNameError("Enter your name to create a room.");
      return;
    }
    setNameError(undefined);
    setBusy(true);
    const result = await store.createRoom(clean);
    setBusy(false);
    if (result.ok) {
      navigate(`/room/${result.room.code}`);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const clean = trimmedName(name);
    if (!clean) {
      setNameError("Enter your name to join a room.");
      return;
    }
    setNameError(undefined);
    if (code.length < ROOM_CODE_MAX) {
      setCodeError("Enter the 4-character room code.");
      return;
    }
    setCodeError(undefined);
    setBusy(true);
    const result = await store.join(code, clean);
    setBusy(false);
    if (result.ok) {
      navigate(`/room/${result.room.code}`);
      return;
    }
    if (result.reason === "game-already-started") {
      navigate(`/?state=game-already-started&code=${code}`);
      return;
    }
    setCodeError(joinFailureMessage(result.reason, code));
  }

  return (
    <div className="flex h-full flex-col gap-[22px] px-6 pt-safe pb-safe">
      {/* 1 — settings icon, aligned right */}
      <div className="flex h-11 justify-end">
        <IconButton aria-label="Settings" onClick={() => navigate("/settings")}>
          <SettingsIcon />
        </IconButton>
      </div>

      {/* 2 — hero card fan */}
      <HeroFan />

      {/* 3 — title + tagline */}
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-center font-display text-hero text-ink">
          Homemade Uno
        </h1>
        <p className="text-paragraph text-ink-muted">
          Card nights with friends, right from your phone
        </p>
      </div>

      {/* 4/5 — name + Create a room (one form so Enter submits create) */}
      <form
        className="flex flex-col gap-[22px]"
        onSubmit={handleCreate}
        noValidate
      >
        <Input
          label="Your name"
          placeholder="e.g. Maya"
          value={name}
          maxLength={16}
          {...(nameError ? { error: nameError } : {})}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(undefined);
          }}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Create a room
        </Button>
      </form>

      {/* 6 — "or join a friend" divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-label text-ink-muted">or join a friend</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* 7 — room code + Join */}
      <form className="flex flex-col gap-2" onSubmit={handleJoin} noValidate>
        <div className="flex items-end gap-2.5">
          <Input
            className="flex-1"
            inputClassName="font-display text-input tracking-[0.3em] uppercase"
            label="Room code"
            placeholder="K7QX"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={ROOM_CODE_MAX}
            value={code}
            {...(codeError ? { error: codeError } : {})}
            onChange={(e) => {
              setCode(sanitizeCode(e.target.value));
              if (codeError) setCodeError(undefined);
            }}
          />
          <Button
            type="submit"
            variant="outline"
            className="h-[52px] w-24 rounded-input"
            disabled={busy}
          >
            Join
          </Button>
        </div>
      </form>

      {/* 8 — spacer + "How to play" link */}
      <div className="flex-1" />
      <Link
        to="/how-to-play"
        className="self-center p-3 text-body text-ink underline"
      >
        How to play
      </Link>
    </div>
  );
}

/** One hero-fan card: suit/value plus its fan geometry (§7.3). */
interface HeroCard {
  suit?: Suit;
  value: CardValue;
  /** Pivot rotation about the card's bottom edge, in degrees. */
  rotation: number;
  /** Horizontal offset (px) from the fan centre. */
  offsetX: number;
  /** Inner cards sit raised; outer cards drop 18px lower (§7.3). */
  raised?: boolean;
}

/**
 * The five hero cards pivot on their bottom edge (design.md §7.3): red 7 −24°,
 * yellow 2 −12°, Wild +4 0° (raised, on top), blue skip +12°, green 9 +24°,
 * fanned ±40/±80px from centre. The outer cards sit 18px lower than the inner
 * ones. Wild +4 is drawn last so it layers on top.
 */
const HERO_CARDS: readonly HeroCard[] = [
  { suit: "red", value: 7, rotation: -24, offsetX: -80 },
  { suit: "yellow", value: 2, rotation: -12, offsetX: -40, raised: true },
  { suit: "blue", value: "skip", rotation: 12, offsetX: 40, raised: true },
  { suit: "green", value: 9, rotation: 24, offsetX: 80 },
  { value: "wild4", rotation: 0, offsetX: 0, raised: true },
] as const;

/**
 * Decorative hero card fan (170px tall). The cards are purely presentational,
 * so each `PlayingCard` is hidden from assistive tech and removed from the tab
 * order. Rotation and horizontal offset are runtime fan geometry, applied via
 * CSS variables per styling.md (no interpolated class fragments).
 */
function HeroFan() {
  return (
    <div className="relative -mx-6 h-[170px]" aria-hidden="true">
      {HERO_CARDS.map((card, i) => (
        <PlayingCard
          key={i}
          {...(card.suit ? { suit: card.suit } : {})}
          value={card.value}
          variant="hero"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            ["--rot" as string]: `${card.rotation}deg`,
            ["--dx" as string]: `${card.offsetX}px`,
          }}
          className={cn(
            "absolute left-1/2 origin-bottom translate-x-[calc(-50%+var(--dx))] rotate-[var(--rot)] shadow-panel",
            card.raised ? "bottom-0" : "bottom-[18px]",
          )}
        />
      ))}
    </div>
  );
}

/**
 * `01c-game-already-started` (design.md §7.9). A full-screen takeover: three
 * fanned card backs, the "ROOM · CODE" chip, the title + explanation, a spacer,
 * and a primary "Back to home" button.
 */
function GameAlreadyStarted({
  code,
  onBackHome,
}: {
  code: string;
  onBackHome: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-[22px] px-6 pt-safe pb-safe">
      <div className="h-11 shrink-0" />
      <BackFan />
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Chip variant="info">ROOM · {code}</Chip>
        <h1 className="font-display text-title text-ink">
          This game has already started
        </h1>
        <p className="max-w-[300px] text-paragraph text-ink-muted">
          New players can join between games. Ask the host to send the link
          again when this one ends.
        </p>
      </div>
      <div className="flex-1" />
      <Button variant="primary" onClick={onBackHome}>
        Back to home
      </Button>
    </div>
  );
}

/** Rotation + horizontal offset for each of the three fanned card backs (01c). */
const BACK_FAN: readonly {
  rotation: number;
  offsetX: number;
  raised: boolean;
}[] = [
  { rotation: -14, offsetX: -62, raised: false },
  { rotation: 14, offsetX: 62, raised: false },
  { rotation: 0, offsetX: 0, raised: true },
] as const;

/**
 * Three decorative fanned card backs for the 01c blocked screen. The centre
 * back sits raised and on top; the outer two drop 20px. Presentational only,
 * so hidden from assistive tech.
 */
function BackFan() {
  return (
    <div className="relative -mx-6 mt-10 h-40 shrink-0" aria-hidden="true">
      {BACK_FAN.map((card, i) => (
        <CardBack
          key={i}
          variant="draw-pile"
          aria-label="Face-down card"
          style={{
            ["--rot" as string]: `${card.rotation}deg`,
            ["--dx" as string]: `${card.offsetX}px`,
          }}
          className={cn(
            "absolute left-1/2 origin-bottom translate-x-[calc(-50%+var(--dx))] rotate-[var(--rot)]",
            card.raised ? "top-0" : "top-5",
          )}
        />
      ))}
    </div>
  );
}

/** 20px settings gear (design.md §5.4 icon button; Lucide Settings). */
function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
