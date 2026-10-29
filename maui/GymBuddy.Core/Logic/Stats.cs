namespace GymBuddy.Core.Logic;

public sealed record RepRange(int Min, int Max);

/// <param name="Best">Heaviest comparable set ever.</param>
/// <param name="Last">Top comparable set of the most recent session that has one.</param>
/// <param name="Avg30d">Mean of comparable sets in sessions finished within the last 30 days.</param>
/// <param name="Approximate">True when no completed set fell inside the rep range and the values were converted from other rep counts.</param>
/// <param name="SampleCount">Number of comparable sets used.</param>
public sealed record ExerciseStats(RepRange Range, double? Best, double? Last, double? Avg30d, bool Approximate, int SampleCount);

/// <summary>Rep-range strength stats (src/logic/stats.ts).</summary>
public static class Stats
{
    private const long DayMs = 24L * 60 * 60 * 1000;
    private const long AvgWindowMs = 30 * DayMs;

    /// <summary>Band around the target: half-width = max(1, round(target × 0.2)), min clamped to 1. 6 → 5–7, 8 → 6–10, 1 → 1–2.</summary>
    public static RepRange RepRangeFor(int targetReps)
    {
        var half = (int)Math.Max(1, JsMath.Round(targetReps * 0.2));
        var max = Math.Max(1, targetReps + half);
        return new RepRange(Math.Max(1, targetReps - half), max);
    }

    /// <summary>Epley factor; a single rep is the 1RM itself.</summary>
    private static double Epley(int reps) => reps <= 1 ? 1 : 1 + reps / 30.0;

    /// <summary>Epley 1RM: weight × (1 + reps / 30); a 1-rep set returns its weight unchanged.</summary>
    public static double EstimateOneRepMax(double weight, int reps) => weight * Epley(reps);

    /// <summary>Weight you could lift for targetReps given a set of weight × reps (via Epley both ways).</summary>
    public static double EstimateWeightAtReps(double weight, int reps, int targetReps) => EstimateOneRepMax(weight, reps) / Epley(targetReps);

    private static double Round1(double n) => JsMath.Round(n * 10) / 10;

    /// <summary>
    /// Best / last / 30-day average weight for an exercise at a target rep count. Only completed sets with
    /// weight &gt; 0 and reps &gt; 0 from finished sessions count. Sets inside RepRangeFor(targetReps) are used
    /// as-is; if there are none anywhere, every set is converted via Epley and Approximate is true.
    /// Null when the exercise has no usable sets.
    /// </summary>
    public static ExerciseStats? ExerciseStatsFor(IEnumerable<WorkoutSession> sessions, string exerciseId, int targetReps, long nowMs)
    {
        var range = RepRangeFor(targetReps);

        var all = new List<(long FinishedAt, List<(double Weight, int Reps)> Sets)>();
        foreach (var session in sessions)
        {
            if (string.IsNullOrEmpty(session.FinishedAt)) continue;
            if (Ids.ParseIsoMs(session.FinishedAt) is not { } finishedAt) continue;
            var sets = new List<(double Weight, int Reps)>();
            foreach (var ex in session.Exercises)
            {
                if (ex.ExerciseId != exerciseId) continue;
                foreach (var s in ex.Sets)
                    if (s.Completed && s.Weight > 0 && s.Reps > 0) sets.Add((s.Weight, s.Reps));
            }
            if (sets.Count > 0) all.Add((finishedAt, sets));
        }
        if (all.Count == 0) return null;

        bool InRange(int reps) => reps >= range.Min && reps <= range.Max;
        var approximate = !all.Any(s => s.Sets.Any(set => InRange(set.Reps)));

        var comparable = all
            .Select(x => (x.FinishedAt, Weights: approximate
                ? x.Sets.Select(s => EstimateWeightAtReps(s.Weight, s.Reps, targetReps)).ToList()
                : x.Sets.Where(s => InRange(s.Reps)).Select(s => s.Weight).ToList()))
            .Where(s => s.Weights.Count > 0)
            .ToList();

        var best = double.NegativeInfinity;
        var latest = comparable[0];
        var sampleCount = 0;
        double recentSum = 0;
        var recentCount = 0;
        foreach (var s in comparable)
        {
            sampleCount += s.Weights.Count;
            best = Math.Max(best, s.Weights.Max());
            if (s.FinishedAt > latest.FinishedAt) latest = s;
            if (s.FinishedAt >= nowMs - AvgWindowMs)
            {
                foreach (var w in s.Weights) recentSum += w;
                recentCount += s.Weights.Count;
            }
        }

        return new ExerciseStats(
            range,
            Round1(best),
            Round1(latest.Weights.Max()),
            recentCount > 0 ? Round1(recentSum / recentCount) : null,
            approximate,
            sampleCount);
    }
}
