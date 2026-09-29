# Design Document: Homemade Uno

## Overview

Homemade Uno is a mobile-only, portrait, link-shareable multiplayer UNO-style card game delivered as an installable PWA. Players create a private room, share an invite link (or a 4-character room code), and play a standard 108-card match with 2–8 friends. There are no accounts and no bots. The host picks the mode in the lobby: Normal (free-for-all, 2–8 players) or 2v2 Team mode (exactly 4 players, partners see each other's hands, a team wins when either partner empties their hand).

The system is **server-authoritative**. A Supabase backend deals, shuffles, and validates every action; clients only render state and send action requests. This is the load-bearing decision for the whole design because three requirements depend on it:

- **Requirement 23 (Hidden Hands and Server Authority)** — the server, not the client, holds the deck order and every hand. Clients never receive another player's hand (except a partner's in Team mode) or the draw-pile order.
- **Requirement 14 (Realtime Synchronization)** — the server persists authoritative state before confirming a change, validates every play/draw, versions each state transition, and rejects out-of-turn or stale actions.
- **Requirement 25 / 15 (Pausing, Disconnect)** — pause/resume and the disconnect grace period are enforced server-side against a recorded `last_seen`, so no client can fake presence or skip the countdown.

The rest of the design is organized around that spine:

| Area                                                                | Requirements covered        |
| ------------------------------------------------------------------- | --------------------------- |
| Rooms, codes, invite links, join/rejoin                             | 1, 2, 3, 24                 |
| Lobby, mode selection, team arrangement                             | 4, 21                       |
| Dealing, turn flow, matching, wilds, stacking, draw, last-card, win | 5, 6, 7, 8, 9, 10, 11, 12   |
| Team visibility                                                     | 13                          |
| Realtime, disconnect/reconnect, hidden hands                        | 14, 15, 23                  |
| Pausing (manual and auto)                                           | 25                          |
| PWA / mobile constraints, animation, accessibility                  | 16, 17, 18                  |
| Screen coverage and design fidelity                                 | 19, 20, Development Process |
| Leaving                                                             | 22                          |

Every visual decision in this document is grounded in the `Design_Spec` (`design/uno-design/design.md`, `screen-map.json`, `theme.css`, `tokens.json`, `screens/`). No new tokens or visual values are introduced (Requirement 20).

### Confirmed technology stack

- **Frontend:** React + Vite, Tailwind CSS v4, Motion for React (`motion/react`) for animation. Mobile-only, portrait, installable PWA (manifest + service worker).
- **Backend / realtime / data:** Supabase — Postgres for state, Supabase Realtime for live sync, Supabase anonymous auth for `Player_ID`, Row Level Security (RLS) to enforce hidden hands, and Edge Functions / Postgres RPC for server-authoritative game logic.
- **Identity:** a Supabase anonymous sign-in session is the `Player_ID`. Rejoin uses the invite link plus the persisted session.
- No bots. No per-turn timer for connected players. A 60-second `Grace_Period` applies to a disconnected active player, then their turn is auto-skipped. Pause / Auto_Pause per Requirement 25.

---

## Architecture

### System context

```mermaid
graph TB
  subgraph Client["React PWA (mobile, portrait)"]
    UI["Screens & components<br/>(22 screen refs)"]
    RS["Realtime store<br/>(public state + own hand)"]
    AC["Action client<br/>(sends versioned requests)"]
    SW["Service worker + manifest"]
  end

  subgraph Supabase["Supabase"]
    AUTH["Anonymous Auth<br/>(Player_ID)"]
    PG[("Postgres<br/>rooms, players, game_state,<br/>hands, actions")]
    RLS["Row Level Security<br/>(hidden hands)"]
    RT["Realtime<br/>(Postgres changes + presence)"]
    FN["Edge Functions / RPC<br/>(authoritative rules engine)"]
  end

  UI --> RS
  UI --> AC
  AC -->|"play/draw/pause… + state version"| FN
  FN -->|deal, shuffle, validate, mutate| PG
  PG --- RLS
  PG -->|row changes| RT
  RT -->|public state, own/partner hand| RS
  AUTH -->|session = Player_ID| Client
  RLS -.->|filters reads| RT
```

### Why game logic lives server-side

A browser client cannot be trusted with the deck order or other players' hands: anything sent to the client can be inspected in network traffic (Requirement 23). Therefore:

1. **The rules engine runs only in Edge Functions / Postgres RPC.** Dealing, shuffling, match validation, penalty resolution, and win detection all execute server-side. The client sends an _intent_ ("play card X, based on state version V") and receives an accept/reject result plus a broadcast of the new public state.
2. **RLS enforces read scope.** A player can `SELECT` only their own hand row, the public game state, and — in Team mode — their partner's hand row. No policy grants any client read access to the draw-pile order.
3. **Persist-before-confirm.** The Edge Function writes the mutated authoritative state to Postgres inside a single transaction before the change is confirmed, so the state survives any individual disconnect (Requirement 14.4).

### Request / response + realtime flow for "play a card"

```mermaid
sequenceDiagram
  participant P as Player (Active)
  participant EF as Edge Function<br/>play_card(room, card, version)
  participant DB as Postgres (+RLS)
  participant RT as Realtime
  participant All as All players in room

  P->>EF: play_card(card_id, based_on_version=V)
  EF->>DB: read authoritative game_state (row lock)
  alt version mismatch, paused, not active player, or illegal card
    EF-->>P: reject (reason code)
    Note over P: client shows illegal-tap shake / toast,<br/>hand & state unchanged (Req 7.3, 14.5)
  else valid
    EF->>DB: apply rules (move card, set color,<br/>penalty, advance turn), version = V+1
    DB-->>EF: committed
    EF-->>P: accept (new public state, your hand)
    DB->>RT: row change (game_state, hands, actions)
    RT-->>All: public state broadcast (< 2s, Req 14.1)
    RT-->>All: each client reads only permitted hands (RLS)
  end
```

