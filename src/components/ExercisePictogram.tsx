import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';

import { colors } from '@/theme';
import type { Equipment, Exercise, MovementPattern } from '@/types';

/** Equipment glyph drawn next to the figure; 'none' for bodyweight-only exercises. */
export type PictogramGlyph = Exclude<Equipment, 'bodyweight'> | 'none';

type PictogramExercise = Pick<Exercise, 'pattern' | 'equipment' | 'compound'>;

interface Props {
  exercise: PictogramExercise;
  /** Rendered width and height in px (square). */
  size?: number;
}

/**
 * Which equipment item wins when an exercise lists several (e.g. ['dumbbell', 'bench'] → dumbbell).
 * Apparatus that fixes the body position (Smith rails, rack, pull-up bar, dip bars) wins, then the
 * load the hands hold; bands and benches come last.
 */
const GLYPH_PRIORITY: readonly PictogramGlyph[] = [
  'smith_machine',
  'rack',
  'pull_up_bar',
  'dip_station',
  'barbell',
  'ez_bar',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'band',
  'bench',
];

export function pictogramGlyph(exercise: Pick<Exercise, 'equipment'>): PictogramGlyph {
  return GLYPH_PRIORITY.find((g) => (exercise.equipment as readonly string[]).includes(g)) ?? 'none';
}

/** `${pattern}:${glyph}`, e.g. "squat:barbell". Identifies the rendered variant. */
export function pictogramVariant(exercise: PictogramExercise): string {
  return `${exercise.pattern}:${pictogramGlyph(exercise)}`;
}

// ---------------------------------------------------------------------------
// Poses (viewBox 0 0 100 100, y down, floor at ~90)

type Pt = readonly [number, number];

interface Pose {
  head: Pt;
  /** Polylines for torso, arms, legs. */
  limbs: readonly (readonly Pt[])[];
  /** Hand positions (1-2); dumbbells / handles are drawn here. */
  hands: readonly Pt[];
  /** Centre of a long bar (barbell, EZ bar, Smith bar). */
  bar: Pt;
  /** Muted furniture that is part of the pose itself. */
  support?: 'bench' | 'floor' | 'seat';
}

const POSES = {
  vertical_push: {
    head: [50, 22],
    limbs: [
      [[50, 31], [50, 62]],
      [[50, 36], [36, 26], [34, 10]],
      [[50, 36], [64, 26], [66, 10]],
      [[50, 62], [42, 92]],
      [[50, 62], [58, 92]],
    ],
    hands: [[34, 10], [66, 10]],
    bar: [50, 10],
  },
  bench: {
    head: [18, 52],
    limbs: [
      [[27, 56], [62, 56]],
      [[32, 56], [32, 24]],
      [[62, 56], [76, 68], [76, 90]],
    ],
    hands: [[32, 24]],
    bar: [32, 22],
    support: 'bench',
  },
  pushup: {
    head: [18, 52],
    limbs: [
      [[26, 57], [88, 84]],
      [[30, 58], [30, 88]],
    ],
    hands: [[30, 88]],
    bar: [30, 88],
    support: 'floor',
  },
  standPress: {
    head: [38, 16],
    limbs: [
      [[38, 25], [38, 58]],
      [[38, 30], [56, 36], [74, 34]],
      [[38, 58], [30, 90]],
      [[38, 58], [48, 90]],
    ],
    hands: [[74, 34]],
    bar: [74, 34],
  },
  bentRow: {
    head: [22, 38],
    limbs: [
      [[30, 42], [62, 46]],
      [[34, 44], [38, 58], [40, 68]],
      [[62, 46], [58, 68], [62, 90]],
      [[62, 46], [68, 68], [72, 90]],
    ],
    hands: [[40, 68]],
    bar: [40, 70],
  },
  seatedRow: {
    head: [30, 30],
    limbs: [
      [[30, 39], [30, 66]],
      [[30, 44], [46, 54], [62, 48]],
      [[30, 66], [58, 66], [70, 80]],
    ],
    hands: [[62, 48]],
    bar: [62, 48],
    support: 'seat',
  },
  hang: {
    head: [50, 30],
    limbs: [
      [[50, 39], [50, 68]],
      [[50, 42], [38, 28], [34, 12]],
      [[50, 42], [62, 28], [66, 12]],
      [[50, 68], [44, 90]],
      [[50, 68], [56, 88]],
    ],
    hands: [[34, 12], [66, 12]],
    bar: [50, 11],
  },
  support: {
    head: [50, 16],
    limbs: [
      [[50, 25], [50, 56]],
      [[50, 30], [38, 40], [36, 52]],
      [[50, 30], [62, 40], [64, 52]],
      [[50, 56], [46, 74], [56, 86]],
    ],
    hands: [[36, 52], [64, 52]],
    bar: [50, 54],
  },
  squat: {
    head: [50, 18],
    limbs: [
      [[52, 27], [38, 56]],
      [[52, 32], [62, 40], [56, 30]],
      [[38, 56], [62, 64], [56, 90]],
      [[38, 56], [56, 72], [46, 90]],
    ],
    hands: [[57, 31]],
    bar: [52, 28],
  },
  hinge: {
    head: [22, 44],
    limbs: [
      [[30, 48], [64, 42]],
      [[34, 50], [38, 76]],
      [[64, 42], [62, 66], [64, 90]],
      [[64, 42], [70, 66], [72, 90]],
    ],
    hands: [[38, 76]],
    bar: [42, 78],
  },
  lunge: {
    head: [48, 14],
    limbs: [
      [[48, 23], [48, 54]],
      [[48, 28], [42, 54]],
      [[48, 54], [66, 66], [66, 90]],
      [[48, 54], [34, 84], [18, 88]],
    ],
    hands: [[42, 54]],
    bar: [48, 27],
  },
  carry: {
    head: [50, 14],
    limbs: [
      [[50, 23], [50, 56]],
      [[50, 28], [38, 56]],
      [[50, 28], [62, 56]],
      [[50, 56], [38, 90]],
      [[50, 56], [64, 88]],
    ],
    hands: [[38, 56], [62, 56]],
    bar: [50, 56],
  },
  core: {
    head: [16, 56],
    limbs: [
      [[24, 62], [88, 76]],
      [[26, 62], [26, 80], [40, 80]],
    ],
    hands: [[40, 80]],
    bar: [40, 78],
    support: 'floor',
  },
  isolation: {
    head: [46, 14],
    limbs: [
      [[46, 23], [46, 56]],
      [[46, 28], [38, 54]],
      [[46, 28], [54, 50], [66, 36]],
      [[46, 56], [38, 90]],
      [[46, 56], [54, 90]],
    ],
    hands: [[66, 36]],
    bar: [62, 37],
  },
} satisfies Record<string, Pose>;

