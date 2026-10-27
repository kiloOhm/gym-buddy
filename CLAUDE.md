# Gym Buddy

Offline-only workout planner and tracker for Android, built with Expo (React Native) and TypeScript. No network calls, no accounts. All data lives on the device.

See AGENTS.md for Expo-specific rules (Expo Router, `npx expo install`, docs lookup).

## Layout

- `src/types/index.ts` — shared domain types. The single source of truth; change here first.
- `src/data/exercises.ts` — static exercise database (muscle activation 0..1 per muscle, form difficulty 1-5, injury risk 1-5, equipment, movement pattern, cues). `src/data/seedPlans.ts` — the example plans created on first launch.
- `src/logic/` — pure functions, no React: muscle coverage of a plan, alternative-exercise suggestions, rep-range strength stats, weekly muscle load, ID helpers. Fully unit tested.
- `src/store/` — zustand store persisted to AsyncStorage (plans, sessions, settings).
- `src/app/` — Expo Router screens. Non-route code never lives here.
- `src/components/` — presentational components shared between screens. `BodyMap.tsx` draws the front/back muscle figure from the geometry in `bodyMapRegions.ts`.

## Conventions

- Keep it simple. No extra state libraries, no UI kits; plain React Native primitives + StyleSheet.
- Exercise IDs are stable slugs and must never change once shipped (sessions reference them).
- Muscle activation: primary target = 1.0, strong secondary 0.5–0.7, stabiliser 0.2–0.3.
- Weights are stored as entered, in the unit from settings; no conversion on save.

## Commands

```bash
npm test             # jest (jest-expo preset)
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo start       # dev server (press a for Android emulator)
```
