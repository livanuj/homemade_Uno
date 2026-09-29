---
name: Homemade Uno
color_theme: Paper Café
product: Online multiplayer color-matching card game (private play with friends)
platform: Mobile-first web app, installed to the home screen as a PWA, portrait only
stack: React + Tailwind CSS v4 (+ Motion for animation, Supabase for realtime)
design_viewport: 390x844 (CSS px)
theme_file: theme.css
tokens_file: tokens.json
screen_map_file: screen-map.json
overview_image: screens/00-overview.png
screen_files: screens/<id>.png and screens/<id>.html
screen_ids:
  - 01-home
  - 01b-home-room-not-found
  - 01c-game-already-started
  - 01d-settings
  - 01e-how-to-play
  - 02a-lobby-just-created
  - 02b-lobby-normal
  - 02c-lobby-2v2-waiting
  - 02d-lobby-2v2-ready
  - 02e-lobby-dragging
  - 02f-lobby-guest
  - 03-game-2v2
  - 04-game-normal
  - 05-menu
  - 06a-wild-color-picker
  - 06b-drew-playable-card
  - 06c-player-disconnected
  - 06d-leave-confirm
  - 07-game-over
  - 08a-paused
  - 08b-paused-waiting
  - 08c-paused-team-offline
---

# Homemade Uno — Design Spec

"Homemade Uno" is the game. "Paper Café" is the name of its color theme.

> **For AI code generators:** Build from this file plus the screen files.
>
> 1. Look at `screens/00-overview.png` first. It shows all 19 screens, grouped into Home, Lobby, and Game.
> 2. To implement a requirement, look it up in `screen-map.json` → `requirement_index`. It lists the screen IDs that show it. Each screen entry also has a description, where it's entered from, and where it leads.
> 3. For each screen, open `screens/<id>.png` (what it looks like) and `screens/<id>.html` (exact px and hex values in inline styles).
> 4. Screens with `"kind": "overlay"` (menu, sheets, dialog, disconnected state) are drawn on top of a game table. Build them as components shown over the table, not as separate routes.
> 5. Use ONLY the tokens in `theme.css`. Never invent colors, font sizes, radii or shadows. If a value is not listed, use the closest token.
> 6. The `.html` files are static references with inline styles and absolute positions. Rebuild them as React components with Tailwind classes and flex layouts. Do not copy the inline styles.
> 7. Screens are drawn at 390×844. The real app must fill any phone from 360–430px wide and 667–932px tall and respect safe areas (see §8).

---

## 1. Design intent

The game should feel like a warm, relaxed card night at a café table. Everything sits on a paper-colored background. The play area is a slightly darker felt oval. Cards are the most colorful and saturated things on screen; all UI around them stays quiet: ink text, cream panels, and pill-shaped buttons.

Rules that follow from this:

- **Color comes from cards and teams, not UI.** Buttons are ink or outlined ink, never suit colors.
- **Every suit has a shape**: red ●, yellow ▲, green ■, blue ◆. The shape is always shown in the card's bottom-right corner, so colorblind players can tell suits apart.
- **3D is used only for other players' cards.** It communicates where each player sits. Your own hand is flat and faces you.
- **The game is called Homemade Uno.** The title appears only on the Home screen. Use original card art only; never reproduce official UNO artwork or logos.

---

## 2. Color tokens

| Token (Tailwind) | Hex       | Use                                                                                |
| ---------------- | --------- | ---------------------------------------------------------------------------------- |
| `paper`          | `#F2EBDD` | App background, row fills inside panels                                            |
| `felt`           | `#E7DCC8` | Game-table oval                                                                    |
| `felt-edge`      | `#D6CCBA` | Table border (2px), dividers (1px)                                                 |
| `surface`        | `#FFFDF8` | Panels, inputs, chips, **card borders**, card numeral circles                      |
| `ink`            | `#2B2320` | Primary text, primary buttons, outlined buttons, switch on                         |
| `ink-muted`      | `#6E625A` | Secondary text, labels, captions, neutral avatar rings, disabled button text       |
| `ink-faint`      | `#9A8E84` | Input placeholders only                                                            |
| `line`           | `#CFC3AE` | Input borders, chip outlines, switch off, disabled button fill, dashed empty slots |
| `avatar`         | `#E3D8C5` | Avatar circle fill                                                                 |
| `card-back`      | `#3A302B` | Face-down cards                                                                    |
| `card-back-deep` | `#2B2320` | Wild card base, cards under the draw pile                                          |
| `danger`         | `#B23E28` | "Leave game", input error border and error text, ✗ badges                          |
| `turn`           | `#E0A423` | Ring + glow on whoever's turn it is (normal mode), countdown ring, "waiting" dots  |
| `team-a`         | `#9C4A7A` | 2v2 Team A: avatar rings, dots, labels                                             |
| `team-b`         | `#2E7D7A` | 2v2 Team B                                                                         |

### Suit colors

Each suit has three values: the card fill, the numeral color inside the white circle, and the corner-index color on the fill.

| Suit   | Shape | Fill                    | Numeral (on `surface` circle) | Corner index (on fill)     |
| ------ | ----- | ----------------------- | ----------------------------- | -------------------------- |
| red    | ●     | `suit-red` `#D4533B`    | `suit-red-ink` `#B23E28`      | white `#FFFFFF`            |
| yellow | ▲     | `suit-yellow` `#E0A423` | `suit-yellow-ink` `#9A6B0A`   | `suit-yellow-on` `#3B2A08` |
| green  | ■     | `suit-green` `#5B8F4E`  | `suit-green-ink` `#456E3B`    | white                      |
| blue   | ◆     | `suit-blue` `#36598F`   | `suit-blue-ink` `#2C4A78`     | white                      |

The glow behind the top discard card uses the current suit color at 45% alpha, for example `0 0 24px rgba(91,143,78,0.45)` for green.

The overlay behind the menu drawer is `ink` at 50% (`bg-ink/50`).

---

## 3. Typography