The client is optimistic only for local feedback (raising a card, drawing animation); the authoritative outcome always comes from the server broadcast. If the server rejects, the client reverts to the last confirmed state.

### How server-authority + RLS satisfy Requirements 23 and 14

- **Req 23.1 / 23.2 (never send other hands or draw order):** The `hands` table holds one row per player per game; RLS restricts `SELECT` to `player_id = auth.uid()` plus the partner in Team mode. The draw pile is stored as a server-only ordered column on `game_state` with **no** `SELECT` policy for clients — only Edge Functions (service role) read it.
- **Req 23.3 (server deals, shuffles, applies rules):** All mutations flow through Edge Functions / RPC; there is no client write path to `game_state` or `hands`.
- **Req 14.5 (validate every action, reject non-active and stale):** Each action carries `based_on_version`; the function rejects if the caller is not the active player or if `based_on_version != game_state.version`.
- **Req 14.6 (read scope):** Enforced by the same RLS policies described above.
- **Req 14.4 / 14.7 (durability and reconnect):** State is persisted per action; on reconnect the client re-subscribes and reads the current public state and its own hand (delivered within 5 s).

---

## Data Models

Postgres schema. All game-mutating writes happen through Edge Functions using the service role; clients read through RLS-protected views/tables and never write game tables directly.

### Tables

**`rooms`**

| Column                            | Type        | Notes                                                    |
| --------------------------------- | ----------- | -------------------------------------------------------- |
| `id`                              | uuid PK     |                                                          |
| `room_code`                       | text unique | 4 chars, A–Z/0–9 minus look-alikes `0 O 1 I L` (Req 1.9) |
| `host_player_id`                  | uuid        | current host (Req 3.6, 12.7, 15.8)                       |
| `game_mode`                       | text        | `normal` \| `team` (Req 4)                               |
| `phase`                           | text        | `lobby` \| `playing` \| `ended`                          |
| `round_number`                    | int         | games played in the room; shown as "Round N" (Req 12.6)  |
| `created_at` / `last_activity_at` | timestamptz | 24 h inactivity cleanup (Req 24.2)                       |

**`players`** (a seat/membership in a room)

| Column             | Type        | Notes                                                                                   |
| ------------------ | ----------- | --------------------------------------------------------------------------------------- |
| `id`               | uuid PK     |                                                                                         |
| `room_id`          | uuid FK     |                                                                                         |
| `player_id`        | uuid        | Supabase anonymous `auth.uid()` (Req 3.1)                                               |
| `display_name`     | text        | 1–16 chars trimmed; duplicate suffixing applied (Req 1.12, 1.13)                        |
| `seat_index`       | int null    | assigned at game start, kept for the game (Req 5.7)                                     |
| `team`             | text null   | `A` \| `B` in Team mode (Req 5.7)                                                       |
| `is_host`          | bool        | derived from `rooms.host_player_id`; retained per seat while host is offline (Req 15.8) |
| `join_order`       | int         | for host succession "longest-present" (Req 3.6, 12.7)                                   |
| `connection_state` | text        | `connected` \| `disconnected` \| `left` (Req 15, 22)                                    |
| `last_seen`        | timestamptz | server-recorded; drives Grace_Period (Req 15.6)                                         |
| `has_left`         | bool        | explicit leave (Req 22)                                                                 |

Unique: `(room_id, player_id)`.

**`game_state`** (one row per room while playing)

| Column                  | Type             | Notes                                                                                              |
| ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `room_id`               | uuid PK/FK       |                                                                                                    |
| `version`               | bigint           | optimistic-concurrency token; incremented every mutation (Req 14.5)                                |
| `draw_pile`             | jsonb (ordered)  | **server-only**, no client SELECT policy (Req 23.2)                                                |
| `discard_pile`          | jsonb (ordered)  | public; top card is the match constraint                                                           |
| `active_color`          | text             | red/yellow/green/blue (Req 7, 8)                                                                   |
| `active_seat`           | int              | exactly one active player (Req 6)                                                                  |
| `direction`             | int              | `+1` clockwise / `-1` counter-clockwise (Req 6)                                                    |
| `penalty_count`         | int              | pending +2/+4 total (Req 9)                                                                        |
| `pending_penalty_kind`  | text null        | `two` \| `four` — governs stacking eligibility (Req 9.5)                                           |
| `phase`                 | text             | `dealing` \| `active` \| `wild_pending` \| `drew_decision` \| `paused` \| `auto_paused` \| `ended` |
| `drew_this_turn`        | bool             | one draw per turn (Req 10.3)                                                                       |
| `last_card_called_seat` | int null         | current turn's Last_Card_Call (Req 11)                                                             |
| `paused_by`             | uuid null        | who paused (Req 25.4)                                                                              |
| `paused_at`             | timestamptz null | drives "Paused for m:ss" (Req 25)                                                                  |
| `pending_choice`        | jsonb null       | wild-color or play/keep choice to re-show after resume (Req 25.14)                                 |
| `winner`                | jsonb null       | winning player or team (Req 12)                                                                    |

**`hands`** (one row per player per game)

