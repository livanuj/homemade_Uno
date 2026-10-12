/**
 * How-to-play route — screen `01e-how-to-play` (design.md §5.24 / §7.9).
 *
 * A scrolling rules page reached from Home, Settings, or the in-game menu. Its
 * design height is 2012px, so unlike the game screens this page is allowed to
 * scroll vertically inside the fixed app shell (Req 16.5): the outer column is
 * `h-full overflow-y-auto`. A round back control returns to the previous screen.
 *
 * Sections, in order (design.md §5.24): the goal, "On your turn" with ✓/✗
 * matching examples, Action cards, Stacking, Last card!, 2v2 teams, and what
 * happens when someone drops out.
 *
 * Card illustrations reuse `PlayingCard` at the 46×68 `partner` size. The ✓/✗
 * verdict badges use token colors — `suit-green-ink` with a check for allowed,
 * `danger` with an ✗ for not allowed. Tokens only (token-policy.md /
 * design-fidelity.md).
 */
import { PlayingCard } from "@/components/PlayingCard";
import type { CardValue, Suit } from "@/design/suits";
import { cn } from "@/lib/cn";
import { ScreenHeader } from "@/routes/SettingsRoute";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function HowToPlayRoute() {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full flex-col gap-4 px-5 pt-safe pb-8">
        <ScreenHeader title="How to play" onBack={() => navigate(-1)} />

        {/* Goal intro (design.md §7.9). */}
        <div className="flex flex-col gap-2 px-1 pb-2 pt-1">
          <p className="font-display text-sheet text-ink">
            Be the first to play every card in your hand.
          </p>
          <p className="text-paragraph text-ink-muted">
            Everyone starts with 7 cards. In 2v2, your team wins as soon as
            either of you runs out.
          </p>
        </div>

        {/* On your turn — with ✓/✗ matching examples. */}
        <Section title="On your turn">
          <p className="text-paragraph text-ink">
            Play one card that matches the color on the pile, or has the same
            number or symbol. If you can't play, or would rather not, tap the
            draw pile to take one card. If it fits, you can play it straight
            away.
          </p>
          <div className="flex items-end justify-between px-1 pb-1 pt-3">
            <ExampleCard suit="red" value={7} caption="On the pile" />
            <span
              className="self-stretch w-px bg-felt-edge"
              aria-hidden="true"
            />
            <ExampleCard
              suit="red"
              value={3}
              caption="Same color"
              verdict="ok"
            />
            <ExampleCard
              suit="blue"
              value={7}
              caption="Same number"
              verdict="ok"
            />
            <ExampleCard
              suit="yellow"
              value={2}
              caption="No match"
              verdict="no"
            />
          </div>
        </Section>

        {/* Action cards. */}
        <Section title="Action cards">
          <ActionRow
            suit="red"
            value="+2"
            name="Draw two"
            description="The next player draws 2 cards and misses their turn."
          />
          <RowDivider />
          <ActionRow
            suit="yellow"
            value="skip"
            name="Skip"
            description="The next player misses their turn."
          />
          <RowDivider />
          <ActionRow
            suit="green"
            value="reverse"
            name="Reverse"
            description="Play changes direction. With 2 players, it works like a skip."
          />
          <RowDivider />
          <ActionRow
            value="wild"
            name="Wild"
            description="Play it on anything, then choose the next color."
          />
          <RowDivider />
          <ActionRow
            value="wild4"
            name="Wild draw four"
            description="Choose the next color. The next player draws 4 and misses their turn."
          />
        </Section>

        {/* Stacking. */}
        <Section title="Stacking">
          <p className="text-paragraph text-ink">
            When a +2 or +4 is played on you, you can pass it on by playing your
            own. A +2 goes on a +2, and a +4 goes on either one. A +2 can't go
            on a +4. The total keeps growing until someone can't stack and draws
            all of it.
          </p>
          <div className="flex items-center gap-2.5 px-1 pb-0.5 pt-2">
            <PlayingCard
              suit="blue"
              value="+2"
              variant="partner"
              tabIndex={-1}
            />
            <PlusSign />
            <PlayingCard
              suit="green"
              value="+2"
              variant="partner"
              tabIndex={-1}
            />
            <PlusSign />
            <PlayingCard value="wild4" variant="partner" tabIndex={-1} />
            <span className="ml-auto rounded-full bg-ink px-3 py-2 text-label font-extrabold text-surface">
              Draw 8
            </span>
          </div>
        </Section>

        {/* Last card! */}
        <Section title="Last card!">
          <p className="text-paragraph text-ink">
            When you have 2 cards on your turn, tap LAST CARD! before you play.
            If you forget, you draw 2 cards.
          </p>
          <span className="mt-1 self-start rounded-full border-2 border-ink px-[18px] py-2.5 font-display text-body uppercase tracking-[0.04em] text-ink">
            LAST CARD!
          </span>
        </Section>

        {/* 2v2 teams. */}
        <Section title="2v2 teams">
          <p className="text-paragraph text-ink">
            With exactly 4 players, you play in two teams. Your partner sits
            across from you, and you can see each other's cards. Your team wins
            when either of you plays your last card.
          </p>
          <div className="flex gap-4 pt-1">
            <TeamDot
              label="Team A"
              dotClass="bg-team-a"
              textClass="text-team-a"
            />
            <TeamDot
              label="Team B"
              dotClass="bg-team-b"
              textClass="text-team-b"
            />
          </div>
        </Section>

        {/* If someone drops out. */}
        <Section title="If someone drops out">
          <p className="text-paragraph text-ink">
            There's no turn timer. If a player loses connection during their
            turn, they get 60 seconds to come back. After that their turn is
            skipped, and any cards they owe are drawn for them.
          </p>
        </Section>
      </div>
    </div>
  );
}

