import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from './storage';

import { BUILT_IN_EXERCISES, setExerciseLibrary } from '@/data/exercises';
import { lastPerformance } from '@/logic/history';
import { newId, nowIso } from '@/logic/ids';
import { difficultyFromLegacy, diffLibrary, exercisesEqual, mergeLibrary } from '@/logic/library';
import { SEED_PLANS } from '@/data/seedPlans';
import type {
  Exercise,
  PlannedExercise,
  SessionExercise,
  SetLog,
  Settings,
  WorkoutPlan,
  WorkoutSession,
} from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
};

export interface GymState {
  hydrated: boolean;
  /** True once the example plans have been created (so deleting them does not bring them back). */
  seeded: boolean;
  plans: WorkoutPlan[];
  /** Finished sessions, newest first. */
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  settings: Settings;
  /** Imported exercises: overrides of built-ins (same id) and additions. See mergeLibrary. */
  customExercises: Exercise[];

  // Plans
  createPlan: (name: string) => WorkoutPlan;
  updatePlan: (planId: string, patch: Partial<Pick<WorkoutPlan, 'name'>>) => void;
  deletePlan: (planId: string) => void;
  addExerciseToPlan: (planId: string, exerciseId: string) => void;
  updatePlannedExercise: (
    planId: string,
    plannedId: string,
    patch: Partial<Pick<PlannedExercise, 'sets' | 'reps' | 'restSec' | 'exerciseId'>>,
  ) => void;
  removePlannedExercise: (planId: string, plannedId: string) => void;
  /** direction -1 moves up, +1 moves down. */
  movePlannedExercise: (planId: string, plannedId: string, direction: -1 | 1) => void;

  // Active session
  startSession: (planId?: string) => WorkoutSession;
  logSet: (sessionExerciseId: string, setIndex: number, patch: Partial<SetLog>) => void;
  addSet: (sessionExerciseId: string) => void;
  removeSet: (sessionExerciseId: string, setIndex: number) => void;
  /** Replace the exercise, keeping the set/rep targets. Records what it substituted. */
  swapExercise: (sessionExerciseId: string, newExerciseId: string) => void;
  addSessionExercise: (exerciseId: string) => void;
  removeSessionExercise: (sessionExerciseId: string) => void;
  finishSession: () => void;
  discardSession: () => void;

  // History
  deleteSession: (sessionId: string) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;

  // Import
  /** Adds the plans as new plans (fresh ids, timestamps now). Returns the created plans. */
  importPlans: (
    plans: readonly {
      name: string;
      exercises: readonly { exerciseId: string; sets: number; reps: number; restSec: number }[];
    }[],
  ) => WorkoutPlan[];
  /**
   * Adds finished sessions from a history file as given (ids preserved), then re-sorts the history by
   * finishedAt, newest first (stable). Returns the imported sessions. The active session is untouched.
   */
  importSessions: (sessions: readonly WorkoutSession[]) => WorkoutSession[];

  // Exercise library
  /**
   * Upserts the exercises into customExercises by id. An entry identical to the built-in with
   * that id removes the custom override instead. Counts are relative to the library before.
   */
  importExercises: (exercises: readonly Exercise[]) => { added: number; updated: number; unchanged: number };
  /** Drops every custom or edited exercise. */
  resetExerciseLibrary: () => void;
}

const BUILT_IN_BY_ID = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

/** The merged library for a customExercises array; cached by reference so it stays stable. */
const libraryCache: {
  custom: readonly Exercise[] | undefined;
  merged: Exercise[];
  byId: Record<string, Exercise>;
} = { custom: undefined, merged: [], byId: {} };
function cacheFor(custom: readonly Exercise[]) {
  if (libraryCache.custom !== custom) {
    libraryCache.custom = custom;
    libraryCache.merged = mergeLibrary(BUILT_IN_EXERCISES, custom);
    libraryCache.byId = Object.fromEntries(libraryCache.merged.map((e) => [e.id, e]));
  }
  return libraryCache;
}
export function libraryFor(custom: readonly Exercise[]): Exercise[] {
  return cacheFor(custom).merged;
}

