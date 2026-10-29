namespace GymBuddy.Core;

/// <summary>
/// One exercise of the library. Immutable; use <c>with</c> to derive variants.
/// Equality is deep (same id, name, equipment sequence, pattern, compound flag, muscle activations
/// regardless of key order, difficulty and cue sequence), matching <c>exercisesEqual</c> in the TypeScript app.
/// </summary>
public sealed record Exercise
{
    /// <summary>Stable slug such as "barbell_back_squat". Never changes once shipped; sessions, plans and overrides reference it.</summary>
    public required string Id { get; init; }

    public required string Name { get; init; }

    /// <summary>Every item required to perform the exercise. <see cref="Core.Equipment.Bodyweight"/> alone means nothing else is needed.</summary>
    public required IReadOnlyList<Equipment> Equipment { get; init; }

    public required MovementPattern Pattern { get; init; }

    public required bool Compound { get; init; }

    /// <summary>
    /// Relative activation per muscle, 0..1 (primary target 1.0, strong secondary 0.5–0.7, stabiliser 0.2–0.3;
    /// muscles not meaningfully worked are absent). Insertion order is the order in the data file.
    /// </summary>
    public required IReadOnlyDictionary<MuscleGroup, double> Muscles { get; init; }

    /// <summary>Editorial 1–5 rating of how technically demanding and how unforgiving the exercise is. Not a measured injury rate.</summary>
    public required int Difficulty { get; init; }

    /// <summary>2–4 short coaching cues.</summary>
    public IReadOnlyList<string> Cues { get; init; } = Array.Empty<string>();

    public double Activation(MuscleGroup muscle) => Muscles.TryGetValue(muscle, out var v) ? v : 0;

    public bool Equals(Exercise? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return Id == other.Id
            && Name == other.Name
            && Pattern == other.Pattern
            && Compound == other.Compound
            && Difficulty == other.Difficulty
            && Equipment.SequenceEqual(other.Equipment)
            && Cues.SequenceEqual(other.Cues, StringComparer.Ordinal)
            && Muscles.Count == other.Muscles.Count
            && Muscles.All(kv => other.Muscles.TryGetValue(kv.Key, out var v) && v.Equals(kv.Value));
    }

    public override int GetHashCode() => HashCode.Combine(Id, Name, Pattern, Compound, Difficulty, Equipment.Count, Muscles.Count, Cues.Count);
}
