import { MUSCLE_GROUPS, type MuscleGroup } from '@/types';

import { MUSCLE_REGIONS } from './bodyMapRegions';

const FRONT: MuscleGroup[] = [
  'chest', 'front_delts', 'side_delts', 'biceps', 'forearms', 'abs', 'obliques',
  'quads', 'adductors', 'hip_flexors', 'calves', 'traps',
];
const BACK: MuscleGroup[] = [
  'traps', 'rear_delts', 'side_delts', 'upper_back', 'lats', 'lower_back', 'triceps',
  'forearms', 'glutes', 'hamstrings', 'adductors', 'calves',
];

const commandCount = (d: string) => (d.match(/[MLHVCSQTAZ]/gi) ?? []).length;

describe('MUSCLE_REGIONS', () => {
  it.each(MUSCLE_GROUPS)('%s has at least one path', (m) => {
    const r = MUSCLE_REGIONS[m];
    expect((r.front?.length ?? 0) + (r.back?.length ?? 0)).toBeGreaterThan(0);
  });

  it('every path is a non-trivial path starting with M', () => {
    for (const m of MUSCLE_GROUPS) {
      for (const d of [...(MUSCLE_REGIONS[m].front ?? []), ...(MUSCLE_REGIONS[m].back ?? [])]) {
        expect(d.startsWith('M')).toBe(true);
        expect(d.length).toBeGreaterThan(10);
      }
    }
  });

  it.each(FRONT)('%s appears in the front view', (m) => {
    expect(MUSCLE_REGIONS[m].front?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(BACK)('%s appears in the back view', (m) => {
    expect(MUSCLE_REGIONS[m].back?.length ?? 0).toBeGreaterThan(0);
  });

  it('left/right paths are mirrored (same number of commands)', () => {
    for (const m of MUSCLE_GROUPS) {
      for (const paths of [MUSCLE_REGIONS[m].front, MUSCLE_REGIONS[m].back]) {
        if (paths?.length === 2) expect(commandCount(paths[0])).toBe(commandCount(paths[1]));
      }
    }
  });
});
