// Shared domain types for Gym Buddy. Keep this file dependency-free.

export const MUSCLE_GROUPS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'hip_flexors',
  'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  lats: 'Lats',
  upper_back: 'Upper back',
  traps: 'Traps',
  lower_back: 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  hip_flexors: 'Hip flexors',
  calves: 'Calves',
};

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'smith_machine',
  'ez_bar',
  'band',
  'bench',
  'rack',
  'pull_up_bar',
  'dip_station',
  'bodyweight',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebell',
  cable: 'Cable station',
  machine: 'Machine',
  smith_machine: 'Smith machine',
  ez_bar: 'EZ bar',
  band: 'Resistance band',
  bench: 'Bench',
  rack: 'Power rack / squat stand',
  pull_up_bar: 'Pull-up bar',
  dip_station: 'Dip station',
  bodyweight: 'Bodyweight',
};

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'carry',
  'core',
  'isolation',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** 1 = trivial, 5 = very technical and very unforgiving. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Exercise {
  /** Stable slug, e.g. "barbell_back_squat". Never change once shipped. */
  id: string;
  name: string;
  /** Every item is required to perform the exercise. "bodyweight" means nothing else is needed. */
  equipment: Equipment[];
  pattern: MovementPattern;
  compound: boolean;
  /**
   * Relative activation per muscle, 0..1. The primary target(s) get 1.0,
   * strong secondaries ~0.5-0.7, minor stabilisers ~0.2-0.3. Omit muscles
   * that are not meaningfully worked.
   */
  muscles: Partial<Record<MuscleGroup, number>>;
  /**
   * Editorial 1-5 rating of how technically demanding and how unforgiving the exercise is
   * (anchors in src/data/exercises.ts). Not a measured injury rate.
   */
  difficulty: Rating;
  /** 2-4 short coaching cues shown in the exercise detail view. */
  cues: string[];
}

export interface PlannedExercise {
  /** Unique within the plan so the same exercise can appear twice. */
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: PlannedExercise[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SetLog {
  reps: number;
  /** In the user's chosen unit; 0 for bodyweight. */
  weight: number;
  completed: boolean;
}

export interface SessionExercise {
  /** Unique within the session. */
  id: string;
  exerciseId: string;
  /** Set when the user swapped the planned exercise for this one. */
  substitutedFor?: string;
  targetSets: number;
  targetReps: number;
  restSec: number;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  planId?: string;
  planName: string;
  startedAt: string; // ISO
  finishedAt?: string; // ISO; undefined while in progress
  exercises: SessionExercise[];
}

export type WeightUnit = 'kg' | 'lb';

export interface Settings {
  weightUnit: WeightUnit;
}
