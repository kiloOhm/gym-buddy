using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace GymBuddy.Core.Logic;

public sealed record ExportedExercise(string ExerciseId, int Sets, int Reps, int RestSec);

/// <summary>A plan as stored in a plans file. Equality compares the exercise list element-wise.</summary>
public sealed record ExportedPlan(string Name, IReadOnlyList<ExportedExercise> Exercises)
{
    public bool Equals(ExportedPlan? other) =>
        other is not null && Name == other.Name && Exercises.SequenceEqual(other.Exercises);

    public override int GetHashCode() => HashCode.Combine(Name, Exercises.Count);
}

public sealed record ParsedImport(IReadOnlyList<ExportedPlan> Plans, IReadOnlyList<string> Warnings);

/// <param name="Plans">Plans to import, in file order, with in-file duplicates removed (first occurrence wins).</param>
/// <param name="Skipped">One line per skipped plan: "Push: identical to existing plan 'Push'" or "Push: duplicate within the file".</param>
public sealed record DedupeResult(IReadOnlyList<ExportedPlan> Plans, IReadOnlyList<string> Skipped);

/// <summary>The "gym-buddy-plans" file (property order matters for byte-equal output).</summary>
public sealed record PlanExportFile(string Format, int Version, string ExportedAt, IReadOnlyList<ExportedPlan> Plans);

/// <summary>Plan export/import file format (src/logic/planExport.ts).</summary>
public static partial class PlanExport
{
    public const string Format = "gym-buddy-plans";
    public const int Version = 1;
    private const string FallbackPlanName = "Imported plan";

    /// <summary>Allowed range and default per field; matches the steppers in the plan editor.</summary>
    private static readonly Dictionary<string, (int Min, int Max, int Fallback)> Limits = new()
    {
        ["sets"] = (1, 10, 3),
        ["reps"] = (1, 30, 10),
        ["restSec"] = (0, 600, 90),
    };

    public static ExportedPlan ToExported(WorkoutPlan plan) =>
        new(plan.Name, plan.Exercises.Select(e => new ExportedExercise(e.ExerciseId, e.Sets, e.Reps, e.RestSec)).ToList());

    /// <summary>Plans as pretty-printed JSON. Ids and timestamps are dropped.</summary>
    public static string SerializePlans(IEnumerable<WorkoutPlan> plans, DateTimeOffset now)
    {
        var file = new PlanExportFile(Format, Version, GymJson.ToIso(now), plans.Select(ToExported).ToList());
        return JsonSerializer.Serialize(file, GymJson.Indented);
    }

    private static string DateStamp(DateTimeOffset d) =>
        string.Create(CultureInfo.InvariantCulture, $"{d.Year:0000}-{d.Month:00}-{d.Day:00}");

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlugChars();

    [GeneratedRegex("^-+|-+$")]
    private static partial Regex EdgeDashes();

    /// <summary>
    /// Base letters for the precomposed Latin letters that NFKD decomposes into letter + combining mark. Needed
    /// because string.Normalize does not decompose under InvariantGlobalization (which the app and tests use).
    /// </summary>
    private static readonly Dictionary<char, string> LatinFold = BuildLatinFold();

