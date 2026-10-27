import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { EXERCISE_IMAGES } from '@/data/exerciseImages';
import { colors, radius, spacing } from '@/theme';
import type { Exercise } from '@/types';

import { ExercisePictogram } from './ExercisePictogram';

interface Props {
  exercise: Exercise;
  variant: 'thumb' | 'hero';
  /** Thumb edge length in px (default 56). Ignored for 'hero'. */
  size?: number;
}

/** True when bundled demonstration photos exist for this exercise id. */
export function hasExercisePhotos(exerciseId: string): boolean {
  return (EXERCISE_IMAGES[exerciseId]?.length ?? 0) > 0;
}

/** Bundled demonstration photo(s) for an exercise, falling back to its procedural pictogram. */
export function ExerciseFigure({ exercise, variant, size = 56 }: Props) {
  // Percentage widths on bundled images are unreliable on Android, so the hero measures
  // itself and gives each photo an explicit pixel size.
  const [heroWidth, setHeroWidth] = useState(0);
  const photos = EXERCISE_IMAGES[exercise.id] ?? [];
  const photoLabel = `${exercise.name} demonstration`;
  const pictogramLabel = `${exercise.name} pictogram`;

  if (variant === 'thumb') {
    const box = { width: size, height: size };
    return photos.length > 0 ? (
      <Image
        source={photos[0]}
        resizeMode="cover"
        style={[styles.thumb, box]}
        accessibilityLabel={photoLabel}
        accessibilityRole="image"
      />
    ) : (
      <View style={[styles.thumb, box]} accessibilityLabel={pictogramLabel} accessibilityRole="image">
        <ExercisePictogram exercise={exercise} size={size} />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.hero, styles.heroEmpty]} accessibilityLabel={pictogramLabel} accessibilityRole="image">
        <ExercisePictogram exercise={exercise} size={140} />
        <Text style={styles.caption}>No photo for this exercise</Text>
      </View>
    );
  }

  const shown = photos.slice(0, 2);
  const inner = Math.max(0, heroWidth - spacing.sm * 2);
  const photoWidth = shown.length === 2 ? Math.floor((inner - spacing.sm) / 2) : Math.floor(inner * 0.72);
  const photoSize = { width: photoWidth, height: Math.round((photoWidth * 3) / 4) };
  return (
    <View
      style={[styles.hero, styles.heroRow, shown.length === 1 && styles.heroSingle]}
      onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}
    >
      {shown.map((source, i) => (
        <View key={i} style={styles.photo}>
          <Image
            source={source}
            resizeMode="contain"
            style={[styles.photoImage, photoSize]}
            accessibilityLabel={shown.length === 2 ? `${photoLabel}, ${i === 0 ? 'start' : 'end'} position` : photoLabel}
            accessibilityRole="image"
          />
          {shown.length === 2 ? <Text style={styles.caption}>{i === 0 ? 'Start' : 'End'}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm },
  heroEmpty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSingle: { justifyContent: 'center' },
  photo: { gap: spacing.xs, alignItems: 'center' },
  photoImage: { borderRadius: radius.sm, backgroundColor: colors.card },
  caption: { fontSize: 11, color: colors.muted },
});
