# Requirements Document

## Introduction

Homemade Uno is a mobile-first, link-shareable, multiplayer color-matching card game built as a portrait-only Progressive Web App. Players create a private room, share a link (or a 4-character room code), and play a standard UNO-style match with friends. There are no accounts and no bots: access is anonymous and gated only by the room code, and every player is a human. The host chooses the game mode in the lobby. Normal mode is a free-for-all for 2 to 8 players. 2v2 team mode requires exactly 4 players; partners see each other's cards face-up, and a team wins when either partner empties their hand.

The application must be built strictly to the provided design assets in the `design/uno-design/` folder (`design/uno-design/design.md`, `design/uno-design/screen-map.json`, `design/uno-design/theme.css`, `design/uno-design/tokens.json`, and the screen references under `design/uno-design/screens/`). All colors, typography, radii, shadows, spacing, components, screen layouts, motion, and accessibility rules are defined there and must be followed exactly. No tokens or visual values may be invented. Realtime play, room data, and player hands are backed by Supabase, and player identity is preserved across disconnects via a Supabase anonymous sign-in session.

## Glossary

- **App**: The Homemade Uno Progressive Web Application running in a mobile browser.
- **Auto_Pause**: A pause started by the App rather than a Player, when fewer than 2 Players are connected, or in Team_Mode when both Players of one Team are disconnected.
- **Player**: A human participant identified by a Player_ID; no bots exist.
- **Host**: The Player who created the Room; the only Player able to choose the Game_Mode, arrange teams, and start the game.
- **Room**: A private game session identified by a unique 4-character Room_Code and reachable by an Invite_Link.
- **Room_Code**: A 4-character uppercase alphanumeric identifier for a Room (for example "K7QX").
- **Invite_Link**: A shareable URL that opens the App directly into the Room identified by its embedded Room_Code.
- **Player_ID**: The user ID from the Player's Supabase anonymous sign-in session, persisted by the Supabase client and used to restore the Player's Seat and Hand on reconnect.
- **Seat**: A fixed position at the game table, assigned when the game starts and kept for that game.
- **Hand**: The set of cards held by a Player.
- **Partner**: In 2v2 mode, the Player seated opposite whose Hand is visible face-up.
- **Paused**: A game state in which no Player can play, draw, call "LAST CARD!", or be skipped, and no Grace_Period countdown runs.
- **Team**: In 2v2 mode, a pair of Players (Team A or Team B) who win or lose together.
- **Game_Mode**: The Host's selection of Normal_Mode or Team_Mode for the next game in the Room.
- **Normal_Mode**: The free-for-all mode, selectable by the Host for 2 to 8 Players.
- **Team_Mode**: The 2v2 mode, selectable by the Host; requires exactly 4 Players to start.
- **Card**: A playing card with a suit and a value, or a Wild card.
- **Suit**: One of red (●), yellow (▲), green (■), or blue (◆).
- **Value**: One of 0–9, +2 (draw two), skip (⊘), reverse (⇄), Wild, or Wild +4.
- **Draw_Pile**: The face-down stack from which Players draw cards.
- **Discard_Pile**: The face-up stack; the top Card determines the current match constraints.
- **Active_Player**: The Player whose turn it currently is.
- **Play_Direction**: The order of turn rotation, either clockwise or counter-clockwise.
- **Active_Color**: The Suit that the next Card must currently match; set by the top Discard_Pile Card or by a Wild color selection.
- **Penalty_Count**: The accumulated number of cards a Player must draw due to unresolved +2 or +4 cards under stacking.
- **Last_Card_Call**: The action a Player takes by pressing "LAST CARD!" on their turn while holding 2 Cards, before playing one.
- **Grace_Period**: The 60 seconds a disconnected Active_Player has to reconnect before their turn is skipped.
- **Toast**: A short, temporary message shown to all Players, per the Design_Spec.
- **Realtime_Service**: The Supabase-backed service that synchronizes Room and game state across all Players.
- **Design_Spec**: The design source of truth comprising `design/uno-design/design.md`, `design/uno-design/screen-map.json`, `design/uno-design/theme.css`, `design/uno-design/tokens.json`, and the screen references under `design/uno-design/screens/`.
- **Reduced_Motion**: The user preference expressed by the `prefers-reduced-motion` media query.

## Requirements

### Requirement 1: Room Creation and Link Sharing

**User Story:** As a Player, I want to create a private room and share a link, so that my friends can join my game without needing an account.

#### Acceptance Criteria

1. WHEN a Player submits a name and selects "Create a room" on the Home screen, THE App SHALL create a Room with Normal_Mode selected, assign the Player as Host, generate a unique Room_Code, and present the Lobby screen.
2. IF a Player selects "Create a room" while the name field is empty or contains only whitespace, THEN THE App SHALL reject the request, retain any entered input, and display an error indication that a name is required.
3. WHEN a Room is created, THE App SHALL generate an Invite_Link that embeds the Room_Code and, when opened, loads the App directly into the associated Room.
4. WHEN a Player selects "Copy link" on the Lobby screen, THE App SHALL copy the Invite_Link to the device clipboard and display a confirmation indication within 1 second.
5. IF the clipboard copy operation fails when a Player selects "Copy link", THEN THE App SHALL display an error indication that the copy did not succeed and SHALL leave the Invite_Link visible for manual copying.
6. WHEN a Player selects "Share invite" on the Lobby screen, THE App SHALL invoke the device native share sheet with the Invite_Link.
7. IF the device native share sheet is unavailable when a Player selects "Share invite", THEN THE App SHALL fall back to copying the Invite_Link to the clipboard and display an indication that sharing is unavailable.
8. WHILE the Lobby screen is displayed, THE App SHALL display the Room_Code in the Lobby room-code panel per the Lobby screen reference.
9. THE App SHALL generate each Room_Code from uppercase letters A-Z and digits 0-9, excluding the look-alike characters 0, O, 1, I, and L.
10. IF Room_Code generation produces a value already assigned to an active Room, THEN THE App SHALL generate a different Room_Code before assigning it, retrying up to 10 times.
11. IF Room_Code generation cannot produce a unique value within 10 attempts, THEN THE App SHALL abort Room creation and display an error indication that the Room could not be created.
12. THE App SHALL require a name of 1 to 16 characters, trimmed of surrounding spaces, and SHALL store it on the device for future visits.
13. IF two Players in a Room have the same name, THEN THE App SHALL append a number to the later Player's displayed name.

