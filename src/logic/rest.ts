/** Whole seconds left until `endsAt`, rounded up so the display hits 0 exactly at the end. Never negative. */
export function remainingSec(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Fraction of the rest still left, 1 at the start and 0 at the end. */
export function restProgress(endsAt: number, totalSec: number, now: number): number {
  if (totalSec <= 0) return 0;
  return Math.min(1, Math.max(0, (endsAt - now) / (totalSec * 1000)));
}

/** Seconds as m:ss, e.g. 83 → "1:23". */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
