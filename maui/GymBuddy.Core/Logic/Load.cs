namespace GymBuddy.Core.Logic;

public enum LoadLevel { None, Low, Good, High }

/// <param name="Suggestions">For None/Low: up to 2 exercises whose activation of this muscle is 1.0, easiest (then name) first. Empty for High.</param>
public sealed record LoadHint(MuscleGroup Muscle, LoadLevel Level, double EffectiveSets, IReadOnlyList<Exercise> Suggestions);

/// <summary>Weekly muscle load (src/logic/load.ts).</summary>
public static class Load
{
    public const int LoadWindowDays = 7;
    /// <summary>Effective sets per muscle per rolling 7 days below this count as under-trained.</summary>
    public const double LowThreshold = 4;
    /// <summary>Effective sets per muscle per rolling 7 days above this count as overtraining risk.</summary>
    public const double HighThreshold = 20;

    private const long DayMs = 24L * 60 * 60 * 1000;
    private const int MaxSuggestions = 2;

    /// <summary>0 → None, (0, low) → Low, [low, high] → Good, &gt; high → High.</summary>
    public static LoadLevel LoadLevelFor(double effectiveSets)
    {
        if (effectiveSets <= 0) return LoadLevel.None;
        if (effectiveSets < LowThreshold) return LoadLevel.Low;
        if (effectiveSets <= HighThreshold) return LoadLevel.Good;
        return LoadLevel.High;
    }

    /// <summary>
    /// Effective sets per muscle over the completed sets of sessions finished within the last
    /// LoadWindowDays days before <paramref name="nowMs"/>. Unfinished sessions are ignored.
    /// </summary>
    public static Coverage RecentMuscleLoad(IEnumerable<WorkoutSession> sessions, long nowMs, IReadOnlyDictionary<string, Exercise> db)
    {
        var since = nowMs - LoadWindowDays * DayMs;
        var items = sessions
            .Where(s =>
            {
                var t = Ids.ParseIsoMs(s.FinishedAt);
                return t is not null && t >= since && t <= nowMs;
            })
            .SelectMany(s => s.Exercises.Select(e => new CoverageItem(e.ExerciseId, e.Sets.Count(x => x.Completed))));
        return CoverageLogic.ComputeCoverage(items, db);
    }

    private static List<Exercise> SuggestFor(MuscleGroup muscle, IReadOnlyDictionary<string, Exercise> db) =>
        db.Values
            .Where(e => e.Muscles.TryGetValue(muscle, out var v) && v == 1)
            .OrderBy(e => e.Difficulty)
            .ThenBy(e => e.Name, LocaleComparer.Instance)
            .Take(MaxSuggestions)
            .ToList();

    private static int LevelOrder(LoadLevel level) => level switch
    {
        LoadLevel.High => 0,
        LoadLevel.None => 1,
        LoadLevel.Low => 2,
        _ => 3,
    };

    /// <summary>One entry per muscle that is None, Low or High (never Good): High first (desc by sets), then None, then Low (asc by sets).</summary>
    public static IReadOnlyList<LoadHint> LoadHints(Coverage load, IReadOnlyDictionary<string, Exercise> db)
    {
        var hints = new List<LoadHint>();
        foreach (var muscle in Muscles.All)
        {
            var effectiveSets = load[muscle];
            var level = LoadLevelFor(effectiveSets);
            if (level == LoadLevel.Good) continue;
            hints.Add(new LoadHint(muscle, level, effectiveSets, level == LoadLevel.High ? [] : SuggestFor(muscle, db)));
        }
        // Stable, like Array.prototype.sort.
        return hints
            .OrderBy(h => LevelOrder(h.Level))
            .ThenBy(h => h.Level == LoadLevel.High ? -h.EffectiveSets : h.EffectiveSets)
            .ToList();
    }
}