### Requirement 2: Joining a Room via Link or Code

**User Story:** As a Player, I want to join a friend's room by opening a link or entering a 4-character code, so that I can play without signing up.

#### Acceptance Criteria

1. WHEN a Player opens an Invite_Link and has no stored name, THE App SHALL present the Home screen with the Room_Code field pre-filled and the name field focused.
2. WHEN a Player opens an Invite_Link and has a stored name, THE App SHALL join the Room and present the Lobby screen.
3. WHEN a Player enters a Room_Code, submits a name, and selects "Join" on the Home screen, THE App SHALL load the Room identified by that Room_Code.
4. THE App SHALL accept a Room_Code of exactly 4 characters, restrict entry to letters A-Z and digits 0-9, and convert input to uppercase as the Player types.
5. IF a Player selects "Join" with a Room_Code that is fewer than 4 characters, THEN THE App SHALL reject the request, retain the entered input, and display an indication that a 4-character code is required.
6. IF a Player attempts to join using a Room_Code that matches no active Room, THEN THE App SHALL display a message that the Room was not found and remain on the Home screen, per the `01b-home-room-not-found` screen reference.
7. IF a Player selects "Join" while the name field is empty or contains only whitespace, THEN THE App SHALL reject the request, retain any entered input, and display an error indication that a name is required.
8. WHEN the App opens without a Room_Code and the Player belongs to a Room whose game is in progress, THE App SHALL return the Player to that game.
9. WHEN the App opens without a Room_Code and the Player does not belong to a Room whose game is in progress, THE App SHALL present the Home screen.
10. IF a Player attempts to join a Room that already has 8 Players, THEN THE App SHALL display a message that the Room is full and remain on the Home screen.
11. THE App SHALL grant Room access based solely on possession of the Room_Code and SHALL NOT require account creation or login.

### Requirement 3: Seat Assignment and Rejoin

**User Story:** As a Player, I want to be returned to my seat with my cards after a disconnect, so that closing my browser does not remove me from the game.

#### Acceptance Criteria

1. WHEN a Player joins a Room for the first time with no Player_ID matching a Seat in that Room, THE App SHALL persist a Player_ID via the Player's Supabase anonymous sign-in session.
2. WHEN a Player reopens the Invite_Link with a Player_ID that matches an occupied Seat in the Room, THE App SHALL restore the Player to that same Seat with the identical set of Cards held in that Seat's Hand at the time of restoration.
3. WHILE a Player is disconnected from a Room in which the game has started and has not ended, THE App SHALL retain that Player's Seat and Hand for reconnection with no expiry time limit.
4. IF a Player opens the Invite_Link with a Player_ID that matches no Seat in the Room and the game has already started, THEN THE App SHALL deny entry, leave all existing Seats and Hands unchanged, and display a message indicating that the game is in progress.
5. WHEN a Player opens the Invite_Link and the game has already started and the Player was not part of that game, THE App SHALL deny entry and display a message that the game is in progress, per the `01c-game-already-started` screen reference.
6. IF the Host leaves the Lobby before the game starts, THEN THE App SHALL make the longest-present remaining Player the Host.

### Requirement 4: Lobby and Mode Selection

**User Story:** As a Host, I want to choose between a normal game and 2v2, arrange the teams, and start when everyone is ready.

#### Acceptance Criteria

1. THE App SHALL display the Room_Code panel with "Copy link" and "Share invite", the Game_Mode panel, the Player list, and the start control, per the Lobby screen references.
2. WHERE the current Player is the Host, THE App SHALL display a Game_Mode control with two options, "Normal" and "Play 2v2", and SHALL let the Host switch between them at any time before the game starts.
3. WHERE the current Player is not the Host, THE App SHALL display the selected Game_Mode as read-only text labelled "chosen by the host", per the `02f-lobby-guest` reference.
4. WHILE Normal_Mode is selected, THE App SHALL list all Players in a single card, per the `02b-lobby-normal` reference.
5. WHILE Team_Mode is selected, THE App SHALL show Team A and Team B cards with two slots each, and SHALL show an empty "Waiting for a player" slot for each unfilled place, per the `02c-lobby-2v2-waiting` reference.
6. WHEN the Host switches to Team_Mode, THE App SHALL fill the teams in join order, alternating Team A and Team B.
7. WHILE Normal_Mode is selected and fewer than 2 Players are present, THE App SHALL disable "Start game" and show "Invite at least 1 more player to start", per the `02a-lobby-just-created` reference.
8. WHILE Team_Mode is selected and the Player count is not exactly 4, THE App SHALL disable "Start game" and show "2v2 needs exactly 4 players. N of 4 have joined."
9. WHILE 5 or more Players are in the Lobby, THE App SHALL disable the "Play 2v2" option and show "2v2 needs exactly 4 players. It unlocks if the room gets back to 4.", per the `02b-lobby-normal` reference, and SHALL NOT remove any Player to enable Team_Mode.
10. IF a 5th Player joins while Team_Mode is selected, THEN THE App SHALL switch the Game_Mode to Normal_Mode and show a Toast to all Players: "Switched to a normal game. 2v2 needs exactly 4 players."
11. WHEN the Player count drops back to 4 or fewer, THE App SHALL re-enable "Play 2v2" but SHALL NOT switch the mode back automatically.
12. WHERE the current Player is not the Host, THE App SHALL show "Waiting for [host name] to start the game" and a "Leave room" button instead of "Start game".
13. THE App SHALL update the Game_Mode, teams, and Player list for all Players in real time.

### Requirement 5: Dealing

**User Story:** As a Player, I want cards dealt to every player when the game starts, so that everyone begins with a full hand.

#### Acceptance Criteria

