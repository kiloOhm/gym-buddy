namespace GymBuddy.Core.Logic;

/// <param name="SessionExercise">A copy of the session exercise being replaced, as it was when the swap screen opened.</param>
/// <param name="SessionIds">Exercise ids in the session at that moment; excluded from the suggestions.</param>
public sealed record SwapTarget(SessionExercise? SessionExercise, IReadOnlyList<string> SessionIds);

/// <summary>Swap-screen snapshot (src/logic/swap.ts).</summary>
public static class Swap
{
    /// <summary>
    /// Snapshot of what the swap screen needs, taken once on mount. The screen renders from this instead of the
    /// live session. Because GymStore mutates its models in place (the TS store replaces them), the session
    /// exercise is copied so later changes do not leak into the snapshot.
    /// </summary>
    public static SwapTarget SwapTargetSnapshot(WorkoutSession? session, string? sessionExerciseId)
    {
        var exercises = session?.Exercises ?? [];
        var found = exercises.FirstOrDefault(e => e.Id == sessionExerciseId);
        return new SwapTarget(found is null ? null : Clone(found), exercises.Select(e => e.ExerciseId).ToList());
    }

    private static SessionExercise Clone(SessionExercise e) => new()
    {
        Id = e.Id,
        ExerciseId = e.ExerciseId,
        SubstitutedFor = e.SubstitutedFor,
        TargetSets = e.TargetSets,
        TargetReps = e.TargetReps,
        RestSec = e.RestSec,
        Sets = e.Sets.Select(s => new SetLog { Reps = s.Reps, Weight = s.Weight, Completed = s.Completed }).ToList(),
    };
}
