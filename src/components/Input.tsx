import { cn } from "@/lib/cn";
import { InputError } from "@/components/InputError";
import { useId } from "react";
import type { InputHTMLAttributes } from "react";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Visible label rendered above the field (design.md §5.6). */
  label: string;
  /** Optional error message; when present, applies the §5.21 error treatment. */
  error?: string;
  /** Extra classes for the wrapping label column. */
  className?: string;
  /** Extra classes for the `<input>` element itself. */
  inputClassName?: string;
}

/**
 * Text input with a visible label (design.md §5.6).
 *
 * Renders a real `<label>` wrapping a `<label>` text row and the `<input>`
 * (`h-[52px] rounded-input border-2 border-line`). On focus the border becomes
 * `border-ink`. When `error` is set, the border turns `border-danger`, the input
 * gets `aria-invalid` + `aria-describedby`, and an `InputError` (§5.21) is
 * rendered below — the error clears when the caller updates `error` to
 * undefined (e.g. as the code is edited). The `h-[52px]`/`px-[18px]` values are
 * documented exact values in design.md §5.6.
 */
export function Input({
  label,
  error,
  className,
  inputClassName,
  ...rest
}: InputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-label text-ink-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "h-[52px] w-full rounded-input border-2 bg-surface px-[18px] text-input text-ink",
          hasError ? "border-danger" : "border-line focus:border-ink",
          inputClassName,
        )}
        {...rest}
      />
      {hasError ? <InputError id={errorId}>{error as string}</InputError> : null}
    </div>
  );
}