There are two families, and each has a fixed job.

| Family                  | Tailwind              | Weights            | Job                                                                                       |
| ----------------------- | --------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| **Bricolage Grotesque** | `font-display`        | 700, 800           | App title, screen titles, room codes, card numerals, primary CTA, the "Last card!" button |
| **Manrope**             | `font-sans` (default) | 500, 600, 700, 800 | All other text: names, labels, body, chips, buttons                                       |

Load both fonts in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Manrope:wght@500;600;700;800&display=swap"
/>
```

### Type scale

Each size token carries its own line-height, tracking and weight, so `text-title` alone is enough.

| Token              | Size | Line height | Tracking             | Weight | Family  | Where                                                              |
| ------------------ | ---- | ----------- | -------------------- | ------ | ------- | ------------------------------------------------------------------ |
| `text-code`        | 42px | 1           | 0.14em               | 800    | display | Room code in lobby                                                 |
| `text-hero`        | 40px | 1.1         | -0.01em              | 800    | display | App title on home                                                  |
| `text-sheet`       | 26px | 1.15        | 0 (0.12em for codes) | 800    | display | "Menu" title, room code in menu                                    |
| `text-title`       | 20px | 1.2         | 0                    | 700    | display | Screen title ("Game room")                                         |
| `text-cta`         | 18px | 1           | 0                    | 800    | display | "Create a room", "Start game"                                      |
| `text-input`       | 17px | 1.4         | 0                    | 600    | sans    | Name input text                                                    |
| `text-body`        | 15px | 1.4         | 0                    | 700    | sans    | Player names, row text, button labels                              |
| `text-paragraph`   | 15px | 1.5         | 0                    | 500    | sans    | Running text: How to play, dialog and sheet explanations, taglines |
| `text-label`       | 13px | 1.3         | 0                    | 700    | sans    | Form labels, chips, turn pill, secondary buttons                   |
| `text-caption`     | 12px | 1.3         | 0                    | 600    | sans    | Setting descriptions, badges, section headers                      |
| `text-micro`       | 11px | 1.3         | 0                    | 600    | sans    | Meta under names ("Partner · 5 cards")                             |
| `text-card-lg`     | 26px | 1           | 0                    | 800    | display | Numeral on discard pile card                                       |
| `text-card`        | 24px | 1           | 0                    | 800    | display | Numeral on hand cards (20px for "+2", 22px for ⇄)                  |
| `text-card-corner` | 13px | 1           | 0                    | 800    | sans    | Corner index on cards                                              |

### Casing and tracking rules

- **Uppercase + tracking 0.08–0.1em** is used only for: room-code chips ("ROOM · K7QX"), section headers ("CARDS LEFT", "TEAM A"), the "ROOM CODE" label, and the "LAST CARD!" button. Everything else is sentence case.
- The room-code input uses `font-display`, 22px, 800, tracking 0.3em, `uppercase`, `maxLength=4`.
- Numbers in badges and counts use Manrope 800 at 12–13px.

---

## 4. Spacing, radii, elevation

**Spacing** follows Tailwind's 4px scale. These values are used:

- Screen padding: `px-4` (16px) on game screens, `px-5` (20px) on the lobby, `px-6` (24px) on home.
- Vertical rhythm between screen sections: `gap-3` (12px) in the lobby, `gap-[22px]` on home, `gap-[18px]` in the menu drawer.
- Inside panels: `p-4` or `p-5`. Inside rows: `px-2.5 py-1.5`.
- Minimum touch target is **44×44px**. Primary CTAs are 56px tall (`h-14`); secondary buttons and inputs are 44–52px.

| Radius token                            | px  | Element                                                                                        |
| --------------------------------------- | --- | ---------------------------------------------------------------------------------------------- |
| `rounded-full`                          | 999 | All buttons, chips, pills, badges, avatars, switches                                           |
| `rounded-card-back`                     | 7   | Small face-down cards                                                                          |
| `rounded-card-sm`                       | 8   | Partner's visible cards                                                                        |
| `rounded-card`                          | 12  | Hand and pile cards                                                                            |
| `rounded-card-lg`                       | 14  | Hero cards on home                                                                             |
| `rounded-row`                           | 14  | Player rows                                                                                    |
| `rounded-input`                         | 16  | Inputs, "Join" button                                                                          |
| `rounded-section`                       | 18  | Team cards, mode panel, player list, settings panels, How-to-play sections, wild color buttons |
| `rounded-panel`                         | 22  | Room-code panel, dialog                                                                        |
| `rounded-l-drawer` / `rounded-t-drawer` | 24  | Menu drawer (left corners), bottom sheets (top corners)                                        |

| Shadow token                         | Element                                          |
| ------------------------------------ | ------------------------------------------------ |
| `shadow-panel`                       | Cream panels on paper                            |
| `shadow-card`                        | Every card                                       |
| `shadow-card-lifted`                 | Selected card in hand (ink ring + deeper shadow) |
| `shadow-cta`                         | Primary CTA                                      |
| `shadow-drawer`                      | Menu drawer                                      |
| `shadow-sheet`                       | Bottom sheets (wild picker, drew a card)         |
| `shadow-turn` / `animate-turn-pulse` | Avatar of the player whose turn it is            |
| `inset-shadow-felt`                  | Game-table oval                                  |

---

## 5. Components

Each component lists its size, its parts, and a Tailwind starting point.

### 5.1 PlayingCard (face up)

```
┌──────────────┐  border: 3px surface, radius card, fill = suit color
│7             │  corner index: top-left, 13px Manrope 800
│    ╭────╮    │  center: surface circle, numeral in suit-*-ink, Bricolage 800
│    │ 7  │    │
│    ╰────╯    │
│             ●│  suit shape: bottom-right, 10px
└──────────────┘
```

| Variant          | Size (w×h) | Border | Circle | Numeral          | Radius |
| ---------------- | ---------- | ------ | ------ | ---------------- | ------ |
| `hero` (home)    | 84×124     | 4px    | 48     | 24px             | 14     |
| `pile` (discard) | 74×108     | 3px    | 42     | 26px             | 12     |
| `hand`           | 70×104     | 3px    | 40     | 24px             | 12     |
| `partner`        | 46×68      | 2px    | 28     | 16px, no corners | 8      |

Values: `0`–`9`, `+2` (draw two), `⊘` (skip), `⇄` (reverse).

**Wild / Wild +4:** a 2×2 grid of the four suit colors (red top-left, yellow top-right, blue bottom-left, green bottom-right) on a `card-back-deep` base. A surface oval sits in the middle with "+4" in ink (Bricolage 800). The plain Wild has no text.

```jsx
<button className="relative w-[70px] h-[104px] rounded-card border-3 border-surface bg-suit-red shadow-card grid place-items-center">
  <span className="absolute top-1 left-[7px] text-card-corner text-white">
    7
  </span>
  <span className="absolute bottom-1 right-[7px] text-[10px] text-white">
    ●
  </span>
  <span className="size-10 rounded-full bg-surface grid place-items-center font-display text-card text-suit-red-ink">
    7
  </span>