1. THE App SHALL build a 108-card deck: in each Suit, one 0, two each of 1–9, two +2, two skip, and two reverse; plus 4 Wild and 4 Wild +4 Cards.
2. WHEN the Host starts the game, THE App SHALL deal exactly 7 Cards to each Player one Card at a time in round-robin order by Seat from a shuffled Draw_Pile composed of the standard 108-Card deck.
3. WHEN dealing the 7 Cards to each Player completes, THE App SHALL move the top Card of the Draw_Pile face-up to become the initial Discard_Pile top and set the Active_Color to that Card's Suit.
4. WHILE Reduced_Motion is not requested, THE App SHALL render the deal as a staggered round-robin animation per the Design_Spec motion rules.
5. IF the initial face-up Card is not a number Card, THEN THE App SHALL return it to the Draw_Pile, reshuffle, and turn over another until a number Card is on top.
6. WHEN dealing completes, THE App SHALL designate the Host as the first Active_Player and set the Play_Direction to clockwise.
7. WHEN the game starts, THE App SHALL assign Seats, and WHERE the Game_Mode is Team_Mode, THE App SHALL alternate Seats between Team A and Team B so that partners sit opposite each other.

### Requirement 6: Turn Flow and Direction

**User Story:** As a Player, I want turns to advance in a clear order that reverses and skips correctly, so that play proceeds fairly.

#### Acceptance Criteria

1. WHEN the Active_Player completes a turn by legally playing a Card or by resolving a draw, THE App SHALL advance the Active_Player to the next Seat in the current Play_Direction.
2. WHEN a reverse (⇄) Card is played in a Room with 3 or more Players, THE App SHALL invert the Play_Direction.
3. WHEN a reverse (⇄) Card is played in a Room with exactly 2 Players, THE App SHALL keep the Play_Direction unchanged and skip the opponent so that the same Player becomes the Active_Player again.
4. WHEN a skip (⊘) Card is played in a Room with 3 or more Players, THE App SHALL advance past the next Player in the current Play_Direction so that the following Player becomes the Active_Player.
5. WHEN a skip (⊘) Card is played in a Room with exactly 2 Players, THE App SHALL skip the opponent so that the same Player becomes the Active_Player again.
6. THE App SHALL show the Active_Player with the turn pulse in both modes, and WHERE the Game_Mode is Normal_Mode THE App SHALL render the ring in the `turn` color, and WHERE the Game_Mode is Team_Mode THE App SHALL keep the team color.
7. THE App SHALL display a turn pill naming the Active_Player and stating the current match constraint, per the Design_Spec.
8. WHILE the Active_Player is connected, THE App SHALL allow the turn to remain open with no time limit.
9. WHILE a Player is not the Active_Player, THE App SHALL reject that Player's attempts to play or draw a Card, leave that Player's Hand and the game state unchanged, and keep the turn with the current Active_Player.
10. WHEN a penalty, skip, or reverse affects a Player, THE App SHALL show a Toast naming the Player and the effect (for example, "Leo draws 4"), except that no turn advances while the game is Paused (Requirement 25).

### Requirement 7: Card Matching Validity

**User Story:** As a Player, I want the game to enforce legal plays, so that only valid cards can be added to the discard pile.

#### Acceptance Criteria

1. WHEN the Active_Player plays a non-Wild Card, THE App SHALL accept it only if its Suit equals the Active_Color, or its number or symbol equals the top Discard_Pile Card's.
2. WHEN the Active_Player plays a Wild or Wild +4 Card and no Penalty_Count is pending, THE App SHALL accept the play.
3. IF the Active_Player attempts to play a Card that does not satisfy criterion 1 or 2, THEN THE App SHALL reject the play, retain the Card in the Active_Player's Hand, leave the Discard_Pile top and the Active_Color unchanged, leave the Active_Player unchanged, and present the illegal-tap shake per Requirement 17.
4. WHEN a non-Wild Card is legally played, THE App SHALL move that Card to the top of the Discard_Pile and set the Active_Color to that Card's Suit.
5. WHEN a Wild or Wild +4 Card is legally played, THE App SHALL move that Card to the top of the Discard_Pile and set the Active_Color per the Wild color selection defined in Requirement 8.
6. WHERE the "Highlight playable cards" setting is enabled, THE App SHALL dim, per the Design_Spec, every Card in the Active_Player's Hand that does not satisfy criterion 1 or 2 while keeping every such Card tappable.

### Requirement 8: Wild Color Selection

**User Story:** As a Player, I want to choose a color after playing a wild, so that the next player has a defined color to match.

#### Acceptance Criteria

1. WHEN the Active_Player plays a Wild or Wild +4 Card, THE App SHALL prompt the Active_Player to select exactly one of the four Suits (red, yellow, green, blue) as the new Active_Color, presenting the color picker per the `06a-wild-color-picker` reference, and the picker SHALL NOT offer a cancel option.
2. WHEN the Active_Player selects a Suit after playing a Wild or Wild +4 Card, THE App SHALL set the Active_Color to the selected Suit.
3. WHEN the Active_Color changes due to a Wild selection, THE App SHALL cross-fade the direction ring and Discard_Pile glow to the new Suit color per the Design_Spec.
4. WHEN a Wild selection is completed, THE App SHALL update the turn pill to state the new Active_Color.
5. WHILE a Wild or Wild +4 Card has been played and no Suit has yet been selected, THE App SHALL keep the Active_Player unchanged, reject any play or draw action, and reject any attempt to dismiss the prompt without selecting a Suit.
6. IF the played Wild or Wild +4 Card empties the Active_Player's Hand, THEN THE App SHALL require a Suit selection and set the Active_Color before resolving the win condition.

### Requirement 9: Draw-Two and Wild-Draw-Four Stacking

**User Story:** As a Player, I want to stack draw cards to pass the penalty along, so that stacking play is supported.

#### Acceptance Criteria