| Column       | Type            | Notes                                       |
| ------------ | --------------- | ------------------------------------------- |
| `room_id`    | uuid FK         |                                             |
| `player_id`  | uuid            |                                             |
| `seat_index` | int             |                                             |
| `team`       | text null       |                                             |
| `cards`      | jsonb (ordered) | the player's cards                          |
| `card_count` | int             | denormalized for opponent badges (Req 13.5) |

Primary key `(room_id, player_id)`.

**`actions`** (append-only event log; concurrency + audit + reconnect replay)

| Column             | Type         | Notes                                                                                                                                       |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | bigserial PK |                                                                                                                                             |
| `room_id`          | uuid FK      |                                                                                                                                             |
| `player_id`        | uuid         | actor                                                                                                                                       |
| `type`             | text         | `play` \| `draw` \| `keep` \| `choose_color` \| `call_last` \| `pause` \| `resume` \| `continue_without` \| `end_game` \| `join` \| `leave` |
| `based_on_version` | bigint       | version the client acted on (Req 14.5)                                                                                                      |
| `result`           | text         | `accepted` \| `rejected` + reason                                                                                                           |
| `created_at`       | timestamptz  |                                                                                                                                             |

The append-only log lets a reconnecting client confirm it is on the latest version and supports server-side conflict rejection: an action whose `based_on_version` is not the current `game_state.version` is rejected as stale.

### Card representation

A card is `{ id, suit?, value }` where `suit ∈ {red,yellow,green,blue}` (absent for wilds) and `value ∈ {0..9, +2, skip, reverse, wild, wild4}`. `id` is a stable identifier used for the shared-layout play animation (`layoutId`, Req 17.1).

### RLS policies (read scope)

- **`game_state` public projection:** a view exposing everything _except_ `draw_pile`. Members of the room may `SELECT` it. `draw_pile` is never selectable by clients (Req 23.2).
- **`hands`:** `SELECT` allowed when `player_id = auth.uid()`; additionally, in Team mode, when the requesting player and the row's player share the same `team` in the same room (partner readability, Req 13.8, 14.6). No cross-team, non-self reads (Req 23.1).
- **`players`, `rooms`:** public within the room (names, connection state, mode, code) — no hand data.
- **All game-table writes:** service role only (Edge Functions). No client `INSERT/UPDATE/DELETE` policy on `game_state`, `hands`, or `draw_pile`.

```mermaid
erDiagram
  rooms ||--o{ players : has
  rooms ||--|| game_state : has
  rooms ||--o{ hands : has
  rooms ||--o{ actions : logs
  players ||--o| hands : holds
```

---

## Game Engine / Rules

The rules engine is a pure module that takes an authoritative state plus an action and returns either a new state or a rejection. It lives server-side (Edge Function / RPC) and is the core correctness surface. Keeping it pure (no I/O, deterministic given an injected RNG seed) is what makes the property-based tests in the Testing Strategy possible.

### Deck composition and shuffle (Req 5.1, 5.2)

- Build the **108-card deck**: per suit — one `0`, two each of `1`–`9`, two `+2`, two `skip`, two `reverse`; plus 4 `wild` and 4 `wild4`. Total = 4×(1 + 18 + 2 + 2 + 2) + 8 = 4×25 + 8 = 108.
- Shuffle with a server-side CSPRNG (Fisher–Yates). The seed/order never leaves the server.

### Deal (Req 5.2–5.7)

- Deal exactly 7 cards to each player, one at a time, round-robin by seat, from the shuffled draw pile.
- Turn the top card face-up as the initial discard; set `active_color` to its suit. If it is **not** a number card, return it, reshuffle, and turn another until a number card is on top (Req 5.5).
- First active player = host; `direction = +1` (clockwise) (Req 5.6).
- Team mode: assign seats alternating Team A / Team B so partners sit opposite (Req 5.7).

### Turn advancement (Req 6)

- After a legal play or resolved draw, advance `active_seat` by `direction` to the next occupied seat.
- **Reverse:** 3+ players → invert `direction` (Req 6.2). Exactly 2 players → direction unchanged, opponent skipped, same player acts again (Req 6.3).
- **Skip:** 3+ players → advance past the next player (Req 6.4). Exactly 2 players → same player acts again (Req 6.5).
- A connected active player has no time limit (Req 6.8). A non-active player's play/draw is rejected with state unchanged (Req 6.9).

### Match validity (Req 7)

- Non-wild is legal iff its suit equals `active_color` **or** its value/symbol equals the top discard card's value/symbol.
- Wild / Wild +4 is legal when no penalty is pending (Req 7.2); under a pending penalty, only stackable cards are legal (see below).
- Illegal play → reject, card stays in hand, discard top / active color / active seat unchanged, illegal-tap shake shown (Req 7.3).
- On legal non-wild play, move to discard top and set `active_color` to its suit (Req 7.4).

### Wild color selection (Req 8)

- Playing a wild enters `wild_pending`: the player must pick one of four suits; the picker has **no cancel** (Req 8.1, `06a-wild-color-picker`).
- While pending, active player is unchanged and all other actions are rejected (Req 8.5). A winning wild still requires the color choice before the win resolves (Req 8.6).

### +2 / +4 asymmetric stacking (Req 9)

- `+2` adds 2 to `penalty_count`; `wild4` adds 4; each targets the next player.
- **Asymmetry:** a `+2` may stack onto a pending `+2` only; a `wild4` may stack onto a pending `+2` **or** `+4`. A `+2` may **not** be played onto a pending `+4` (Req 9.3, 9.5). `pending_penalty_kind` tracks which is on top.
- If the targeted player does not stack, they draw `penalty_count` cards, `penalty_count` resets to 0, and the turn advances (Req 9.4).
- A stacked `wild4` lets its player choose the color; the **last** chosen color applies after the penalty is drawn (Req 9.6).

