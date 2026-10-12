import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { shouldAutoPause } from "./autopause";
import { deal } from "./deal";
import { reducer } from "./reducer";
import { createSeededRng } from "./rng";
import { makeState, playerList, runLegalSequence } from "./testkit";
import type { ConnectionSnapshot, ConnectionState, GameMode, Seat, Suit } from "./types";

const RUNS = 100;
const MAX_STEPS = 200;

describe("Feature: homemade-uno, Property 14: Win detection", () => {
  it("the game ends exactly when a hand empties via a legal final play; winner matches mode", () => {
    fc.assert(
      fc.property(fc.constantFrom<GameMode>("normal", "team"), fc.constantFrom<Suit>("red", "blue"), (mode, color) => {
        // p0 (seat 0, team A in Team mode) holds a single playable card.
        const seats: Seat[] =
          mode === "team"
            ? [
                { playerId: "p0", seat: 0, team: "A" },
                { playerId: "p1", seat: 1, team: "B" },
                { playerId: "p2", seat: 2, team: "A" },
                { playerId: "p3", seat: 3, team: "B" },
              ]
            : [
                { playerId: "p0", seat: 0 },
                { playerId: "p1", seat: 1 },
              ];
        const hands = seats.map((_, i) =>
          i === 0 ? [{ id: "win", suit: color, value: 4 as const }] : [{ id: `x${i}`, suit: color, value: 2 as const }],
        );
        const state = makeState({
          mode,
          seats,
          hands,
          discardPile: [{ id: "top", suit: color, value: 4 }],
          activeColor: color,
          lastCardCalledSeat: 0, // avoid the forgot-to-call path on the winning turn
        });

        const res = reducer(state, { type: "play", playerId: "p0", cardId: "win" }, { rng: createSeededRng(1) });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.state.phase).toBe("ended");
        if (mode === "team") {
          expect(res.state.winner).toEqual({ kind: "team", team: "A" });
        } else {
          expect(res.state.winner).toEqual({ kind: "player", seat: 0, playerId: "p0" });
        }
      }),
      { numRuns: RUNS },
    );
  });

  it("random legal play only reaches `ended` when some hand is empty", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), fc.integer({ min: 2, max: 8 }), (seed, count) => {
        const rng = createSeededRng(seed);
        const initial = deal({ mode: "normal", players: playerList(count) }, rng);
        runLegalSequence(initial, { rng }, MAX_STEPS, (state) => {
          if (state.phase === "ended") {
            expect(state.hands.some((h) => h.length === 0)).toBe(true);
          } else {
            expect(state.hands.every((h) => h.length > 0)).toBe(true);
          }
        });
      }),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: homemade-uno, Property 15: Auto-pause predicate", () => {
  const connArb = fc.constantFrom<ConnectionState>("connected", "disconnected", "left");

  it("auto-pause iff <2 connected, or Team mode with a whole team disconnected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<GameMode>("normal", "team"),
        fc.array(fc.record({ team: fc.constantFrom("A", "B"), connection: connArb }), { minLength: 2, maxLength: 8 }),
        (mode, rows) => {
          const players: ConnectionSnapshot[] = rows.map((r, i) =>
            mode === "team"
              ? { playerId: `p${i}`, team: r.team as "A" | "B", connection: r.connection }
              : { playerId: `p${i}`, connection: r.connection },
          );

          const connected = players.filter((p) => p.connection === "connected").length;
          let teamOffline = false;
          if (mode === "team") {
            for (const team of ["A", "B"] as const) {
              const members = players.filter((p) => p.team === team);
              if (members.length > 0 && members.every((p) => p.connection !== "connected")) {
                teamOffline = true;
              }
            }
          }
          const expected = connected < 2 || teamOffline;
          expect(shouldAutoPause(mode, players)).toBe(expected);
        },
      ),
      { numRuns: RUNS },
    );
  });
});