type PoseKey = keyof typeof POSES;

const FREE_WEIGHTS: readonly PictogramGlyph[] = ['barbell', 'dumbbell', 'ez_bar', 'kettlebell', 'smith_machine', 'bench'];

function poseFor(pattern: MovementPattern, glyph: PictogramGlyph): PoseKey {
  // The apparatus decides the body position for these, whatever the pattern.
  if (glyph === 'pull_up_bar' || pattern === 'vertical_pull') return 'hang';
  if (glyph === 'dip_station') return 'support';
  if (pattern === 'horizontal_push') {
    if (FREE_WEIGHTS.includes(glyph)) return 'bench';
    return glyph === 'cable' || glyph === 'machine' ? 'standPress' : 'pushup';
  }
  if (pattern === 'horizontal_pull') {
    return glyph === 'cable' || glyph === 'machine' || glyph === 'band' ? 'seatedRow' : 'bentRow';
  }
  return pattern;
}

// ---------------------------------------------------------------------------
// Drawing

const pts = (line: readonly Pt[]) => line.map(([x, y]) => `${x},${y}`).join(' ');

function Support({ kind }: { kind: NonNullable<Pose['support']> }) {
  if (kind === 'floor') return <Line x1={6} y1={91} x2={94} y2={91} />;
  if (kind === 'seat') {
    return (
      <>
        <Line x1={14} y1={73} x2={44} y2={73} />
        <Line x1={28} y1={73} x2={28} y2={91} strokeWidth={3} />
      </>
    );
  }
  return <BenchShape y={64} />;
}

function BenchShape({ y }: { y: number }) {
  return (
    <>
      <Line x1={12} y1={y} x2={88} y2={y} />
      <Line x1={22} y1={y} x2={22} y2={91} strokeWidth={3} />
      <Line x1={78} y1={y} x2={78} y2={91} strokeWidth={3} />
    </>
  );
}