1. WHEN a +2 Card is played, THE App SHALL increase the Penalty_Count by 2 and target the next Player in the Play_Direction.
2. WHEN a Wild +4 Card is played, THE App SHALL increase the Penalty_Count by 4 and target the next Player in the Play_Direction.
3. WHILE a Penalty_Count is pending against the Active_Player, THE App SHALL accept a +2 Card of any color onto a pending +2, and a Wild +4 onto a pending +2 or +4, adding its value to the Penalty_Count and passing it to the next Player.
4. IF the Active_Player facing a pending Penalty_Count does not play an eligible stackable Card, THEN THE App SHALL move a number of Cards equal to the Penalty_Count from the Draw_Pile to the Active_Player's Hand, reset the Penalty_Count to 0, and advance the Active_Player to the next Seat in the current Play_Direction.
5. WHILE a Penalty_Count is pending and the top draw Card is a Wild +4, THE App SHALL reject a +2, and WHILE any Penalty_Count is pending, THE App SHALL reject every play other than those allowed in criterion 3.
6. WHEN a Wild +4 is stacked, THE App SHALL let the Player who played it choose the Active_Color, and THE App SHALL apply the last color chosen after the penalty is drawn.

### Requirement 10: Draw-One Behavior

**User Story:** As a Player, I want to draw one card when I cannot or choose not to play, so that the turn resolves cleanly.

#### Acceptance Criteria

1. WHEN the Active_Player selects the Draw_Pile with no Penalty_Count pending and no Card has yet been drawn this turn, THE App SHALL move exactly one Card from the Draw_Pile to the Active_Player's Hand.
2. WHERE a drawn Card is playable, THE App SHALL show the drawn Card with "Play it" and "Keep it", per the `06b-drew-playable-card` reference, and "Keep it" SHALL end the turn.
3. WHILE the Active_Player has already drawn one Card this turn under this requirement, THE App SHALL reject any further selection of the Draw_Pile for that turn and keep the turn with the Active_Player.
4. WHEN the Active_Player chooses to end the turn after drawing without playing the drawn Card, THE App SHALL keep the drawn Card in the Active_Player's Hand and advance the Active_Player to the next Seat in the current Play_Direction.
5. IF the Card drawn under this requirement is not legally playable, THEN THE App SHALL keep the drawn Card in the Active_Player's Hand and advance the Active_Player to the next Seat in the current Play_Direction.
6. WHEN a Card is drawn, THE App SHALL animate the Card sliding from the Draw_Pile into the Hand and flipping face up per the Design_Spec.
7. IF the Draw_Pile is empty when a draw is required and the Discard_Pile contains at least two cards, THEN THE App SHALL reshuffle all Discard_Pile cards except the top Card into a new face-down Draw_Pile before completing the draw.
8. IF a draw is required while the Draw_Pile is empty and the Discard_Pile contains only its top Card, THEN THE App SHALL complete the turn without drawing a Card, retain all Hands and the Discard_Pile unchanged, and advance the Active_Player to the next Seat in the current Play_Direction.

### Requirement 11: Last-Card Call and Penalty

**User Story:** As a Player, I want to call my last card, so that I follow the rule and avoid a penalty for staying silent.

#### Acceptance Criteria

1. THE App SHALL always display the "LAST CARD!" button, per the Design_Spec, and SHALL enable it only on the Player's turn while they hold exactly 2 Cards.
2. WHEN a Player presses "LAST CARD!", THE App SHALL record the Last_Card_Call for that turn.
3. IF a Player's turn ends with 1 Card and no Last_Card_Call recorded, THEN THE App SHALL make that Player draw 2 Cards and show a Toast to everyone (for example, "Leo forgot to call last card, +2").
4. WHEN a Player's Hand grows above 1 Card, THE App SHALL clear their Last_Card_Call.

### Requirement 12: Win Conditions

**User Story:** As a Player, I want the game to end and declare a winner correctly, so that both normal and team play conclude as designed.

#### Acceptance Criteria

1. WHILE the mode is Normal_Mode, WHEN a Player's Hand becomes empty by completing a legal final play, THE App SHALL end the game and declare that Player the winner.
2. WHILE the mode is Team_Mode, WHEN either Player on a Team empties their Hand by completing a legal final play, THE App SHALL end the game and declare that Team the winner.
3. WHEN the game ends, THE App SHALL show the result screen to all Players, including each Player's remaining Card count, per the `07-game-over` reference.
4. WHEN the game has ended, THE App SHALL reject any further play or draw action and display an indication to the acting Player that the game has ended.
5. WHERE the current Player is the Host, THE App SHALL show "Play again", which returns everyone to the Lobby with the same Game_Mode and teams, and WHERE the current Player is not the Host, THE App SHALL show "Waiting for the host", and THE App SHALL show "Back to home" to all Players.
6. THE App SHALL count games played in the Room and show it on the game table mode chip as "Round N" (for example "2v2 · Round 2"), matching the `03-game-2v2` reference.
7. IF the Host is disconnected or has left when the game ends, THEN THE App SHALL pass the Host role to the longest-present connected Player.

### Requirement 13: Team Partner Card Visibility

**User Story:** As a Player in 2v2, I want to see my partner's cards face-up, so that we can coordinate as a team.

#### Acceptance Criteria

1. WHILE the mode is Team_Mode, THE App SHALL display every Card in the current Player's Partner's Hand face-up in the partner seat, per the 2v2 game screen reference.
2. WHILE the mode is Team_Mode, THE App SHALL render the Partner's face-up cards using the partner Card variant and the partner 3D recipe defined in the Design_Spec.
3. WHILE the mode is Team_Mode, THE App SHALL render the Hands of both opposing-Team Players as face-down card backs that reveal no Card Value.
4. WHILE the mode is Normal_Mode, THE App SHALL render every other Player's Hand as face-down card backs that reveal no Card Value.
5. THE App SHALL show at most 7 face-down card backs per opponent seat and display the real Card count in the badge, per the Design_Spec.
6. WHEN the Partner draws or plays a Card, THE App SHALL update the displayed Partner Hand and card-count badge to the Partner's new Hand within 1 second.
7. IF the Partner's Hand data is temporarily unavailable, THEN THE App SHALL retain the last known Partner card-count badge and SHALL NOT reveal any Card as face-up until current Partner Hand data is available.
8. WHILE the mode is Team_Mode, THE App SHALL make a Player's Hand readable only by that Player and their Partner (see Requirement 23).

