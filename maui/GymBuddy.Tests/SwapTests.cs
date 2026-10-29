using GymBuddy.Core;
using GymBuddy.Core.Logic;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/swap.test.ts.</summary>
public class SwapTests
{
    private static SessionExercise Sx(string id, string exerciseId) => new() { Id = id, ExerciseId = exerciseId, TargetSets = 3, TargetReps = 10, RestSec = 90, Sets = [] };

    private static WorkoutSession MakeSession() => new()
    {
        Id = "s1",
        PlanName = "Push",
        StartedAt = "2026-01-01T10:00:00.000Z",
        Exercises = [Sx("a", "barbell_bench"), Sx("b", "overhead_press")],
    };

    [Fact]
    public void finds_the_session_exercise_and_lists_the_session_exercise_ids()
    {
        var session = MakeSession();
        var snap = Swap.SwapTargetSnapshot(session, "b");
        // A copy (the C# store mutates in place), equal in content.
        Assert.Equal("b", snap.SessionExercise?.Id);
        Assert.Equal("overhead_press", snap.SessionExercise?.ExerciseId);
        Assert.Equal(["barbell_bench", "overhead_press"], snap.SessionIds);
    }

    [Fact]
    public void returns_no_session_exercise_for_an_unknown_id_or_no_session()
    {
        Assert.Null(Swap.SwapTargetSnapshot(MakeSession(), "zzz").SessionExercise);
        var none = Swap.SwapTargetSnapshot(null, "a");
        Assert.Null(none.SessionExercise);
        Assert.Empty(none.SessionIds);
        Assert.Empty(Swap.SwapTargetSnapshot(null, null).SessionIds);
    }

    [Fact]
    public void is_not_affected_by_later_changes_to_the_session()
    {
        var live = MakeSession();
        var snap = Swap.SwapTargetSnapshot(live, "a");
        live.Exercises[0].ExerciseId = "dumbbell_bench"; // in-place, like GymStore.SwapExercise
        live.Exercises.Add(Sx("c", "squat"));
        Assert.Equal("barbell_bench", snap.SessionExercise?.ExerciseId);
        Assert.Equal(["barbell_bench", "overhead_press"], snap.SessionIds);
    }
}
