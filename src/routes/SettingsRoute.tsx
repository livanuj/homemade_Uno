/**
 * Settings route — screen `01d-settings` (design.md §5.23 / §7.9).
 *
 * A device-preferences page reached from the Home settings button. It edits the
 * display name (1–16 chars, stored on the device) and three game toggles —
 * Sound effects, Vibration, Highlight playable cards — a "How to play" link,
 * and the app version. All preferences persist to `localStorage` through the
 * shared `useSettings` store (Req 1.7, 1.12, 16.7); no backend is involved.
 *
 * The Vibration row is hidden on devices without the Vibration API (iPhones),
 * per Req 16.7. Support is feature-detected once on mount so a re-render never
 * flips the row mid-session.
 *
 * Tokens only, built to the PNG (design-fidelity.md / token-policy.md); reuses
 * `IconButton`, `Input`, and `Switch`.
 */
import { IconButton } from "@/components/IconButton";
import { Input } from "@/components/Input";
import { Switch } from "@/components/Switch";
import { cn } from "@/lib/cn";
import {
  NAME_MAX_LENGTH,
  supportsVibration,
  useSettings,
} from "@/lib/settings";
import { useId, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/** App version shown at the bottom of the page (design.md §5.23). */
const APP_VERSION = "Version 1.0";

export function SettingsRoute() {
  const navigate = useNavigate();
  const { settings, set } = useSettings();

  // Feature-detect once: whether to show the Vibration row (Req 16.7). Computed
  // on mount so it can't flip between renders within a session.
  const showVibration = useMemo(() => supportsVibration(), []);

  return (
    <div className="flex h-full flex-col gap-[18px] px-5 pt-safe pb-safe">
      <ScreenHeader title="Settings" onBack={() => navigate(-1)} />

      {/* YOU — editable display name (1–16 chars, stored on device). */}
      <section className="flex flex-col gap-2">
        <SectionLabel>YOU</SectionLabel>
        <div className="flex flex-col gap-2 rounded-section bg-surface px-4 py-3.5 shadow-panel">
          <Input
            label="Your name"
            value={settings.name}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoComplete="off"
            onChange={(e) => set({ name: e.target.value })}
            onBlur={(e) => set({ name: e.target.value.trim() })}
          />
          <span className="text-caption text-ink-muted">
            Other players see this name at the table
          </span>
        </div>
      </section>

      {/* GAME — the three toggles. */}
      <section className="flex flex-col gap-2">
        <SectionLabel>GAME</SectionLabel>
        <div className="flex flex-col rounded-section bg-surface px-4 py-1.5 shadow-panel">
          <SwitchRow
            title="Sound effects"
            description="Card flips, shuffles, the last-card call"
            checked={settings.sound}
            onChange={(v) => set({ sound: v })}
          />
          {showVibration && (
            <>
              <RowDivider />
              <SwitchRow
                title="Vibration"
                description="Buzz on your turn. Not available on iPhone."
                checked={settings.vibration}
                onChange={(v) => set({ vibration: v })}
              />
            </>
          )}
          <RowDivider />
          <SwitchRow
            title="Highlight playable cards"
            description="Dim the cards you cannot play"
            checked={settings.highlight}
            onChange={(v) => set({ highlight: v })}
          />
        </div>
      </section>

      {/* How to play — link row (design.md §5.23). */}
      <div className="flex flex-col rounded-section bg-surface px-4 py-1 shadow-panel">
        <button
          type="button"
          onClick={() => navigate("/how-to-play")}
          className="flex min-h-[52px] items-center justify-between text-body text-ink"
        >
          How to play
          <ChevronRightIcon />
        </button>
      </div>

      <div className="flex-1" />
      <span className="self-center text-caption text-ink-muted">
        {APP_VERSION}
      </span>
    </div>
  );
}

/**
 * A single labelled settings row: title + description on the left, a `Switch`
 * on the right (design.md §5.23 — `min-h-14`). The switch is wired to the row
 * title via `aria-labelledby` so it announces the setting name (Req 18).
 */
function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const titleId = useId();
  return (
    <div className="flex min-h-14 items-center gap-3">
      <div className="flex flex-grow flex-col gap-0.5">
        <span id={titleId} className="text-body text-ink">
          {title}
        </span>
        <span className="text-caption text-ink-muted">{description}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={titleId}
      />
    </div>
  );
}

/** 1px `felt-edge` divider between settings rows (design.md §5.23). */
function RowDivider() {
  return <span className="h-px bg-felt-edge" />;
}

/** Section header ("YOU" / "GAME"): `text-caption`, extrabold, wide tracking. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-caption font-extrabold tracking-[0.08em] text-ink-muted">
      {children}
    </span>
  );
}

/**
 * Shared side-page header (design.md §7.9): a 44px row with a round back
 * IconButton on the left, a centered title, and a 44px spacer on the right so
 * the title stays optically centered.
 */
export function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between">
      <IconButton aria-label="Back" onClick={onBack}>
        <ChevronLeftIcon />
      </IconButton>
      <h1 className="font-display text-title text-ink">{title}</h1>
      <span className="w-11" />
    </div>
  );
}

/** 20px back chevron (Lucide ChevronLeft, design.md §5.4). */
function ChevronLeftIcon() {
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
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** 18px forward chevron in `ink-muted` for the "How to play" link row. */
function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-ink-muted")}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