### Requirement 14: Realtime Synchronization

**User Story:** As a Player, I want every player's screen to stay in sync, so that we all see the same game state as it changes.

#### Acceptance Criteria

1. WHEN any Player plays or draws a Card, or a pause or resume event occurs, THE Realtime_Service SHALL propagate the resulting public game state, including pause and resume events, to all connected Players in the Room within 2 seconds.
2. WHEN a Player joins or leaves the Lobby, THE Realtime_Service SHALL update the Player list for all connected Players in the Room within 2 seconds.
3. THE Realtime_Service SHALL propagate Game_Mode, team, and Host changes in the Lobby to all connected Players in the Room within 2 seconds.
4. THE App SHALL persist Room state, Seat assignments, and Hands in Supabase before confirming each state change, so that the authoritative state survives individual Player disconnects.
5. THE server SHALL validate every play and draw, and each action SHALL carry the game-state version it was based on, and THE server SHALL reject actions from non-Active Players and actions based on an outdated version.
6. THE App SHALL restrict each Player's read access in Supabase so that a Player can read only their own Hand and the public game state, and cannot read any other Player's Hand, except a Partner's Hand in Team_Mode.
7. WHEN a Player reconnects to a Room after a disconnect, THE Realtime_Service SHALL send that Player the current authoritative public game state and their own Hand within 5 seconds of reconnection.

### Requirement 15: Disconnect and Reconnect

**User Story:** As a Player, I want the game to handle disconnects gracefully, so that a dropped connection does not break the match for anyone.

#### Acceptance Criteria

1. WHEN a Player loses connection, THE App SHALL show them as offline to other Players and show a Toast "[name] lost connection", per the `06c-player-disconnected` reference.
2. WHEN a disconnected Player reconnects, THE App SHALL synchronize that Player's view to the current authoritative game state.
3. WHEN it becomes a disconnected Player's turn, THE App SHALL show a countdown of the Grace_Period on their avatar and in the turn pill, and IF they have not reconnected when it ends and the game is not Paused, THEN THE App SHALL skip their turn and make them draw any pending Penalty_Count.
4. WHEN a reconnecting Player rejoins, THE App SHALL restore the Player's Seat and Hand per Requirement 3.
5. WHILE a Player stays disconnected after one skipped turn, THE App SHALL skip their later turns immediately, unless a Player pauses the game to wait for them (Requirement 25.2).
6. THE server SHALL record each Player's last-seen time and SHALL perform the skip only after confirming the Grace_Period has passed.
7. IF fewer than 2 Players remain connected, or in Team_Mode both Players of one Team are disconnected, THEN THE App SHALL start an Auto_Pause per Requirement 25.10.
8. WHILE the Host is disconnected, THE App SHALL retain the Host role for the Host's Seat so that the role is restored on reconnection, and SHALL continue the game for the remaining connected Players.

### Requirement 16: PWA and Mobile Constraints

**User Story:** As a Player, I want the app to behave like an installed portrait phone app, so that it feels native on my device.

#### Acceptance Criteria

1. THE App SHALL provide a web manifest with `display` set to "standalone", `orientation` set to "portrait", and `background_color` and `theme_color` set per the Design_Spec.
2. THE App SHALL set the viewport meta to `width=device-width, initial-scale=1, viewport-fit=cover` and the theme-color meta per the Design_Spec.
3. THE App SHALL size the root using `h-dvh` and apply the safe-area padding per the Design_Spec so that no interactive control or text is rendered within the device safe-area insets on devices reporting non-zero safe-area inset values.
4. THE App SHALL fit phone screens 360–430px wide and 667–932px tall without scrolling on game screens, scaling the table layout proportionally.
5. WHILE the Lobby or How to play is displayed AND the total content height exceeds the viewport height, THE App SHALL allow vertical scrolling with no horizontal scrolling.
6. THE App SHALL disable text selection on Cards and apply `touch-action: manipulation` to the game table such that double-tap and pinch gestures produce no zoom change on the game table.
7. THE App SHALL hide the Vibration setting on devices that do not support vibration, including iPhones.
8. IF the App is opened at a viewport width below 360px or above 430px, or in landscape orientation, THEN THE App SHALL display a message instructing the Player to use a supported portrait phone width between 360px and 430px, and SHALL suppress rendering of the game and lobby screens while the unsupported condition persists.

### Requirement 17: Animations

**User Story:** As a Player, I want the specified animations, so that the game feels lively and communicates what is happening.

#### Acceptance Criteria

1. WHEN the Active_Player plays a Card, THE App SHALL animate the Card from the Hand to the top of the Discard_Pile and settle it at a slight random rotation, per the Design_Spec.
2. WHEN another Player plays a Card, THE App SHALL animate the Card flying from that Player's Seat to the top of the Discard_Pile while flipping from face-down to face-up, per the Design_Spec.
3. WHEN a Player selects a Card in their Hand, THE App SHALL raise the Card to its selected position, per the Design_Spec.
4. WHEN the Active_Player changes, THE App SHALL cross-fade the turn pill to display the new Active_Player and current match constraint and SHALL apply the turn ring pulse to the new Active_Player, per the Design_Spec.
5. WHEN the menu drawer opens, THE App SHALL slide the drawer into view from the right edge and fade in the backdrop, per the Design_Spec.
6. WHILE Reduced_Motion is requested, THE App SHALL render every Card flight as an instant move to its final position with no travel animation and SHALL remove the turn ring pulse, per the Design_Spec.
7. IF a shared layout transition for a played Card cannot play because its source or target position is unavailable or the transition is interrupted, THEN THE App SHALL place the Card at the top of the Discard_Pile in its final position without leaving the Card in an intermediate or missing state.
8. WHEN the Host drags a Player row, THE App SHALL lift and tilt the row per the `02e-lobby-dragging` reference.
9. WHEN a bottom sheet or dialog opens, THE App SHALL animate it per the Design_Spec.
10. WHEN the game pauses or resumes, THE App SHALL fade the paused overlay in or out per the Design_Spec.

### Requirement 18: Accessibility

