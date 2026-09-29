---
inclusion: fileMatch
fileMatchPattern: "src/{firebase,realtime}/**/*.{ts,tsx}"
---

# Firestore Data & Realtime Conventions

The game is **server-authoritative**. Clients render state and send intents; the server (Cloud Functions) deals, shuffles, validates, and mutates. This enforces Requirements 14 and 23. Backend: **Cloud Firestore + Cloud Functions + Firebase Anonymous Auth**.

## No client writes to game documents

Clients never write game state directly. All mutations go through a callable Cloud Function that runs the pure rules engine server-side.

- FORBIDDEN:
  ```ts
  await updateDoc(doc(db, "rooms", id, "state", "current"), { activeSeat: next });
  await updateDoc(doc(db, "rooms", id, "hands", uid), { cards });
  ```
- REQUIRED — call a Cloud Function:
  ```ts
  await callAction("playCard", { roomId, cardId, basedOnVersion: state.version });
  ```
Firestore Security Rules deny all client writes to `game_state`, `hands`, and the draw pile. The only client write allowed is a player updating **their own** presence/`lastSeen` field (or via a heartbeat doc), scoped by `request.auth.uid`.

## Every action carries the state version

Optimistic concurrency: stamp each action with the `version` it was based on. The Cloud Function rejects stale or out-of-turn actions (transaction-checked).

- REQUIRED: pass `basedOnVersion: currentState.version`; on a version-conflict reject, resync from the snapshot listener and revert optimistic UI.

## Action client is the single transport layer

All Cloud Function calls go through one thin `callAction(name, payload)` wrapper in `src/firebase/` (built on `httpsCallable`). Components and hooks never call `httpsCallable` directly.

- FORBIDDEN: `httpsCallable(functions, "playCard")(...)` inside a component.
- REQUIRED: a `useGameActions()` hook exposing `playCard`, `drawOne`, `chooseColor`, `pause`, etc., each delegating to `callAction`.

## Reads honor Security Rules; never widen scope

- A client reads only: its own hand doc, the public room/state docs (which exclude the draw pile), the partner's hand doc in Team mode, and player docs (no hand data).
- The draw pile is stored so that NO client can read its order — either as a field the rules deny, or in a server-only document/subcollection with a deny-all read rule.
- FORBIDDEN: reading another player's hand doc (except a partner's in Team mode) or the draw-pile order. If a query needs data the client should not see, the logic belongs in a Cloud Function.

## Data model (documents, not tables)

- `rooms/{roomId}` — public room doc (code, host, mode, phase, round).
- `rooms/{roomId}/players/{playerId}` — seat/team/host/connection/lastSeen (public within room; own lastSeen writable by that player only).
- `rooms/{roomId}/state/current` — public game state (discard top, active seat, direction, active color, penalty, version, phase). Draw-pile order is NOT here / not client-readable.
- `rooms/{roomId}/hands/{playerId}` — a player's cards; readable only by that player (+ partner in Team mode).
- The authoritative deck/draw order lives where only Cloud Functions (Admin SDK) can read it.

## Realtime & presence

- Subscribe with Firestore `onSnapshot` listeners: the room doc, players collection, the public state doc, and own/partner hand docs. Hold snapshot state in a read-only store; do not fork or locally edit it.
- Presence: use RTDB `onDisconnect` (or a heartbeat doc). The **server** (a Cloud Function / scheduled check), not the client, enforces the 60s Grace_Period against the recorded `lastSeen`.

## Local development

- Use the **Firebase Emulator Suite** (Auth + Firestore + Functions) for local dev and integration tests. Security-rules tests use `@firebase/rules-unit-testing`.

## Anti-patterns

- Duplicating rule logic on the client "for responsiveness" — the client may show optimistic *animation*, but never computes authoritative outcomes.
- Trusting client-reported presence for skip/pause decisions — always server-confirmed via `lastSeen`.
