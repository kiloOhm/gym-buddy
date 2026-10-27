// Example plans created on first launch: a push / pull / legs / arms split,
// five exercises per day.
// Exercise IDs must exist in src/data/exercises.ts (the test checks this).

export interface SeedExercise {
  exerciseId: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface SeedPlan {
  name: string;
  exercises: SeedExercise[];
}

const ex = (exerciseId: string, sets: number, reps: number, restSec: number): SeedExercise => ({
  exerciseId,
  sets,
  reps,
  restSec,
});

export const SEED_PLANS: SeedPlan[] = [
  {
    name: 'Push',
    exercises: [
      ex('barbell_bench_press', 4, 6, 150),
      ex('overhead_press', 3, 8, 120),
      ex('incline_dumbbell_bench_press', 3, 10, 90),
      ex('dumbbell_lateral_raise', 3, 15, 60),
      ex('cable_triceps_pushdown', 3, 12, 60),
    ],
  },
  {
    name: 'Pull',
    exercises: [
      ex('conventional_deadlift', 3, 5, 180),
      ex('pull_up', 3, 8, 120),
      ex('barbell_row', 3, 8, 120),
      ex('seated_cable_row', 3, 12, 90),
      ex('face_pull', 3, 15, 60),
    ],
  },
  {
    name: 'Legs',
    exercises: [
      ex('barbell_back_squat', 4, 6, 180),
      ex('romanian_deadlift', 3, 8, 120),
      ex('leg_press', 3, 12, 90),
      ex('walking_lunge', 3, 10, 90),
      ex('standing_calf_raise', 4, 12, 60),
    ],
  },
  {
    name: 'Arms',
    exercises: [
      ex('close_grip_bench_press', 3, 8, 120),
      ex('ez_bar_curl', 3, 10, 90),
      ex('ez_bar_skullcrusher', 3, 10, 90),
      ex('hammer_curl', 3, 12, 60),
      ex('dumbbell_overhead_triceps_extension', 3, 12, 60),
    ],
  },
];
