# Homemade Uno — design package

Put this folder at `design/uno-design/` in the project. The requirements refer to that path.

| File | What it is | Read it when |
|---|---|---|
| `design.md` | The design spec: intent, tokens, every component, screen layouts, navigation, motion, accessibility | Always, first |
| `screen-map.json` | Machine-readable map of all 19 screens: description, requirements covered, where each screen is entered from and leads to, plus a `requirement_index` from requirement number to screen IDs | You need to find which screen implements a requirement, or which requirements a screen covers |
| `theme.css` | Tailwind CSS v4 theme with every allowed token | Setting up Tailwind (import once) |
| `tokens.json` | The same tokens as JSON, plus card sizes and suit data | Tools or scripts that need raw values |
| `screens/00-overview.png` | All 19 screens on one sheet, grouped and labeled with their IDs | Getting the big picture |
| `screens/<id>.png` | One screen at 2× (780 px wide) | Seeing what to build |
| `screens/<id>.html` | The same screen as static HTML with exact px/hex values | Checking exact sizes, colors, and copy |

Screen IDs follow the user flow: `01-…` home and side pages, `02a–02f` lobby states, `03`/`04` game tables, `05`/`06a–06d` overlays and table states, `07` game over.

Requirement numbers used here refer to `requirements.md` after applying `requirements-updates.md`.
