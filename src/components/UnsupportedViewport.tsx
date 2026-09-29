/**
 * Unsupported-viewport guard message (Requirement 16.4 / 16.8).
 *
 * Rendered inside the app shell when the viewport is too narrow (<360px), too
 * wide (>430px), or in landscape orientation. While shown, the routed game and
 * lobby content is suppressed (see App.tsx). Copy matches Requirement 16.8:
 * "use a supported portrait phone width between 360px and 430px".
 *
 * Tokens only (token-policy.md / design-fidelity.md): `bg-paper`, `text-ink`,
 * `text-ink-muted`, and the `text-title` / `text-body` type-scale tokens.
 */
export function UnsupportedViewport() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <h1 className="font-display text-title text-ink">Rotate to portrait</h1>
      <p className="max-w-xs text-body text-ink-muted">
        Homemade Uno is built for phones. Please use a supported portrait phone
        width between 360px and 430px.
      </p>
    </div>
  );
}