function syncExerciseRegistry(custom: readonly Exercise[]): void {
  setExerciseLibrary(libraryFor(custom));
}

/** The push/pull/legs/arms example plans, with fresh IDs. */
export function buildSeedPlans(): WorkoutPlan[] {
  const now = nowIso();
  return SEED_PLANS.map((seed) => ({
    id: newId(),
    name: seed.name,
    createdAt: now,
    updatedAt: now,
    exercises: seed.exercises.map((e) => ({ id: newId(), ...e })),
  }));
}

/** Version of the persisted state; bump together with a step in migratePersistedState. */
export const PERSIST_VERSION = 2;

/**
 * Upgrades persisted state from an older version.
 * - Version 0 → 1: imported exercises from before the single difficulty score get it derived from
 *   their old formDifficulty/injuryRisk. (This step also switched the new 'rack' equipment on in
 *   the user's equipment list; that list is gone since version 2, so there is nothing left to do.)
 * - Version 1 → 2: the "my equipment" setting was removed, so `settings.availableEquipment` is
 *   dropped from the stored settings.
 */
export function migratePersistedState(persisted: unknown, version: number): unknown {
  if (typeof persisted !== 'object' || persisted === null) return persisted;
  const state = { ...(persisted as Record<string, unknown>) };
  if (version < 1) {
    if (Array.isArray(state.customExercises)) {
      state.customExercises = state.customExercises.map((raw: Record<string, unknown>) => {
        if (typeof raw !== 'object' || raw === null || typeof raw.difficulty === 'number') return raw;
        const { formDifficulty, injuryRisk, ...rest } = raw;
        const form = typeof formDifficulty === 'number' ? formDifficulty : 3;
        const risk = typeof injuryRisk === 'number' ? injuryRisk : form;
        return { ...rest, difficulty: difficultyFromLegacy(form, risk) };
      });
    }
  }
  if (version < 2) {
    const settings = state.settings;
    if (typeof settings === 'object' && settings !== null && 'availableEquipment' in settings) {
      const { availableEquipment: _removed, ...rest } = settings as Record<string, unknown>;
      state.settings = rest;
    }
  }
  return state;
}

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const DEFAULT_REST = 90;

function makeSets(
  sessions: readonly WorkoutSession[],
  exerciseId: string,
  count: number,
  reps: number,
): SetLog[] {
  const last = lastPerformance(sessions, exerciseId);
  return Array.from({ length: count }, (_, i) => ({
    reps: last?.sets[i]?.reps ?? reps,
    weight: last?.sets[i]?.weight ?? last?.sets[last.sets.length - 1]?.weight ?? 0,
    completed: false,
  }));
}

