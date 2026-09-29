# Requirements Updates

This document lists every change needed in `requirements.md`. It combines the review findings, the rule decisions made so far, and the new lobby design.

Each item gives the **requirement**, **what's wrong or what changed**, and the **suggested wording** in the same EARS style ("WHEN … THE App SHALL …") so it can be pasted in directly.

---

## 0. Decisions this document is based on

| Topic | Decision |
|---|---|
| Game mode | The **host chooses** Normal or 2v2 in the lobby. The mode is no longer set automatically by player count. New rooms start in Normal. |
| 2v2 player count | 2v2 needs **exactly 4** players. With 4 or fewer players the host can select 2v2 ("Start game" stays disabled until there are exactly 4). With 5 or more, the "Play 2v2" option is disabled with an explanation. No one is ever removed to make 2v2 fit. |
| Team arrangement | In 2v2, the host **drags players between Team A and Team B**. Dropping on a player swaps them. "Shuffle teams" is removed. |
| Missed "Last card!" | **Automatic 2-card penalty.** |
| Disconnected player | Their turn is **auto-skipped after 60 seconds**. Connected players have no time limit. |
| Stacking | A +2 stacks on any +2. A +4 stacks on a +2 or a +4. A +2 **cannot** go on a +4. |
| Maximum players | **8** |
| Game name | **Homemade Uno.** "Paper Café" is only the name of the color theme. |

### Still open (answer these before finalizing)

1. **"Leave game" in the menu:** does it work like disconnecting (turns are skipped and the player can come back), or does it remove the player permanently? This document assumes the first option, which matches the current dialog design.
2. ~~2v2 selected and a 5th player joins~~ **Decided:** "Play 2v2" is disabled at 5 or more players, and if a 5th player joins while 2v2 is selected, the room switches to Normal with a toast (see 4.9).
3. **"Round 1" chip on the game tables:** keep it as a count of games played in the room, or remove it? This document assumes it counts games.
4. ~~Game name~~ **Decided:** the game is called **Homemade Uno**, shown as the title on the Home screen. (If it is ever shared publicly, the name should be revisited, since UNO is a Mattel trademark.)

---

## 1. Introduction and Glossary

### Introduction, paragraph 1
**Change:** Replace "When exactly four players are present the game runs in 2v2 team mode … with any other player count the game runs in normal free-for-all mode" with:

> The host chooses the game mode in the lobby. Normal mode is a free-for-all for 2 to 8 players. 2v2 team mode requires exactly 4 players; partners see each other's cards face-up, and a team wins when either partner empties their hand.

### Introduction, paragraph 2
**Problem:** Two `design.md` files are listed (`design/design.md` and `design/uno-design/design.md`). If they differ, it's unclear which one wins.
**Change:** Keep only `design/uno-design/`, or state which file takes precedence.

**Problem:** "Player identity is preserved … via a stored device identifier." A value in local storage breaks on iPhones: the installed home-screen app and Safari keep separate storage, and invite links open in Safari. It also can't be enforced by Supabase security rules.
**Change:** "…player identity is preserved across disconnects via a Supabase anonymous sign-in session."

