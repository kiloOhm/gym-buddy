#!/usr/bin/env node
// Downloads demonstration photos for our exercises from the public-domain
// free-exercise-db dataset (https://github.com/yuhonas/free-exercise-db, Unlicense),
// shrinks them, and regenerates src/data/exerciseImages.ts.
//
//   node scripts/build-exercise-images.mjs          # download missing + regenerate
//   node scripts/build-exercise-images.mjs --map    # only regenerate the TS map
//
// Resizing uses macOS `sips`; on other systems the originals are kept.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const OUT = 'assets/exercises';
const MAP_FILE = 'src/data/exerciseImages.ts';
const MAX_WIDTH = 480;

/** our exercise id → free-exercise-db id (folder name). Unmapped ids use the pictogram. */
export const PHOTO_SOURCES = {
  barbell_bench_press: 'Barbell_Bench_Press_-_Medium_Grip',
  dumbbell_bench_press: 'Dumbbell_Bench_Press',
  push_up: 'Pushups',
  incline_barbell_bench_press: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  incline_dumbbell_bench_press: 'Incline_Dumbbell_Press',
  machine_chest_press: 'Machine_Bench_Press',
  chest_dip: 'Dips_-_Chest_Version',
  cable_fly: 'Cable_Crossover',
  pec_deck: 'Butterfly',
  dumbbell_fly: 'Dumbbell_Flyes',
  smith_machine_bench_press: 'Smith_Machine_Bench_Press',
  overhead_press: 'Standing_Military_Press',
  seated_dumbbell_shoulder_press: 'Dumbbell_Shoulder_Press',
  dumbbell_lateral_raise: 'Side_Lateral_Raise',
  cable_lateral_raise: 'Cable_Seated_Lateral_Raise',
  face_pull: 'Face_Pull',
  machine_shoulder_press: 'Machine_Shoulder_Military_Press',
  reverse_pec_deck: 'Reverse_Machine_Flyes',
  dumbbell_reverse_fly: 'Reverse_Flyes',
  band_pull_apart: 'Band_Pull_Apart',
  barbell_upright_row: 'Upright_Barbell_Row',
  behind_the_neck_press: 'Standing_Barbell_Press_Behind_Neck',
  pull_up: 'Pullups',
  lat_pulldown: 'Wide-Grip_Lat_Pulldown',
  barbell_row: 'Bent_Over_Barbell_Row',
  dumbbell_row: 'One-Arm_Dumbbell_Row',
  seated_cable_row: 'Seated_Cable_Rows',
  chin_up: 'Chin-Up',
  machine_row: 'Leverage_Iso_Row',
  weighted_pull_up: 'Weighted_Pull_Ups',
  inverted_row: 'Inverted_Row',
  straight_arm_pulldown: 'Straight-Arm_Pulldown',
  barbell_shrug: 'Barbell_Shrug',
  dumbbell_shrug: 'Dumbbell_Shrug',
  rack_pull: 'Rack_Pulls',
  back_extension: 'Hyperextensions_Back_Extensions',
  superman: 'Superman',
  snatch_grip_deadlift: 'Snatch_Deadlift',
  dumbbell_curl: 'Dumbbell_Bicep_Curl',
  barbell_curl: 'Barbell_Curl',
  hammer_curl: 'Hammer_Curls',
  ez_bar_curl: 'EZ-Bar_Curl',
  cable_curl: 'Standing_Biceps_Cable_Curl',
  preacher_curl: 'Preacher_Curl',
  cable_triceps_pushdown: 'Triceps_Pushdown',
  close_grip_bench_press: 'Close-Grip_Barbell_Bench_Press',
  ez_bar_skullcrusher: 'EZ-Bar_Skullcrusher',
  dumbbell_overhead_triceps_extension: 'Seated_Triceps_Press',
  triceps_dip: 'Dips_-_Triceps_Version',
  diamond_push_up: 'Push-Ups_-_Close_Triceps_Position',
  barbell_wrist_curl: 'Seated_Palm-Up_Barbell_Wrist_Curl',
  reverse_wrist_curl: 'Seated_Dumbbell_Palms-Down_Wrist_Curl',
  reverse_curl: 'Reverse_Barbell_Curl',
  plank: 'Plank',
  hanging_leg_raise: 'Hanging_Leg_Raise',
  cable_crunch: 'Cable_Crunch',
  crunch: 'Crunches',
  side_plank: 'Side_Bridge',
  pallof_press: 'Pallof_Press',
  dead_bug: 'Dead_Bug',
  cable_woodchop: 'Standing_Cable_Wood_Chop',
  lying_leg_raise: 'Flat_Bench_Lying_Leg_Raise',
  captains_chair_knee_raise: 'Knee_Hip_Raise_On_Parallel_Bars',
  barbell_rollout: 'Barbell_Ab_Rollout',
  barbell_back_squat: 'Barbell_Squat',
  leg_press: 'Leg_Press',
  leg_extension: 'Leg_Extensions',
  front_squat: 'Front_Barbell_Squat',
  goblet_squat: 'Goblet_Squat',
  hack_squat: 'Hack_Squat',
  smith_machine_squat: 'Smith_Machine_Squat',
  bodyweight_squat: 'Bodyweight_Squat',
  walking_lunge: 'Dumbbell_Lunges',
  bulgarian_split_squat: 'Split_Squat_with_Dumbbells',
  reverse_lunge: 'Dumbbell_Rear_Lunge',
  step_up: 'Dumbbell_Step_Ups',
  conventional_deadlift: 'Barbell_Deadlift',
  romanian_deadlift: 'Romanian_Deadlift',
  hip_thrust: 'Barbell_Hip_Thrust',
  lying_leg_curl: 'Lying_Leg_Curls',
  seated_leg_curl: 'Seated_Leg_Curl',
  dumbbell_romanian_deadlift: 'Stiff-Legged_Dumbbell_Deadlift',
  glute_bridge: 'Butt_Lift_Bridge',
  sumo_deadlift: 'Sumo_Deadlift',
  good_morning: 'Good_Morning',
  single_leg_romanian_deadlift: 'Kettlebell_One-Legged_Deadlift',
  cable_pull_through: 'Pull_Through',
  nordic_hamstring_curl: 'Natural_Glute_Ham_Raise',
  cable_glute_kickback: 'One-Legged_Cable_Kickback',
  hip_abductor_machine: 'Thigh_Abductor',
  hip_adductor_machine: 'Thigh_Adductor',
  band_lateral_walk: 'Monster_Walk',
  standing_calf_raise: 'Standing_Calf_Raises',
  seated_calf_raise: 'Seated_Calf_Raise',
  smith_machine_calf_raise: 'Smith_Machine_Calf_Raise',
  kettlebell_swing: 'One-Arm_Kettlebell_Swings',
  farmers_carry: 'Farmers_Walk',
  dumbbell_thruster: 'Kettlebell_Thruster',
  kettlebell_turkish_get_up: 'Kettlebell_Turkish_Get-Up_Lunge_style',
  power_clean: 'Power_Clean',
  incline_push_up: 'Incline_Push-Up',
  reverse_crunch: 'Reverse_Crunch',
  cable_overhead_triceps_extension: 'Cable_Rope_Overhead_Triceps_Extension',
};

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function shrink(file) {
  if (process.platform !== 'darwin') return;
  execFileSync('sips', ['-Z', String(MAX_WIDTH), '--setProperty', 'formatOptions', '72', file], { stdio: 'ignore' });
}

