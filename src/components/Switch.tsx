import { cn } from "@/lib/cn";

interface SwitchProps {
  /** Current on/off state, reflected as `aria-checked` (design.md §5.7). */
  checked: boolean;
  /** Fires with the next value when toggled. */
  onCheckedChange: (checked: boolean) => void;
  /**
   * Accessible name. Prefer wiring `aria-labelledby` to a visible row title
   * (settings rows, §5.20); pass `aria-label` when there is no visible label.
   */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle switch (design.md §5.7).
 *
 * A real `<button role="switch">` sized 52×32 whose `aria-checked` reflects
 * state (styling.md / Requirement 18 — native, labelled interactive element).
 * The track is `bg-ink` when on and `bg-line` when off; the 26px `bg-surface`
 * knob slides from `left: 3px` (off) to `left: 23px` (on) over 200ms. The
 * 52/32/26/3/23px measurements are the documented exact values from §5.7.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      aria-label={aria["aria-label"]}
      aria-labelledby={aria["aria-labelledby"]}
      className={cn(
        "relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-ink" : "bg-line",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] size-[26px] rounded-full bg-surface shadow-panel transition-[left] duration-200",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
