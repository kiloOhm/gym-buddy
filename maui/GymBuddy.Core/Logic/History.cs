namespace GymBuddy.Core.Logic;

/// <param name="Date">ISO finishedAt of the session.</param>
public sealed record LastPerformance(string Date, IReadOnlyList<SetLog> Sets);

/// <summary>Previous performance lookups (src/logic/history.ts).</summary>
public static class History
{
    /// <summary>Most recent finished session that contains the exercise, with its completed sets.</summary>
    public static LastPerformance? LastPerformanceOf(IEnumerable<WorkoutSession> sessions, string exerciseId)
    {
        // Newest first by ISO string, like the TS comparator (string comparison of finishedAt).
        var sorted = sessions
            .Where(s => !string.IsNullOrEmpty(s.FinishedAt))
            .OrderByDescending(s => s.FinishedAt, StringComparer.Ordinal);
        foreach (var session in sorted)
        {
            var ex = session.Exercises.FirstOrDefault(e => e.ExerciseId == exerciseId);
            if (ex is null) continue;
            var done = ex.Sets.Where(s => s.Completed).ToList();
            if (done.Count == 0) continue;
            return new LastPerformance(session.FinishedAt!, done);
        }
        return null;
    }

    /// <summary>Heaviest completed weight for an exercise across all sessions, or null.</summary>
    public static double? BestWeight(IEnumerable<WorkoutSession> sessions, string exerciseId)
    {
        double? best = null;
        foreach (var session in sessions)
            foreach (var ex in session.Exercises)
            {
                if (ex.ExerciseId != exerciseId) continue;
                foreach (var set in ex.Sets)
                    if (set.Completed && (best is null || set.Weight > best)) best = set.Weight;
            }
        return best;
    }
}
