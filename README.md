# Gym Buddy

An offline workout planner and tracker for Android. No accounts, no network: everything is stored on the phone.

## What it does

- **Home**: your recent workouts and a body map of how much each muscle group got in the last 7 days, with overtraining warnings (above 20 effective sets) and exercise suggestions for groups you haven't trained.
- **Exercise library** of 123 exercises. Each one records which muscle groups it hits and how much (0–1 per muscle, 1 = primary target), a single difficulty score (1–5: how technically demanding and how unforgiving the exercise is; an editorial rating, not a measured injury rate), the equipment it needs (barbell, dumbbells, power rack / squat stand, …), and a few coaching cues.
- **Plans**: build workout templates (exercise, sets, reps, rest). The plan editor shows a front/back body map and a bar chart of effective sets per muscle group, plus a summary of total sets, average difficulty and the hardest exercise, so you can see what a workout actually targets before you run it. A push / pull / legs / arms split is created on first launch to start from.
- **Workout**: start a plan, log weight and reps per set, tick sets off. Ticking a set starts a rest countdown for that exercise's rest time (with +30 s and Skip). When it ends the phone vibrates; if the app is in the background or the screen is off, a "Rest over" notification with sound and vibration fires on time instead (Android asks for notification permission on the first rest; the app also declares the exact-alarm permission so the alert isn't delayed, which puts an alarm icon in the status bar while a rest runs). The web app only vibrates while it is open. Each exercise shows your best, last and 30-day average weight for the target rep range (estimated via Epley from other rep counts when you have no sets in that range). If an exercise or its equipment isn't available, tap **Swap** to get ranked substitutes that hit the same muscles (each one lists the equipment it needs), preferring options that aren't more demanding than the original. Tap the ⓘ next to an exercise name to open its details (cues, muscles, substitutes).
- **Deload advice**: when your history shows signs of fatigue (a lift's estimated max falling over four sessions, a muscle group at high load two weeks running, or six training weeks without a lighter one), Home shows a "Time for a deload?" card with the reasons, and a reminder notification arrives at 9:00. One tap starts a deload workout from any plan: the same exercises with half the sets and a target of about 90 % of your last weight. "Not now" hides it and reminds you again a week later.
- **History**: finished sessions with volume, duration, per-exercise sets and the muscles worked.
- **Settings**: kg/lb, plan **export/import**, and exercise library export/import. Export picks the plans you want and shares a JSON file; import reads such a file, validates it against the exercise database, and skips plans whose content already exists (content hash). `gym-buddy-seed-plans.json` in this repo is an export of the four seeded plans, and `gym-buddy-exercises.json` is an export of the built-in exercise library to start editing from. **History export/import** moves your finished workouts to another phone, the browser or the MAUI app as one JSON file; workouts already in your history are skipped.
  - **Exercise library export/import**: export the whole library as a JSON file, edit it (add exercises, tweak ratings, muscles or cues) and import it back. Imported entries override built-ins with the same id or are added as new exercises, are used everywhere (library, picker, coverage, suggestions, stats) and survive restarts; *Reset to built-in library* drops them again.

## Library file format

The exercise library export (`gym-buddy-exercises.json` in this repo is the built-in library) is JSON:

```json
{
  "format": "gym-buddy-exercises",
  "version": 2,
  "exportedAt": "2026-10-28T00:00:00.000Z",
  "exercises": [
    {
      "id": "barbell_bench_press",
      "name": "Barbell bench press",
      "equipment": ["barbell", "bench"],
      "pattern": "horizontal_push",
      "compound": true,
      "muscles": { "chest": 1, "front_delts": 0.5, "triceps": 0.6 },
      "difficulty": 3,
      "cues": ["Pull shoulder blades back and down", "Touch the bar to your lower chest"]
    }
  ]
}
```

Exercise fields:

- `id`: stable slug (lowercase letters, digits, underscores). An entry with a built-in id overrides that built-in; a new id adds an exercise. Never rename an id you have used: workouts and plans reference it.
- `name`: display name.
- `equipment`: every item needed, from `barbell`, `dumbbell`, `kettlebell`, `cable`, `machine`, `smith_machine`, `ez_bar`, `band`, `bench`, `rack` (power rack / squat stand), `pull_up_bar`, `dip_station`, `bodyweight`. Use `["bodyweight"]` only when nothing else is needed.
- `pattern`: `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `squat`, `hinge`, `lunge`, `carry`, `core` or `isolation`.
- `compound`: `true` for multi-joint lifts.
- `muscles`: editorial involvement estimate per muscle group, above 0 and at most 1. The primary target gets 1, strong secondaries about 0.5–0.7, stabilisers 0.2–0.3. If no muscle is at 1 the values are scaled up on import.
- `difficulty`: integer 1–5, an editorial rating of how technically demanding and how unforgiving the exercise is. It is not a measured injury rate. Anchors:
  - 1: machine chest press, leg extension, pec deck, cable lateral raise, push-up
  - 2: dumbbell bench press, leg press, lat pulldown, seated cable row, dumbbell curl
  - 3: barbell bench press, barbell row, overhead press, kettlebell swing, Bulgarian split squat, hip thrust, pull-up
  - 4: barbell back squat, front squat, Romanian deadlift, weighted pull-up, barbell upright row, rack pull
  - 5: conventional deadlift, snatch-grip deadlift, good morning, behind-the-neck press, power clean

  Out-of-range or fractional values are rounded and clamped with a warning; an entry without a numeric difficulty is skipped.
- `cues`: up to 4 short coaching cues (optional).

Version 1 files, which had `formDifficulty` and `injuryRisk` (both 1–5) instead of `difficulty`, still import: each entry gets `difficulty` = the mean of the two rounded up, clamped to 1–5, and the import shows the warning "Converted form/injury ratings to the single difficulty score".

The plan export (`gym-buddy-seed-plans.json` is an example) is `{ "format": "gym-buddy-plans", "version": 1, "exportedAt", "plans": [{ "name", "exercises": [{ "exerciseId", "sets", "reps", "restSec" }] }] }`. Exercise ids must exist in the library; unknown ones are skipped with a warning, and plans whose content matches an existing plan are not imported twice.

## History file format

The history export (`gym-buddy-history-YYYY-MM-DD.json`) is JSON, written in exactly this field order with 2-space indentation so the Expo and MAUI apps produce the same file:

```json
{
  "format": "gym-buddy-history",
  "version": 1,
  "exportedAt": "2026-10-29T15:04:05.123Z",
  "weightUnit": "kg",
  "sessions": [
    {
      "id": "mh3k2x9abc123",
      "planId": "mh3k2x8plan01",
      "planName": "Push",
      "startedAt": "2026-10-29T14:12:00.000Z",
      "finishedAt": "2026-10-29T14:26:30.000Z",
      "deload": true,
      "exercises": [
        {
          "id": "mh3k2x9ex0001",
          "exerciseId": "dumbbell_bench_press",
          "substitutedFor": "barbell_bench_press",
          "targetSets": 5,
          "targetReps": 6,
          "restSec": 150,
          "sets": [
            {
              "reps": 6,
              "weight": 80,
              "completed": true
            }
          ]
        }
      ]
    }
  ]
}
```

- Only finished workouts are exported, newest first; the workout in progress never is. `planId` and `substitutedFor` are left out when absent; `deload` (the workout was logged as a deload) is written only when it is `true` or `false`.
- `weightUnit` is the exporting app's setting. Weights are copied as entered, never converted; importing into an app set to the other unit shows a warning.
- Workouts are matched by `id`: one already in your history (or repeated in the file) is skipped. Workouts without an id, an unparseable `finishedAt`/`startedAt` or an exercise list are skipped with a warning; broken exercises and sets are dropped or fixed up (counts default to 0) with a warning. Exercise ids not in the library are kept, so the history survives a missing custom exercise.

## Run it

Requirements: Node 22, Android Studio with an emulator or a phone with USB debugging.

```bash
npm install
npx expo start
```

Press `a` to open it on a running emulator (Expo Go is installed automatically), or scan the QR code with the Expo Go app on your phone.

## Install on your phone

Every push to the main branch builds a release APK on GitHub Actions and attaches it to the rolling **latest** pre-release:
https://github.com/kiloOhm/gym-buddy/releases/tag/latest

Open that page on your phone, download `gym-buddy.apk`, and allow installs from your browser when Android asks. The APK is signed with the standard debug keystore, which is fine for personal sideloading but not for the Play Store. The same file is also available as a workflow artifact on the Actions tab.

## Web app

The same app runs in the browser as an installable PWA, deployed to GitHub Pages on every push to the main branch (one-time setup: repository Settings → Pages → Source: "GitHub Actions"):
https://kiloohm.github.io/gym-buddy/

After the first visit it works fully offline (a service worker caches the app and the exercise photos). To install it:

- **Android (Chrome):** menu ⋮ → "Install app" (or "Add to Home screen").
- **iOS (Safari):** Share → "Add to Home Screen".
- **Desktop (Chrome/Edge):** the install icon at the right of the address bar.

Your data is stored in that browser's IndexedDB on that device (migrated automatically from the earlier localStorage key), separate from the Android app and from other browsers. To move plans or a custom exercise library between them, use export and import in Settings: on the web, export downloads the JSON file and import opens a file chooser. Clearing the site data in the browser deletes everything.

Updates are downloaded in the background but only take effect once every window/tab of the app has been closed and the app is opened again.

Build and serve it locally:

```bash
npm run build:web                          # expo export -p web + scripts/build-pwa.mjs → dist/
npx expo serve                             # or any static file server on dist/
WEB_BASE_URL=/gym-buddy npm run build:web  # reproduces the GitHub Pages build (served under /gym-buddy/)
```

## Build an installable APK locally

Expo generates the native project on demand; you don't edit `android/` by hand.

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npx expo run:android --variant release
```

This builds and installs a release build on the connected device/emulator. The APK ends up under `android/app/build/outputs/apk/release/`. (Needs JDK 17 or 21; the one bundled with Android Studio works.)

## Develop

```bash
npm test             # unit tests for the exercise data and the logic
npm run typecheck
npx expo lint
```

See `CLAUDE.md` for the code layout and conventions.
