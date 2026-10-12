import Link from 'next/link';

/** The "overtone." wordmark — lowercase navy word, terracotta period. */
export function Wordmark() {
  return (
    <Link
      href="/"
      className="text-primary -ml-1 inline-flex min-h-11 items-center px-1 text-xl font-semibold tracking-tight lowercase"
    >
      <span>overtone</span>
      <span className="text-accent" aria-hidden="true">
        .
      </span>
    </Link>
  );
}
