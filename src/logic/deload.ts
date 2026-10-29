import { getExerciseMap } from '@/data/exercises';
import type { Exercise, MuscleGroup, WeightUnit, WorkoutSession } from '@/types';
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '@/types';

import { LOAD_THRESHOLDS, loadLevel, recentMuscleLoad } from './load';
import { formatWeight } from './sessionFormat';
import { estimateOneRepMax } from './stats';

/**
 * Signs that a deload week (same workouts, about half the sets, about 10 % lighter) is due,
 * derived from the finished sessions. Editorial heuristics, not a fatigue measurement.
 */

/** Top-set estimated 1RM strictly falling across the last this many sessions of a lift... */
export const DECLINE_SESSIONS = 4;
/** ...and the last at least this share below the first. */
export const DECLINE_MIN_DROP = 0.05;
/** The latest of those sessions must be at most this old, so a lift that was dropped stops flagging. */
export const DECLINE_MAX_AGE_DAYS = 28;
/** A muscle at load level 'high' in each of the last this many seven-day windows. */
export const HIGH_LOAD_WEEKS = 2;
/** This many consecutive training weeks without a lighter week. */
export const STREAK_MIN_WEEKS = 6;
/** How far back the streak is counted. */
export const STREAK_MAX_WEEKS = 26;
/** A week with fewer completed sets than this share of the streak's median is "lighter". */
export const LIGHTER_WEEK_RATIO = 0.6;
/** No advice this long after a finished deload session. */
export const DELOAD_COOLDOWN_DAYS = 14;
export const SNOOZE_DAYS = 7;
/** Local hour of the reminder. */
export const ADVICE_HOUR = 9;
/** Computed before this local hour → remind today, otherwise tomorrow. */
export const ADVICE_EARLIEST_HOUR = 8;

