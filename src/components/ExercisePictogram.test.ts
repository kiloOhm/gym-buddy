import { EQUIPMENT, MOVEMENT_PATTERNS } from '@/types';

import { pictogramVariant } from './ExercisePictogram';

describe('pictogramVariant', () => {
  it('returns a glyph for every equipment value', () => {
    for (const equipment of EQUIPMENT) {
      const variant = pictogramVariant({ pattern: 'isolation', equipment: [equipment], compound: false });
      expect(variant).toBe(`isolation:${equipment === 'bodyweight' ? 'none' : equipment}`);
    }
  });

  it('returns a variant for every movement pattern', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(pictogramVariant({ pattern, equipment: ['barbell'], compound: true })).toBe(`${pattern}:barbell`);
    }
  });

  it('yields the bare pattern with glyph none for bodyweight-only exercises', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(pictogramVariant({ pattern, equipment: ['bodyweight'], compound: true })).toBe(`${pattern}:none`);
    }
    expect(pictogramVariant({ pattern: 'core', equipment: [], compound: false })).toBe('core:none');
  });

  it('picks by priority, not list order, when several items are listed', () => {
    expect(pictogramVariant({ pattern: 'horizontal_push', equipment: ['bench', 'dumbbell'], compound: true })).toBe(
      'horizontal_push:dumbbell',
    );
    expect(pictogramVariant({ pattern: 'vertical_pull', equipment: ['dumbbell', 'pull_up_bar'], compound: true })).toBe(
      'vertical_pull:pull_up_bar',
    );
  });
});
