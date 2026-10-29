using GymBuddy.Core;
using GymBuddy.Core.Logic;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/history.test.ts.</summary>
public class HistoryTests
{
    private static WorkoutSession Session(string id, string finishedAt, string exerciseId, params (int Reps, double Weight, bool Completed)[] sets) => new()
    {
        Id = id,
        PlanName = "P",
        StartedAt = finishedAt,
        FinishedAt = finishedAt,
        Exercises =
        [
            new SessionExercise
            {
                Id = $"{id}-e",
                ExerciseId = exerciseId,
                TargetSets = sets.Length,
                TargetReps = 10,
                RestSec = 60,
                Sets = sets.Select(s => new SetLog { Reps = s.Reps, Weight = s.Weight, Completed = s.Completed }).ToList(),
            },
        ],
    };

    [Fact]
    public void lastPerformance_returns_the_newest_finished_session_with_completed_sets()
    {
        WorkoutSession[] sessions =
        [
            Session("old", "2026-01-01T10:00:00Z", "squat", (10, 60, true)),
            Session("new", "2026-02-01T10:00:00Z", "squat", (8, 80, true), (8, 80, false)),
        ];
        var lp = History.LastPerformanceOf(sessions, "squat");
        Assert.Equal("2026-02-01T10:00:00Z", lp?.Date);
        var set = Assert.Single(lp!.Sets);
        Assert.Equal((8, 80.0, true), (set.Reps, set.Weight, set.Completed));
    }

    [Fact]
    public void lastPerformance_skips_sessions_where_nothing_was_completed()
    {
        Assert.Null(History.LastPerformanceOf([Session("s", "2026-01-01T10:00:00Z", "squat", (10, 60, false))], "squat"));
    }

    [Fact]
    public void bestWeight_finds_the_heaviest_completed_set()
    {
        WorkoutSession[] sessions =
        [
            Session("a", "2026-01-01T10:00:00Z", "squat", (10, 60, true), (5, 100, false)),
            Session("b", "2026-01-02T10:00:00Z", "squat", (5, 90, true)),
        ];
        Assert.Equal(90, History.BestWeight(sessions, "squat"));
        Assert.Null(History.BestWeight(sessions, "bench"));
    }
}