### Glossary
| Term | Change |
|---|---|
| **Device_ID** | Rename to **Player_ID**: "The user ID from the Player's Supabase anonymous sign-in session, persisted by the Supabase client and used to restore the Player's Seat and Hand on reconnect." |
| **Seat** | "A fixed position at the game table, assigned when the game starts and kept for that game." (Seats can't be fixed "for the duration of a Room", because players join, leave, and change teams in the lobby.) |
| **Normal_Mode** | "The free-for-all mode, selectable by the Host for 2 to 8 Players." |
| **Team_Mode** | "The 2v2 mode, selectable by the Host; requires exactly 4 Players to start." |
| **Last_Card_Call** | "The action a Player takes by pressing 'LAST CARD!' on their turn while holding 2 Cards, before playing one." |
| **Game_Mode** | *New:* "The Host's selection of Normal_Mode or Team_Mode for the next game in the Room." |
| **Grace_Period** | *New:* "The 60 seconds a disconnected Active_Player has to reconnect before their turn is skipped." |
| **Toast** | *New:* "A short, temporary message shown to all Players, per the Design_Spec." |
| **Design_Steering_File** | Move to a separate "Development process" section (see §20). |

---

## 2. Requirement 1: Room Creation and Link Sharing

**1.1** Add the destination and the default mode:
> WHEN a Player submits a name and selects "Create a room" on the Home screen, THE App SHALL create a Room with Normal_Mode selected, assign the Player as Host, generate a unique Room_Code, and present the Lobby screen.

**1.5** Remove the type-token detail ("using the `text-code` type token"). That belongs in the Design_Spec. Replace with: "…per the Lobby screen reference."

**1.6** Keep, and add: Room_Codes SHALL exclude look-alike characters (0, O, 1, I, L).

**Add 1.7 (name rules):**
> THE App SHALL require a name of 1 to 16 characters, trimmed of surrounding spaces, and SHALL store it on the device for future visits. IF two Players in a Room have the same name, THEN THE App SHALL append a number to the later Player's displayed name.

---

## 3. Requirement 2: Joining a Room

**2.1 — Problem:** The link opens straight into the Lobby, but the Player has never entered a name.
> WHEN a Player opens an Invite_Link and has no stored name, THE App SHALL present the Home screen with the Room_Code field pre-filled and the name field focused. WHEN a Player opens an Invite_Link and has a stored name, THE App SHALL join the Room and present the Lobby screen.

**2.3** Change "up to 4" to "exactly 4". Input SHALL be converted to uppercase as the Player types.

**2.4** Add a design reference: "…per the `01b-home-room-not-found` screen reference."

**2.5** Clarify what "existing Room association" means:
> WHEN the App opens without a Room_Code and the Player belongs to a Room whose game is in progress, THE App SHALL return the Player to that game. OTHERWISE THE App SHALL present the Home screen.

**Add 2.7 (room full):**
> IF a Player attempts to join a Room that already has 8 Players, THEN THE App SHALL display a message that the Room is full and remain on the Home screen.

*(Needs a small design: it can reuse the room-not-found error style.)*

---

## 4. Requirement 3: Seat Assignment and Rejoin

**3.1** "…persist a **Player_ID** via Supabase anonymous sign-in." Seats are assigned at game start (see 5.6), not on joining.

**3.2 / 3.4 / 3.5** Replace "Device_ID" with "Player_ID".

**3.5** Add a design reference: "…per the `01c-game-already-started` screen reference."

**Add 3.6 (host leaves the lobby):**
> IF the Host leaves the Lobby before the game starts, THEN THE App SHALL make the longest-present remaining Player the Host.

---

## 5. Requirement 4: Lobby and Mode Selection — **rewrite**

The current 4.2 and 4.3 choose the mode automatically by player count. The new lobby design lets the host choose. Replace Requirement 4 entirely:

> **User Story:** As a Host, I want to choose between a normal game and 2v2, arrange the teams, and start when everyone is ready.
>
> 1. THE App SHALL display the Room_Code panel with "Copy link" and "Share invite", the Game_Mode panel, the Player list, and the start control, per the Lobby screen references.
> 2. WHERE the current Player is the Host, THE App SHALL display a Game_Mode control with two options, "Normal" and "Play 2v2", and SHALL let the Host switch between them at any time before the game starts.
> 3. WHERE the current Player is not the Host, THE App SHALL display the selected Game_Mode as read-only text labelled "chosen by the host", per the `02f-lobby-guest` reference.
> 4. WHILE Normal_Mode is selected, THE App SHALL list all Players in a single card, per the `02b-lobby-normal` reference.
> 5. WHILE Team_Mode is selected, THE App SHALL show Team A and Team B cards with two slots each, and SHALL show an empty "Waiting for a player" slot for each unfilled place, per the `02c-lobby-2v2-waiting` reference.
> 6. WHEN the Host switches to Team_Mode, THE App SHALL fill the teams in join order, alternating Team A and Team B.
> 7. WHILE Normal_Mode is selected and fewer than 2 Players are present, THE App SHALL disable "Start game" and show "Invite at least 1 more player to start", per the `02a-lobby-just-created` reference.
> 8. WHILE Team_Mode is selected and the Player count is not exactly 4, THE App SHALL disable "Start game" and show "2v2 needs exactly 4 players. N of 4 have joined."
> 9. WHILE 5 or more Players are in the Lobby, THE App SHALL disable the "Play 2v2" option and show "2v2 needs exactly 4 players. It unlocks if the room gets back to 4.", per the `02b-lobby-normal` reference. THE App SHALL NOT remove any Player to enable Team_Mode.
> 9a. IF a 5th Player joins while Team_Mode is selected, THEN THE App SHALL switch the Game_Mode to Normal_Mode and show a Toast to all Players: "Switched to a normal game. 2v2 needs exactly 4 players."
> 9b. WHEN the Player count drops back to 4 or fewer, THE App SHALL re-enable "Play 2v2" but SHALL NOT switch the mode back automatically.
> 10. WHERE the current Player is not the Host, THE App SHALL show "Waiting for [host name] to start the game" and a "Leave room" button instead of "Start game".
> 11. THE App SHALL update the Game_Mode, teams, and Player list for all Players in real time.

**Remove:** old 4.6 ("Shuffle teams"). It's replaced by Requirement 21 below.

---

## 6. New Requirement 21: Team Arrangement (drag and drop)

> **User Story:** As a Host, I want to drag players between teams, so that I can choose who partners with whom.
>
> 1. WHILE Team_Mode is selected, THE App SHALL show a drag handle (six-dot grip) on each Player row for the Host only, per the `02d-lobby-2v2-ready` reference.
> 2. WHEN the Host drags a Player row, THE App SHALL lift the row, leave a dashed placeholder in its original slot, and show "Drop on a player to swap", per the `02e-lobby-dragging` reference.
> 3. WHEN the Host drops a Player onto a Player in the other team, THE App SHALL swap the two Players.
> 4. WHEN the Host drops a Player onto an empty slot in the other team, THE App SHALL move the Player into that slot.
> 5. WHEN the Host drops a Player outside a valid target, THE App SHALL return the row to its original slot.
> 6. THE App SHALL let the Host move a Player without dragging: activating the drag handle by tap or keyboard SHALL move that Player to the other team, swapping with the Player in the same position if that team is full.
> 7. THE App SHALL NOT show drag handles to non-Host Players, and SHALL reject team changes from non-Host Players.

*Why 21.6:* dragging alone doesn't work for screen-reader or keyboard users, which Requirement 18 requires.

---

## 7. Requirement 5: Dealing

**Add 5.0 (deck composition):**
> THE App SHALL build a 108-card deck: in each Suit, one 0, two each of 1–9, two +2, two skip, and two reverse; plus 4 Wild and 4 Wild +4 Cards.

**5.3** Remove the animation timing ("60ms"); say "per the Design_Spec motion rules".

**5.5 — Problem:** It only covers a Wild as the first card, not a skip, reverse, or +2.
> IF the initial face-up Card is not a number Card, THEN THE App SHALL return it to the Draw_Pile, reshuffle, and turn over another until a number Card is on top.

**Add 5.6 (seats):**
> WHEN the game starts, THE App SHALL assign Seats. In Team_Mode, Seats SHALL alternate Team A and Team B so that partners sit opposite each other.

---

## 8. Requirement 6: Turn Flow and Direction

**6.3** Add the two-player case:
> WHEN a reverse Card is played in a game with exactly 2 Players, THE App SHALL treat it as a skip.

**6.4 — Problem:** In 2v2 every avatar ring is already a team color, so "the Team ring" can't show whose turn it is.
> THE App SHALL show the Active_Player with the turn pulse in both modes. In Normal_Mode the ring is the `turn` color; in Team_Mode it keeps the team color.

**6.6 — Change** for the disconnect decision:
> WHILE the Active_Player is connected, THE App SHALL allow the turn to remain open with no time limit.

**Add 6.8 (toasts):**
> WHEN a penalty, skip, or reverse affects a Player, THE App SHALL show a Toast naming the Player and the effect (for example, "Leo draws 4").

---

## 9. Requirement 7: Card Matching Validity

**7.1 — Problem:** "matches by Suit … or matches the current Active_Color" says the same thing twice, and is unclear after a Wild.
> WHEN the Active_Player plays a non-Wild Card, THE App SHALL accept it only if its Suit equals the Active_Color, or its number or symbol equals the top Discard_Pile Card's.

**7.2 — Problem:** It conflicts with 9.5, which blocks Wilds while a penalty is pending.
> WHEN the Active_Player plays a Wild or Wild +4 Card **and no Penalty_Count is pending**, THE App SHALL accept the play.

**7.3** Keep. Remove the words "shake animation per the Design_Spec" and reference Requirement 17 instead.

**7.5** Remove "`brightness-55`". Say "dim, per the Design_Spec".

---

## 10. Requirement 8: Wild Color Selection

**8.1** Add the design reference and the "no cancel" rule:
> …THE App SHALL present the color picker per the `06a-wild-color-picker` reference. The picker SHALL NOT offer a cancel option.

**8.3** Remove the animation timing ("300ms"). Keep the behavior.

---

## 11. Requirement 9: Stacking — **rewrite 9.3 and 9.5**

> 9.3 WHILE a Penalty_Count is pending against the Active_Player, THE App SHALL accept a +2 Card of any color onto a pending +2, and a Wild +4 onto a pending +2 or +4, adding its value to the Penalty_Count and passing it to the next Player.
>
> 9.5 WHILE a Penalty_Count is pending and the top draw Card is a Wild +4, THE App SHALL reject a +2. WHILE any Penalty_Count is pending, THE App SHALL reject every play other than those in 9.3.
>
> 9.6 *(new)* WHEN a Wild +4 is stacked, THE Player who played it SHALL choose the Active_Color. The last color chosen applies after the penalty is drawn.

---

## 12. Requirement 10: Draw-One Behavior

**10.2** Add the choice and its design:
> WHERE a drawn Card is playable, THE App SHALL show the drawn Card with "Play it" and "Keep it", per the `06b-drew-playable-card` reference. "Keep it" SHALL end the turn.

**10.4** Remove the timing ("300ms").

---

## 13. Requirement 11: Last-Card Call — **rewrite**

**Problem:** 11.1 shows the button only at 1 card, but 11.2 lets you press it *before* reaching 1 card. The design shows the button at all times. 11.4 is redundant.

> 1. THE App SHALL always display the "LAST CARD!" button, per the Design_Spec, and SHALL enable it only on the Player's turn while they hold exactly 2 Cards.
> 2. WHEN a Player presses "LAST CARD!", THE App SHALL record the Last_Card_Call for that turn.
> 3. IF a Player's turn ends with 1 Card and no Last_Card_Call recorded, THEN THE App SHALL make that Player draw 2 Cards and show a Toast to everyone (for example, "Leo forgot to call last card, +2").
> 4. WHEN a Player's Hand grows above 1 Card, THE App SHALL clear their Last_Card_Call.

**Remove:** old 11.4.

---

## 14. Requirement 12: Win Conditions

**12.3** Add the design reference:
> WHEN the game ends, THE App SHALL show the result screen to all Players, including each Player's remaining Card count, per the `07-game-over` reference.

**Add 12.5 (after the game):**
> WHERE the current Player is the Host, THE App SHALL show "Play again", which returns everyone to the Lobby with the same Game_Mode and teams. Non-Host Players SHALL see "Waiting for the host". All Players SHALL see "Back to home".

**Add 12.6 (counter, open decision 3):**
> THE App SHALL count games played in the Room and show it on the game table mode chip as "Round N" (for example "2v2 · Round 2"), matching the `03-game-2v2` reference.

---

## 15. Requirement 13: Partner Card Visibility

**13.4** Clarify that the "real count" rule is about face-down backs:
> THE App SHALL show at most 7 face-down card backs per opponent seat and display the real Card count in the badge.

**Add 13.5 (link to security):**
> In Team_Mode, THE App SHALL make a Player's Hand readable only by that Player and their Partner (see Requirement 23).

---

## 16. Requirement 14: Realtime Synchronization

**14.3** Remove; it repeats 14.1.

**14.5 — Problem:** It doesn't say *where* the check happens, so a modified browser could bypass it.
> THE server SHALL validate every play and draw. Each action SHALL carry the game-state version it was based on, and THE server SHALL reject actions from non-Active Players and actions based on an outdated version.

**Add 14.6:** "THE Realtime_Service SHALL propagate Game_Mode, team, and Host changes in the Lobby."

---

## 17. Requirement 15: Disconnect and Reconnect — **rewrite 15.1 and 15.3**

> 15.1 WHEN a Player loses connection, THE App SHALL show them as offline to other Players and show a Toast "[name] lost connection", per the `06c-player-disconnected` reference.
>
> 15.3 WHEN it becomes a disconnected Player's turn, THE App SHALL show a countdown of the Grace_Period on their avatar and in the turn pill. IF they have not reconnected when it ends, THEN THE App SHALL skip their turn, and SHALL make them draw any pending Penalty_Count.
>
> 15.5 *(new)* WHILE a Player stays disconnected after one skipped turn, THE App SHALL skip their later turns immediately.
>
> 15.6 *(new)* THE server SHALL record each Player's last-seen time, and SHALL perform the skip only after confirming the Grace_Period has passed. *(A disconnected phone can't skip its own turn, so the remaining players' apps request it and the server checks.)*
>
> 15.7 *(new)* IF fewer than 2 Players remain connected, THEN THE App SHALL end the game. *(Needs a small design: a variant of the game-over screen.)*

---

## 18. New Requirement 22: Leaving (open decision 1)

> 1. WHEN a Player selects "Leave game", THE App SHALL ask for confirmation, per the `06d-leave-confirm` reference.
> 2. WHEN a Player confirms, THE App SHALL return them to the Home screen and treat them as disconnected, skipping their turns immediately with no Grace_Period.
> 3. THE Player SHALL be able to rejoin through the Invite_Link until the game ends.

*If you choose "remove permanently" instead: their Cards return to the Draw_Pile, their Seat is removed, and a 2v2 game ends. The dialog text must also change.*

---

## 19. Requirement 16: PWA and Mobile

**16.1–16.3** Keep, but reference the Design_Spec instead of repeating the values.

**16.4 — Problem:** It covers width but not height. On short phones such as the iPhone SE (667px tall), the 844px table doesn't fit.
> THE App SHALL fit phone screens 360–430px wide and 667–932px tall without scrolling on game screens, scaling the table layout proportionally.

**16.5** Change "only the Lobby" to "the Lobby and How to play".

**Add 16.7:** "THE App SHALL hide the Vibration setting on devices that don't support vibration (including iPhones)."

---

## 20. Requirement 17: Animations

**Problem:** It repeats exact timings from the Design_Spec. When the design changes, the two documents drift apart.
**Change:** Keep each item's *behavior*, and replace all numbers with "per the Design_Spec". Add:

> 17.7 WHEN a bottom sheet or dialog opens, THE App SHALL animate it per the Design_Spec.
> 17.8 WHEN the Host drags a Player row, THE App SHALL lift and tilt the row per the `02e-lobby-dragging` reference.

---

## 21. Requirement 18: Accessibility

**18.5** Remove the specific token names; say "per the Design_Spec".

**Add 18.6:** "Every drag-and-drop action SHALL have a tap and keyboard alternative (see 21.6)."

**Add 18.7:** "Dialogs and bottom sheets SHALL move focus inside when opened, return it when closed, and close with the Escape key, except the Wild color picker, which requires a choice."

---

## 22. Requirement 19: Screen Coverage — **replace with this screen table**

Requirement 19 should list every designed screen. The table below lines up three names for each screen: the **board name** exactly as it appears on the design canvas, the **design file**, and the **reference ID** used in the export package and throughout these requirements. Every reference ID mentioned elsewhere in this document matches this table.

Replace Requirement 19's criteria with:

> THE App SHALL provide every screen and state listed in the Screen Table, each matching its reference under `design/uno-design/screens/`.

### Screen Table

All boards are 390×844 and use the "Paper Café" color theme (the name of the palette, not the game), except How to play, which scrolls (390×2012).

| # | Board name (design canvas) | Design file | Reference ID | Description | Requirements |
|---|---|---|---|---|---|
| 1 | Homemade Uno · Home | `Home.dc.html` | `01-home` | First screen when there's no room. Card-fan hero, "Homemade Uno" title and tagline, "Your name" input, "Create a room" button, an "or join a friend" divider, the room-code input with "Join", a "How to play" link, and a settings button. Opens with the code pre-filled when a friend follows an invite link. | 1.1, 1.7, 2.1, 2.2, 2.3, 2.5 |
| 2 | Homemade Uno · Home · room not found | `HomeError.dc.html` | `01b-home-room-not-found` | Home after "Join" with a code that matches no room. The code field gets a red border and a red message appears under it: "No room uses the code ABCD. Check the code with your friend and try again." The player stays on Home. | 2.4 |
| 3 | Homemade Uno · Game already started | `GameStarted.dc.html` | `01c-game-already-started` | Full screen shown when someone opens an invite link to a game that's already in progress and they weren't part of it. Fanned card backs, the room code, "This game has already started", a short explanation, and "Back to home". | 3.5 |
| 4 | Homemade Uno · Settings | `Settings.dc.html` | `01d-settings` | Opened from the Home settings button. Editable name, switches for Sound effects, Vibration (hidden on devices without vibration), and Highlight playable cards, a "How to play" link, and the app version. | 1.7, 16.7 |
| 5 | Homemade Uno · How to play | `HowToPlay.dc.html` | `01e-how-to-play` | Scrolling rules page opened from Home, Settings, or the in-game menu. Sections: goal, your turn (with ✓/✗ matching examples), action cards, stacking, last card, 2v2 teams, and what happens when someone drops out. | 16.5 |
| 6 | Homemade Uno · Lobby · just created | `LobbyNew.dc.html` | `02a-lobby-just-created` | What the host sees right after "Create a room". Room-code panel with "Copy link" and "Share invite", the mode control set to Normal, only the host listed plus a dashed "Share the link to invite friends" slot, and "Start game" disabled with "Invite at least 1 more player to start". | 1.1–1.4, 4.1, 4.2, 4.7 |
| 7 | Homemade Uno · Lobby · normal game | `LobbyNormal.dc.html` | `02b-lobby-normal` | Host view in Normal mode with 5 players in one list. "Play 2v2" is greyed out with the note "2v2 needs exactly 4 players. It unlocks if the room gets back to 4." "Start game" is enabled. | 4.2, 4.4, 4.9 |
| 8 | Homemade Uno · Lobby · 2v2 waiting | `Lobby2v2Waiting.dc.html` | `02c-lobby-2v2-waiting` | Host has selected "Play 2v2" with only 3 players. Team A and Team B cards, one dashed "Waiting for a player" slot, drag handles on each row, and "Start game" disabled with "2v2 needs exactly 4 players. 3 of 4 have joined." | 4.5, 4.6, 4.8 |
| 9 | Homemade Uno · Lobby · 2v2 ready | `Lobby.dc.html` | `02d-lobby-2v2-ready` | Host view with exactly 4 players in 2v2. Two full teams, a six-dot drag handle on every row, the hint "Drag to change teams", and "Start game" enabled. | 4.5, 21.1 |
| 10 | Homemade Uno · Lobby · dragging a player | `LobbyDragging.dc.html` | `02e-lobby-dragging` | The moment the host drags Leo from Team B onto Maya in Team A. Leo's row is lifted and tilted, Maya's row shows a dashed "Swap" target, Leo's old slot is a dashed placeholder, and the hint reads "Drop on a player to swap". | 21.2–21.5, 17.8 |
| 11 | Homemade Uno · Lobby · guest view | `LobbyGuest.dc.html` | `02f-lobby-guest` | What non-host players see (here, Maya). The mode is read-only ("chosen by the host"), there are no drag handles, and "Waiting for Alex to start the game" with a "Leave room" button replaces "Start game". | 4.3, 4.10, 21.7 |
| 12 | Homemade Uno · 2v2 table | `Game2v2_Paper.dc.html` | `03-game-2v2` | 2v2 game in progress on your turn. Partner's hand face-up and tilted at the top, opponents' card backs angled on the sides, draw and discard piles with the direction ring, the turn pill, your avatar with the "LAST CARD!" button, and your fanned hand with unplayable cards dimmed and the selected card raised. | 6.4, 6.5, 7.5, 11.1, 13.1–13.4 |
| 13 | Homemade Uno · Normal table | `GameNormal.dc.html` | `04-game-normal` | Normal game with 5 players on someone else's turn. Four opponents with card backs (two tilted at the top, two angled at the sides), the active player's avatar glowing, and the turn pill naming them and the current color. | 5.6, 6.4, 6.5, 13.3 |
| 14 | Homemade Uno · In-game menu | `Menu.dc.html` | `05-menu` | Drawer that slides in from the right when the menu button is tapped. Room code with "Copy link", cards left per player (grouped by team in 2v2), the three setting switches, "How to play", and "Leave game". | 1.3, 22.1 |
| 15 | Homemade Uno · Wild · choose a color | `WildPicker.dc.html` | `06a-wild-color-picker` | Bottom sheet over the table right after playing a Wild or Wild +4. Shows the card played, "Choose a color", who draws next, and four large color buttons, each with its shape and name. There is no cancel option. | 8.1, 8.2, 9.6 |
| 16 | Homemade Uno · Drew a playable card | `PlayOrKeep.dc.html` | `06b-drew-playable-card` | After drawing a card that can be played. The drawn card is shown enlarged ("You drew"), with a sheet saying "Red 3 fits the pile" and the buttons "Play it" and "Keep it" (which ends the turn). | 10.2 |
| 17 | Homemade Uno · Player disconnected | `Disconnected.dc.html` | `06c-player-disconnected` | Normal game where Nora lost connection on her turn. Her avatar is faded with an offline badge and a countdown ring, her name reads "Nora · offline", the pill says "Waiting for Nora · skipping in 42s", and a "Nora lost connection" toast appears. | 15.1, 15.3, 15.5 |
| 18 | Homemade Uno · Leave game · confirm | `LeaveConfirm.dc.html` | `06d-leave-confirm` | Dialog after tapping "Leave game" in the menu. "Leave this game?" with an explanation that your turns will be skipped and you can come back through the invite link, then "Stay in game" (main) and "Leave game" (red). | 22.1, 22.2 |
| 19 | Homemade Uno · Game over · team wins | `Winner.dc.html` | `07-game-over` | Result screen shown to everyone when the game ends (2v2 example). Confetti in the four card shapes, the winners' avatars, "Team A wins!", who played the last card, cards left per player, "Play again" (host only; others see "Waiting for the host"), and "Back to home". | 12.1–12.5 |

### Still to design

These states are required but have no board yet. Each can reuse existing components.

| Needed for | What it needs |
|---|---|
| 2.7 Room full | Home error state like #2, with the message "This room is full (8 players)." |
| 4.9a Auto-switch to Normal | A toast in the lobby: "Switched to a normal game. 2v2 needs exactly 4 players." |
| 15.7 Game ended early | A variant of #19 titled "Game ended" for when fewer than 2 players remain connected. |
| 12.5 Guest game over | A variant of #19 with "Waiting for the host" instead of "Play again". |
| Normal game over | A variant of #19 for Normal mode: one winner's avatar and "Maya wins!" |

## 23. Requirement 20: Design Fidelity

**20.1 — Problem:** It requires spacing tokens from `theme.css`, but there are none. Spacing uses Tailwind's default scale plus a few exact values listed in `design.md`, so as written the rule can't be met.
> THE App SHALL use only the color, typography, radius, and shadow tokens in `theme.css`, Tailwind's default spacing scale, and values explicitly listed in `design.md`.

**20.3** Move to a new section, "Development process". It's a rule for how the code is written, not a feature of the app.

**20.4 and 20.5** Merge into one criterion. They overlap with Requirement 19.

**Add:** The export package (`design.md`, `theme.css`, `tokens.json`, `screens/`) must be regenerated to include the new screens and these new components:

- the mode control (segmented)
- the drag handle, drag-lifted row, and drop target
- the empty player slot
- the disabled primary button
- the bottom sheet
- the dialog
- the toast
- the large color buttons
- the enlarged drawn card
- the countdown ring and offline badge
- the confetti

---

## 24. New Requirement 23: Hidden Hands and Server Authority

> 1. THE App SHALL never send a Player the contents of another Player's Hand, except their Partner's in Team_Mode.
> 2. THE App SHALL never send any Player the order of the Draw_Pile.
> 3. THE server SHALL deal, shuffle, and apply every game rule. The App SHALL only display state and send requested actions.

*This is the Supabase Row Level Security plus Edge Function setup from our first discussion.*

---

## 25. New Requirement 24: Room Lifecycle and Limits

> 1. THE App SHALL allow at most 8 Players in a Room.
> 2. THE App SHALL delete a Room after 24 hours with no activity, making its Room_Code available again.
> 3. THE App SHALL treat a Room as "active" for 1.6 (unique codes) until it is deleted.

---

## 26. Things to remove

| Item | Reason |
|---|---|
| Old 4.6 "Shuffle teams" | Replaced by drag and drop (Requirement 21). |
| Old 11.4 | Redundant with the win conditions. |
| 14.3 | Repeats 14.1. |
| Exact timings and token names in 1.5, 5.3, 7.5, 8.3, 10.4, 16.1–16.3, 17, 18.5 | Keep them only in the Design_Spec so the two documents can't drift apart. |
| 20.4 / 20.5 duplication | Merge. |