### Draw-one (Req 10)

- With no penalty pending and nothing drawn yet this turn, drawing moves exactly one card; `drew_this_turn = true`.
- If the drawn card is playable, show "Play it" / "Keep it" (`drew_decision`, `06b-drew-playable-card`); "Keep it" ends the turn (Req 10.2, 10.4). If not playable, keep it and advance (Req 10.5).
- A second draw in the same turn is rejected (Req 10.3).
- **Reshuffle on empty:** if the draw pile is empty and the discard has ≥2 cards, reshuffle all discards except the top into a new face-down draw pile, then complete the draw (Req 10.7). If the discard has only its top card, complete the turn without drawing and advance (Req 10.8).

### Last-card call and penalty (Req 11)

- The "LAST CARD!" button is always visible, enabled only on the player's turn while holding exactly 2 cards (Req 11.1).
- Pressing it records `last_card_called_seat` for the turn.
- If a turn ends with the player holding 1 card and no call was recorded, that player draws 2 and a toast is shown (Req 11.3).
- When a hand grows above 1 card, the call is cleared (Req 11.4).

### Win conditions (Req 12)

- Normal: a hand becoming empty via a legal final play ends the game; that player wins.
- Team: either partner emptying their hand ends the game; that team wins.
- After a win, further actions are rejected with an "ended" indication; the result screen (`07-game-over`) shows remaining counts.

### Key invariants (drive property-based tests)

These must hold across all valid engine executions and are the basis for the Correctness Properties section:

1. **Card conservation:** at every state, cards across all hands + draw pile + discard pile = exactly 108, with no duplicate card `id`.
2. **Exactly one active player:** `active_seat` always references exactly one occupied, in-game seat.
3. **Penalty clears only by draw or valid stack:** `penalty_count` decreases to 0 only when the targeted player draws it; otherwise it strictly increases via legal stacking.
4. **Match legality:** any card added to the discard top satisfied Req 7.1/7.2 (or the stacking rules) at the moment it was played.
5. **Hidden-information boundary:** no engine output destined for a client ever includes another player's hand (except a partner's in Team mode) or the draw-pile order.

---

## Realtime & Presence

### Channels

Each room uses a Supabase Realtime channel keyed by `room_id` carrying two signal types:

1. **Postgres change subscriptions** on `game_state` (public projection), `players`, and the caller's own/partner `hands` rows. These deliver authoritative state within 2 s of a committed mutation (Req 14.1–14.3). RLS ensures each subscriber receives only rows it is allowed to read.
2. **Presence** to track live connection. A client joining the channel tracks its `player_id`; presence join/leave events flip `connection_state` and, importantly, a server-side path records `last_seen`.

### Connection state and last-seen

Presence alone is client-reported and not trustworthy for enforcing the grace period. So:

