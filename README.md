# Gym Buddy

An offline workout planner and tracker for Android. No accounts, no network: everything is stored on the phone.

## What it does

- **Home**: your recent workouts and a body map of how much each muscle group got in the last 7 days, with overtraining warnings (above 20 effective sets) and exercise suggestions for groups you haven't trained.
- **Exercise library** of 117 exercises. Each one records which muscle groups it hits and how hard (0–1 per muscle), how technical it is to keep good form (1–5), how injury-prone it is (1–5), the equipment it needs, and a few coaching cues.
- **Plans**: build workout templates (exercise, sets, reps, rest). The plan editor shows a front/back body map and a bar chart of effective sets per muscle group, plus a difficulty/injury-risk summary, so you can see what a workout actually targets before you run it. A push / pull / legs / arms split is created on first launch to start from.
- **Workout**: start a plan, log weight and reps per set, tick sets off. Ticking a set starts a rest countdown for that exercise's rest time (with +30 s and Skip; the phone vibrates when it ends). Each exercise shows your best, last and 30-day average weight for the target rep range (estimated via Epley from other rep counts when you have no sets in that range). If an exercise or its equipment isn't available, tap **Swap** to get ranked substitutes that hit the same muscles with the equipment you have, preferring options that aren't harder or riskier than the original.
- **History**: finished sessions with volume, duration, per-exercise sets and the muscles worked.
- **Settings**: the equipment you have access to (filters suggestions and the library), kg/lb, and plan **export/import**. Export picks the plans you want and shares a JSON file; import reads such a file, validates it against the exercise database, and skips plans whose content already exists (content hash). `gym-buddy-seed-plans.json` in this repo is an export of the four seeded plans, and `gym-buddy-exercises.json` is an export of the built-in exercise library to start editing from.
  - **Exercise library export/import**: export the whole library as a JSON file, edit it (add exercises, tweak ratings, muscles or cues) and import it back. Imported entries override built-ins with the same id or are added as new exercises, are used everywhere (library, picker, coverage, suggestions, stats) and survive restarts; *Reset to built-in library* drops them again.

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