</button>
```

States:

- **Playable:** default.
- **Not playable** (only when "Highlight playable cards" is on): `brightness-55`. Keep it tappable so a shake animation can explain why it can't be played.
- **Selected:** raised 22px above its fan position, rotation 0, `shadow-card-lifted`.
- Every card is a `<button>` with an `aria-label` such as "Red 7", "Blue skip", "Wild draw four".

### 5.2 CardBack (face down)

This is a `card-back` fill with a surface border. In the center is a small circle split into four quadrants in the suit colors, at 45% of the card width.

| Variant   | Size   | Border | Emblem |
| --------- | ------ | ------ | ------ |
| draw pile | 70×104 | 3px    | 30px   |
| side seat | 40×58  | 2px    | 18px   |
| top seat  | 34×50  | 2px    | 15px   |

The draw pile is three stacked backs, offset by 0, 2, and 4px. The lower two use `card-back-deep`, and the whole stack is one `<button aria-label="Draw a card">`.

### 5.3 Avatar

A circle with `avatar` fill and a 3px ring, showing the initial in Manrope 800 at 15px.

- **Sizes:** 44 (game table), 40 (partner), 36 (lobby rows).
- **Ring color:** `team-a` or `team-b` in 2v2. In normal mode it's `ink-muted`, `ink` for you, and `turn` for the active player.
- **Card-count badge:** min 22×22, `rounded-full`, `bg-ink text-surface`, 12px 800, positioned at the bottom corner facing the table center (−8px offset).
- **Active turn:** add `animate-turn-pulse`.

### 5.4 Buttons

| Type             | Classes                                                                                         | Used for                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Primary          | `h-14 w-full rounded-full bg-ink text-surface font-display text-cta shadow-cta`                 | Create a room, Start game                                                       |
| Primary (small)  | `h-11 rounded-full bg-ink text-surface text-body`                                               | Share invite                                                                    |
| Outline          | `h-11 rounded-full border-2 border-ink text-ink text-body`                                      | Copy link, Join, "LAST CARD!" (uses `font-display` + uppercase)                 |
| Soft             | `h-[50px] rounded-full bg-paper text-ink text-body` (on `surface`: `bg-surface`)                | How to play, Back to home, Leave room                                           |
| Danger outline   | `h-[50px] rounded-full border-2 border-danger text-danger font-extrabold`                       | Leave game                                                                      |
| Primary disabled | `h-14 w-full rounded-full bg-line text-ink-muted font-display text-cta` + `disabled`, no shadow | Start game when it can't start yet (always paired with a reason caption, §5.14) |
| Dialog main      | `h-[50px] w-full rounded-full bg-ink text-surface text-body font-extrabold`                     | "Stay in game"                                                                  |
| Icon             | `size-11 rounded-full bg-surface grid place-items-center` + 20px stroke icon                    | Menu, back, close, settings                                                     |

Icons are 2px-stroke line icons in `ink`, for example Lucide (`Menu`, `ChevronLeft`, `ChevronRight`, `X`, `Settings`, `Copy`, `Check`, `Info`, `CircleAlert`, `LogOut`, `WifiOff`, `ArrowDownUp`). The drag handle uses a custom six-dot grip (§5.13).

### 5.5 Chips and pills

- **Info chip:** `px-3.5 py-2.5 rounded-full bg-surface text-label tracking-[0.08em]` for "ROOM · K7QX".
- **Outline chip:** `border border-line text-ink-muted` for "2v2 · Round 1" and "Normal · 5 players" (the round is the number of games played in the room).
- **Turn pill:** `bg-surface rounded-full px-3.5 py-2 text-label`, with a 12px dot in the current suit color (or `turn` when it's someone else's turn). Example text: "Your turn · match red or play a wild", "Nora's turn · color is green".
- **Host badge:** `bg-ink text-surface text-micro font-bold px-2 py-0.5 rounded-full`.

### 5.6 Inputs

`h-[52px] rounded-input border-2 border-line bg-surface px-[18px] text-input`, with a visible `<label>` above it (`text-label text-ink-muted`). On focus the border changes to `border-ink`. The room-code input uses `font-display text-[22px] font-extrabold tracking-[0.3em] uppercase`, `maxLength={4}`. For the error state, see §5.21.

### 5.7 Switch

A 52×32 `<button role="switch" aria-checked>`. The track is `bg-ink` when on and `bg-line` when off. The knob is 26px `bg-surface` with a small shadow, at `left: 3px` when off and `left: 23px` when on, with a 200ms transition.

### 5.8 Team card (lobby, 2v2)

A `bg-surface rounded-section shadow-panel px-3 py-2.5 flex flex-col gap-1.5` panel. Its header is a 12px team-color dot plus the team name (`text-label font-extrabold tracking-[0.06em]`, team color). It holds two slots. Each slot is either a player row or an empty slot (§5.12).

**Player row:** `min-h-[46px] rounded-row bg-paper px-2.5 py-1.5 flex items-center gap-2.5`, containing, in order: the drag handle (host only, §5.13), avatar 36 with a team ring, name (`text-body flex-1`), optional Host badge, and a ready check (18px `Check`, `suit-green-ink`). Guests see the same row without the handle (`02f-lobby-guest`).

### 5.9 Game mode control (lobby)

A `bg-surface rounded-section shadow-panel px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5` panel:

1. Label "Game mode" (`text-label text-ink-muted`).
2. A two-option segmented control: `role="radiogroup"`, `grid grid-cols-2 gap-1 p-1 rounded-full bg-paper`. Each option is a `role="radio"` button, `h-11 rounded-full text-body font-extrabold flex items-center justify-center gap-2`:
   - Selected: `bg-ink text-surface` with `shadow-[0_2px_8px_rgba(40,30,40,0.18)]`.
   - Not selected: transparent, `text-ink`.
   - Disabled ("Play 2v2" with 5+ players): `opacity-40 cursor-not-allowed`, `disabled`, and `aria-describedby` pointing to the info note.
   - Icons: "Normal" has four small circles (18px stroke icon). "Play 2v2" has two overlapping 12px dots in `team-a` and `team-b`.
3. A description (`text-label font-medium text-ink-muted`): "Everyone plays for themselves. 2 to 8 players." or "Two teams of two. Partners see each other's cards. Needs exactly 4 players."
4. Only when "Play 2v2" is disabled: an info note (§5.22) saying "2v2 needs exactly 4 players. It unlocks if the room gets back to 4."

**Guest version:** the label reads "Game mode · chosen by the host", and the control is replaced by read-only text: the mode icon plus "2v2 teams" or "Normal game" (`text-input font-extrabold`).

### 5.10 Menu drawer

The drawer slides in from the right. It is 322px wide (`w-[82.5%] max-w-[340px]`), full height, `bg-surface rounded-l-drawer shadow-drawer`, with padding `pt-safe px-5 pb-safe`, over a `bg-ink/50` backdrop. Tapping the backdrop closes it. Sections from top to bottom:

1. Title "Menu" and a close button.
2. The room box on `paper`, with a Copy link button.
3. "CARDS LEFT", grouped by team in 2v2.
4. A 1px divider.
5. Three switches: Sound effects, Vibration, Highlight playable cards.
6. A spacer.
7. "How to play" (soft) and "Leave game" (danger). "Leave game" must open a confirmation dialog.

### 5.11 Player list card (lobby, Normal)

The same panel as the team card, but without a header, listing every player (up to 8) with `gap-1`. Rows have no drag handle. The host's ring is `ink`; everyone else's is `ink-muted`.

### 5.12 Empty slot

A placeholder row the same size as a player row: `min-h-[46px] rounded-row border-2 border-dashed border-line px-2.5`, containing a 36px dashed circle (`border-2 border-dashed border-line`) and muted text (`text-body font-semibold text-ink-muted`). Texts: "Waiting for a player" (2v2) and "Share the link to invite friends" (lobby with only the host).

### 5.13 Drag handle and drag states (2v2 lobby, host only)

- **Handle:** a `<button>` 28×44 (`-ml-1.5`), transparent, `cursor-grab touch-none`, containing a 14×20 six-dot grip (2 columns × 3 rows of 3.6px dots, `ink-muted`). `aria-label="Move [name] to the other team"`. Tapping or pressing Enter without dragging moves the player to the other team (swapping if that team is full).
- **Hint** above the teams (right side of the "Players · N" row): a 10×14 grip plus "Drag to change teams" (`text-label font-semibold text-ink-muted`). While dragging it changes to "Drop on a player to swap".
- **Lifted row:** `bg-surface`, `-rotate-2`, `shadow-card-lifted`, grip in `ink`, following the finger.
- **Original slot:** turns into a dashed placeholder with the player's name in muted text.
- **Drop target** (the row under the finger): `border-2 border-dashed border-ink bg-surface`, its avatar at 45% opacity, and a right-aligned `ArrowDownUp` icon with "Swap" (`text-label font-extrabold`).
- Reference: `02e-lobby-dragging`.

### 5.14 Start control with reason

A column, centered, `gap-2`: the Start button (primary or primary disabled, §5.4), then one caption line (`text-label font-semibold text-ink-muted text-center`, `id` referenced by the button's `aria-describedby`). Captions used:

- "Everyone is ready" (enabled)
- "Invite at least 1 more player to start"
- "2v2 needs exactly 4 players. 3 of 4 have joined."

**Guest version:** a status pill (`bg-surface rounded-full px-4 py-2.5 text-label`, with a 10px `turn` dot) saying "Waiting for Alex to start the game", then a soft "Leave room" button on `surface`.

### 5.15 Bottom sheet

Used for the Wild color picker and "Drew a playable card". It sits over the table behind a `bg-ink/50` backdrop: `fixed inset-x-0 bottom-0 bg-surface rounded-t-drawer shadow-sheet px-5 pt-6 pb-safe flex flex-col gap-4` (gap 5 for the picker). It has `role="dialog"` with `aria-labelledby` pointing to its title (`text-sheet`, Bricolage). The subtitle is `text-label` or `text-paragraph` in `ink-muted`.

### 5.16 Wild color buttons

A `grid grid-cols-2 gap-3` of four buttons, each `h-24 rounded-section border-3 border-surface shadow-card flex flex-col items-center justify-center gap-1.5`, filled with the suit color. Each contains the suit shape (22px) over the color name (`text-input font-extrabold`). Text is white, except on yellow, where it uses `suit-yellow-on`. Order: Red, Yellow / Green, Blue. `aria-label` is the color name. The sheet header shows the played Wild card (partner size, 46×68), "Choose a color", and a consequence line such as "Leo draws 4 unless he can stack". There is no cancel option.

### 5.17 Spotlight card

A drawn card shown above the "drew a playable card" sheet: the **hero** card variant (84×124, §5.1) at `scale-125`, with `drop-shadow-[0_12px_24px_rgba(40,30,40,0.35)]`, centered at about y 300, under a small `bg-surface` pill reading "You drew". Sheet title: "[Color] [value] fits the pile". Buttons: primary "Play it" and outline "Keep it".

### 5.18 Dialog

A centered dialog over a `bg-ink/50` backdrop, `role="alertdialog"`: `w-[calc(100%-48px)] max-w-[342px] bg-surface rounded-panel shadow-cta p-6 flex flex-col gap-[18px]`. Top to bottom:

1. A 48px `bg-paper` circle holding a 22px icon (`LogOut` in `danger` for the leave dialog).
2. The title (`text-sheet`).
3. The explanation (`text-paragraph text-ink-muted`).
4. The buttons, stacked with `gap-2.5`: safe action first (dialog main), destructive action second (danger outline).

Reference: `06d-leave-confirm`.

### 5.19 Toast

A short message for events everyone should notice (disconnects, penalties, mode auto-switch): `bg-ink text-surface rounded-full px-4 py-2.5 text-label shadow-cta`, `role="status"`. On the table it is centered at about y 214, above the piles. It stays for 3 seconds. Only one shows at a time; newer toasts replace older ones.

### 5.20 Offline avatar and countdown ring

For a disconnected player (reference `06c-player-disconnected`):

- A 56px wrapper around a 40px avatar at 55% opacity.
- **Countdown ring:** an SVG circle (r=25, stroke 3). The track is `felt-edge` and the progress is `turn`, with round caps, starting at 12 o'clock and draining clockwise over the 60-second grace period.
- **Offline badge:** top-right, 22px `bg-ink` circle with a 13px `WifiOff` icon in `surface`. The card-count badge stays bottom-right.
- The name label becomes "Nora · offline" in `ink-muted`.
- The turn pill reads "Waiting for Nora · skipping in 42s", with a `turn` dot.
- The countdown ring only appears when it's the disconnected player's turn. Otherwise the avatar is just faded, with the offline badge.

### 5.21 Input error

Input border `border-danger`, with `aria-invalid="true"` and `aria-describedby`. Below the input row: a `<p role="alert">` (`text-label font-semibold text-danger flex gap-2`) with a 16px `CircleAlert` icon. Example: "No room uses the code ABCD. Check the code with your friend and try again." The error clears as soon as the code is edited. Reference: `01b-home-room-not-found`.

### 5.22 Info note

Explains why something is unavailable: `bg-paper rounded-row px-3 py-2.5 flex gap-2 text-label font-semibold text-ink`, with a 16px `Info` icon in `ink-muted`. Used under the disabled "Play 2v2" option.

### 5.23 Settings panel and rows

Section labels (`text-caption font-extrabold tracking-[0.08em] text-ink-muted`: "YOU", "GAME") sit above `bg-surface rounded-section shadow-panel px-4` panels.

- **Name panel:** label, input, and helper text "Other players see this name at the table" (`text-caption text-ink-muted`).
- **Switch rows:** `min-h-14`, with the title (`text-body`) and description (`text-caption text-ink-muted`) on the left and the switch (§5.7) on the right. Rows are separated by 1px `felt-edge` dividers. The Vibration row is hidden on devices without vibration.
- **Link row:** "How to play" with a `ChevronRight` in `ink-muted`.
- **Version:** "Version 1.0" centered at the bottom (`text-caption text-ink-muted`).

### 5.24 How-to-play section

A `bg-surface rounded-section shadow-panel p-[18px] flex flex-col gap-2.5` panel with an h2 (`text-title`, Bricolage) and `text-paragraph` text. Card illustrations use the partner card size (46×68).

- **Match examples:** a row of cards, each with a 22px verdict badge at its bottom-right: `bg-suit-green-ink` with a `Check` for allowed, `bg-danger` with an `X` for not allowed. Each has a caption (`text-caption text-ink-muted`).
- **Action card rows:** the card, then its name (`text-body font-extrabold`) and description (`text-label font-medium text-ink-muted`), separated by `felt-edge` dividers.
- **Stacking example:** cards joined by "+" signs (`text-title text-ink-muted`), ending in an ink pill "Draw 8".

### 5.25 Game over

- **Confetti:** about 12 suit shapes (●▲■◆) at 19–28px in the four suit colors, scattered over the top 300px at random rotations. They burst in once when the screen opens and are static with reduced motion.
- **Winners:** 72px avatars with team (or `ink`) rings, overlapping by 16px, with `shadow-cta`.
- **Title:** `text-hero`: "Team A wins!" or "Maya wins!".
- **Subtitle:** `text-paragraph text-ink-muted`: "Maya played her last card".
- **Results card:** "CARDS LEFT", then rows (avatar 32, name, and a count pill in `bg-paper`), grouped by team with a divider in 2v2. The player who went out gets a team-colored "Went out" badge.
- **Buttons:** primary "Play again" (host only), the caption "Everyone stays in room K7QX", and soft "Back to home". Guests see "Waiting for the host" instead of the primary button.

---

## 6. 3D recipes (other players' cards)

Tailwind v4 has 3D utilities: `perspective-*`, `rotate-x-*`, `rotate-y-*`, `transform-3d`, and `origin-*`. Put the perspective on the **parent** and the rotation on the **row or column of cards**.

| Seat                        | Parent                | Card group                                | Layout of cards                       |
| --------------------------- | --------------------- | ----------------------------------------- | ------------------------------------- |
| Partner (2v2, top, face up) | `perspective-[420px]` | `rotate-x-42 origin-bottom flex`          | Row, overlap `-ml-2`                  |
| Opponent top (normal)       | `perspective-[360px]` | `rotate-x-48 origin-top flex`             | Row of backs, overlap `-ml-[22px]`    |
| Opponent left               | `perspective-[360px]` | `rotate-y-52 origin-left flex flex-col`   | Column of backs, overlap `-mt-[42px]` |
| Opponent right              | `perspective-[360px]` | `-rotate-y-52 origin-right flex flex-col` | Same, mirrored                        |

Show at most 7 backs per seat, even if a player holds more; the number badge shows the real count.

---

## 7. Screens

All coordinates are for the 390×844 design. The **game tables use absolute positioning** inside a `relative` full-screen container. All other screens are flex columns. Full descriptions, entry points, and exits for every screen are in `screen-map.json`.

### 7.1 Screen index

| ID                         | Board name                | Kind    | Shown over                                                                         | Requirements                                |
| -------------------------- | ------------------------- | ------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `01-home`                  | Home                      | page    | —                                                                                  | 1.1, 1.7, 2.1, 2.2, 2.3, 2.5                |
| `01b-home-room-not-found`  | Home · room not found     | page    | —                                                                                  | 2.4                                         |
| `01c-game-already-started` | Game already started      | page    | —                                                                                  | 3.5                                         |
| `01d-settings`             | Settings                  | page    | —                                                                                  | 1.7, 16.7                                   |
| `01e-how-to-play`          | How to play               | page    | —                                                                                  | 16.5                                        |
| `02a-lobby-just-created`   | Lobby · just created      | page    | —                                                                                  | 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.7           |
| `02b-lobby-normal`         | Lobby · normal game       | page    | —                                                                                  | 4.2, 4.4, 4.9                               |
| `02c-lobby-2v2-waiting`    | Lobby · 2v2 waiting       | page    | —                                                                                  | 4.5, 4.6, 4.8                               |
| `02d-lobby-2v2-ready`      | Lobby · 2v2 ready         | page    | —                                                                                  | 4.5, 21.1                                   |
| `02e-lobby-dragging`       | Lobby · dragging a player | page    | —                                                                                  | 21.2, 21.3, 21.4, 21.5, 17.8                |
| `02f-lobby-guest`          | Lobby · guest view        | page    | —                                                                                  | 4.3, 4.10, 21.7                             |
| `03-game-2v2`              | 2v2 table                 | page    | —                                                                                  | 6.4, 6.5, 7.5, 11.1, 13.1, 13.2, 13.3, 13.4 |
| `04-game-normal`           | Normal table              | page    | —                                                                                  | 5.6, 6.4, 6.5, 13.3                         |
| `05-menu`                  | In-game menu              | overlay | 03-game-2v2 or 04-game-normal                                                      | 1.3, 22.1                                   |
| `06a-wild-color-picker`    | Wild · choose a color     | overlay | 03-game-2v2 (shown) or 04-game-normal                                              | 8.1, 8.2, 9.6                               |
| `06b-drew-playable-card`   | Drew a playable card      | overlay | 03-game-2v2 (shown) or 04-game-normal                                              | 10.2                                        |
| `06c-player-disconnected`  | Player disconnected       | overlay | 04-game-normal (shown) or 03-game-2v2 — a state of the table, not a separate route | 15.1, 15.3, 15.5                            |
| `06d-leave-confirm`        | Leave game · confirm      | overlay | 03-game-2v2 (shown) or 04-game-normal                                              | 22.1, 22.2                                  |
| `07-game-over`             | Game over · team wins     | page    | —                                                                                  | 12.1, 12.2, 12.3, 12.4, 12.5                |

### 7.2 Navigation flow

```
                       ┌──────────── 01d-settings ── 01e-how-to-play
                       │