- Clients heartbeat by updating their own `players.last_seen` (allowed by a narrow RLS policy limited to that single column of the caller's own row).
- The **server** compares `now() - last_seen` against the 60 s `Grace_Period` before performing any skip (Req 15.6). A scheduled Edge Function (or an on-action check) performs the skip only after confirming the period elapsed and the game is not paused (Req 15.3).

### Disconnect / reconnect (Req 15)

```mermaid
stateDiagram-v2
  [*] --> Connected
  Connected --> Disconnected: presence leave / heartbeat stops
  Disconnected --> Connected: presence rejoin (sync within 5s, Req 14.7)
  Disconnected --> GraceCountdown: becomes active player's turn
  GraceCountdown --> Connected: reconnects in time
  GraceCountdown --> Skipped: 60s elapsed & not paused (Req 15.3)
  Skipped --> Disconnected: later turns skipped immediately (Req 15.5)
  Disconnected --> AutoPause: <2 connected, or a whole team offline (Req 15.7)
```

- On disconnect, other players see the player faded with an offline badge and a "[name] lost connection" toast (`06c-player-disconnected`, Req 15.1).
- When it becomes a disconnected player's turn, a countdown ring (§5.20) drains over 60 s; if not back and not paused, the turn is skipped and any pending penalty is drawn (Req 15.3). Subsequent turns are skipped immediately (Req 15.5) unless paused to wait.
- Host role is retained on the host's seat while the host is offline; the game continues for others (Req 15.8).

### Pause / resume propagation (Req 25, 14.1)

- Pause/resume are actions that set `game_state.phase` to `paused` / `auto_paused` / back to `active`, plus `paused_by` / `paused_at`. The state change broadcasts to all players within 2 s (Req 25.3, 14.1).
- While paused the server rejects every play, draw, last-card call, color choice, and skip, and the grace countdown is stopped (Req 25.6).
- **Auto-pause** triggers server-side when fewer than 2 players are connected, or in Team mode when both players of one team are disconnected (Req 15.7, 25.10). Auto-pause resumes automatically when the triggering condition clears (Req 25.12).
- A `pending_choice` captured at pause time (wild color, or play/keep) is re-shown to the same player on resume (Req 25.14).

---

## Components and Interfaces

This section describes the client-side structure — app organization, routing, state management, the screen-to-component mapping, shared components, and how design tokens/theme are wired in.

### App structure (React + Vite)

```
src/
  main.tsx                # PWA bootstrap, mounts <App/>, registers service worker
  App.tsx                 # router + global providers
  routes/                 # page-level routes
    HomeRoute.tsx         # 01-home, 01b, 01c states
    SettingsRoute.tsx     # 01d-settings
    HowToPlayRoute.tsx    # 01e-how-to-play
    LobbyRoute.tsx        # 02a–02f (mode/host/guest are state, not routes)
    GameRoute.tsx         # 03/04 table + all overlays
    GameOverRoute.tsx     # 07-game-over (+ variants)
  components/             # shared components (see below)
  game/                   # client-side view models (NOT the rules engine)
  realtime/               # channel subscription, presence, reconnect
  supabase/               # client, auth (anon), typed queries
  design/                 # tokens wiring, motion presets
```

### Routing

React Router with routes for **home**, **lobby**, **game**, **game over**, **settings**, and **how-to-play**. Everything the `screen-map.json` marks `"kind": "overlay"` (menu, wild picker, drew-a-card sheet, disconnected state, leave-confirm, paused overlays) is a **component rendered over the table**, not a route — matching the Design_Spec guidance. Lobby sub-states (`02a`–`02f`) and game tables (`03`/`04`) are the same route rendering different state.

### State management

- **Server state** (authoritative) arrives via Realtime and is held in a lightweight store (Zustand or React context + reducer). It is treated as read-only truth; the UI derives everything from it.
- **Local UI state** (selected card, open sheet, drag in progress, input text) is component-local.
- **Action dispatch** goes through the action client, which stamps each request with the current `game_state.version`; on rejection it reverts optimistic UI and, if needed, resyncs.
- **Device-persisted:** name and settings (sound, vibration, highlight playable) in `localStorage`; `Player_ID` is the Supabase anon session (Req 1.12, 3.1).

### Screen → component mapping (all 22 references)

| Screen ref                 | Route / rendering         | Key components                                                                                                                |
| -------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `01-home`                  | HomeRoute                 | HeroCardFan, Input, PrimaryButton, code Input, Join OutlineButton                                                             |
| `01b-home-room-not-found`  | HomeRoute (error state)   | InputError (§5.21)                                                                                                            |
| `01c-game-already-started` | HomeRoute (blocked state) | CardBack fan, room chip, SoftButton                                                                                           |
| `01d-settings`             | SettingsRoute             | SettingsPanel, Switch, LinkRow                                                                                                |
| `01e-how-to-play`          | HowToPlayRoute            | HowToPlaySection, verdict badges                                                                                              |
| `02a-lobby-just-created`   | LobbyRoute                | RoomCodePanel, ModeControl, PlayerList, EmptySlot, StartControl (disabled)                                                    |
| `02b-lobby-normal`         | LobbyRoute                | ModeControl (2v2 disabled + InfoNote), PlayerList                                                                             |
| `02c-lobby-2v2-waiting`    | LobbyRoute                | TeamCard, EmptySlot, DragHandle, StartControl (disabled)                                                                      |
| `02d-lobby-2v2-ready`      | LobbyRoute                | TeamCard, DragHandle, StartControl (enabled)                                                                                  |
| `02e-lobby-dragging`       | LobbyRoute (drag state)   | LiftedRow, DropTarget, dashed placeholder                                                                                     |
| `02f-lobby-guest`          | LobbyRoute (guest state)  | read-only ModeControl, StartControl guest (status pill + Leave)                                                               |
| `03-game-2v2`              | GameRoute                 | GameTable, PartnerHand (3D), OpponentSeat, DrawPile, DiscardPile, DirectionRing, TurnPill, PlayerRow, HandFan, LastCardButton |
| `04-game-normal`           | GameRoute                 | same table, no teams, active-player turn ring                                                                                 |
| `05-menu`                  | overlay                   | MenuDrawer, Switch, PauseButton, SoftButton, DangerButton                                                                     |
| `06a-wild-color-picker`    | overlay                   | BottomSheet, WildColorButtons                                                                                                 |
| `06b-drew-playable-card`   | overlay                   | SpotlightCard, BottomSheet, Play it / Keep it                                                                                 |
| `06c-player-disconnected`  | table state               | OfflineAvatar, CountdownRing, Toast, "Pause and wait" chip                                                                    |
| `06d-leave-confirm`        | overlay                   | Dialog (§5.18)                                                                                                                |
| `07-game-over`             | GameOverRoute             | Confetti, WinnerAvatars, ResultsCard, PrimaryButton/guest waiting                                                             |
| `08a-paused`               | overlay                   | PausedOverlay (Break variant)                                                                                                 |
| `08b-paused-waiting`       | overlay                   | PausedOverlay (Waiting variant), OfflineAvatar                                                                                |
| `08c-paused-team-offline`  | overlay                   | PausedOverlay (Auto variant), DangerButton "End game"                                                                         |

### Shared components

`PlayingCard` (§5.1), `CardBack` (§5.2), `Avatar` (§5.3, with card-count badge and turn pulse), buttons (§5.4), `Chip`/`TurnPill` (§5.5), `Input`/`InputError` (§5.6, §5.21), `Switch` (§5.7), `TeamCard`/`PlayerRow` (§5.8, §5.11), `ModeControl` (§5.9), `MenuDrawer` (§5.10), `EmptySlot` (§5.12), `DragHandle` + drag states (§5.13), `StartControl` (§5.14), `BottomSheet` (§5.15), `WildColorButtons` (§5.16), `SpotlightCard` (§5.17), `Dialog` (§5.18), `Toast` (§5.19), `OfflineAvatar` + `CountdownRing` (§5.20), `InfoNote` (§5.22), `Confetti` (§5.25), `PausedOverlay` (§11/§12). These are exactly the new components the Development Process requires the export package to include.

### Tokens / theme wiring (Req 20, Development Process)

- `theme.css` is imported once; Tailwind v4's `@theme`/`@import` picks up the token names so classes like `bg-ink`, `text-suit-red-ink`, `rounded-panel`, `shadow-cta`, `animate-turn-pulse`, `pt-safe`/`pb-safe` are available directly.
- Components use **only** these token classes and Tailwind's default spacing scale (Req 20.1). Where a value is missing, the closest token is used, never a new one (Req 20.2).
- The reference `.html` files are rebuilt as React components with Tailwind classes and flex/documented-absolute layouts; inline styles are not copied verbatim (Req 20.3).
- A **Design_Steering_File** (always-included, no manual activation) references the Design_Spec, directs all UI generation to these tokens/theme/screen references, and prohibits inventing tokens (Development Process requirement / Req 20).

---

## Animation System (Motion for React)

All motion is implemented with `motion/react` following §9 of the Design_Spec. Timings and springs are taken directly from the spec; no new values are introduced.

| Moment              | Implementation                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play / throw a card | Shared `layoutId={card.id}` between the hand card and the discard top; spring (stiffness 380, damping 30); lands at a random −10°…+10° rotation (Req 17.1) |
| Opponent plays      | Card flies from the seat to the pile while flipping `rotateY 180→0`, 350 ms (Req 17.2)                                                                     |
| Draw                | Card slides from the draw pile into the fan and flips face up, 300 ms `ease-card` (Req 10.6, 17)                                                           |
| Deal                | 7 cards per seat, staggered 60 ms, round-robin (Req 5.4)                                                                                                   |
| Select card         | Rises to `top: 0`, rotation 0, 150 ms (Req 17.3)                                                                                                           |
| Illegal tap         | Horizontal shake ±6px, 3 cycles, 240 ms (Req 7.3, 17)                                                                                                      |
| Turn change         | Turn pill cross-fades; new active avatar gets `animate-turn-pulse` (Req 17.4)                                                                              |
| Wild color change   | Direction ring + discard glow cross-fade to the new suit color, 300 ms (Req 8.3, 17)                                                                       |
| Menu drawer         | Slides in from `x=100%`, 250 ms `ease-card`; backdrop fades 0→50% (Req 17.5)                                                                               |
| Bottom sheet        | Slides up from `y=100%`; spotlight card scales 0.9→1.25 (Req 17.9)                                                                                         |
| Dialog              | Fades and scales 0.96→1, 200 ms (Req 17.9)                                                                                                                 |
| Toast               | Slides down 8px + fades in, 3 s, fades out (§5.19)                                                                                                         |
| Drag lift / tilt    | Row scales 1.02, −2° rotation, `shadow-card-lifted`; drop springs to slot (Req 17.8, 21)                                                                   |
| Pause overlay       | Fades in with card scale 0.96→1; fades out on resume (Req 17.10)                                                                                           |
| Countdown ring      | Progress stroke drains linearly over 60 s (§5.20)                                                                                                          |
| Confetti            | Bursts once, 900 ms; winner avatars pop 0.8→1 (§5.25)                                                                                                      |

**Interrupted shared transition (Req 17.7):** if a played card's shared-layout source/target is unavailable or the transition is interrupted, the card is placed directly at the discard top in its final position (no intermediate/missing state). Implemented via Motion's layout completion callback plus a fallback that commits the final layout immediately.

**Reduced motion (Req 17.6):** a `prefers-reduced-motion` hook swaps card flights for instant moves, removes the turn pulse, and renders confetti statically. `theme.css` already neutralizes CSS-driven animations; Motion variants read the same preference.

---

## Key Flows

### Create / join a room (Req 1, 2)

```mermaid
sequenceDiagram
  participant U as Player
  participant C as Client
  participant EF as Edge Function
  participant DB as Postgres
  U->>C: enter name + Create
  C->>EF: create_room(name)
  EF->>DB: generate unique code (retry ≤10, Req 1.10/1.11), insert room+host player
  EF-->>C: room + invite link
  C-->>U: Lobby (02a)
  Note over U,C: Join path: open invite link → if stored name, join & Lobby (02f);<br/>else Home with code pre-filled (Req 2.1/2.2)
```

- Empty/whitespace name → reject, retain input, show name-required error (Req 1.2, 2.7). Unknown code → `01b` (Req 2.6). Room full (8) → room-full message (Req 2.10). Game already started and not a member → `01c` (Req 3.4, 3.5).

### Start game + deal (Req 5)

Host taps Start (enabled only when mode constraints are met) → Edge Function assigns seats (team-alternating in 2v2), shuffles, deals 7 each round-robin, flips a number card as the initial discard, sets host as first active, direction clockwise. Deal animation plays for connected clients (Req 5.4).

### Play a card (validation → persist → broadcast)

Covered by the sequence in **Architecture**. Wild play routes into the color-picker flow; +2/+4 into the stacking flow.

### Draw one (Req 10)

Client taps the draw pile → `draw_one` function checks no penalty pending and `drew_this_turn = false` → moves one card (reshuffling if needed) → if playable, returns a `drew_decision` state showing "Play it/Keep it"; otherwise keeps and advances.

### Wild color pick (Req 8, 9.6)

After a wild is accepted, state enters `wild_pending`; the picker (`06a`) has no cancel. Choosing a suit sets `active_color`, cross-fades the ring/glow, updates the turn pill, then resolves any win (Req 8.6) or continues.

### +2 / +4 stacking chain (Req 9)

```mermaid
sequenceDiagram
  participant A as Player A
  participant B as Player B
  participant S as Server
  A->>S: play +2 (penalty=2, kind=two)
  S-->>B: your turn, penalty 2 pending
  alt B stacks +2
    B->>S: play +2 (penalty=4)
    S-->>Next: penalty 4 pending
  else B stacks wild4
    B->>S: play wild4 (penalty=6, kind=four, choose color)
  else B cannot/does not stack
    B->>S: draw
    S->>S: B draws penalty, penalty→0, advance
  end
  Note over S: +2 onto pending +4 is rejected (Req 9.5)
```

### Last-card penalty (Req 11)

On turn resolution the server checks: if the acting player now holds 1 card and no `last_card_called_seat` was set this turn, it adds a 2-card penalty and emits a toast.

### Disconnect → grace → skip (Req 15)

See the presence state diagram. Server enforces the 60 s window against `last_seen`; skip only when elapsed and not paused; later turns skipped immediately.

### Pause / resume / auto-pause / continue-without / end-game (Req 25)

```mermaid
stateDiagram-v2
  active --> paused: player Pause (25.1/25.3)
  active --> auto_paused: <2 connected / team offline (25.10)
  paused --> active: Resume (25.7)
  paused --> active: all reconnected (auto, 25.8)
  paused --> active: Continue without [name] (25.9)
  auto_paused --> active: condition clears (auto, 25.12)
  auto_paused --> ended: End game (25.13)
```

Manual pause shows the Break (`08a`) or Waiting (`08b`) variant; auto-pause shows the Auto variant (`08c`) with "End game". `pending_choice` is re-shown on resume (Req 25.14). The menu (including Leave and How to play) stays available while paused (Req 25.15).

### Game over + play again + host transfer (Req 12)

On win, `phase = ended`, `winner` set, `07-game-over` shown to all with remaining counts. Host sees "Play again" (returns everyone to the lobby with the same mode/teams, increments the visible round); guests see "Waiting for the host"; all see "Back to home". If the host is gone at end, the role passes to the longest-present connected player (Req 12.7).

---

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

These properties target the pure, server-side rules engine (deterministic given an injected RNG seed), which is the appropriate PBT surface. Realtime delivery, RLS-enforced hidden hands, presence-driven grace/skip, PWA/animation, and accessibility are verified with the integration, component, and manual tests described in the Testing Strategy rather than as properties.

### Property 1: Deck composition

_For any_ freshly built deck, it contains exactly 108 cards with the exact multiset: per suit one 0, two each of 1–9, two +2, two skip, two reverse; plus 4 Wild and 4 Wild +4.

**Validates: Requirements 5.1**

### Property 2: Card conservation

_For any_ reachable game state produced by any sequence of legal actions, the union of all hands, the draw pile, and the discard pile is exactly the 108-card deck — the total count is always 108 and every card id appears exactly once. (Subsumes the conservation aspects of dealing, draw-one, penalty draws, and reshuffle-on-empty.)

**Validates: Requirements 5.2, 9.4, 10.1, 10.7, 10.8**

### Property 3: Team seat alternation

_For any_ Team-mode game start with 4 players, seats alternate Team A and Team B so that each player's partner is seated opposite them.

**Validates: Requirements 5.7**

### Property 4: Exactly one active player

_For any_ reachable non-ended state, `active_seat` references exactly one occupied, in-game seat.

**Validates: Requirements 6.1**

### Property 5: Reverse turn order

_For any_ room, playing a reverse card inverts the play direction when 3 or more players are present, and when exactly 2 players are present leaves the direction unchanged and returns the turn to the same player.

**Validates: Requirements 6.2, 6.3**

### Property 6: Skip turn order

_For any_ room, playing a skip card makes the player after the next player active when 3 or more players are present, and when exactly 2 players are present returns the turn to the same player.

**Validates: Requirements 6.4, 6.5**

### Property 7: Actions from a forbidden context are no-ops

_For any_ state, an action that is not permitted in that context — a play or draw from a non-active player, any non-color-choice action while a wild is pending, any game action while paused or auto-paused, or any action after the game has ended — is rejected and leaves the entire game state unchanged.

**Validates: Requirements 6.9, 8.5, 10.3, 12.4, 25.6**

### Property 8: Match legality

_For any_ state and any attempted play, the engine accepts the play only if it satisfies the match constraint (suit equals the active color, or value/symbol equals the discard top) or is a legal wild/stack; every rejected play leaves the hand, discard top, active color, and active seat unchanged.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 9: Wild selection sets the active color

_For any_ wild or wild +4 play followed by a chosen suit S, the active color becomes exactly S.

**Validates: Requirements 8.2**

### Property 10: Penalty accumulation and asymmetric stacking

_For any_ pending-penalty state, a +2 is accepted only onto a pending +2 and a wild +4 is accepted onto a pending +2 or +4 (a +2 onto a pending +4 is rejected); each accepted stack increases the penalty count by exactly the card's value (2 or 4) and passes it to the next player.

**Validates: Requirements 9.1, 9.2, 9.3, 9.5**

### Property 11: Penalty clears only by drawing

_For any_ reachable state, the penalty count returns to 0 only when the targeted player draws the pending penalty; a non-stacking response makes that player draw exactly `penalty_count` cards, resets it to 0, and advances the turn.

**Validates: Requirements 9.4**

### Property 12: Last-card penalty

_For any_ turn that ends with the acting player holding exactly 1 card and no Last_Card_Call recorded that turn, that player draws exactly 2 cards.

**Validates: Requirements 11.3**

### Property 13: Last-card flag hygiene

_For any_ reachable state, no seat whose hand holds more than 1 card retains a recorded Last_Card_Call.

**Validates: Requirements 11.4**

### Property 14: Win detection

_For any_ sequence of legal actions, the game enters the ended state exactly when an in-game hand reaches 0 via a legal final play; in Normal_Mode the emptying player is the winner, and in Team_Mode the emptying player's team is the winner.

**Validates: Requirements 12.1, 12.2**

### Property 15: Auto-pause predicate

_For any_ configuration of player connection states, an Auto_Pause is active if and only if fewer than 2 players are connected, or the mode is Team_Mode and both players of some team are disconnected.

**Validates: Requirements 15.7, 25.10**

---

## Error Handling

| Condition                                            | Handling                                                                                          | Requirement    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| Out-of-turn / non-active action                      | Server rejects; hand and state unchanged; turn stays put                                          | 6.9, 14.5      |
| Stale action (version mismatch)                      | Server rejects with a version-conflict reason; client resyncs to latest and reverts optimistic UI | 14.5           |
| Illegal card play                                    | Reject; card stays; illegal-tap shake                                                             | 7.3, 17        |
| Second draw in a turn                                | Reject; turn stays                                                                                | 10.3           |
| Action while paused                                  | Reject all play/draw/call/color/skip                                                              | 25.6           |
| Room not found                                       | `01b-home-room-not-found` (red border + message)                                                  | 2.6            |
| Room full (8)                                        | Home room-full message (reuses `01b` pattern)                                                     | 2.10, 24.1     |
| Game already started, not a member                   | `01c-game-already-started`                                                                        | 3.4, 3.5       |
| Empty/whitespace name                                | Reject, retain input, name-required error                                                         | 1.2, 2.7       |
| Code < 4 chars on Join                               | Reject, retain input, 4-char message                                                              | 2.5            |
| Clipboard copy fails                                 | Show copy-failed error; leave link visible for manual copy                                        | 1.5            |
| Native share unavailable                             | Fall back to clipboard copy + "sharing unavailable" note                                          | 1.7            |
| Code generation can't find a unique code in 10 tries | Abort creation + error                                                                            | 1.11           |
| Draw pile empty, discard ≥2                          | Reshuffle discards (except top) into draw, then draw                                              | 10.7           |
| Draw pile empty, discard = top only                  | Complete turn without drawing; advance                                                            | 10.8           |
| Network loss                                         | Presence flips offline; state persisted server-side; on reconnect resync within 5 s               | 14.4, 14.7, 15 |
| Interrupted card animation                           | Commit card to final discard position                                                             | 17.7           |
| Partner hand temporarily unavailable (2v2)           | Keep last known count badge; do not reveal any card face-up until fresh data                      | 13.7           |
| Unsupported viewport (<360 / >430px) or landscape    | Show "use a supported portrait width" message; suppress game/lobby rendering                      | 16.8           |

---

## Testing Strategy

A dual approach: unit + integration tests for concrete behavior and infrastructure, and **property-based tests** for the universal invariants of the rules engine. Because the rules engine is a pure, deterministic module (given an injected RNG seed), it is an ideal PBT target; realtime, RLS, and UI are tested with integration/example tests.

### Unit tests (rules engine — examples and edge cases)

- Reverse and skip in the exact-2-player case (Req 6.3, 6.5).
- Initial-discard reshuffle when the flipped card is an action card (Req 5.5).
- `+2` onto pending `+4` rejected; `wild4` onto `+2` accepted (Req 9.5).
- Reshuffle-on-empty (≥2 discards) vs. no-draw (only top) (Req 10.7, 10.8).
- Last-card penalty when a player ends a turn on 1 card without calling (Req 11.3).
- Winning wild requires color before win resolves (Req 8.6).

### Property-based tests (invariants from the Game Engine section)

Use a PBT library for the engine's language (e.g. **fast-check** for a TypeScript engine). Each of Properties 1–15 in the **Correctness Properties** section is implemented as a single property-based test that runs ≥100 generated iterations and is tagged `Feature: homemade-uno, Property N: <property text>`. Generators produce random legal action sequences over random valid initial states (player counts 2–8, both modes). Highlights: Property 2 (card conservation — total always 108, no duplicate ids), Property 4 (exactly one active player), Property 7 (forbidden-context actions are no-ops), Property 8 (match legality), Property 10/11 (stacking eligibility and penalty-clears-only-by-draw), and Properties 5/6 (reverse/skip turn order including the 2-player case).

### Integration tests (Supabase RPC / Edge Functions + RLS)

- **RLS hidden hands (Req 23.1, 14.6):** authenticate as player A and assert a `SELECT` on player B's hand returns no rows in Normal mode; in Team mode assert a partner's hand **is** readable and an opponent's is not.
- **Draw pile secrecy (Req 23.2):** assert no client role can read `draw_pile`.
- **Server authority (Req 14.5):** call `play_card` as a non-active player and as a stale version; assert both reject and state is unchanged.
- **Persistence (Req 14.4):** confirm state is committed before the accept response.

### Realtime sync tests

- Two subscribed clients: after an accepted action, both receive the new public state within 2 s (Req 14.1); lobby membership/mode/host changes propagate within 2 s (Req 14.2, 14.3); a reconnecting client receives current public state and its own hand within 5 s (Req 14.7).
- Presence-driven disconnect flips offline state and drives the server-enforced grace/skip and auto-pause (Req 15, 25.10).

### Accessibility testing

Automated checks (roles, `aria-label`s on icon-only buttons, live-region wiring, focus management, contrast tokens) cover the mechanics of Requirement 18, but **full WCAG conformance requires manual testing with assistive technologies and expert accessibility review** — this cannot be fully validated by automated tests alone.