**User Story:** As a Player using assistive technology or with color-vision differences, I want the game to be accessible, so that I can play on equal footing.

#### Acceptance Criteria

1. THE App SHALL implement all interactive elements as native `<button>`, `<input>`, or `<a>` elements and SHALL provide an `aria-label` on every icon-only button, per the Design_Spec.
2. WHEN a Card control is rendered, THE App SHALL provide it an `aria-label` describing the Card in the pattern "<Suit> <Value>" for suited Cards (for example "Red 7", "Blue skip") and the Card name for Wild Cards (for example "Wild", "Wild draw four").
3. THE App SHALL render every Suit's distinct shape at all Card sizes in addition to its color and SHALL NOT rely on color alone to convey Suit.
4. WHEN a turn changes or a Card is played, THE App SHALL announce the change in an `aria-live="polite"` region.
5. THE App SHALL maintain text and non-text contrast ratios per the Design_Spec.
6. THE App SHALL make every interactive control operable by keyboard and SHALL provide a visible focus indication on the focused control.
7. WHILE multiple announcements occur in rapid succession, THE App SHALL present them in the `aria-live="polite"` region without discarding the most recent turn-change or card-played announcement.
8. THE App SHALL provide a tap and keyboard alternative for every drag-and-drop action (see Requirement 21).
9. WHEN a dialog or bottom sheet opens, THE App SHALL move focus inside it, and WHEN it closes, THE App SHALL return focus to the control that opened it, and THE App SHALL close it with the Escape key, except the Wild color picker, which requires a choice.
10. WHERE the paused overlay is shown, THE App SHALL present it as a dialog that the Escape key does not close and that is dismissed only by resuming, continuing, or ending the game.

### Requirement 19: Screen Coverage

**User Story:** As a Player, I want every designed screen present, so that the full flow from home to gameplay works as designed.

#### Acceptance Criteria

1. THE App SHALL provide every screen and state listed in the Screen Table, each matching its reference under `design/uno-design/screens/`.

#### Screen Table

All boards are 390×844 and use the "Paper Café" color theme (the name of the palette, not the game), except How to play, which scrolls (390×2012).

