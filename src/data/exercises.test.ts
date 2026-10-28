import {
  BUILT_IN_EXERCISES as EXERCISES,
  getExercise,
  getExerciseMap,
  getExercises,
  setExerciseLibrary,
} from '@/data/exercises';
import { EQUIPMENT, MOVEMENT_PATTERNS, MUSCLE_GROUPS, type Exercise } from '@/types';

const HOME_EQUIPMENT = new Set<string>(['bodyweight', 'pull_up_bar', 'dip_station']);

function primaries(e: Exercise): string[] {
  return Object.entries(e.muscles)
    .filter(([, v]) => v === 1)
    .map(([k]) => k);
}

function byId(id: string): Exercise {
  const e = getExercise(id);
  if (!e) throw new Error(`missing exercise ${id}`);
  return e;
}

describe('exercise database: shape', () => {
  it('has 123 exercises', () => {
    expect(EXERCISES).toHaveLength(123);
  });

  it('has unique, slug-shaped IDs', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it('has unique, non-empty names', () => {
    const names = EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const e of EXERCISES) expect(e.name.trim().length).toBeGreaterThan(0);
  });

  it('keeps the original stub IDs', () => {
    for (const id of ['barbell_back_squat', 'leg_press', 'dumbbell_bench_press']) {
      expect(getExercise(id)).toBeDefined();
    }
  });

  it.each(EXERCISES.map((e) => [e.id, e] as const))('%s is well-formed', (_id, e) => {
    expect(e.equipment.length).toBeGreaterThan(0);
    expect(new Set(e.equipment).size).toBe(e.equipment.length);
    for (const item of e.equipment) expect(EQUIPMENT).toContain(item);
    if (e.equipment.includes('bodyweight')) expect(e.equipment).toEqual(['bodyweight']);

    expect(MOVEMENT_PATTERNS).toContain(e.pattern);
    expect(typeof e.compound).toBe('boolean');

    const entries = Object.entries(e.muscles);
    expect(entries.length).toBeGreaterThan(0);
    for (const [muscle, value] of entries) {
      expect(MUSCLE_GROUPS).toContain(muscle);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(primaries(e).length).toBeGreaterThanOrEqual(1);

    expect(Number.isInteger(e.difficulty)).toBe(true);
    expect(e.difficulty).toBeGreaterThanOrEqual(1);
    expect(e.difficulty).toBeLessThanOrEqual(5);
    expect(e).not.toHaveProperty('formDifficulty');
    expect(e).not.toHaveProperty('injuryRisk');

    expect(e.cues.length).toBeGreaterThanOrEqual(2);
    expect(e.cues.length).toBeLessThanOrEqual(4);
    for (const cue of e.cues) {
      expect(cue.trim().length).toBeGreaterThan(0);
      expect(cue.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('exercise database: coverage', () => {
  it.each([...MUSCLE_GROUPS])('%s is the primary target of at least 3 exercises', (muscle) => {
    const count = EXERCISES.filter((e) => e.muscles[muscle] === 1).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it.each([...EQUIPMENT])('%s is required by at least 2 exercises', (item) => {
    const count = EXERCISES.filter((e) => e.equipment.includes(item)).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it.each([...MOVEMENT_PATTERNS])('%s is used by at least 3 exercises', (pattern) => {
    const count = EXERCISES.filter((e) => e.pattern === pattern).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('has at least 12 exercises doable at home with bodyweight, a bar or dip station', () => {
    const home = EXERCISES.filter((e) => e.equipment.every((item) => HOME_EQUIPMENT.has(item)));
    expect(home.length).toBeGreaterThanOrEqual(12);
  });
});

describe('exercise database: lookup', () => {
  it('the registry starts with every built-in exercise', () => {
    expect(getExercises()).toBe(EXERCISES);
    expect(Object.keys(getExerciseMap())).toHaveLength(EXERCISES.length);
    for (const e of EXERCISES) expect(getExerciseMap()[e.id]).toBe(e);
  });

  it('setExerciseLibrary replaces the registry contents', () => {
    const custom: Exercise = { ...byId('pull_up'), id: 'custom_pull', name: 'Custom pull' };
    try {
      setExerciseLibrary([...EXERCISES, custom]);
      expect(getExercises()).toHaveLength(EXERCISES.length + 1);
      expect(getExercise('custom_pull')).toBe(custom);
      expect(getExerciseMap().custom_pull).toBe(custom);
    } finally {
      setExerciseLibrary(EXERCISES);
    }
    expect(getExercise('custom_pull')).toBeUndefined();
  });

  it('getExercise returns the exercise or undefined', () => {
    expect(getExercise('barbell_back_squat')?.name).toBe('Barbell back squat');
    expect(getExercise('not_a_real_exercise')).toBeUndefined();
    expect(getExercise('')).toBeUndefined();
    expect(getExercise('toString')).toBeUndefined();
  });
});

describe('exercise database: rating anchors', () => {
  it.each([
    ['machine_chest_press', 1],
    ['leg_extension', 1],
    ['pec_deck', 1],
    ['cable_lateral_raise', 1],
    ['push_up', 1],
    ['dumbbell_bench_press', 2],
    ['leg_press', 2],
    ['lat_pulldown', 2],
    ['seated_cable_row', 2],
    ['dumbbell_curl', 2],
    ['barbell_bench_press', 3],
    ['barbell_row', 3],
    ['overhead_press', 3],
    ['kettlebell_swing', 3],
    ['bulgarian_split_squat', 3],
    ['hip_thrust', 3],
    ['pull_up', 3],
    ['barbell_back_squat', 4],
    ['front_squat', 4],
    ['romanian_deadlift', 4],
    ['weighted_pull_up', 4],
    ['barbell_upright_row', 4],
    ['rack_pull', 4],
    ['conventional_deadlift', 5],
    ['snatch_grip_deadlift', 5],
    ['good_morning', 5],
    ['behind_the_neck_press', 5],
    ['power_clean', 5],
  ] as const)('%s has difficulty %i', (id, difficulty) => {
    expect(byId(id).difficulty).toBe(difficulty);
  });

  it.each([
    ['reverse_crunch', 1],
    ['incline_push_up', 1],
    ['dumbbell_goblet_squat', 2],
    ['machine_lateral_raise', 1],
    ['cable_overhead_triceps_extension', 2],
  ] as const)('new entry %s has difficulty %i', (id, difficulty) => {
    expect(byId(id).difficulty).toBe(difficulty);
  });

  it('matches the documented activation profiles', () => {
    expect(byId('romanian_deadlift').muscles).toEqual({
      hamstrings: 1,
      glutes: 0.8,
      lower_back: 0.5,
      forearms: 0.3,
    });
    expect(byId('lat_pulldown').muscles).toEqual({
      lats: 1,
      upper_back: 0.5,
      biceps: 0.5,
      rear_delts: 0.3,
    });
    expect(byId('overhead_press').muscles).toMatchObject({
      front_delts: 1,
      side_delts: 0.5,
      triceps: 0.6,
      upper_back: 0.2,
    });
  });

  it('lists every required item of equipment for common lifts', () => {
    expect(byId('barbell_bench_press').equipment).toEqual(['barbell', 'bench']);
    expect(byId('pull_up').equipment).toEqual(['pull_up_bar']);
    expect(byId('push_up').equipment).toEqual(['bodyweight']);
    expect(byId('chest_dip').equipment).toEqual(['dip_station']);
    expect(byId('weighted_pull_up').equipment).toEqual(['pull_up_bar']);
    expect(byId('back_extension').equipment).toEqual(['machine']);
    expect(byId('preacher_curl').equipment).toEqual(['ez_bar', 'machine']);
  });

  it('requires a rack for the lifts that start from one', () => {
    for (const id of ['barbell_back_squat', 'front_squat', 'good_morning', 'rack_pull', 'inverted_row']) {
      expect(byId(id).equipment).toEqual(['barbell', 'rack']);
    }
  });

  it('marks isolation exercises as non-compound', () => {
    for (const e of EXERCISES.filter((x) => x.pattern === 'isolation')) {
      expect(e.compound).toBe(false);
    }
  });
});
