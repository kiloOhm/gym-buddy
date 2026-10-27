// Geometry for the BodyMap figure. Dependency-free so it can be unit tested
// without rendering. Both views share the same 200 × 400 silhouette; every
// shape is defined for the figure's left half (x ≤ 100) and mirrored about
// x = 100 for the right half, so the figure is symmetric by construction.

import type { MuscleGroup } from '@/types';

export const BODY_VIEWBOX = { width: 200, height: 400 } as const;

type Pt = readonly [number, number];
type Poly = readonly Pt[];

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Closed polygon path: "M x y L x y ... Z". */
export function polygonPath(points: Poly): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`).join(' ') + ' Z';
}

export function mirrorPoints(points: Poly): Pt[] {
  return points.map(([x, y]) => [BODY_VIEWBOX.width - x, y] as const);
}

/** Left path + mirrored right path. */
function pair(points: Poly): string[] {
  return [polygonPath(points), polygonPath(mirrorPoints(points))];
}

// ---------------------------------------------------------------------------
// Left-half polygons. Shared vertices make neighbouring regions tile exactly.

// Shoulder cap (deltoid) split: the outer sliver is the side delt in both
// views; the rest is the front delt (front view) or rear delt (back view).
const SIDE_DELT: Poly = [[56, 68], [48, 80], [48, 98], [54, 90]];
const DELT_CAP: Poly = [[68, 65], [56, 68], [54, 90], [48, 98], [60, 104], [70, 96], [72, 72]];

const UPPER_ARM: Poly = [[48, 98], [60, 104], [70, 96], [66, 116], [62, 132], [46, 132]];
const FOREARM: Poly = [[46, 132], [62, 132], [60, 150], [54, 190], [40, 190], [43, 150]];
const LOWER_LEG: Poly = [[72, 288], [90, 288], [90, 310], [86, 350], [80, 362], [76, 362], [72, 340], [70, 310]];

// Front view
const TRAPS_FRONT: Poly = [[91, 50], [91, 62], [68, 65], [80, 57]];
const CHEST: Poly = [[100, 63], [91, 62], [68, 65], [72, 72], [70, 96], [80, 105], [88, 107], [100, 106]];
const OBLIQUES: Poly = [[70, 96], [80, 105], [88, 107], [88, 168], [76, 172], [77, 150], [74, 125]];
const ABS: Poly = [[88, 107], [100, 106], [100, 182], [90, 178], [88, 168]];
const HIP_FLEXORS: Poly = [[76, 172], [88, 168], [90, 178], [94, 192], [84, 200], [72, 184]];
const ADDUCTORS_FRONT: Poly = [[90, 178], [100, 182], [100, 202], [97, 212], [94, 240], [88, 220], [84, 200], [94, 192]];
const QUADS: Poly = [[72, 184], [84, 200], [88, 220], [94, 240], [92, 272], [86, 282], [76, 282], [70, 270], [67, 240], [68, 205]];

// Back view
const TRAPS_BACK: Poly = [[100, 52], [91, 50], [80, 57], [68, 65], [72, 72], [84, 76], [100, 92]];
const UPPER_BACK: Poly = [[72, 72], [84, 76], [100, 92], [100, 124], [88, 118], [76, 104], [70, 96]];
const LATS: Poly = [[70, 96], [76, 104], [88, 118], [100, 124], [100, 140], [88, 150], [77, 150], [74, 125]];
const LOWER_BACK: Poly = [[77, 150], [88, 150], [100, 140], [100, 178], [76, 172]];
const GLUTES: Poly = [[76, 172], [100, 178], [100, 202], [97, 212], [84, 216], [68, 205], [72, 184]];
const ADDUCTORS_BACK: Poly = [[84, 216], [97, 212], [94, 240], [93, 256], [88, 240]];
const HAMSTRINGS: Poly = [[68, 205], [84, 216], [88, 240], [93, 256], [92, 272], [86, 282], [76, 282], [70, 270], [67, 240]];

/** SVG path data per muscle group and view (left + mirrored right paths). */
export const MUSCLE_REGIONS: Record<MuscleGroup, { front?: string[]; back?: string[] }> = {
  chest: { front: pair(CHEST) },
  front_delts: { front: pair(DELT_CAP) },
  side_delts: { front: pair(SIDE_DELT), back: pair(SIDE_DELT) },
  rear_delts: { back: pair(DELT_CAP) },
  lats: { back: pair(LATS) },
  upper_back: { back: pair(UPPER_BACK) },
  traps: { front: pair(TRAPS_FRONT), back: pair(TRAPS_BACK) },
  lower_back: { back: pair(LOWER_BACK) },
  biceps: { front: pair(UPPER_ARM) },
  triceps: { back: pair(UPPER_ARM) },
  forearms: { front: pair(FOREARM), back: pair(FOREARM) },
  abs: { front: pair(ABS) },
  obliques: { front: pair(OBLIQUES) },
  quads: { front: pair(QUADS) },
  hamstrings: { back: pair(HAMSTRINGS) },
  glutes: { back: pair(GLUTES) },
  adductors: { front: pair(ADDUCTORS_FRONT), back: pair(ADDUCTORS_BACK) },
  hip_flexors: { front: pair(HIP_FLEXORS) },
  calves: { front: pair(LOWER_LEG), back: pair(LOWER_LEG) },
};

// ---------------------------------------------------------------------------
// Unassigned silhouette drawn underneath the regions (same for both views).

const TORSO_LEG_LEFT: Poly = [
  [100, 50], [91, 50], [80, 57], [68, 65], [72, 72], [70, 96], [74, 125], [77, 150], [76, 172],
  [72, 184], [68, 205], [67, 240], [70, 270], [72, 288], [70, 310], [72, 340], [76, 362],
  [80, 362], [86, 350], [90, 310], [90, 288], [92, 272], [94, 240], [97, 212], [100, 202],
];
const ARM: Poly = [
  [68, 65], [56, 68], [48, 80], [48, 98], [46, 132], [43, 150], [40, 190],
  [54, 190], [60, 150], [62, 132], [66, 116], [70, 96], [72, 72],
];
const HAND: Poly = [[40, 190], [54, 190], [55, 202], [50, 213], [42, 213], [37, 203]];
const FOOT: Poly = [[74, 358], [86, 354], [88, 372], [86, 384], [68, 384], [68, 377]];
const NECK: Poly = [[92, 40], [92, 56], [100, 58]];

const torsoAndLegs = [...TORSO_LEG_LEFT, ...mirrorPoints(TORSO_LEG_LEFT).reverse()];

/** Non-muscle outline paths: torso/legs, arms, hands, feet, neck. */
export const BODY_OUTLINE: string[] = [
  polygonPath(torsoAndLegs),
  ...pair(ARM),
  ...pair(HAND),
  ...pair(FOOT),
  polygonPath([...NECK, ...mirrorPoints(NECK).reverse()]),
];

/** Head ellipse. */
export const BODY_HEAD = { cx: 100, cy: 28, rx: 15, ry: 19 } as const;
