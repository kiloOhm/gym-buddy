using System.Collections;

namespace GymBuddy.Core.Logic;

/// <summary>Effective sets per muscle group (sets × activation, summed over exercises). Always has all 19 muscles.</summary>
public sealed class Coverage : IEnumerable<KeyValuePair<MuscleGroup, double>>, IEquatable<Coverage>
{
    private readonly double[] _values = new double[Muscles.All.Count];

    public double this[MuscleGroup muscle]
    {
        get => _values[(int)muscle];
        set => _values[(int)muscle] = value;
    }

    /// <summary>Every muscle at zero (emptyCoverage).</summary>
    public static Coverage Empty() => new();

    public static Coverage From(IEnumerable<KeyValuePair<MuscleGroup, double>> values)
    {
        var c = new Coverage();
        foreach (var (m, v) in values) c[m] = v;
        return c;
    }

    /// <summary>Largest value, 0 when everything is zero.</summary>
    public double Max() => _values.Length == 0 ? 0 : Math.Max(0, _values.Max());

    public IReadOnlyDictionary<MuscleGroup, double> ToDictionary() => this.ToDictionary(kv => kv.Key, kv => kv.Value);

    public IEnumerator<KeyValuePair<MuscleGroup, double>> GetEnumerator()
    {
        foreach (var m in Muscles.All) yield return new(m, _values[(int)m]);
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public bool Equals(Coverage? other) => other is not null && _values.SequenceEqual(other._values);
    public override bool Equals(object? obj) => Equals(obj as Coverage);
    public override int GetHashCode() => _values.Aggregate(0, (h, v) => HashCode.Combine(h, v));
    public override string ToString() => string.Join(", ", this.Where(kv => kv.Value != 0).Select(kv => $"{kv.Key.Slug()}: {JsMath.ToJsString(kv.Value)}"));
}

public sealed record CoverageItem(string ExerciseId, int Sets);

public enum CoverageLevel { None, Light, Moderate, High }

/// <param name="AvgDifficulty">Average difficulty over planned exercises, 1..5 (1 decimal); 0 when empty.</param>
/// <param name="MaxDifficulty">1..5; 0 when empty.</param>
/// <param name="Hardest">The first exercise with the highest difficulty, if any.</param>
public sealed record PlanSummary(int TotalSets, double AvgDifficulty, int MaxDifficulty, Exercise? Hardest);

/// <summary>Muscle coverage of a plan (src/logic/coverage.ts).</summary>
public static class CoverageLogic
{
    /// <summary>Sum of sets × activation for every muscle, rounded to 2 decimals. Unknown exercise ids are ignored.</summary>
    public static Coverage ComputeCoverage(IEnumerable<CoverageItem> items, IReadOnlyDictionary<string, Exercise> db)
    {
        var coverage = Coverage.Empty();
        foreach (var item in items)
        {
            if (!db.TryGetValue(item.ExerciseId, out var exercise)) continue;
            foreach (var muscle in Muscles.All)
            {
                var activation = exercise.Activation(muscle);
                if (activation != 0) coverage[muscle] += item.Sets * activation;
            }
        }
        foreach (var muscle in Muscles.All) coverage[muscle] = JsMath.Round(coverage[muscle], 2);
        return coverage;
    }

    /// <summary>Bucket effective sets into a level for display (per-session buckets).</summary>
    public static CoverageLevel CoverageLevel(double effectiveSets)
    {
        if (effectiveSets <= 0) return Logic.CoverageLevel.None;
        if (effectiveSets < 4) return Logic.CoverageLevel.Light;
        if (effectiveSets < 10) return Logic.CoverageLevel.Moderate;
        return Logic.CoverageLevel.High;
    }

    public static PlanSummary SummarizePlan(IEnumerable<CoverageItem> items, IReadOnlyDictionary<string, Exercise> db)
    {
        var totalSets = 0;
        var difficultySum = 0;
        var count = 0;
        Exercise? hardest = null;
        foreach (var item in items)
        {
            if (!db.TryGetValue(item.ExerciseId, out var exercise)) continue;
            totalSets += item.Sets;
            difficultySum += exercise.Difficulty;
            count += 1;
            if (hardest is null || exercise.Difficulty > hardest.Difficulty) hardest = exercise;
        }
        return new PlanSummary(
            totalSets,
            count == 0 ? 0 : JsMath.Round((double)difficultySum / count, 1),
            hardest?.Difficulty ?? 0,
            hardest);
    }

    /// <summary>Coverage items for a plan's exercises.</summary>
    public static IEnumerable<CoverageItem> ItemsOf(WorkoutPlan plan) => plan.Exercises.Select(e => new CoverageItem(e.ExerciseId, e.Sets));
}