export const useGymStore = create<GymState>()(
  persist(
    (set, get) => {
      const updatePlanExercises = (
        planId: string,
        fn: (exercises: PlannedExercise[]) => PlannedExercise[],
      ) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === planId ? { ...p, exercises: fn(p.exercises), updatedAt: nowIso() } : p,
          ),
        }));

      const updateActive = (fn: (session: WorkoutSession) => WorkoutSession) =>
        set((s) => (s.activeSession ? { activeSession: fn(s.activeSession) } : {}));

      const updateSessionExercise = (
        sessionExerciseId: string,
        fn: (ex: SessionExercise) => SessionExercise,
      ) =>
        updateActive((session) => ({
          ...session,
          exercises: session.exercises.map((ex) => (ex.id === sessionExerciseId ? fn(ex) : ex)),
        }));

      return {
        hydrated: false,
        seeded: false,
        plans: [],
        sessions: [],
        activeSession: null,
        settings: DEFAULT_SETTINGS,
        customExercises: [],

        createPlan: (name) => {
          const now = nowIso();
          const plan: WorkoutPlan = { id: newId(), name, exercises: [], createdAt: now, updatedAt: now };
          set((s) => ({ plans: [...s.plans, plan] }));
          return plan;
        },
        updatePlan: (planId, patch) =>
          set((s) => ({
            plans: s.plans.map((p) => (p.id === planId ? { ...p, ...patch, updatedAt: nowIso() } : p)),
          })),
        deletePlan: (planId) => set((s) => ({ plans: s.plans.filter((p) => p.id !== planId) })),
        addExerciseToPlan: (planId, exerciseId) =>
          updatePlanExercises(planId, (exs) => [
            ...exs,
            { id: newId(), exerciseId, sets: DEFAULT_SETS, reps: DEFAULT_REPS, restSec: DEFAULT_REST },
          ]),
        updatePlannedExercise: (planId, plannedId, patch) =>
          updatePlanExercises(planId, (exs) =>
            exs.map((e) => (e.id === plannedId ? { ...e, ...patch } : e)),
          ),
        removePlannedExercise: (planId, plannedId) =>
          updatePlanExercises(planId, (exs) => exs.filter((e) => e.id !== plannedId)),
        movePlannedExercise: (planId, plannedId, direction) =>
          updatePlanExercises(planId, (exs) => {
            const i = exs.findIndex((e) => e.id === plannedId);
            const j = i + direction;
            if (i < 0 || j < 0 || j >= exs.length) return exs;
            const copy = [...exs];
            [copy[i], copy[j]] = [copy[j], copy[i]];
            return copy;
          }),

        startSession: (planId) => {
          const { plans, sessions } = get();
          const plan = planId ? plans.find((p) => p.id === planId) : undefined;
          const session: WorkoutSession = {
            id: newId(),
            planId: plan?.id,
            planName: plan?.name ?? 'Free workout',
            startedAt: nowIso(),
            exercises: (plan?.exercises ?? []).map((pe) => ({
              id: newId(),
              exerciseId: pe.exerciseId,
              targetSets: pe.sets,
              targetReps: pe.reps,
              restSec: pe.restSec,
              sets: makeSets(sessions, pe.exerciseId, pe.sets, pe.reps),
            })),
          };
          set({ activeSession: session });
          return session;
        },
        logSet: (sessionExerciseId, setIndex, patch) =>
          updateSessionExercise(sessionExerciseId, (ex) => ({
            ...ex,
            sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
          })),
        addSet: (sessionExerciseId) =>
          updateSessionExercise(sessionExerciseId, (ex) => {
            const prev = ex.sets[ex.sets.length - 1];
            return {
              ...ex,
              sets: [...ex.sets, { reps: prev?.reps ?? ex.targetReps, weight: prev?.weight ?? 0, completed: false }],
            };
          }),
        removeSet: (sessionExerciseId, setIndex) =>
          updateSessionExercise(sessionExerciseId, (ex) => ({
            ...ex,
            sets: ex.sets.filter((_, i) => i !== setIndex),
          })),
        swapExercise: (sessionExerciseId, newExerciseId) => {
          const { sessions } = get();
          updateSessionExercise(sessionExerciseId, (ex) => ({
            ...ex,
            exerciseId: newExerciseId,
            substitutedFor: ex.substitutedFor ?? ex.exerciseId,
            sets: makeSets(sessions, newExerciseId, Math.max(ex.sets.length, 1), ex.targetReps),
          }));
        },
        addSessionExercise: (exerciseId) => {
          const { sessions } = get();
          updateActive((session) => ({
            ...session,
            exercises: [
              ...session.exercises,
              {
                id: newId(),
                exerciseId,
                targetSets: DEFAULT_SETS,
                targetReps: DEFAULT_REPS,
                restSec: DEFAULT_REST,
                sets: makeSets(sessions, exerciseId, DEFAULT_SETS, DEFAULT_REPS),
              },
            ],
          }));
        },
        removeSessionExercise: (sessionExerciseId) =>
          updateActive((session) => ({
            ...session,
            exercises: session.exercises.filter((ex) => ex.id !== sessionExerciseId),
          })),
        finishSession: () =>
          set((s) => {
            if (!s.activeSession) return {};
            const finished: WorkoutSession = { ...s.activeSession, finishedAt: nowIso() };
            return { activeSession: null, sessions: [finished, ...s.sessions] };
          }),
        discardSession: () => set({ activeSession: null }),

        deleteSession: (sessionId) =>
          set((s) => ({ sessions: s.sessions.filter((x) => x.id !== sessionId) })),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        importPlans: (incoming) => {
          const now = nowIso();
          const created: WorkoutPlan[] = incoming.map((p) => ({
            id: newId(),
            name: p.name,
            createdAt: now,
            updatedAt: now,
            exercises: p.exercises.map((e) => ({
              id: newId(),
              exerciseId: e.exerciseId,
              sets: e.sets,
              reps: e.reps,
              restSec: e.restSec,
            })),
          }));
          set((s) => ({ plans: [...s.plans, ...created] }));
          return created;
        },

        importSessions: (incoming) => {
          const imported = [...incoming];
          set((s) => ({
            sessions: [...s.sessions, ...imported].sort((a, b) => {
              const fa = a.finishedAt ?? '';
              const fb = b.finishedAt ?? '';
              return fa < fb ? 1 : fa > fb ? -1 : 0;
            }),
          }));
          return imported;
        },

        importExercises: (incoming) => {
          const { customExercises } = get();
          const diff = diffLibrary(incoming, libraryFor(customExercises));
          const next = [...customExercises];
          for (const e of incoming) {
            const index = next.findIndex((c) => c.id === e.id);
            const builtIn = BUILT_IN_BY_ID.get(e.id);
            if (builtIn && exercisesEqual(e, builtIn)) {
              if (index >= 0) next.splice(index, 1);
            } else if (index >= 0) {
              next[index] = e;
            } else {
              next.push(e);
            }
          }
          if (diff.added.length + diff.updated.length > 0 || next.length !== customExercises.length) {
            set({ customExercises: next });
          }
          return { added: diff.added.length, updated: diff.updated.length, unchanged: diff.unchanged.length };
        },
        resetExerciseLibrary: () => set({ customExercises: [] }),
      };
    },
    {
      name: 'gym-buddy-v1',
      version: PERSIST_VERSION,
      migrate: (persisted, version) => migratePersistedState(persisted, version) as GymState,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        seeded: s.seeded,
        plans: s.plans,
        sessions: s.sessions,
        activeSession: s.activeSession,
        settings: s.settings,
        customExercises: s.customExercises,
      }),
      onRehydrateStorage: () => () => {
        const state = useGymStore.getState();
        if (!state.seeded) {
          useGymStore.setState({ plans: [...state.plans, ...buildSeedPlans()], seeded: true });
        }
        syncExerciseRegistry(useGymStore.getState().customExercises ?? []);
        useGymStore.setState({ hydrated: true });
      },
    },
  ),
);

// Keep the exercise registry (getExercises/getExercise) in step with the custom entries.
useGymStore.subscribe((state, prev) => {
  if (state.customExercises !== prev.customExercises) syncExerciseRegistry(state.customExercises);
});

/** The current exercise library (built-ins merged with custom entries); re-renders after an import. */
export function useExerciseLibrary(): Exercise[] {
  const custom = useGymStore((s) => s.customExercises);
  return libraryFor(custom);
}

/**
 * The current library indexed by id. Screens that look exercises up or pass a `db` to the logic
 * functions use this (instead of getExercise/defaults) so they re-render after an import.
 */
export function useExerciseMap(): Record<string, Exercise> {
  const custom = useGymStore((s) => s.customExercises);
  return cacheFor(custom).byId;
}
