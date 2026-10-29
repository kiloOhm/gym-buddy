namespace GymBuddy.Core;

/// <summary>Enum ↔ slug ↔ display label tables. Slugs are the JSON wire format shared with the TypeScript app.</summary>
public sealed class SlugTable<T> where T : struct, Enum
{
    private readonly (T Value, string Slug, string Label)[] _rows;
    private readonly Dictionary<string, T> _bySlug;

    internal SlugTable(params (T Value, string Slug, string Label)[] rows)
    {
        _rows = rows;
        _bySlug = rows.ToDictionary(r => r.Slug, r => r.Value, StringComparer.Ordinal);
        All = rows.Select(r => r.Value).ToArray();
        if (All.Count != Enum.GetValues<T>().Length) throw new InvalidOperationException($"Slug table for {typeof(T).Name} is incomplete");
    }

    /// <summary>Every value in declaration order (the order the TypeScript constants use).</summary>
    public IReadOnlyList<T> All { get; }

    public string Slug(T value) => _rows[Convert.ToInt32(value)].Slug;

    public string Label(T value) => _rows[Convert.ToInt32(value)].Label;

    public bool TryParse(string? slug, out T value)
    {
        if (slug is not null) return _bySlug.TryGetValue(slug, out value);
        value = default;
        return false;
    }

    public T Parse(string slug) => TryParse(slug, out var v) ? v : throw new FormatException($"Unknown {typeof(T).Name} '{slug}'");
}

public static class Muscles
{
    public static readonly SlugTable<MuscleGroup> Table = new(
        (MuscleGroup.Chest, "chest", "Chest"),
        (MuscleGroup.FrontDelts, "front_delts", "Front delts"),
        (MuscleGroup.SideDelts, "side_delts", "Side delts"),
        (MuscleGroup.RearDelts, "rear_delts", "Rear delts"),
        (MuscleGroup.Lats, "lats", "Lats"),
        (MuscleGroup.UpperBack, "upper_back", "Upper back"),
        (MuscleGroup.Traps, "traps", "Traps"),
        (MuscleGroup.LowerBack, "lower_back", "Lower back"),
        (MuscleGroup.Biceps, "biceps", "Biceps"),
        (MuscleGroup.Triceps, "triceps", "Triceps"),
        (MuscleGroup.Forearms, "forearms", "Forearms"),
        (MuscleGroup.Abs, "abs", "Abs"),
        (MuscleGroup.Obliques, "obliques", "Obliques"),
        (MuscleGroup.Quads, "quads", "Quads"),
        (MuscleGroup.Hamstrings, "hamstrings", "Hamstrings"),
        (MuscleGroup.Glutes, "glutes", "Glutes"),
        (MuscleGroup.Adductors, "adductors", "Adductors"),
        (MuscleGroup.HipFlexors, "hip_flexors", "Hip flexors"),
        (MuscleGroup.Calves, "calves", "Calves"));

    /// <summary>All 19 muscle groups in the canonical order (MUSCLE_GROUPS in the TypeScript app).</summary>
    public static IReadOnlyList<MuscleGroup> All => Table.All;
    public static string Slug(this MuscleGroup m) => Table.Slug(m);
    public static string Label(this MuscleGroup m) => Table.Label(m);
    public static bool TryParse(string? slug, out MuscleGroup m) => Table.TryParse(slug, out m);
    public static MuscleGroup Parse(string slug) => Table.Parse(slug);
}

public static class Equipments
{
    public static readonly SlugTable<Equipment> Table = new(
        (Equipment.Barbell, "barbell", "Barbell"),
        (Equipment.Dumbbell, "dumbbell", "Dumbbells"),
        (Equipment.Kettlebell, "kettlebell", "Kettlebell"),
        (Equipment.Cable, "cable", "Cable station"),
        (Equipment.Machine, "machine", "Machine"),
        (Equipment.SmithMachine, "smith_machine", "Smith machine"),
        (Equipment.EzBar, "ez_bar", "EZ bar"),
        (Equipment.Band, "band", "Resistance band"),
        (Equipment.Bench, "bench", "Bench"),
        (Equipment.Rack, "rack", "Power rack / squat stand"),
        (Equipment.PullUpBar, "pull_up_bar", "Pull-up bar"),
        (Equipment.DipStation, "dip_station", "Dip station"),
        (Equipment.Bodyweight, "bodyweight", "Bodyweight"));

    public static IReadOnlyList<Equipment> All => Table.All;
    public static string Slug(this Equipment e) => Table.Slug(e);
    public static string Label(this Equipment e) => Table.Label(e);
    public static bool TryParse(string? slug, out Equipment e) => Table.TryParse(slug, out e);
    public static Equipment Parse(string slug) => Table.Parse(slug);
}

public static class MovementPatterns
{
    public static readonly SlugTable<MovementPattern> Table = new(
        (MovementPattern.HorizontalPush, "horizontal_push", "Horizontal push"),
        (MovementPattern.VerticalPush, "vertical_push", "Vertical push"),
        (MovementPattern.HorizontalPull, "horizontal_pull", "Horizontal pull"),
        (MovementPattern.VerticalPull, "vertical_pull", "Vertical pull"),
        (MovementPattern.Squat, "squat", "Squat"),
        (MovementPattern.Hinge, "hinge", "Hinge"),
        (MovementPattern.Lunge, "lunge", "Lunge"),
        (MovementPattern.Carry, "carry", "Carry"),
        (MovementPattern.Core, "core", "Core"),
        (MovementPattern.Isolation, "isolation", "Isolation"));

    public static IReadOnlyList<MovementPattern> All => Table.All;
    public static string Slug(this MovementPattern p) => Table.Slug(p);
    /// <summary>"horizontal_push" → "Horizontal push" (formatPattern in the TypeScript app).</summary>
    public static string Label(this MovementPattern p) => Table.Label(p);
    public static bool TryParse(string? slug, out MovementPattern p) => Table.TryParse(slug, out p);
    public static MovementPattern Parse(string slug) => Table.Parse(slug);
}

public static class WeightUnits
{
    public static readonly SlugTable<WeightUnit> Table = new(
        (WeightUnit.Kg, "kg", "kg"),
        (WeightUnit.Lb, "lb", "lb"));

    public static IReadOnlyList<WeightUnit> All => Table.All;
    public static string Slug(this WeightUnit u) => Table.Slug(u);
    public static string Label(this WeightUnit u) => Table.Label(u);
    public static bool TryParse(string? slug, out WeightUnit u) => Table.TryParse(slug, out u);
    public static WeightUnit Parse(string slug) => Table.Parse(slug);
}