function wave(from: Pt, to: Pt, waves = 3, amp = 4): string {
  const [x0, y0] = from;
  const dx = (to[0] - x0) / (waves * 2);
  const dy = (to[1] - y0) / (waves * 2);
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal to the line, for the wave's control points.
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${x0},${y0}`;
  for (let i = 0; i < waves * 2; i++) {
    const s = i % 2 === 0 ? amp : -amp;
    const cx = x0 + dx * (i + 0.5) + nx * s;
    const cy = y0 + dy * (i + 0.5) + ny * s;
    d += ` Q${cx},${cy} ${x0 + dx * (i + 1)},${y0 + dy * (i + 1)}`;
  }
  return d;
}

/** Equipment drawn in primary blue; frames and rails in muted grey. */
function Glyph({ glyph, pose }: { glyph: PictogramGlyph; pose: Pose }) {
  const [bx, by] = pose.bar;
  const [hx, hy] = pose.hands[0];
  const accent = { stroke: colors.primary, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none' };
  const muted = { stroke: colors.muted, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };

  switch (glyph) {
    case 'barbell':
      return (
        <G {...accent}>
          <Line x1={bx - 27} y1={by} x2={bx + 27} y2={by} />
          <Line x1={bx - 22} y1={by - 8} x2={bx - 22} y2={by + 8} strokeWidth={5} />
          <Line x1={bx + 22} y1={by - 8} x2={bx + 22} y2={by + 8} strokeWidth={5} />
        </G>
      );
    case 'ez_bar':
      return (
        <G {...accent}>
          <Polyline
            points={pts([[bx - 22, by], [bx - 11, by], [bx - 6, by - 4], [bx, by], [bx + 6, by - 4], [bx + 11, by], [bx + 22, by]])}
          />
          <Line x1={bx - 19} y1={by - 6} x2={bx - 19} y2={by + 6} strokeWidth={5} />
          <Line x1={bx + 19} y1={by - 6} x2={bx + 19} y2={by + 6} strokeWidth={5} />
        </G>
      );
    case 'smith_machine':
      return (
        <>
          <G {...muted}>
            <Line x1={8} y1={4} x2={8} y2={94} />
            <Line x1={92} y1={4} x2={92} y2={94} />
          </G>
          <Line {...accent} x1={8} y1={by} x2={92} y2={by} />
        </>
      );
    case 'rack':
      // Two uprights with J-hooks; the bar sits at the pose's bar height.
      return (
        <>
          <G {...muted}>
            <Line x1={10} y1={4} x2={10} y2={94} />
            <Line x1={90} y1={4} x2={90} y2={94} />
            <Polyline points={pts([[10, by - 6], [15, by - 6], [15, by]])} />
            <Polyline points={pts([[90, by - 6], [85, by - 6], [85, by]])} />
          </G>
          <Line {...accent} x1={15} y1={by} x2={85} y2={by} />
        </>
      );
    case 'dumbbell':
      return (
        <G {...accent}>
          {pose.hands.map(([x, y], i) => (
            <G key={i}>
              <Line x1={x - 7} y1={y} x2={x + 7} y2={y} />
              <Line x1={x - 7} y1={y - 5} x2={x - 7} y2={y + 5} strokeWidth={5} />
              <Line x1={x + 7} y1={y - 5} x2={x + 7} y2={y + 5} strokeWidth={5} />
            </G>
          ))}
        </G>
      );
    case 'kettlebell':
      return (
        <>
          <Path {...accent} strokeWidth={3} d={`M${hx - 5},${hy + 3} Q${hx},${hy - 6} ${hx + 5},${hy + 3}`} />
          <Circle cx={hx} cy={hy + 9} r={7} fill={colors.primary} />
        </>
      );
    case 'cable': {
      const py = Math.min(90, Math.max(8, hy));
      return (
        <>
          <Line {...muted} x1={94} y1={4} x2={94} y2={94} />
          <Line {...accent} strokeWidth={2} x1={90} y1={py} x2={hx} y2={hy} />
          <Circle cx={90} cy={py} r={4} fill={colors.primary} />
        </>
      );
    }
    case 'machine':
      return (
        <>
          <Rect {...muted} x={5} y={5} width={90} height={88} rx={8} />
          <Line {...accent} strokeWidth={5} x1={hx - 6} y1={hy} x2={hx + 6} y2={hy} />
        </>
      );
    case 'band': {
      const to: Pt = hy < 70 ? [hx, 92] : [94, hy];
      return <Path {...accent} strokeWidth={2.5} d={wave([hx, hy], to)} />;
    }
    case 'pull_up_bar': {
      const y = Math.min(...pose.hands.map(([, y]) => y)) - 2;
      return <Line {...accent} x1={14} y1={y} x2={86} y2={y} />;
    }
    case 'dip_station': {
      const y = hy + 2;
      return (
        <>
          <G {...muted}>
            <Line x1={24} y1={y} x2={24} y2={94} />
            <Line x1={80} y1={y + 7} x2={80} y2={94} />
          </G>
          <G {...accent} strokeWidth={3.5}>
            <Line x1={20} y1={y} x2={76} y2={y} />
            <Line x1={26} y1={y + 7} x2={84} y2={y + 7} />
          </G>
        </>
      );
    }
    case 'bench':
      return (
        <G stroke={colors.muted} strokeWidth={5} strokeLinecap="round">
          <BenchShape y={72} />
        </G>
      );
    case 'none':
      return null;
  }
}

/** Procedural stick-figure pictogram from movement pattern + equipment; works for any exercise. */
export function ExercisePictogram({ exercise, size = 64 }: Props) {
  const glyph = pictogramGlyph(exercise);
  const pose: Pose = POSES[poseFor(exercise.pattern, glyph)];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {pose.support ? (
        <G stroke={colors.muted} strokeWidth={5} strokeLinecap="round" fill="none">
          <Support kind={pose.support} />
        </G>
      ) : null}
      <G opacity={0.85}>
        <G stroke={colors.text} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {pose.limbs.map((line, i) => (
            <Polyline key={i} points={pts(line)} />
          ))}
        </G>
        <Circle cx={pose.head[0]} cy={pose.head[1]} r={7} fill={colors.text} />
      </G>
      <Glyph glyph={glyph} pose={pose} />
    </Svg>
  );
}
