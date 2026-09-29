# Pause feature: requirement changes

These changes add pausing to `requirements.md`. Numbers refer to the current version of that file.

**Decisions:** any connected player can pause at any time and any connected player can resume. The game also pauses by itself when continuing makes no sense.

---

## 1. Glossary: add

- **Paused**: A game state in which no Player can play, draw, call "LAST CARD!", or be skipped, and no Grace_Period countdown runs.
- **Auto_Pause**: A pause started by the App rather than a Player, when fewer than 2 Players are connected, or in Team_Mode when both Players of one Team are disconnected.

---

## 2. New Requirement 25: Pausing

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
9. WHEN any connected Player selects "Continue without [name]", THE App SHALL resume the game, skip the disconnected Player's current turn if it is theirs (drawing any pending Penalty_Count for them), and skip their later turns immediately until they reconnect.
10. WHEN fewer than 2 Players are connected, or in Team_Mode both Players of one Team are disconnected, THE App SHALL start an Auto_Pause and show which Players or Team lost connection, per the `08c-paused-team-offline` reference.
11. WHILE an Auto_Pause is active, THE App SHALL show an "End game" button to every connected Player instead of "Resume game" or "Continue without".
12. WHEN the condition that started an Auto_Pause clears because a Player reconnects, THE App SHALL resume automatically.
13. WHEN a Player selects "End game" during an Auto_Pause, THE App SHALL end the game without a winner and show the result screen titled "Game ended" to all Players.
14. IF the game was paused while a Player was choosing a Wild color or deciding "Play it" / "Keep it", THEN THE App SHALL show that choice to the same Player again after the game resumes.
15. WHILE the game is Paused, THE App SHALL keep the menu drawer available, including "Leave game" and "How to play".

---

## 3. Changes to existing requirements

| Requirement | Change |
|---|---|
| **6.8** | Add at the end: "…except that no turn advances while the game is Paused (Requirement 25)." |
| **14.1** | Add "pause and resume events" to what is propagated within 2 seconds. |
| **15.3** | Replace the last part with: "…IF they have not reconnected when it ends and the game is not Paused, THEN THE App SHALL skip their turn and make them draw any pending Penalty_Count." |
| **15.5** | Add: "…unless a Player pauses the game to wait for them (Requirement 25.2)." |
| **15.7** | Replace with: "IF fewer than 2 Players remain connected, or in Team_Mode both Players of one Team are disconnected, THEN THE App SHALL start an Auto_Pause per Requirement 25.10." (The game no longer ends automatically.) |
| **22.2** | Add: "A Player who leaves on purpose SHALL NOT be waited for: the 'Continue without [name]' behavior applies to them immediately. An Auto_Pause still starts if their leaving meets the condition in 25.10." |
| **24.2** | No change. A Paused game with no activity for 24 hours is deleted with its Room, which stops a pause from lasting forever. |
| **18.9** | Add: "The paused overlay is a dialog without Escape-to-close; it is dismissed only by resuming, continuing, or ending the game." |
| **17** | Add: "WHEN the game pauses or resumes, THE App SHALL fade the paused overlay in or out per the Design_Spec." |

---

## 4. Screen Table: add and update rows

**New rows:**

| # | Board name (design canvas) | Design file | Reference ID | Description | Requirements |
|---|---|---|---|---|---|
| 20 | Homemade Uno · Game paused | `PausedBreak.dc.html` | `08a-paused` | Paused overlay on the 2v2 table when nobody is disconnected. Pause icon, "Game paused", "Maya paused the game. Anyone can resume when everyone's ready.", a "Paused for 2:14" status, and "Resume game". | 25.3, 25.4, 25.7 |
| 21 | Homemade Uno · Paused · waiting for a player | `PausedWaiting.dc.html` | `08b-paused-waiting` | Paused overlay on the normal table while Nora is offline. Her faded avatar with an offline badge, "Waiting for Nora", who paused, "resumes by itself when Nora is back", a "Paused for 1:05" status, and "Continue without Nora" with the note that her turns will be skipped. | 25.5, 25.8, 25.9 |
| 22 | Homemade Uno · Paused · a team is offline | `PausedTeamGone.dc.html` | `08c-paused-team-offline` | Automatic pause on the 2v2 table because both Team B players disconnected. Both faded avatars, "Team B lost connection", "The game paused by itself. It resumes when Leo or Sara comes back.", a "Paused for 3:40" status, and "End game" in red. | 25.10–25.13, 15.7 |

**Updated rows:**

| # | Change |
|---|---|
| 14 · In-game menu (`05-menu`) | Description: add "a 'Pause game' button above 'How to play'". Requirements: add 25.1. |
| 17 · Player disconnected (`06c-player-disconnected`) | Description: add "a 'Pause and wait' button under the turn pill". Requirements: add 25.2. |

**Still to design:** add "25.13 Game ended: a variant of `07-game-over` titled 'Game ended', with no winner and no confetti." This replaces the existing "15.7 Game ended early" row, because the game now ends only when a player chooses "End game".