| #   | Board name (design canvas)                   | Design file               | Reference ID               | Description                                                                                                                                                                                                                                                                                                          | Requirements                   |
| --- | -------------------------------------------- | ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Homemade Uno · Home                          | `Home.dc.html`            | `01-home`                  | First screen when there's no room. Card-fan hero, "Homemade Uno" title and tagline, "Your name" input, "Create a room" button, an "or join a friend" divider, the room-code input with "Join", a "How to play" link, and a settings button. Opens with the code pre-filled when a friend follows an invite link.     | 1.1, 1.7, 2.1, 2.2, 2.3, 2.5   |
| 2   | Homemade Uno · Home · room not found         | `HomeError.dc.html`       | `01b-home-room-not-found`  | Home after "Join" with a code that matches no room. The code field gets a red border and a red message appears under it: "No room uses the code ABCD. Check the code with your friend and try again." The player stays on Home.                                                                                      | 2.4                            |
| 3   | Homemade Uno · Game already started          | `GameStarted.dc.html`     | `01c-game-already-started` | Full screen shown when someone opens an invite link to a game that's already in progress and they weren't part of it. Fanned card backs, the room code, "This game has already started", a short explanation, and "Back to home".                                                                                    | 3.5                            |
| 4   | Homemade Uno · Settings                      | `Settings.dc.html`        | `01d-settings`             | Opened from the Home settings button. Editable name, switches for Sound effects, Vibration (hidden on devices without vibration), and Highlight playable cards, a "How to play" link, and the app version.                                                                                                           | 1.7, 16.7                      |
| 5   | Homemade Uno · How to play                   | `HowToPlay.dc.html`       | `01e-how-to-play`          | Scrolling rules page opened from Home, Settings, or the in-game menu. Sections: goal, your turn (with ✓/✗ matching examples), action cards, stacking, last card, 2v2 teams, and what happens when someone drops out.                                                                                                 | 16.5                           |
| 6   | Homemade Uno · Lobby · just created          | `LobbyNew.dc.html`        | `02a-lobby-just-created`   | What the host sees right after "Create a room". Room-code panel with "Copy link" and "Share invite", the mode control set to Normal, only the host listed plus a dashed "Share the link to invite friends" slot, and "Start game" disabled with "Invite at least 1 more player to start".                            | 1.1–1.4, 4.1, 4.2, 4.7         |
| 7   | Homemade Uno · Lobby · normal game           | `LobbyNormal.dc.html`     | `02b-lobby-normal`         | Host view in Normal mode with 5 players in one list. "Play 2v2" is greyed out with the note "2v2 needs exactly 4 players. It unlocks if the room gets back to 4." "Start game" is enabled.                                                                                                                           | 4.2, 4.4, 4.9                  |
| 8   | Homemade Uno · Lobby · 2v2 waiting           | `Lobby2v2Waiting.dc.html` | `02c-lobby-2v2-waiting`    | Host has selected "Play 2v2" with only 3 players. Team A and Team B cards, one dashed "Waiting for a player" slot, drag handles on each row, and "Start game" disabled with "2v2 needs exactly 4 players. 3 of 4 have joined."                                                                                       | 4.5, 4.6, 4.8                  |
| 9   | Homemade Uno · Lobby · 2v2 ready             | `Lobby.dc.html`           | `02d-lobby-2v2-ready`      | Host view with exactly 4 players in 2v2. Two full teams, a six-dot drag handle on every row, the hint "Drag to change teams", and "Start game" enabled.                                                                                                                                                              | 4.5, 21.1                      |
| 10  | Homemade Uno · Lobby · dragging a player     | `LobbyDragging.dc.html`   | `02e-lobby-dragging`       | The moment the host drags Leo from Team B onto Maya in Team A. Leo's row is lifted and tilted, Maya's row shows a dashed "Swap" target, Leo's old slot is a dashed placeholder, and the hint reads "Drop on a player to swap".                                                                                       | 21.2–21.5, 17.8                |
| 11  | Homemade Uno · Lobby · guest view            | `LobbyGuest.dc.html`      | `02f-lobby-guest`          | What non-host players see (here, Maya). The mode is read-only ("chosen by the host"), there are no drag handles, and "Waiting for Alex to start the game" with a "Leave room" button replaces "Start game".                                                                                                          | 4.3, 4.10, 21.7                |
| 12  | Homemade Uno · 2v2 table                     | `Game2v2_Paper.dc.html`   | `03-game-2v2`              | 2v2 game in progress on your turn. Partner's hand face-up and tilted at the top, opponents' card backs angled on the sides, draw and discard piles with the direction ring, the turn pill, your avatar with the "LAST CARD!" button, and your fanned hand with unplayable cards dimmed and the selected card raised. | 6.4, 6.5, 7.5, 11.1, 13.1–13.4 |
| 13  | Homemade Uno · Normal table                  | `GameNormal.dc.html`      | `04-game-normal`           | Normal game with 5 players on someone else's turn. Four opponents with card backs (two tilted at the top, two angled at the sides), the active player's avatar glowing, and the turn pill naming them and the current color.                                                                                         | 5.6, 6.4, 6.5, 13.3            |
| 14  | Homemade Uno · In-game menu                  | `Menu.dc.html`            | `05-menu`                  | Drawer that slides in from the right when the menu button is tapped. Room code with "Copy link", cards left per player (grouped by team in 2v2), the three setting switches, a "Pause game" button above "How to play", "How to play", and "Leave game".                                                             | 1.3, 22.1, 25.1                |
| 15  | Homemade Uno · Wild · choose a color         | `WildPicker.dc.html`      | `06a-wild-color-picker`    | Bottom sheet over the table right after playing a Wild or Wild +4. Shows the card played, "Choose a color", who draws next, and four large color buttons, each with its shape and name. There is no cancel option.                                                                                                   | 8.1, 8.2, 9.6                  |
| 16  | Homemade Uno · Drew a playable card          | `PlayOrKeep.dc.html`      | `06b-drew-playable-card`   | After drawing a card that can be played. The drawn card is shown enlarged ("You drew"), with a sheet saying "Red 3 fits the pile" and the buttons "Play it" and "Keep it" (which ends the turn).                                                                                                                     | 10.2                           |
| 17  | Homemade Uno · Player disconnected           | `Disconnected.dc.html`    | `06c-player-disconnected`  | Normal game where Nora lost connection on her turn. Her avatar is faded with an offline badge and a countdown ring, her name reads "Nora · offline", the pill says "Waiting for Nora · skipping in 42s", a "Pause and wait" button under the turn pill, and a "Nora lost connection" toast appears.                  | 15.1, 15.3, 15.5, 25.2         |
| 18  | Homemade Uno · Leave game · confirm          | `LeaveConfirm.dc.html`    | `06d-leave-confirm`        | Dialog after tapping "Leave game" in the menu. "Leave this game?" with an explanation that your turns will be skipped and you can come back through the invite link, then "Stay in game" (main) and "Leave game" (red).                                                                                              | 22.1, 22.2                     |
| 19  | Homemade Uno · Game over · team wins         | `Winner.dc.html`          | `07-game-over`             | Result screen shown to everyone when the game ends (2v2 example). Confetti in the four card shapes, the winners' avatars, "Team A wins!", who played the last card, cards left per player, "Play again" (host only; others see "Waiting for the host"), and "Back to home".                                          | 12.1–12.5                      |
| 20  | Homemade Uno · Game paused                   | `PausedBreak.dc.html`     | `08a-paused`               | Paused overlay on the 2v2 table when nobody is disconnected. Pause icon, "Game paused", "Maya paused the game. Anyone can resume when everyone's ready.", a "Paused for 2:14" status, and "Resume game".                                                                                                             | 25.3, 25.4, 25.7               |
| 21  | Homemade Uno · Paused · waiting for a player | `PausedWaiting.dc.html`   | `08b-paused-waiting`       | Paused overlay on the normal table while Nora is offline. Her faded avatar with an offline badge, "Waiting for Nora", who paused, "resumes by itself when Nora is back", a "Paused for 1:05" status, and "Continue without Nora" with the note that her turns will be skipped.                                       | 25.5, 25.8, 25.9               |
| 22  | Homemade Uno · Paused · a team is offline    | `PausedTeamGone.dc.html`  | `08c-paused-team-offline`  | Automatic pause on the 2v2 table because both Team B players disconnected. Both faded avatars, "Team B lost connection", "The game paused by itself. It resumes when Leo or Sara comes back.", a "Paused for 3:40" status, and "End game" in red.                                                                    | 25.10–25.13, 15.7              |

#### Still to design

These states are required but have no board yet. Each can reuse existing components.

| Needed for                 | What it needs                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2.7 Room full              | Home error state like #2, with the message "This room is full (8 players)."                                                     |
| 4.9a Auto-switch to Normal | A toast in the lobby: "Switched to a normal game. 2v2 needs exactly 4 players."                                                 |
| 25.13 Game ended           | A variant of #19 titled "Game ended", with no winner and no confetti (the game now ends only when a Player chooses "End game"). |
| 12.5 Guest game over       | A variant of #19 with "Waiting for the host" instead of "Play again".                                                           |
| Normal game over           | A variant of #19 for Normal mode: one winner's avatar and "Maya wins!"                                                          |

### Requirement 20: Design Fidelity

**User Story:** As a maintainer, I want all UI generation locked to the design spec, so that no invented tokens or off-design visuals enter the codebase.

#### Acceptance Criteria

1. THE App SHALL use only the color, typography, radius, and shadow tokens in `theme.css`, Tailwind's default spacing scale, and values explicitly listed in `design.md`.
2. WHERE a needed value is absent from the token set, THE App SHALL use the closest defined token rather than a new value, per the Design_Spec guidance.
3. THE App SHALL rebuild the reference `.html` screens as React components with Tailwind classes and flex or documented absolute layouts, SHALL NOT copy the reference inline styles verbatim, and SHALL render each screen consistent with its corresponding screen reference under `design/uno-design/screens/`.

### Requirement 21: Team Arrangement

