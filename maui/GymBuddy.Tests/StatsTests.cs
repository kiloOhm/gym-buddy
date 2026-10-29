using GymBuddy.Core;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/stats.test.ts.</summary>
public class StatsTests
{
    private static readonly long NOW = Ms("2026-03-01T12:00:00Z");
    private static string DaysAgo(double d) => Iso(NOW - (long)(d * 24 * 60 * 60 * 1000));

    private static WorkoutSession Session(string id, string? finishedAt, string exerciseId, params (int Reps, double Weight, bool Completed)[] sets) => new()
    {
        Id = id,
        PlanName = "P",
        StartedAt = finishedAt ?? DaysAgo(0),
        FinishedAt = finishedAt,
        Exercises =
        [
            new SessionExercise
            {
                Id = $"{id}-e",
                ExerciseId = exerciseId,
                TargetSets = sets.Length,
                TargetReps = 6,
                RestSec = 60,
                Sets = sets.Select(s => new SetLog { Reps = s.Reps, Weight = s.Weight, Completed = s.Completed }).ToList(),
            },
        ],
    };

    [Theory]
    [InlineData(6, 5, 7)]
    [InlineData(8, 6, 10)]
    [InlineData(10, 8, 12)]
    [InlineData(15, 12, 18)]
    [InlineData(3, 2, 4)]
    public void repRange_target(int target, int min, int max)
    {
        Assert.Equal(new RepRange(min, max), Stats.RepRangeFor(target));
    }

    [Fact]
    public void repRange_clamps_the_lower_bound_at_1_for_tiny_targets()
    {
        Assert.Equal(new RepRange(1, 2), Stats.RepRangeFor(1));
        Assert.Equal(new RepRange(1, 3), Stats.RepRangeFor(2));
    }

    [Fact]
    public void Epley_estimates_a_1RM_treating_a_single_rep_as_the_1RM_itself()
    {
        Assert.Equal(133.33, Stats.EstimateOneRepMax(100, 10), 2);
        Assert.Equal(100, Stats.EstimateOneRepMax(100, 1));
    }

    [Fact]
    public void Epley_round_trips_and_converts_between_rep_counts()
    {
        Assert.Equal(100, Stats.EstimateWeightAtReps(100, 1, 1));
        Assert.True(Math.Abs(Stats.EstimateWeightAtReps(100, 10, 5) - 114.3) < 0.05);
        Assert.True(Math.Abs(Stats.EstimateWeightAtReps(100, 10, 1) - 133.3) < 0.05);
    }

    [Fact]
    public void exerciseStats_computes_best_last_and_30_day_average_from_in_range_sets()
    {
        WorkoutSession[] sessions =
        [
            Session("new", DaysAgo(2), "squat", (6, 90, true), (6, 85, true), (12, 120, true)),
            Session("mid", DaysAgo(10), "squat", (5, 87.5, true), (7, 87.5, true)),
            Session("old", DaysAgo(60), "squat", (6, 100, true)),
        ];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 6, NOW);
        // best 100: the 60-day-old session still counts; avg (90 + 85 + 87.5 + 87.5) / 4 without the old 100.
        Assert.Equal(new ExerciseStats(new RepRange(5, 7), 100, 90, 87.5, false, 5), stats);
    }

    [Fact]
    public void exerciseStats_uses_the_most_recent_session_with_in_range_sets_for_last_not_the_heaviest()
    {
        WorkoutSession[] sessions =
        [
            Session("heavy", DaysAgo(20), "squat", (6, 110, true)),
            Session("recent", DaysAgo(1), "squat", (6, 80, true), (6, 82.5, true)),
            Session("outOfRangeOnly", DaysAgo(0), "squat", (15, 60, true)),
        ];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 6, NOW);
        Assert.Equal(82.5, stats?.Last);
        Assert.Equal(110, stats?.Best);
    }

    [Fact]
    public void exerciseStats_leaves_avg30d_undefined_when_all_sessions_are_older_than_30_days()
    {
        var stats = Stats.ExerciseStatsFor([Session("old", DaysAgo(45), "squat", (6, 100, true))], "squat", 6, NOW);
        Assert.Null(stats?.Avg30d);
        Assert.Equal(100, stats?.Last);
    }

    [Fact]
    public void exerciseStats_approximates_from_other_rep_counts_when_nothing_is_in_range()
    {
        WorkoutSession[] sessions =
        [
            Session("a", DaysAgo(3), "squat", (10, 100, true)),
            Session("b", DaysAgo(40), "squat", (1, 140, true)),
        ];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 5, NOW);
        // 100×10 → 133.33 / (35/30) = 114.3 at 5 reps; 140×1 → 140 / (35/30) = 120.0
        Assert.Equal(new ExerciseStats(new RepRange(4, 6), 120, 114.3, 114.3, true, 2), stats);
    }

    [Fact]
    public void exerciseStats_ignores_uncompleted_sets_zero_weight_sets_and_unfinished_sessions()
    {
        WorkoutSession[] sessions =
        [
            Session("open", null, "squat", (6, 200, true)),
            Session("done", DaysAgo(1), "squat", (6, 150, false), (6, 0, true), (0, 90, true), (6, 70, true)),
        ];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 6, NOW)!;
        Assert.Equal((70.0, 70.0, 70.0, false, 1), (stats.Best!.Value, stats.Last!.Value, stats.Avg30d!.Value, stats.Approximate, stats.SampleCount));
    }

    [Fact]
    public void exerciseStats_returns_undefined_for_an_unknown_exercise_or_no_usable_sets()
    {
        WorkoutSession[] sessions = [Session("a", DaysAgo(1), "squat", (6, 100, true))];
        Assert.Null(Stats.ExerciseStatsFor(sessions, "bench", 6, NOW));
        Assert.Null(Stats.ExerciseStatsFor([Session("b", DaysAgo(1), "bench", (6, 0, true))], "bench", 6, NOW));
    }

    [Fact]
    public void exerciseStats_does_not_approximate_when_any_session_has_an_in_range_set()
    {
        WorkoutSession[] sessions =
        [
            Session("other", DaysAgo(1), "squat", (12, 100, true)),
            Session("match", DaysAgo(5), "squat", (6, 80, true)),
        ];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 6, NOW)!;
        Assert.Equal((80.0, 80.0, 80.0, false, 1), (stats.Best!.Value, stats.Last!.Value, stats.Avg30d!.Value, stats.Approximate, stats.SampleCount));
    }

    [Fact]
    public void exerciseStats_rounds_output_weights_to_one_decimal()
    {
        WorkoutSession[] sessions = [Session("a", DaysAgo(1), "squat", (6, 80.25, true), (6, 80.3, true), (6, 80.3, true))];
        var stats = Stats.ExerciseStatsFor(sessions, "squat", 6, NOW);
        Assert.Equal(80.3, stats?.Best);
        Assert.Equal(80.3, stats?.Avg30d); // 80.2833 → 80.3
    }
}
