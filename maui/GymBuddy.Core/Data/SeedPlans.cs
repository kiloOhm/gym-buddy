namespace GymBuddy.Core.Data;

public sealed record SeedExercise(string ExerciseId, int Sets, int Reps, int RestSec);

public sealed record SeedPlan(string Name, IReadOnlyList<SeedExercise> Exercises);

/// <summary>
/// Example plans created on first launch: a push / pull / legs / arms split, five exercises per day
/// (src/data/seedPlans.ts). Exercise ids must exist in the built-in library (the tests check this).
/// </summary>
public static class SeedPlans
{
    private static SeedExercise Ex(string exerciseId, int sets, int reps, int restSec) => new(exerciseId, sets, reps, restSec);

    public static readonly IReadOnlyList<SeedPlan> All =
    [
        new("Push",
        [
            Ex("barbell_bench_press", 4, 6, 150),
            Ex("overhead_press", 3, 8, 120),
            Ex("incline_dumbbell_bench_press", 3, 10, 90),
            Ex("dumbbell_lateral_raise", 3, 15, 60),
            Ex("cable_triceps_pushdown", 3, 12, 60),
        ]),
        new("Pull",
        [
            Ex("conventional_deadlift", 3, 5, 180),
            Ex("pull_up", 3, 8, 120),
            Ex("barbell_row", 3, 8, 120),
            Ex("seated_cable_row", 3, 12, 90),
            Ex("face_pull", 3, 15, 60),
        ]),
        new("Legs",
        [
            Ex("barbell_back_squat", 4, 6, 180),
            Ex("romanian_deadlift", 3, 8, 120),
            Ex("leg_press", 3, 12, 90),
            Ex("walking_lunge", 3, 10, 90),
            Ex("standing_calf_raise", 4, 12, 60),
        ]),
        new("Arms",
        [
            Ex("close_grip_bench_press", 3, 8, 120),
            Ex("ez_bar_curl", 3, 10, 90),
            Ex("ez_bar_skullcrusher", 3, 10, 90),
            Ex("hammer_curl", 3, 12, 60),
            Ex("dumbbell_overhead_triceps_extension", 3, 12, 60),
        ]),
    ];
}