async function main() {
  const mapOnly = process.argv.includes('--map');
  mkdirSync(OUT, { recursive: true });
  if (!mapOnly) {
    let fetched = 0;
    for (const [ourId, srcId] of Object.entries(PHOTO_SOURCES)) {
      const dir = join(OUT, ourId);
      mkdirSync(dir, { recursive: true });
      for (const n of [0, 1]) {
        const dest = join(dir, `${n}.jpg`);
        if (existsSync(dest)) continue;
        try {
          await download(`${BASE}/${srcId}/${n}.jpg`, dest);
          shrink(dest);
          fetched++;
        } catch (e) {
          if (n === 0) console.warn(`! ${ourId}: ${e.message}`);
        }
      }
    }
    console.log(`downloaded ${fetched} files`);
  }
  const lines = [];
  for (const ourId of Object.keys(PHOTO_SOURCES).sort()) {
    const dir = join(OUT, ourId);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => /^\d\.jpg$/.test(f)).sort();
    if (files.length === 0) continue;
    const reqs = files.map((f) => `require('../../assets/exercises/${ourId}/${f}')`).join(', ');
    lines.push(`  ${ourId}: [${reqs}],`);
  }
  const ts = `// GENERATED by scripts/build-exercise-images.mjs — do not edit by hand.
// Demonstration photos (start / end position) bundled from the public-domain
// free-exercise-db dataset (https://github.com/yuhonas/free-exercise-db, Unlicense),
// keyed by our exercise id. Exercises without an entry fall back to a pictogram.
import type { ImageSourcePropType } from 'react-native';

export const EXERCISE_IMAGES: Readonly<Record<string, readonly ImageSourcePropType[]>> = {
${lines.join('\n')}
};
`;
  writeFileSync(MAP_FILE, ts);
  console.log(`wrote ${MAP_FILE} with ${lines.length} entries`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
