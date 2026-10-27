import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { lastPerformance } from '@/logic/history';
import { newId, nowIso } from '@/logic/ids';
import { SEED_PLANS } from '@/data/seedPlans';
import { EQUIPMENT } from '@/types';
import type {
  PlannedExercise,
  SessionExercise,
  SetLog,
  Settings,
  WorkoutPlan,
  WorkoutSession,
} from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  availableEquipment: [...EQUIPMENT],
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
      };
    },
    {
      name: 'gym-buddy-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        seeded: s.seeded,
        plans: s.plans,
        sessions: s.sessions,
        activeSession: s.activeSession,
        settings: s.settings,
      }),
      onRehydrateStorage: () => () => {
        const state = useGymStore.getState();
        if (!state.seeded) {
          useGymStore.setState({ plans: [...state.plans, ...buildSeedPlans()], seeded: true });
        }
        useGymStore.setState({ hydrated: true });
      },
    },
  ),
);
