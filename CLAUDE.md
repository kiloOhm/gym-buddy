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
- Rest-end alert: `src/store/rest.ts` mirrors `start`/`extend`/`clear` to one local notification (`src/store/restNotification.ts`, fixed id `rest-end`, channel `rest-timer`), because JS timers (and `RestTimer`'s `Vibration.vibrate`) pause in the background. Permission is asked lazily on the first rest; denied = in-app bar and vibration only. The handler hides banner/sound while the app is active (the in-app bar covers it). No-op on web.
- Exact timing: expo-notifications (`ExpoSchedulingDelegate.setupAlarm`) falls back to inexact `setAndAllowWhileIdle()` on Android 12+ unless `canScheduleExactAlarms()`, so app.json declares `USE_EXACT_ALARM` (auto-granted on 13+; OK because the app is sideloaded, Play restricts it) and `SCHEDULE_EXACT_ALARM` (Android 12/12L), and the trigger uses `delivery: 'alarmClock'` (`setAlarmClock()`, never deferred by OEM battery policies; shows the alarm icon in the status bar during a rest). Local notifications work in Expo Go, but the manifest permissions only apply to our own build (prebuild/APK).
- Web/PWA: `npm run build:web` = `expo export -p web` + `scripts/build-pwa.mjs` (injects manifest/theme/apple tags and the service-worker registration into `dist/index.html`, writes `404.html` + `.nojekyll` for GitHub Pages, generates `dist/sw.js` with a per-build cache). `public/` (manifest, icons) is copied verbatim into the export root. `WEB_BASE_URL` (e.g. `/gym-buddy`) sets `experiments.baseUrl` via `app.config.js` only when set; never hardcode it in app.json, the dev server reads it too. Native-only APIs (file system, sharing) need a `Platform.OS === 'web'` branch, see `src/logic/planFiles.ts`.

## Commands

```bash
npm test             # jest (jest-expo preset)
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo start       # dev server (press a for Android emulator)
npm run build:web    # PWA export to dist/ (WEB_BASE_URL=/gym-buddy for the Pages build)
```

## MAUI port (`maui/`, branch `maui`)

A native Android rebuild with .NET MAUI (C#, .NET 10, `net10.0-android` only). The Expo sources above stay the porting reference and the data source. Solution `maui/GymBuddy.sln`, three projects:

- `maui/GymBuddy.Core/` — plain `net10.0` library, no MAUI dependency, so it builds and tests with any .NET 10 SDK. `Types/` (enums with slug tables `Muscles`/`Equipments`/`MovementPatterns`/`WeightUnits`, the immutable `Exercise` record with deep equality, mutable plan/session models, `GymJson` options that reproduce `JSON.stringify` output), `Data/` (`BuiltInExercises.g.cs` and `ExerciseImages.g.cs` are GENERATED by `maui/scripts/generate-exercises.mjs` from `src/data/exercises.ts` and `assets/exercises/`; never edit them, re-run `node maui/scripts/generate-exercises.mjs` and commit; `SeedPlans.cs`), `Logic/` (1:1 ports of `src/logic`, same rounding, ordering and message texts; `JsMath`/`JsJson`/`LocaleComparer` reproduce the JavaScript semantics the TypeScript relies on), `Store/` (`GymStore` = the zustand store: one JSON file `gym-buddy-v1.json` in `FileSystem.AppDataDirectory` with the same `{"state":{…},"version":2}` envelope and the same migrations, write-through, `Changed` event; `RestTimer` + `IRestAlarm`), `Geometry/` (`BodyMapRegions`, `Pictogram` poses).
- `maui/GymBuddy/` — the MAUI app: Shell with the five tabs and routes, MVVM with CommunityToolkit.Mvvm, `Controls/` (BodyMap as `GraphicsView`/`IDrawable` from the Core geometry, pictogram, steppers, rest bar), `Platforms/Android/` (rest-end alarm via `AlarmManager.setAlarmClock` + `NotificationCompat`, channel `rest-timer`). Photos are bundled as MauiAssets `exercises/<id>/0.jpg` straight from `assets/exercises`. Plain MAUI controls, no UI kits.
- `maui/GymBuddy.Tests/` — xunit ports of every `*.test.ts` (same names and expected values) plus round-trip tests that pin the plan/library file formats byte-for-byte against `Fixtures/`.

Rules: exchange files (`gym-buddy-plans` v1, `gym-buddy-exercises` v2/v1, `gym-buddy-history` v1) must stay byte-compatible with the TypeScript app (the history file is the only way to move past workouts between the two apps, see `src/logic/historyExport.ts` / `maui/GymBuddy.Core/Logic/HistoryExport.cs`); slugs are the wire format; exercise ids never change; Core never references MAUI; logic takes the exercise `db` dictionary and `nowMs` explicitly (no globals). The package id is `de.lukas.gymbuddy.maui` so both apps install side by side.

Emulator checks: drive the APK with `adb shell input` and read screens with `adb shell uiautomator dump` plus `adb exec-out screencap -p`. The dump fails ("could not get idle state") on the active Workout page because the elapsed clock changes a label every second, and a failed dump leaves the previous `/sdcard/ui.xml` in place, so delete it before each dump and rely on screenshots there. A fresh install resets `POST_NOTIFICATIONS`; grant it with `adb shell pm grant de.lukas.gymbuddy.maui android.permission.POST_NOTIFICATIONS` before testing the background rest alarm.

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"; export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
dotnet test maui/GymBuddy.Tests/GymBuddy.Tests.csproj                                   # unit tests, no Android needed
dotnet build maui/GymBuddy.sln -c Release                                               # needs the maui-android workload
dotnet publish maui/GymBuddy/GymBuddy.csproj -f net10.0-android -c Release -o out       # APK: out/de.lukas.gymbuddy.maui-Signed.apk
node maui/scripts/generate-exercises.mjs                                                # regenerate the C# exercise data
```