/** A rules panel: `bg-surface rounded-section shadow-panel p-[18px]` (§5.24). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-section bg-surface p-[18px] shadow-panel">
      <h2 className="font-display text-title text-ink">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A matching example: a 46×68 card with an optional verdict badge at its
 * bottom-right and a caption below (design.md §5.24). `ok` → green-ink check,
 * `no` → danger ✗.
 */
function ExampleCard({
  suit,
  value,
  caption,
  verdict,
}: {
  suit?: Suit;
  value: CardValue;
  caption: string;
  verdict?: "ok" | "no";
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <PlayingCard
          {...(suit ? { suit } : {})}
          value={value}
          variant="partner"
          tabIndex={-1}
        />
        {verdict && <VerdictBadge verdict={verdict} />}
      </div>
      <span
        className={cn(
          "text-caption",
          verdict ? "text-ink-muted" : "font-bold text-ink",
        )}
      >
        {caption}
      </span>
    </div>
  );
}

/** 22px verdict badge overlaid at a card's bottom-right corner. */
function VerdictBadge({ verdict }: { verdict: "ok" | "no" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -bottom-1.5 -right-1.5 grid size-[22px] place-items-center rounded-full",
        verdict === "ok" ? "bg-suit-green-ink" : "bg-danger",
      )}
    >
      {verdict === "ok" ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-surface"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="text-surface"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </span>
  );
}

/**
 * An action-card row: the card, then its name and description, per §5.24
 * (`text-body font-extrabold` name, `text-label font-medium text-ink-muted`
 * description).
 */
function ActionRow({
  suit,
  value,
  name,
  description,
}: {
  suit?: Suit;
  value: CardValue;
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3.5 py-2">
      <PlayingCard
        {...(suit ? { suit } : {})}
        value={value}
        variant="partner"
        tabIndex={-1}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-extrabold text-ink">{name}</span>
        <span className="text-label font-medium text-ink-muted">
          {description}
        </span>
      </div>
    </div>
  );
}

/** "+" join sign between stacked cards (`text-title text-ink-muted`, §5.24). */
function PlusSign() {
  return (
    <span
      aria-hidden="true"
      className="font-display text-title font-extrabold text-ink-muted"
    >
      +
    </span>
  );
}

/**
 * A team legend entry: a 12px color dot + label in the team color. `dotClass`
 * and `textClass` are full token classes (styling.md — no interpolation).
 */
function TeamDot({
  label,
  dotClass,
  textClass,
}: {
  label: string;
  dotClass: string;
  textClass: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-label font-extrabold",
        textClass,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-3 rounded-full", dotClass)}
      />
      {label}
    </span>
  );
}

/** 1px `felt-edge` divider between action rows (design.md §5.24). */
function RowDivider() {
  return <span className="h-px bg-felt-edge" />;
}
