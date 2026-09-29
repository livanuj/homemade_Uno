import { cn } from "@/lib/cn";

interface InputErrorProps {
  /** Element id, referenced by the input's `aria-describedby`. */
  id?: string;
  /** The error message, e.g. "No room uses the code ABCD…". */
  children: string;
  className?: string;
}

/**
 * Input error message (design.md §5.21). A `role="alert"` paragraph in
 * `text-danger` with a 16px alert icon, shown below an invalid input (used by
 * `01b-home-room-not-found`). Pair with `aria-invalid`/`aria-describedby` on the
 * input — the `Input` component wires this up automatically via its `error` prop.
 */
export function InputError({ id, children, className }: InputErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-center gap-2 text-label font-semibold text-danger",
        className,
      )}
    >
      <AlertIcon />
      <span>{children}</span>
    </p>
  );
}

/**
 * 16px CircleAlert glyph (design.md §5.21 references Lucide `CircleAlert`).
 * Inlined as a 2px-stroke SVG in `currentColor` so the icon inherits the
 * `text-danger` color and no icon dependency is required.
 */
function AlertIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
