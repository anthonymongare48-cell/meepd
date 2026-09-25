import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <span className="not-found-mark">m</span>
      <p className="not-found-kicker">meepdf</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist or may have moved.</p>
      <Link className="not-found-link" href="/">Back to PDF tools</Link>
    </main>
  );
}
