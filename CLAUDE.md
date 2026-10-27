# Gym Buddy

Offline-only workout planner and tracker for Android, built with Expo (React Native) and TypeScript. No network calls, no accounts. All data lives on the device.

See AGENTS.md for Expo-specific rules (Expo Router, `npx expo install`, docs lookup).

## Layout

- `src/types/index.ts` — shared domain types. The single source of truth; change here first.
- `src/data/exercises.ts` — built-in exercise database `BUILT_IN_EXERCISES` (muscle activation 0..1 per muscle, difficulty 1-5, equipment, movement pattern, cues) plus the runtime registry: `getExercises()` / `getExerciseMap()` / `getExercise(id)` return the library actually in use (built-ins merged with the user's imported `customExercises`). Never read `BUILT_IN_EXERCISES` for display or logic; in components use `useExerciseLibrary()` / `useExerciseMap()` from the store so screens re-render after an import. `src/data/seedPlans.ts` — the example plans created on first launch.
- `src/logic/` — pure functions, no React: muscle coverage of a plan, alternative-exercise suggestions, rep-range strength stats, weekly muscle load, ID helpers. Fully unit tested.
- `src/store/` — zustand store persisted to AsyncStorage (plans, sessions, settings, customExercises). `customExercises` holds imported exercises: an entry with a built-in id overrides that built-in, new ids are additions (`mergeLibrary` in `src/logic/library.ts`). The store keeps the registry in sync via `setExerciseLibrary`.
- `src/app/` — Expo Router screens. Non-route code never lives here.
- `src/components/` — presentational components shared between screens. `BodyMap.tsx` draws the front/back muscle figure from the geometry in `bodyMapRegions.ts`.

## Conventions

- Keep it simple. No extra state libraries, no UI kits; plain React Native primitives + StyleSheet.
- Exercise IDs are stable slugs and must never change once shipped (sessions, plans and custom overrides reference them). This still holds for built-ins now that the library is importable: renaming a built-in id would orphan history and turn users' overrides into duplicates.
- Muscle activation: primary target = 1.0, strong secondary 0.5–0.7, stabiliser 0.2–0.3. These are editorial involvement estimates, not EMG data.
- `difficulty` (1–5) is the only exercise rating: an editorial score of how technically demanding and how unforgiving the exercise is, NOT a measured injury rate. Rate new entries against the anchors in the `src/data/exercises.ts` header. Alternatives prefer candidates that are not more demanding than the original; the plan summary shows average and hardest. Library files are version 2 (`difficulty`); version 1 files (`formDifficulty` + `injuryRisk`) still import via `difficultyFromLegacy` (ceil of the mean).
- Equipment lists every required item. `rack` (power rack / squat stand) is required by lifts that start from the hooks (back/front squat, good morning, rack pull, inverted row). Adding an `EQUIPMENT` value needs a pictogram glyph (`ExercisePictogram.tsx`) and, so existing users keep it switched on, a persist `migrate` step in `src/store/index.ts` (bump `PERSIST_VERSION`).
- Weights are stored as entered, in the unit from settings; no conversion on save.

## Commands

```bash
npm test             # jest (jest-expo preset)
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo start       # dev server (press a for Android emulator)
```
