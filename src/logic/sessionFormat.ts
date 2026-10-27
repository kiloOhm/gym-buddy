import type { SetLog, WeightUnit, WorkoutSession } from '@/types';

/** Elapsed milliseconds as mm:ss (or h:mm:ss past an hour). Negative values clamp to 0. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Trim pointless decimals: 80 → "80", 82.5 → "82.5". */
export function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : String(Math.round(weight * 100) / 100);
}

/** "80 kg × 8, 80 × 8, 80 × 7" — unit only on the first set. */
export function formatSetList(sets: readonly SetLog[], unit: WeightUnit): string {
  return sets
    .map((s, i) => `${formatWeight(s.weight)}${i === 0 ? ` ${unit}` : ''} × ${s.reps}`)
    .join(', ');
}

/** Parse a user-typed number. Accepts "," as decimal separator; empty or invalid → 0. */
export function parseNumberInput(text: string, allowDecimal: boolean): number {
  const normalised = text.replace(',', '.').trim();
  if (normalised === '') return 0;
  const n = allowDecimal ? parseFloat(normalised) : parseInt(normalised, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Σ weight × reps over completed sets. */
export function sessionVolume(session: WorkoutSession): number {
  let total = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) if (s.completed) total += s.weight * s.reps;
  }
  return total;
}

/** Whole minutes between start and finish, or undefined while in progress. */
export function sessionDurationMin(session: WorkoutSession): number | undefined {
  if (!session.finishedAt) return undefined;
  const ms = Date.parse(session.finishedAt) - Date.parse(session.startedAt);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : undefined;
}

export function completedSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.completed).length, 0);
}

/** Short weekday + date for session lists, e.g. "Tue, 27 Oct 2026" (locale-dependent). */
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