**User Story:** As a Host, I want to drag players between teams, so that I can choose who partners with whom.

#### Acceptance Criteria

1. WHILE Team_Mode is selected, THE App SHALL show a drag handle (six-dot grip) on each Player row for the Host only, per the `02d-lobby-2v2-ready` reference.
2. WHEN the Host drags a Player row, THE App SHALL lift the row, leave a dashed placeholder in its original slot, and show "Drop on a player to swap", per the `02e-lobby-dragging` reference.
3. WHEN the Host drops a Player onto a Player in the other team, THE App SHALL swap the two Players.
4. WHEN the Host drops a Player onto an empty slot in the other team, THE App SHALL move the Player into that slot.
5. WHEN the Host drops a Player outside a valid target, THE App SHALL return the row to its original slot.
6. WHEN the Host activates a Player's drag handle by tap or keyboard, THE App SHALL move that Player to the other team, swapping with the Player in the same position if that team is full.
7. THE App SHALL NOT show drag handles to non-Host Players, and SHALL reject team changes from non-Host Players.

### Requirement 22: Leaving

**User Story:** As a Player, I want to leave a game and be able to come back, so that stepping away does not end the match for everyone.

#### Acceptance Criteria

1. WHEN a Player selects "Leave game", THE App SHALL ask for confirmation, per the `06d-leave-confirm` reference.
2. WHEN a Player confirms leaving, THE App SHALL return the Player to the Home screen, treat the Player as disconnected, skip their turns immediately with no Grace_Period, apply the "Continue without [name]" behavior to them immediately without waiting for them, and start an Auto_Pause if their leaving meets the condition in Requirement 25.10.
3. THE App SHALL allow the Player to rejoin through the Invite_Link until the game ends.

### Requirement 23: Hidden Hands and Server Authority

**User Story:** As a Player, I want hands and the deck kept secret and the rules enforced server-side, so that no one can cheat by inspecting network traffic.

#### Acceptance Criteria

1. THE App SHALL never send a Player the contents of another Player's Hand, except their Partner's in Team_Mode.
2. THE App SHALL never send any Player the order of the Draw_Pile.
3. THE server SHALL deal, shuffle, and apply every game rule, and THE App SHALL only display state and send requested actions.

### Requirement 24: Room Lifecycle and Limits

**User Story:** As a Player, I want rooms to have sensible limits and clean up over time, so that codes stay available and rooms do not accumulate.

#### Acceptance Criteria

1. THE App SHALL allow at most 8 Players in a Room.
2. WHEN a Room has had no activity for 24 hours, THE App SHALL delete the Room and make its Room_Code available again.
3. THE App SHALL treat a Room as "active" for the unique-code rule in criterion 1.10 until the Room is deleted.

### Requirement 25: Pausing

**User Story:** As a Player, I want to pause the game for a break or to wait for a friend who dropped out, so that nobody misses the match because of a short interruption.

#### Acceptance Criteria

1. WHILE a game is in progress, THE App SHALL let any connected Player pause it from the "Pause game" button in the menu drawer, per the `05-menu` reference.
2. WHILE it is a disconnected Player's turn and their Grace_Period countdown is running, THE App SHALL show a "Pause and wait" button under the turn pill to every connected Player, per the `06c-player-disconnected` reference.
3. WHEN a Player pauses the game, THE App SHALL enter the Paused state for all Players within 2 seconds, show a Toast "[name] paused the game", and show the paused overlay over the game table.
4. WHILE the game is Paused and no Player is disconnected, THE App SHALL show "Game paused", the name of the Player who paused, the time paused so far, and a "Resume game" button, per the `08a-paused` reference.
5. WHILE the game is Paused and one or more Players are disconnected, THE App SHALL show "Waiting for [name]", their offline avatar, the time paused so far, and a "Continue without [name]" button, per the `08b-paused-waiting` reference.
6. WHILE the game is Paused, THE server SHALL reject every play, draw, "LAST CARD!" call, color choice, and turn skip, and SHALL stop the Grace_Period countdown.
7. WHEN any connected Player selects "Resume game", THE App SHALL leave the Paused state for all Players and show a Toast "[name] resumed the game".
8. WHEN the game was paused while waiting and every disconnected Player has reconnected, THE App SHALL resume automatically and show a Toast "[name] is back".
9. WHEN any connected Player selects "Continue without [name]", THE App SHALL resume the game, skip the disconnected Player's current turn if it is theirs and draw any pending Penalty_Count for them, and skip their later turns immediately until they reconnect.
10. WHEN fewer than 2 Players are connected, or in Team_Mode both Players of one Team are disconnected, THE App SHALL start an Auto_Pause and show which Players or Team lost connection, per the `08c-paused-team-offline` reference.
11. WHILE an Auto_Pause is active, THE App SHALL show an "End game" button to every connected Player instead of "Resume game" or "Continue without".
12. WHEN the condition that started an Auto_Pause clears because a Player reconnects, THE App SHALL resume automatically.
13. WHEN a Player selects "End game" during an Auto_Pause, THE App SHALL end the game without a winner and show the result screen titled "Game ended" to all Players.
14. IF the game was paused while a Player was choosing a Wild color or deciding "Play it" or "Keep it", THEN THE App SHALL show that choice to the same Player again after the game resumes.
15. WHILE the game is Paused, THE App SHALL keep the menu drawer available, including "Leave game" and "How to play".

## Development Process

This section covers rules for how the code is written, not features of the App.

- THE project SHALL include a Design_Steering_File that is always included, references the Design_Spec (`design/uno-design/` — `theme.css`, `tokens.json`, `screen-map.json`, and `screens/`), directs all UI generation to those tokens, theme, and screen references, prohibits inventing tokens, and requires no manual activation.
- THE export package (`design.md`, `theme.css`, `tokens.json`, `screens/`) SHALL be regenerated to include the new screens and these new components: the mode control (segmented); the drag handle, drag-lifted row, and drop target; the empty player slot; the disabled primary button; the bottom sheet; the dialog; the toast; the large color buttons; the enlarged drawn card; the countdown ring and offline badge; and the confetti.