    private static Dictionary<char, string> BuildLatinFold()
    {
        var groups = new (string Chars, string Base)[]
        {
            ("ÀÁÂÃÄÅĀĂĄ", "A"), ("àáâãäåāăąª", "a"), ("ÇĆĈĊČ", "C"), ("çćĉċč", "c"), ("Ď", "D"), ("ď", "d"),
            ("ÈÉÊËĒĔĖĘĚ", "E"), ("èéêëēĕėęě", "e"), ("ĜĞĠĢ", "G"), ("ĝğġģ", "g"), ("Ĥ", "H"), ("ĥ", "h"),
            ("ÌÍÎÏĨĪĬĮİ", "I"), ("ìíîïĩīĭį", "i"), ("Ĳ", "IJ"), ("ĳ", "ij"), ("Ĵ", "J"), ("ĵ", "j"), ("Ķ", "K"), ("ķ", "k"),
            ("ĹĻĽ", "L"), ("ĺļľ", "l"), ("ÑŃŅŇ", "N"), ("ñńņň", "n"), ("ÒÓÔÕÖŌŎŐ", "O"), ("òóôõöōŏőº", "o"),
            ("ŔŖŘ", "R"), ("ŕŗř", "r"), ("ŚŜŞŠ", "S"), ("śŝşšſ", "s"), ("ŢŤ", "T"), ("ţť", "t"),
            ("ÙÚÛÜŨŪŬŮŰŲ", "U"), ("ùúûüũūŭůűų", "u"), ("Ŵ", "W"), ("ŵ", "w"), ("ÝŶŸ", "Y"), ("ýÿŷ", "y"),
            ("ŹŻŽ", "Z"), ("źżž", "z"), ("¹", "1"), ("²", "2"), ("³", "3"),
        };
        var map = new Dictionary<char, string>();
        foreach (var (chars, b) in groups)
            foreach (var c in chars) map[c] = b;
        return map;
    }

