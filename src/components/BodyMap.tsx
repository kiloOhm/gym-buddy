import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { coverageLevel, type CoverageLevel } from '@/logic/coverage';
import { loadLevel, type LoadLevel } from '@/logic/load';
import { colors, radius, spacing } from '@/theme';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '@/types';

import { BODY_HEAD, BODY_OUTLINE, BODY_VIEWBOX, MUSCLE_REGIONS } from './bodyMapRegions';

export { MUSCLE_REGIONS } from './bodyMapRegions';

interface BodyMapProps {
  /** Effective sets (plan/session) or activation (exercise) per muscle. Missing = 0. */
  values: Partial<Record<MuscleGroup, number>>;
  /** 'level' colours by coverageLevel buckets (default, for plans/sessions);
   *  'relative' colours by value / max over the given values (for a single exercise's activation);
   *  'load' colours by loadLevel (weekly effective sets: untrained / low / good / over). */
  scale?: Scale;
  /** Called when a region is tapped. */
  onPressMuscle?: (muscle: MuscleGroup) => void;
  /** Highlighted muscle (thicker outline), e.g. the one the user tapped. */
  selected?: MuscleGroup;
  height?: number;
}

type Scale = 'level' | 'relative' | 'load';

const OUTLINE_FILL = '#F7F8FA';
const LEGEND: CoverageLevel[] = ['none', 'light', 'moderate', 'high'];

const LOAD_COLORS: Record<LoadLevel, string> = {
  none: colors.coverage.none,
  low: colors.coverage.light,
  good: colors.coverage.moderate,
  high: colors.danger,
};
const LOAD_LEGEND: { level: LoadLevel; label: string }[] = [
  { level: 'none', label: 'untrained' },
  { level: 'low', label: 'low' },
  { level: 'good', label: 'good' },
  { level: 'high', label: 'over' },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function fillFor(value: number, scale: Scale, max: number): string {
  if (scale === 'load') return LOAD_COLORS[loadLevel(value)];
  if (value <= 0) return colors.coverage.none;
  if (scale === 'level') return colors.coverage[coverageLevel(value)];
  const t = Math.min(1, value / max);
  return mix(colors.coverage.light, colors.coverage.high, t);
}

/** Front + back muscle map; each region is filled by its value. */
export function BodyMap({ values, scale = 'level', onPressMuscle, selected, height = 260 }: BodyMapProps) {
  const max = Math.max(0, ...MUSCLE_GROUPS.map((m) => values[m] ?? 0)) || 1;

  const renderView = (view: 'front' | 'back') => {
    // Draw the selected muscle last so its thicker outline is not covered.
    const order = [...MUSCLE_GROUPS].sort((a, b) => Number(a === selected) - Number(b === selected));
    return (
      <View style={styles.view} key={view}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${BODY_VIEWBOX.width} ${BODY_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <G fill={OUTLINE_FILL} stroke={colors.border} strokeWidth={1} strokeLinejoin="round">
            <Ellipse cx={BODY_HEAD.cx} cy={BODY_HEAD.cy} rx={BODY_HEAD.rx} ry={BODY_HEAD.ry} />
            {BODY_OUTLINE.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
          {order.map((m) =>
            (MUSCLE_REGIONS[m][view] ?? []).map((d, i) => {
              const isSelected = m === selected;
              return (
                <Path
                  key={`${m}-${i}`}
                  d={d}
                  fill={fillFor(values[m] ?? 0, scale, max)}
                  stroke={isSelected ? colors.text : colors.card}
                  strokeWidth={isSelected ? 2.5 : 1}
                  strokeLinejoin="round"
                  accessibilityLabel={MUSCLE_LABELS[m]}
                  onPress={onPressMuscle ? () => onPressMuscle(m) : undefined}
                />
              );
            }),
          )}
        </Svg>
        <Text style={styles.viewLabel}>{view === 'front' ? 'Front' : 'Back'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {renderView('front')}
        {renderView('back')}
      </View>
      {scale === 'level' ? (
        <View style={styles.legend}>
          {LEGEND.map((level) => (
            <View key={level} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colors.coverage[level] }]} />
              <Text style={styles.legendText}>{level}</Text>
            </View>
          ))}
        </View>
      ) : scale === 'load' ? (
        <View style={styles.legend}>
          {LOAD_LEGEND.map(({ level, label }, i) => (
            <View key={level} style={styles.legendItem}>
              {i > 0 ? <Text style={styles.legendText}>·</Text> : null}
              <View style={[styles.swatch, { backgroundColor: LOAD_COLORS[level] }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row' },
  view: { flex: 1, alignItems: 'center' },
  viewLabel: { marginTop: spacing.xs, fontSize: 12, color: colors.muted },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: radius.sm / 2 },
  legendText: { fontSize: 12, color: colors.muted },
});