export type DeloadReason =
  /** Estimated 1RM of the first and last of the DECLINE_SESSIONS sessions, user's unit, 1 decimal. */
  | { kind: 'decline'; exerciseId: string; from: number; to: number }
  | { kind: 'load'; muscle: MuscleGroup; weeks: number }
  | { kind: 'streak'; weeks: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Finished {
  session: WorkoutSession;
  finishedAt: number;
}

/** Finished sessions with a parseable finishedAt, oldest first. */
function finishedSessions(sessions: readonly WorkoutSession[]): Finished[] {
  const out: Finished[] = [];
  for (const session of sessions) {
    if (!session.finishedAt) continue;
    const finishedAt = Date.parse(session.finishedAt);
    if (Number.isFinite(finishedAt)) out.push({ session, finishedAt });
  }
  return out.sort((a, b) => a.finishedAt - b.finishedAt);
}

/** Highest Epley estimate over the session's completed, loaded sets of the exercise. */
function topSet(session: WorkoutSession, exerciseId: string): number | undefined {
  let best: number | undefined;
  for (const ex of session.exercises) {
    if (ex.exerciseId !== exerciseId) continue;
    for (const s of ex.sets) {
      if (!s.completed || s.weight <= 0 || s.reps <= 0) continue;
      const e1rm = estimateOneRepMax(s.weight, s.reps);
      if (best === undefined || e1rm > best) best = e1rm;
    }
  }
  return best;
}

function declineFrom(finished: readonly Finished[], exerciseId: string, now: number): DeloadReason | undefined {
  const tops: { top: number; at: number }[] = [];
  for (const { session, finishedAt } of finished) {
    if (session.deload === true) continue;
    const top = topSet(session, exerciseId);
    if (top !== undefined) tops.push({ top, at: finishedAt });
  }
  if (tops.length < DECLINE_SESSIONS) return undefined;
  const recent = tops.slice(-DECLINE_SESSIONS);
  if (now - recent[recent.length - 1].at > DECLINE_MAX_AGE_DAYS * DAY_MS) return undefined;
  const last = recent.map((t) => t.top);
  for (let i = 1; i < last.length; i++) if (!(last[i] < last[i - 1])) return undefined;
  const from = last[0];
  const to = last[last.length - 1];
  if (to > from * (1 - DECLINE_MIN_DROP)) return undefined;
  return { kind: 'decline', exerciseId, from: round1(from), to: round1(to) };
}

/**
 * Decline reason when the top-set estimated 1RM fell in each of the latest DECLINE_SESSIONS
 * finished non-deload sessions of the lift, by at least DECLINE_MIN_DROP overall, and the latest
 * of them is at most DECLINE_MAX_AGE_DAYS old.
 */
export function strengthDecline(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  now: number = Date.now(),
): DeloadReason | undefined {
  return declineFrom(finishedSessions(sessions), exerciseId, now);
}

/** One reason per muscle at load level 'high' in both of the last two seven-day windows, in MUSCLE_GROUPS order. */
export function sustainedHighLoad(
  sessions: readonly WorkoutSession[],
  now: number,
  db: Record<string, Exercise> = getExerciseMap(),
): DeloadReason[] {
  const thisWeek = recentMuscleLoad(sessions, now, db);
  const lastWeek = recentMuscleLoad(sessions, now - WEEK_MS, db);
  return MUSCLE_GROUPS.filter(
    (m) => loadLevel(thisWeek[m]) === 'high' && loadLevel(lastWeek[m]) === 'high',
  ).map((muscle) => ({ kind: 'load', muscle, weeks: HIGH_LOAD_WEEKS }));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Streak reason when at least STREAK_MIN_WEEKS consecutive seven-day windows ending at `now`
 * contain training and none of them is a lighter week (a deload session, or fewer completed
 * sets than LIGHTER_WEEK_RATIO × the median week). Counted back at most STREAK_MAX_WEEKS.
 */
export function trainingStreak(sessions: readonly WorkoutSession[], now: number): DeloadReason | undefined {
  const weeks: { sets: number; deload: boolean; trained: boolean }[] = Array.from(
    { length: STREAK_MAX_WEEKS },
    () => ({ sets: 0, deload: false, trained: false }),
  );
  for (const { session, finishedAt } of finishedSessions(sessions)) {
    if (finishedAt > now) continue;
    // Window k = (now − (k+1)·7d, now − k·7d].
    const w = weeks[Math.floor((now - finishedAt) / WEEK_MS)];
    if (!w) continue;
    w.trained = true;
    if (session.deload === true) w.deload = true;
    for (const ex of session.exercises) w.sets += ex.sets.filter((s) => s.completed).length;
  }
  let trainedWeeks = 0;
  while (trainedWeeks < weeks.length && weeks[trainedWeeks].trained) trainedWeeks++;
  if (trainedWeeks < STREAK_MIN_WEEKS) return undefined;
  const run = weeks.slice(0, trainedWeeks);
  const threshold = LIGHTER_WEEK_RATIO * median(run.map((w) => w.sets));
  let streak = 0;
  while (streak < run.length && !run[streak].deload && run[streak].sets >= threshold) streak++;
  return streak >= STREAK_MIN_WEEKS ? { kind: 'streak', weeks: streak } : undefined;
}

/** True when a deload session finished within the last DELOAD_COOLDOWN_DAYS days. */
export function inDeloadCooldown(sessions: readonly WorkoutSession[], now: number): boolean {
  const since = now - DELOAD_COOLDOWN_DAYS * DAY_MS;
  return finishedSessions(sessions).some(
    ({ session, finishedAt }) => session.deload === true && finishedAt >= since && finishedAt <= now,
  );
}

/**
 * All current reasons, or [] when there are none or a deload session finished within the
 * cooldown. Sorted: decline reasons by exerciseId, then load reasons in MUSCLE_GROUPS order,
 * then streak.
 */
export function deloadReasons(
  sessions: readonly WorkoutSession[],
  now: number = Date.now(),
  db: Record<string, Exercise> = getExerciseMap(),
): DeloadReason[] {
  if (inDeloadCooldown(sessions, now)) return [];
  const finished = finishedSessions(sessions);
  const ids = new Set<string>();
  for (const { session } of finished) {
    if (session.deload === true) continue;
    for (const ex of session.exercises) ids.add(ex.exerciseId);
  }
  const reasons: DeloadReason[] = [];
  for (const id of [...ids].sort()) {
    const decline = declineFrom(finished, id, now);
    if (decline) reasons.push(decline);
  }
  reasons.push(...sustainedHighLoad(sessions, now, db));
  const streak = trainingStreak(sessions, now);
  if (streak) reasons.push(streak);
  return reasons;
}

/** Stable identity of a reason set, '' for none, e.g. 'decline:barbell_back_squat|load:quads|streak'. */
export function adviceKey(reasons: readonly DeloadReason[]): string {
  return reasons
    .map((r) => {
      switch (r.kind) {
        case 'decline':
          return `decline:${r.exerciseId}`;
        case 'load':
          return `load:${r.muscle}`;
        case 'streak':
          return 'streak';
      }
    })
    .join('|');
}

/** One human line per reason; an exercise missing from `db` is named "Unknown exercise". */
export function describeReason(reason: DeloadReason, db: Record<string, Exercise>, unit: WeightUnit): string {
  switch (reason.kind) {
    case 'decline': {
      const name = db[reason.exerciseId]?.name ?? 'Unknown exercise';
      return `${name}: estimated max fell ${DECLINE_SESSIONS - 1} sessions in a row (${formatWeight(reason.from)} → ${formatWeight(reason.to)} ${unit})`;
    }
    case 'load':
      return `${MUSCLE_LABELS[reason.muscle]}: over ${LOAD_THRESHOLDS.high} effective sets a week for ${reason.weeks} weeks`;
    case 'streak':
      return `${reason.weeks} weeks of training without a lighter week`;
  }
}

/**
 * When to deliver the reminder: today at ADVICE_HOUR local time if `now` is before
 * ADVICE_EARLIEST_HOUR local, otherwise tomorrow at ADVICE_HOUR. Milliseconds since epoch.
 */
export function nextAdviceTime(now: number): number {
  const d = new Date(now);
  if (d.getHours() >= ADVICE_EARLIEST_HOUR) d.setDate(d.getDate() + 1);
  d.setHours(ADVICE_HOUR, 0, 0, 0);
  return d.getTime();
}