    private static string Slugify(string text)
    {
        string decomposed;
        try
        {
            decomposed = text.Normalize(NormalizationForm.FormKD);
        }
        catch (Exception e) when (e is ArgumentException or PlatformNotSupportedException)
        {
            decomposed = text;
        }
        var stripped = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (c >= '\u0300' && c <= '\u036f') continue;
            if (LatinFold.TryGetValue(c, out var folded)) stripped.Append(folded);
            else stripped.Append(c);
        }
        var lower = stripped.ToString().ToLowerInvariant();
        return EdgeDashes().Replace(NonSlugChars().Replace(lower, "-"), "");
    }

    /// <summary>"gym-buddy-plans-2026-10-27.json", or "gym-buddy-plan-push-2026-10-27.json" for a single plan (local date of <paramref name="localNow"/>).</summary>
    public static string SuggestedFileName(IReadOnlyList<WorkoutPlan> plans, DateTimeOffset localNow)
    {
        var date = DateStamp(localNow);
        if (plans.Count == 1)
        {
            var slug = Slugify(plans[0].Name);
            if (slug.Length == 0) slug = "plan";
            return $"gym-buddy-plan-{slug}-{date}.json";
        }
        return $"gym-buddy-plans-{date}.json";
    }

    private static int ReadNumber(bool present, JsonNode? raw, string field, string context, List<string> warnings)
    {
        var (min, max, fallback) = Limits[field];
        if (!present || raw is null)
        {
            warnings.Add($"{context}: missing {field}, using {fallback}");
            return fallback;
        }
        if (!JsJson.IsNumber(raw, out var n))
        {
            warnings.Add($"{context}: invalid {field}, using {fallback}");
            return fallback;
        }
        var value = (int)Math.Min(max, Math.Max(min, JsMath.Round(n)));
        if (value != n) warnings.Add($"{context}: {field} {JsMath.ToJsString(n)} adjusted to {value}");
        return value;
    }

    /// <summary>
    /// Parses an exported plans file. Throws <see cref="FormatException"/> with a human-readable message when the
    /// file as a whole is unusable; per-exercise problems are fixed up and reported as warnings.
    /// </summary>
    public static ParsedImport ParsePlanExport(string json, IReadOnlyDictionary<string, Exercise> db)
    {
        var data = JsJson.Parse(json, "The file is not valid JSON.");
        if (data is not JsonObject obj || !JsJson.IsString(JsJson.Get(obj, "format").Value, out var format) || format != Format)
            throw new FormatException("This is not a Gym Buddy plans file.");
        var (hasVersion, versionNode) = JsJson.Get(obj, "version");
        if (!JsJson.IsNumber(versionNode, out var version) || version != Version)
            throw new FormatException($"Unsupported file version ({JsJson.JsString(hasVersion, versionNode)}). Update Gym Buddy and try again.");
        if (JsJson.Get(obj, "plans").Value is not JsonArray rawPlans)
            throw new FormatException("The file does not contain a list of plans.");

        var warnings = new List<string>();
        var plans = new List<ExportedPlan>();
        for (var index = 0; index < rawPlans.Count; index++)
        {
            var position = $"Plan {index + 1}";
            if (rawPlans[index] is not JsonObject rawPlan || !JsJson.IsString(JsJson.Get(rawPlan, "name").Value, out var rawName))
                throw new FormatException($"{position} has no name.");
            if (JsJson.Get(rawPlan, "exercises").Value is not JsonArray rawExercises)
                throw new FormatException($"{position} has no exercise list.");
            var name = rawName.Trim();
            if (name.Length == 0) name = FallbackPlanName;

            var exercises = new List<ExportedExercise>();
            for (var exIndex = 0; exIndex < rawExercises.Count; exIndex++)
            {
                if (rawExercises[exIndex] is not JsonObject rawEx || !JsJson.IsString(JsJson.Get(rawEx, "exerciseId").Value, out var exerciseId))
                {
                    warnings.Add($"{name}: skipped exercise {exIndex + 1} without an exercise id");
                    continue;
                }
                if (!db.TryGetValue(exerciseId, out var exercise))
                {
                    warnings.Add($"{name}: skipped unknown exercise '{exerciseId}'");
                    continue;
                }
                var context = $"{name} / {exercise.Name}";
                var (hs, s) = JsJson.Get(rawEx, "sets");
                var sets = ReadNumber(hs, s, "sets", context, warnings);
                var (hr, r) = JsJson.Get(rawEx, "reps");
                var reps = ReadNumber(hr, r, "reps", context, warnings);
                var (hrs, rs) = JsJson.Get(rawEx, "restSec");
                var restSec = ReadNumber(hrs, rs, "restSec", context, warnings);
                exercises.Add(new ExportedExercise(exerciseId, sets, reps, restSec));
            }

            if (exercises.Count == 0) warnings.Add($"{name}: no exercises");
            plans.Add(new ExportedPlan(name, exercises));
        }

        return new ParsedImport(plans, warnings);
    }

    /// <summary>
    /// Stable content hash of a plan's exercise list (ids, sets, reps, rest, in order). Plan name and ids are not
    /// included. FNV-1a 32-bit over "barbell_bench_press:4x6@150|overhead_press:3x8@120", per UTF-16 code unit;
    /// 8 lowercase hex chars.
    /// </summary>
    public static string PlanFingerprint(IEnumerable<ExportedExercise> exercises) =>
        Fingerprint(exercises.Select(e => (e.ExerciseId, e.Sets, e.Reps, e.RestSec)));

    public static string PlanFingerprint(IEnumerable<PlannedExercise> exercises) =>
        Fingerprint(exercises.Select(e => (e.ExerciseId, e.Sets, e.Reps, e.RestSec)));

    private static string Fingerprint(IEnumerable<(string ExerciseId, int Sets, int Reps, int RestSec)> exercises)
    {
        var canonical = string.Join("|", exercises.Select(e =>
            string.Create(CultureInfo.InvariantCulture, $"{e.ExerciseId}:{e.Sets}x{e.Reps}@{e.RestSec}")));
        unchecked
        {
            var hash = 0x811c9dc5u;
            foreach (var c in canonical)
            {
                hash ^= c;
                hash *= 0x01000193u;
            }
            return hash.ToString("x8", CultureInfo.InvariantCulture);
        }
    }

    /// <summary>Drops incoming plans whose fingerprint matches an existing plan's exercises or an earlier incoming plan's.</summary>
    public static DedupeResult DedupePlans(IEnumerable<ExportedPlan> incoming, IEnumerable<WorkoutPlan> existingPlans)
    {
        var existingNames = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var p in existingPlans) existingNames.TryAdd(PlanFingerprint(p.Exercises), p.Name);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var plans = new List<ExportedPlan>();
        var skipped = new List<string>();
        foreach (var p in incoming)
        {
            var fp = PlanFingerprint(p.Exercises);
            if (existingNames.TryGetValue(fp, out var match)) skipped.Add($"{p.Name}: identical to existing plan '{match}'");
            else if (!seen.Add(fp)) skipped.Add($"{p.Name}: duplicate within the file");
            else plans.Add(p);
        }
        return new DedupeResult(plans, skipped);
    }
}
