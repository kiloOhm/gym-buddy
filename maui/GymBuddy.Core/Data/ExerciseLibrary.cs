namespace GymBuddy.Core.Data;

/// <summary>Lookup helpers for exercise lists. The library in use (built-ins merged with custom entries) lives in GymStore.</summary>
public static class ExerciseLibrary
{
    /// <summary>Exercises indexed by id; a later entry with the same id wins (like Object.fromEntries).</summary>
    public static IReadOnlyDictionary<string, Exercise> IndexById(IEnumerable<Exercise> exercises)
    {
        var map = new Dictionary<string, Exercise>(StringComparer.Ordinal);
        foreach (var e in exercises) map[e.Id] = e;
        return map;
    }

    /// <summary>The built-in exercises by id.</summary>
    public static IReadOnlyDictionary<string, Exercise> BuiltInById { get; } = IndexById(BuiltInExercises.All);
}
