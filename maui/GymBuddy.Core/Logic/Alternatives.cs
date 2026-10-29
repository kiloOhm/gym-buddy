namespace GymBuddy.Core.Logic;

/// <param name="Score">0..1, higher is a closer substitute.</param>
/// <param name="Reasons">Short human-readable reasons, e.g. "Same movement pattern", "Easier".</param>
public sealed record Alternative(Exercise Exercise, double Score, IReadOnlyList<string> Reasons);

/// <summary>Alternative-exercise suggestions (src/logic/alternatives.ts).</summary>
public static class Alternatives
{
    /// <summary>Minimum activation a candidate needs on one of the original's primary muscles.</summary>
    private const double MinPrimaryActivation = 0.5;
    /// <summary>Minimum muscle-vector similarity for a candidate to be considered at all.</summary>
    private const double MinSimilarity = 0.4;
    public const int DefaultLimit = 5;

    /// <summary>0..1 cosine similarity of two exercises' muscle activation vectors.</summary>
    public static double MuscleSimilarity(Exercise a, Exercise b)
    {
        double dot = 0, normA = 0, normB = 0;
        foreach (var m in Muscles.All)
        {
            var x = a.Activation(m);
            var y = b.Activation(m);
            dot += x * y;
            normA += x * x;
            normB += y * y;
        }
        if (normA == 0 || normB == 0) return 0;
        return Math.Min(1, Math.Max(0, dot / Math.Sqrt(normA * normB)));
    }

    /// <summary>Primary muscles: those at 1.0; falls back to the most activated muscle(s) if none is at 1.0.</summary>
    private static List<MuscleGroup> PrimaryMuscles(Exercise exercise)
    {
        var max = Math.Max(0, Muscles.All.Max(exercise.Activation));
        if (max == 0) return [];
        var target = max >= 1 ? 1 : max;
        return Muscles.All.Where(m => exercise.Activation(m) >= target).ToList();
    }

    public static string EquipmentReason(IReadOnlyList<Equipment> equipment)
    {
        var needed = equipment.Where(e => e != Equipment.Bodyweight).ToList();
        if (needed.Count == 0) return "No equipment needed";
        return $"Needs: {string.Join(", ", needed.Select(e => e.Label()))}";
    }

    /// <summary>Ranked substitutes for an exercise, best first. Empty if the id is unknown.</summary>
    public static IReadOnlyList<Alternative> SuggestAlternatives(
        string exerciseId,
        IReadOnlyDictionary<string, Exercise> db,
        IReadOnlyCollection<string>? excludeIds = null,
        int limit = DefaultLimit)
    {
        if (!db.TryGetValue(exerciseId, out var original)) return [];

        var excluded = new HashSet<string>(excludeIds ?? [], StringComparer.Ordinal);
        var primaries = PrimaryMuscles(original);

        var results = new List<Alternative>();
        foreach (var candidate in db.Values)
        {
            if (candidate.Id == original.Id || excluded.Contains(candidate.Id)) continue;

            // Shared primary: the original's primary the candidate hits hardest.
            MuscleGroup? sharedPrimary = null;
            foreach (var m in primaries)
            {
                if (candidate.Activation(m) < MinPrimaryActivation) continue;
                if (sharedPrimary is null || candidate.Activation(m) > candidate.Activation(sharedPrimary.Value)) sharedPrimary = m;
            }
            if (sharedPrimary is null) continue;

            var similarity = MuscleSimilarity(original, candidate);
            if (similarity < MinSimilarity) continue;

            var samePattern = candidate.Pattern == original.Pattern;
            var sameCompound = candidate.Compound == original.Compound;
            var extraDifficulty = Math.Max(0, candidate.Difficulty - original.Difficulty);
            var safety = extraDifficulty == 0 ? 1 : extraDifficulty == 1 ? 0.5 : 0;

            var raw =
                0.55 * similarity +
                0.2 * (samePattern ? 1 : 0) +
                0.15 * (sameCompound ? 1 : 0) +
                0.1 * safety -
                0.05 * extraDifficulty;
            var score = JsMath.Round(Math.Min(1, Math.Max(0, raw)), 3);

            var reasons = new List<string>
            {
                samePattern ? "Same movement pattern" : "Different pattern, same muscles",
                $"Hits {sharedPrimary.Value.Label()} like the original",
            };
            if (candidate.Difficulty < original.Difficulty) reasons.Add("Easier");
            else if (candidate.Difficulty == original.Difficulty) reasons.Add("Same difficulty");
            else reasons.Add("More demanding");
            reasons.Add(EquipmentReason(candidate.Equipment));

            results.Add(new Alternative(candidate, score, reasons));
        }

        // Stable sort like Array.prototype.sort: score desc, then name (localeCompare).
        var sorted = results
            .OrderByDescending(a => a.Score)
            .ThenBy(a => a.Exercise.Name, LocaleComparer.Instance)
            .Take(Math.Max(0, limit))
            .ToList();
        return sorted;
    }
}
