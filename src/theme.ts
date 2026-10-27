// Single place for colours, spacing and radii. Plain objects, no theming library.

export const colors = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  border: '#E3E5E8',
  text: '#15181C',
  muted: '#6B7280',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  coverage: {
    none: '#E3E5E8',
    light: '#93C5FD',
    moderate: '#3B82F6',
    high: '#1D4ED8',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
} as const;
