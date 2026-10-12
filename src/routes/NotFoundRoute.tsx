import { Link } from "react-router-dom";

/**
 * Fallback route for unmatched paths.
 */
export function NotFoundRoute() {
  return (
    <main>
      <h1>Not found</h1>
      <Link to="/">Back to home</Link>
    </main>
  );
}
