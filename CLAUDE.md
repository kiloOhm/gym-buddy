# Gym Buddy

Offline-only workout planner and tracker for Android, built with Expo (React Native) and TypeScript. No network calls, no accounts. All data lives on the device.

See AGENTS.md for Expo-specific rules (Expo Router, `npx expo install`, docs lookup).

## Layout

- `src/types/index.ts` — shared domain types. The single source of truth; change here first.
- `src/data/exercises.ts` — built-in exercise database `BUILT_IN_EXERCISES` (muscle activation 0..1 per muscle, difficulty 1-5, equipment, movement pattern, cues) plus the runtime registry: `getExercises()` / `getExerciseMap()` / `getExercise(id)` return the library actually in use (built-ins merged with the user's imported `customExercises`). Never read `BUILT_IN_EXERCISES` for display or logic; in components use `useExerciseLibrary()` / `useExerciseMap()` from the store so screens re-render after an import. `src/data/seedPlans.ts` — the example plans created on first launch.
- `src/logic/` — pure functions, no React: muscle coverage of a plan, alternative-exercise suggestions, rep-range strength stats, weekly muscle load, ID helpers. Fully unit tested.
- `src/store/` — zustand store persisted to AsyncStorage on native and IndexedDB on web (`storage.ts` / `storage.web.ts`, which also migrates the old localStorage key) (plans, sessions, settings = the weight unit, customExercises). `customExercises` holds imported exercises: an entry with a built-in id overrides that built-in, new ids are additions (`mergeLibrary` in `src/logic/library.ts`). The store keeps the registry in sync via `setExerciseLibrary`.
- `src/app/` — Expo Router screens. Non-route code never lives here.
- `src/components/` — presentational components shared between screens. `BodyMap.tsx` draws the front/back muscle figure from the geometry in `bodyMapRegions.ts`.

## Conventions

- Keep it simple. No extra state libraries, no UI kits; plain React Native primitives + StyleSheet.
- Exercise IDs are stable slugs and must never change once shipped (sessions, plans and custom overrides reference them). This still holds for built-ins now that the library is importable: renaming a built-in id would orphan history and turn users' overrides into duplicates.
- Muscle activation: primary target = 1.0, strong secondary 0.5–0.7, stabiliser 0.2–0.3. These are editorial involvement estimates, not EMG data.
- `difficulty` (1–5) is the only exercise rating: an editorial score of how technically demanding and how unforgiving the exercise is, NOT a measured injury rate. Rate new entries against the anchors in the `src/data/exercises.ts` header. Alternatives prefer candidates that are not more demanding than the original; the plan summary shows average and hardest. Library files are version 2 (`difficulty`); version 1 files (`formDifficulty` + `injuryRisk`) still import via `difficultyFromLegacy` (ceil of the mean).
- Equipment lists every required item. `rack` (power rack / squat stand) is required by lifts that start from the hooks (back/front squat, good morning, rack pull, inverted row). Adding an `EQUIPMENT` value needs a pictogram glyph (`ExercisePictogram.tsx`). There is no user equipment setting: suggestions and lists never filter by equipment, they only show what each exercise needs.
- Weights are stored as entered, in the unit from settings; no conversion on save.
- A screen that mutates the store and then calls `router.back()` in the same handler (swap, pick-exercise) must render from a snapshot of the store state taken on mount, never from the live selector: the store update re-renders the screen while react-native-screens is already dismissing it, and a re-ordered keyed list there crashes Fabric on Android ("addViewAt: failed to insert view … already has a parent"). Guard the handler against a second tap.
- Never import `Alert` from react-native directly; use `alert` from `@/components/alert` (same signature). `Alert.alert` is a no-op on web; the wrapper falls back to `window.alert`/`window.confirm` (OK/Cancel only: OK runs the last non-cancel button).
- Never import `router` from expo-router; call `useRouter()` in each component that navigates (pass it into plain helpers). The module-level router is reset to a throwing stub when Android relaunches the Activity for a config change (font scale / density / language, expo/expo#51859: the new JS root binds it, the old root's cleanup then unbinds it), and the next navigation crashed the release build. `no-restricted-imports` in `eslint.config.js` enforces it.
- Rest-end alert: `src/store/rest.ts` mirrors `start`/`extend`/`clear` to one local notification (`src/store/restNotification.ts`, fixed id `rest-end`, channel `rest-timer`), because JS timers (and `RestTimer`'s `Vibration.vibrate`) pause in the background. Permission is asked lazily on the first rest; denied = in-app bar and vibration only. The handler hides banner/sound while the app is active (the in-app bar covers it). No-op on web.
- Exact timing: expo-notifications (`ExpoSchedulingDelegate.setupAlarm`) falls back to inexact `setAndAllowWhileIdle()` on Android 12+ unless `canScheduleExactAlarms()`, so app.json declares `USE_EXACT_ALARM` (auto-granted on 13+; OK because the app is sideloaded, Play restricts it) and `SCHEDULE_EXACT_ALARM` (Android 12/12L), and the trigger uses `delivery: 'alarmClock'` (`setAlarmClock()`, never deferred by OEM battery policies; shows the alarm icon in the status bar during a rest). Local notifications work in Expo Go, but the manifest permissions only apply to our own build (prebuild/APK).
- Deload advice: the rules live in `src/logic/deload.ts` (top-set e1RM strictly falling over the last 4 sessions of a lift, a muscle at high load in each of the last two weeks, six training weeks without a lighter week; no advice for 14 days after a finished deload session). The store keeps `deloadAdvice` and refreshes it after finishing or deleting a session, on hydration and when the app returns to the foreground (`_layout.tsx`). The reminder is one local notification on channel `deload-advice` scheduled for the next 09:00 (`src/store/deloadNotification.ts`; shared plumbing with the rest alert in `src/store/notifications.ts`); "Not now" on the Home card hides it and moves the reminder a week out (`snoozedUntil`). Deload sessions (`startDeloadSession`: half the sets, rounded up) carry `deload: true`.
- Web/PWA: `npm run build:web` = `expo export -p web` + `scripts/build-pwa.mjs` (injects manifest/theme/apple tags and the service-worker registration into `dist/index.html`, writes `404.html` + `.nojekyll` for GitHub Pages, generates `dist/sw.js` with a per-build cache). `public/` (manifest, icons) is copied verbatim into the export root. `WEB_BASE_URL` (e.g. `/gym-buddy`) sets `experiments.baseUrl` via `app.config.js` only when set; never hardcode it in app.json, the dev server reads it too. Native-only APIs (file system, sharing) need a `Platform.OS === 'web'` branch, see `src/logic/planFiles.ts`.

## Commands

```bash
npm test             # jest (jest-expo preset)
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo start       # dev server (press a for Android emulator)
npm run build:web    # PWA export to dist/ (WEB_BASE_URL=/gym-buddy for the Pages build)
```