invite link / launch → 01-home ──(bad code)──→ 01b-home-room-not-found
                       │   └──(game in progress)──→ 01c-game-already-started
          Create a room│              │Join
                       ▼              ▼
          02a-lobby-just-created   02f-lobby-guest (non-host view of any lobby)
             │            │
      Normal ▼            ▼ Play 2v2
   02b-lobby-normal ⇄ 02c-lobby-2v2-waiting ─(4th joins)→ 02d-lobby-2v2-ready ⇄ 02e-lobby-dragging
             │                                                   │
       Start ▼                                             Start ▼
     04-game-normal                                        03-game-2v2
             └───────────────┬───────────────────────────────────┘
                 overlays on the table: 05-menu → 06d-leave-confirm,
                 06a-wild-color-picker, 06b-drew-playable-card, 06c-player-disconnected
                             ▼
                       07-game-over ──(Play again)──→ same lobby, same mode and teams
                             └──(Back to home)──→ 01-home
```

### 7.3 Home layout (`01-home`)

This is a flex column with `px-6 pt-safe pb-safe gap-[22px]`. From top to bottom:

1. A settings icon button, aligned right.
2. The hero card fan, 170px tall. Five hero cards pivot on `origin-bottom`: red 7 at −24°, yellow 2 at −12°, Wild +4 at 0° (raised, on top), blue ⊘ at +12°, green 9 at +24°. The outer cards sit 18px lower than the inner ones.
3. The title "Homemade Uno" (`text-hero`, centered) and the tagline "Card nights with friends, right from your phone" (`text-paragraph text-ink-muted`).
4. The "Your name" label and input.
5. The "Create a room" primary button.
6. An "or join a friend" divider: 1px `line` rules on each side of a 13px `ink-muted` label.
7. The "Room code" label, then a row with the code input (flex-1) and a 96×52 outline "Join" button.
8. A spacer, then a centered underlined "How to play" link.

### 7.4 Lobby layout (`02a`–`02f`)

This is a flex column with `px-5 pt-safe pb-safe gap-3`. From top to bottom:

1. A header with a back icon button, "Game room" (`text-title`) in the center, and an empty 44px space on the right.
2. The room-code panel (`rounded-panel shadow-panel px-5 pt-3 pb-3.5 gap-2`): "ROOM CODE" label, the code in `text-code`, then two equal buttons, "Copy link" (outline) and "Share invite" (primary small, which calls `navigator.share`).
3. The game mode panel (§5.9).
4. A "Players · N" row. On the right: "Up to 8" in Normal, or the drag hint in 2v2 for the host.
5. The player area: the player list card (§5.11) in Normal, or the Team A and Team B cards (§5.8) in 2v2.
6. A spacer, then the start control (§5.14).

Which lobby screen applies:

| Situation                          | Screen                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Host alone, just created           | `02a-lobby-just-created`                               |
| Normal selected, 2+ players        | `02b-lobby-normal` ("Play 2v2" disabled at 5+ players) |
| 2v2 selected, fewer than 4 players | `02c-lobby-2v2-waiting`                                |
| 2v2 selected, exactly 4 players    | `02d-lobby-2v2-ready`                                  |
| Host dragging a player             | `02e-lobby-dragging`                                   |
| Any lobby, seen by a non-host      | `02f-lobby-guest`                                      |

The lobby may scroll when 6–8 players are listed.

### 7.5 Game table layout — 2v2 (`03-game-2v2`)

| Layer          | Position (x, y, w, h)     | Notes                                                                                                                                |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Table oval     | 20, 150, 350×470          | `rounded-[50%] bg-felt border-2 border-felt-edge inset-shadow-felt`                                                                  |
| Top bar        | inset 16, y 16, h 44      | Room chip, mode chip ("2v2 · Round 1"), menu icon button                                                                             |
| Partner seat   | centered, y 70            | Avatar 40 (`team-a` ring), name, "Partner · N cards" in `team-a`; face-up cards with the partner 3D recipe                           |
| Left opponent  | x 8, y 272, w 76          | Avatar 44 + badge, name, side-seat backs (3D)                                                                                        |
| Right opponent | right 8, y 272, w 76      | Mirrored                                                                                                                             |
| Direction ring | 90, 290, 210×210          | SVG dashed circle r=96 in the current suit color at 45%, plus two arrowheads (clockwise, flipped when reversed)                      |
| Piles          | 105, 340, 180×116, gap 22 | Draw pile (left) and discard pile (right). The top discard card is rotated +8° with a suit glow; the previous card shows at −12°     |
| Turn pill      | centered, y 512           |                                                                                                                                      |
| Your row       | inset 16, y 596, h 48     | Avatar 44 (team ring + `animate-turn-pulse` on your turn), "You", "Team A · N cards"; right side has the "LAST CARD!" outline button |
| Your hand      | 0, 664, 390×180           | Fan (see §7.7)                                                                                                                       |

### 7.6 Game table layout — normal (`04-game-normal`)

This uses the same frame as 2v2, with these differences:

- There are no teams and no partner, and all avatar rings are `ink-muted`.
- The active player gets a `turn` ring and pulse, and the turn pill names them.
- Seats fill clockwise from your left: left side (x 8, y 272), top-left (x 56, y 72), top-right (x 214, y 72), right side. For 3 players, use left and right. For 6–8 players, add more top seats and shrink the backs to 30×44.
- The top mode chip reads "Normal · N players".

### 7.7 Hand fan math

For `n` cards (card width 70, container width W = screen width), with index `i` from 0 to n−1:

```
step     = min(42, (W - 34*2 - 70) / (n - 1))       // horizontal spacing
left_i   = (W - (70 + step*(n-1))) / 2 + i*step
t        = i - (n-1)/2                               // −…0…+
rotate_i = t * (30 / max(n-1, 1)) degrees            // total spread ≈ 30°
top_i    = 22 + 2.4 * t²                             // arc (px)
selected → top = 0, rotate = 0, z-index on top
```

Above 10 cards, allow horizontal scrolling of the hand rather than shrinking cards below 70px wide.

### 7.8 Overlays on the game table

- **`05-menu`:** drawer (§5.10) from the right.
- **`06a-wild-color-picker`:** bottom sheet (§5.15, §5.16), opened right after playing a Wild. It blocks the game until a color is chosen.
- **`06b-drew-playable-card`:** spotlight card (§5.17) plus bottom sheet.
- **`06c-player-disconnected`:** not an overlay but a table state. The offline avatar and countdown (§5.20), the turn pill text, and a toast (§5.19).
- **`06d-leave-confirm`:** dialog (§5.18), opened from "Leave game" in the menu.

### 7.9 Other full screens

- **`01c-game-already-started`:** a column with 44px top space, three fanned card backs (hero size, 84×124, at −14°, 0°, and +14°), the room chip, the title (`text-sheet`), the explanation (`text-paragraph text-ink-muted`, max 300px wide), a spacer, and primary "Back to home".
- **`01d-settings`:** header "Settings", then settings panels (§5.23).
- **`01e-how-to-play`:** header "How to play", an intro (`text-sheet` sentence plus a `text-paragraph` line), then six sections (§5.24): On your turn, Action cards, Stacking, Last card!, 2v2 teams, If someone drops out. The page scrolls; its design height is 2012.
- **`07-game-over`:** see §5.25.

---

## 8. Mobile / PWA requirements

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `<meta name="theme-color" content="#F2EBDD">`
- The manifest needs `display: "standalone"`, `orientation: "portrait"`, `background_color: "#F2EBDD"`, and `theme_color: "#F2EBDD"`.
- Size the root with `h-dvh` (not `100vh`) and apply `pt-safe` / `pb-safe` (defined in theme.css) so nothing hides under the notch or home bar.
- Game screens don't scroll. Only the lobby (with many players) and How to play scroll.
- The table must also fit short phones (667px tall): scale the table layout proportionally rather than cropping.
- Disable text selection on cards (`select-none`) and pinch-zoom on the table (`touch-action: manipulation`).

---

## 9. Motion (use Motion for React: `motion/react`)

| Moment              | Spec                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play a card         | Shared `layoutId={card.id}` from hand to discard pile, spring (stiffness 380, damping 30), and the card lands at a random rotation between −10° and +10°    |
| Opponent plays      | The card flies from that player's seat to the pile and flips (rotateY 180→0) during the flight, 350ms                                                       |
| Draw                | The card slides from the draw pile into the fan and flips face up for you, 300ms `ease-card`                                                                |
| Deal                | 7 cards to each seat, staggered 60ms per card, round-robin                                                                                                  |
| Select card         | Rises to `top: 0`, rotation 0, 150ms                                                                                                                        |
| Illegal tap         | Horizontal shake ±6px, 3 cycles, 240ms                                                                                                                      |
| Turn change         | The avatar ring switches to active with `animate-turn-pulse`; the turn pill cross-fades                                                                     |
| Color change (wild) | The direction ring and discard glow cross-fade to the new suit color, 300ms                                                                                 |
| Menu drawer         | Slides in from x=100%, 250ms `ease-card`; the backdrop fades 0→50%                                                                                          |
| Bottom sheet        | Slides up from y=100%, 250ms `ease-card`; the backdrop fades 0→50%. The spotlight card scales 0.9→1.25 as it rises from the draw pile                       |
| Dialog              | Fades in and scales 0.96→1, 200ms `ease-card`                                                                                                               |
| Toast               | Slides down 8px and fades in, 200ms; stays 3s; fades out 200ms                                                                                              |
| Drag (lobby)        | On pick-up the row lifts (scale 1.02, −2° rotation, `shadow-card-lifted`) within 120ms. On drop, rows spring to their new slots (stiffness 380, damping 30) |
| Countdown ring      | The progress stroke drains linearly over 60s                                                                                                                |
| Game over           | Confetti bursts once from the top center, 900ms; winner avatars pop in (scale 0.8→1)                                                                        |

Respect `prefers-reduced-motion`: replace flights with instant moves, remove the pulse, and show confetti without the burst. theme.css already does this for CSS animations.

---

## 10. Accessibility

- All interactive elements are real `<button>`, `<input>`, or `<a>` elements, and icon-only buttons have an `aria-label`.
- Suits are never distinguished by color alone; always render the shape.
- Text contrast is at least 4.5:1. Don't put `suit-yellow` text on `paper` or `surface`; use `suit-yellow-ink` or `ink` instead.
- Announce turn changes and cards played in an `aria-live="polite"` region.
- Every drag action has a tap and keyboard alternative: activating the drag handle moves the player to the other team.
- Dialogs and bottom sheets move focus inside when opened and return it when closed. They close with Escape, except the Wild color picker, which requires a choice.
- Error messages use `role="alert"`; toasts and the waiting status use `role="status"`.
- A disabled control always has a visible reason next to it (a Start caption or an info note), linked with `aria-describedby`.

---

## 11. Paused overlay (component §5.26)

Behind the overlay is a `bg-ink/50` backdrop over the whole table. The card is centered, `role="dialog" aria-modal="true" aria-labelledby`, and has **no Escape-to-close**: it is dismissed only by resuming, continuing, or ending the game.

Card: `w-[calc(100%-48px)] max-w-[342px] bg-surface rounded-panel shadow-cta p-6 flex flex-col gap-[18px]`, at about y 220 on the 390×844 design. Top to bottom:

1. **Header visual** (varies, see §2).
2. **Title:** `font-display text-sheet`.
3. **Explanation:** `text-paragraph text-ink-muted`.
4. **Status pill:** `self-start bg-paper rounded-full px-3 py-2 text-label`, with a 10px `turn` dot, reading "Paused for m:ss". It counts up every second.
5. **Action:** one full-width button (see §2).

## 12. Variants

| Variant                                                    | Screen                    | Header visual                                                                                                                      | Title / explanation                                                                                  | Action                                                                                                                                              |
| ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Break** (nobody offline)                                 | `08a-paused`              | 48px `bg-paper` circle with a 22px pause icon (two rounded bars) in `ink`                                                          | "Game paused" / "[name] paused the game. Anyone can resume when everyone's ready."                   | Dialog main button (`h-[50px] bg-ink text-surface font-extrabold`): "Resume game"                                                                   |
| **Waiting** (someone offline, paused by a player)          | `08b-paused-waiting`      | Offline avatar 56 (below) plus "[name] · offline" (`text-label text-ink-muted`)                                                    | "Waiting for [name]" / "[who] paused the game. It resumes by itself when [name] is back."            | Outline button "Continue without [name]", then a note (`text-label text-ink-muted text-center`): "[name]'s turns will be skipped until she returns" |
| **Auto** (a whole team offline, or fewer than 2 connected) | `08c-paused-team-offline` | Two offline avatars 56, overlapping by 18px, then the team label (`text-label font-extrabold tracking-[0.06em]` in the team color) | "Team B lost connection" / "The game paused by itself. It resumes when [name] or [name] comes back." | Danger outline button "End game"                                                                                                                    |

In Normal mode the Auto variant shows the missing players' avatars and "[names] lost connection". When several players are offline in the Waiting variant, list their avatars and use "Waiting for [name] and [name]".

**Offline avatar 56:** a 56px circle with `avatar` fill, a 3px ring (team color in 2v2, `ink-muted` in Normal), and the initial (20px, weight 800), all at 55% opacity. A 24px `bg-ink` badge at the top-right (−4px offset) holds a 13px `WifiOff` icon in `surface`.

## 13. Changes to existing screens (not included in this download)

- **`05-menu`:** add a "Pause game" button above "How to play". It is a dialog main button (`h-[50px] bg-ink text-surface font-extrabold`) with an 18px pause icon in `surface` before the label.
- **`06c-player-disconnected`:** add a "Pause and wait" chip button, centered at about y 552, under the turn pill: `h-9 px-3.5 rounded-full border-2 border-ink bg-surface text-label font-extrabold`, with a 14px pause icon. It is shown to every connected player while the disconnected player's countdown runs.

## 14. Motion and messages

- **Overlay:** fades in over 200ms `ease-card`, with the card scaling 0.96→1. It fades out on resume. With reduced motion it appears and disappears instantly.
- **Toasts** (§5.19): "[name] paused the game", "[name] resumed the game", "[name] is back". Automatic resume shows only the "is back" toast.
- **Announcements:** pause and resume are announced in the `aria-live="polite"` region. When the overlay opens, focus moves to its action button.
