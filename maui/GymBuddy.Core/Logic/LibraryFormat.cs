using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace GymBuddy.Core.Logic;

public sealed record ParsedLibrary(IReadOnlyList<Exercise> Exercises, IReadOnlyList<string> Warnings);

public sealed record LibraryDiff(IReadOnlyList<Exercise> Added, IReadOnlyList<Exercise> Updated, IReadOnlyList<Exercise> Unchanged);

/// <summary>The "gym-buddy-exercises" file as written by both apps (property order matters for byte-equal output).</summary>
public sealed record LibraryExportFile(string Format, int Version, string ExportedAt, IReadOnlyList<Exercise> Exercises);

/// <summary>
/// Exercise library export/import (src/logic/library.ts): merging custom entries over the built-ins, the file
/// format, validation and diffing.
/// </summary>
public static partial class LibraryFormat
{
    public const string Format = "gym-buddy-exercises";
    public const int Version = 2;
    /// <summary>Version 1 files carried formDifficulty + injuryRisk instead of difficulty; they still import.</summary>
    public const int LegacyVersion = 1;
    public const string LegacyRatingsWarning = "Converted form/injury ratings to the single difficulty score";
    private const int MaxCues = 4;

    [GeneratedRegex("^[a-z0-9_]+$")]
    private static partial Regex IdPattern();

    /// <summary>
    /// Built-ins with custom entries layered on top: same id → the custom entry replaces the built-in;
    /// new ids are appended (sorted by name). Output order: built-in order, then custom additions.
    /// </summary>
    public static IReadOnlyList<Exercise> MergeLibrary(IEnumerable<Exercise> builtIn, IEnumerable<Exercise> custom)
    {
        var builtInList = builtIn as IReadOnlyList<Exercise> ?? builtIn.ToList();
        var customById = new Dictionary<string, Exercise>(StringComparer.Ordinal);
        foreach (var e in custom) customById[e.Id] = e;
        var builtInIds = new HashSet<string>(builtInList.Select(e => e.Id), StringComparer.Ordinal);
        var merged = builtInList.Select(e => customById.GetValueOrDefault(e.Id) ?? e).ToList();
        var additions = customById.Values
            .Where(e => !builtInIds.Contains(e.Id))
            .OrderBy(e => e.Name, LocaleComparer.Instance);
        merged.AddRange(additions);
        return merged;
    }

    /// <summary>The library as pretty-printed JSON (2 spaces), byte-identical to the TypeScript app's export.</summary>
    public static string SerializeLibrary(IEnumerable<Exercise> exercises, DateTimeOffset now)
    {
        var file = new LibraryExportFile(Format, Version, GymJson.ToIso(now), exercises.ToList());
        return JsonSerializer.Serialize(file, GymJson.Indented);
    }

    /// <summary>"gym-buddy-exercises-2026-10-27.json" from the calendar date of <paramref name="localNow"/> (pass DateTimeOffset.Now).</summary>
    public static string LibraryFileName(DateTimeOffset localNow) =>
        string.Create(CultureInfo.InvariantCulture, $"gym-buddy-exercises-{localNow.Year:0000}-{localNow.Month:00}-{localNow.Day:00}.json");

    private static int ClampRating(double value) => (int)Math.Min(5, Math.Max(1, JsMath.Round(value)));

    /// <summary>The single difficulty score for the old pair of ratings: the mean rounded half up, clamped to 1..5.</summary>
    public static int DifficultyFromLegacy(double formDifficulty, double injuryRisk) =>
        ClampRating(Math.Ceiling((formDifficulty + injuryRisk) / 2));

    /// <summary>Thrown inside ValidateEntry to skip the entry; the message becomes the warning.</summary>
    private sealed class SkipEntry(string message) : Exception(message);

    private sealed class ParseContext
    {
        public List<string> Warnings { get; } = [];
        public bool ConvertedLegacy { get; set; }
    }

    private static int ReadDifficulty(JsonObject raw, string label, ParseContext ctx)
    {
        var (hasDifficulty, difficultyNode) = JsJson.Get(raw, "difficulty");
        if (!hasDifficulty
            && JsJson.IsNumber(JsJson.Get(raw, "formDifficulty").Value, out var form)
            && JsJson.IsNumber(JsJson.Get(raw, "injuryRisk").Value, out var risk))
        {
            ctx.ConvertedLegacy = true;
            return DifficultyFromLegacy(form, risk);
        }
        if (!JsJson.IsNumber(difficultyNode, out var d)) throw new SkipEntry("difficulty must be a number from 1 to 5");
        var value = ClampRating(d);
        if (value != d) ctx.Warnings.Add($"{label}: difficulty {JsMath.ToJsString(d)} adjusted to {value}");
        return value;
    }

    private static Exercise ValidateEntry(JsonNode? rawNode, int position, ParseContext ctx)
    {
        var warnings = ctx.Warnings;
        if (rawNode is not JsonObject raw) throw new SkipEntry($"entry {position} is not an object");

        if (!JsJson.IsString(JsJson.Get(raw, "id").Value, out var id) || !IdPattern().IsMatch(id))
            throw new SkipEntry("id must be lowercase letters, digits and underscores");

        var name = JsJson.IsString(JsJson.Get(raw, "name").Value, out var rawName) ? rawName.Trim() : "";
        if (name.Length == 0) throw new SkipEntry("name is missing");
        var label = $"{name} ({id})";

        if (JsJson.Get(raw, "equipment").Value is not JsonArray equipmentArray || equipmentArray.Count == 0)
            throw new SkipEntry("equipment must be a non-empty list");
        var equipment = new List<Equipment>();
        foreach (var item in equipmentArray)
        {
            if (!JsJson.IsString(item, out var slug) || !Equipments.TryParse(slug, out var eq))
                throw new SkipEntry($"unknown equipment '{JsJson.JsString(item)}'");
            if (!equipment.Contains(eq)) equipment.Add(eq);
        }

        var (hasPattern, patternNode) = JsJson.Get(raw, "pattern");
        if (!JsJson.IsString(patternNode, out var patternSlug) || !MovementPatterns.TryParse(patternSlug, out var pattern))
            throw new SkipEntry($"unknown movement pattern '{JsJson.JsString(hasPattern, patternNode)}'");

        if (!JsJson.IsBool(JsJson.Get(raw, "compound").Value, out var compound))
            throw new SkipEntry("compound must be true or false");

        if (JsJson.Get(raw, "muscles").Value is not JsonObject musclesObj) throw new SkipEntry("muscles must be an object");
        var entries = new List<(MuscleGroup Muscle, double Value)>();
        foreach (var (key, valueNode) in musclesObj)
        {
            if (!Muscles.TryParse(key, out var muscle)) throw new SkipEntry($"unknown muscle group '{key}'");
            if (!JsJson.IsNumber(valueNode, out var value) || value <= 0 || value > 1)
                throw new SkipEntry($"activation for {key} must be a number above 0 and at most 1");
            entries.Add((muscle, value));
        }
        if (entries.Count == 0) throw new SkipEntry("muscles is empty");
        var max = entries.Max(e => e.Value);
        var muscles = new Dictionary<MuscleGroup, double>();
        if (max < 1)
        {
            foreach (var (muscle, value) in entries)
                muscles[muscle] = value == max ? 1 : Math.Max(0.01, JsMath.Round(value / max * 100) / 100);
            warnings.Add($"{label}: muscle activations scaled so the primary target is 1");
        }
        else
        {
            foreach (var (muscle, value) in entries) muscles[muscle] = value;
        }

        var difficulty = ReadDifficulty(raw, label, ctx);

        var cues = new List<string>();
        var (hasCues, cuesNode) = JsJson.Get(raw, "cues");
        if (hasCues)
        {
            if (cuesNode is not JsonArray cuesArray) throw new SkipEntry("cues must be a list of strings");
            foreach (var cue in cuesArray)
            {
                if (!JsJson.IsString(cue, out var text)) throw new SkipEntry("cues must be a list of strings");
                cues.Add(text.Trim());
            }
            if (cues.Any(c => c.Length == 0))
            {
                cues = cues.Where(c => c.Length > 0).ToList();
                warnings.Add($"{label}: empty cues removed");
            }
            if (cues.Count > MaxCues)
            {
                cues = cues.Take(MaxCues).ToList();
                warnings.Add($"{label}: only the first {MaxCues} cues kept");
            }
        }

        return new Exercise
        {
            Id = id,
            Name = name,
            Equipment = equipment,
            Pattern = pattern,
            Compound = compound,
            Muscles = muscles,
            Difficulty = difficulty,
            Cues = cues,
        };
    }

    /// <summary>How an invalid entry is named in a warning: id, else name, else its position.</summary>
    private static string EntryLabel(JsonNode? raw, int position)
    {
        if (raw is JsonObject obj)
        {
            var name = JsJson.IsString(JsJson.Get(obj, "name").Value, out var n) ? n.Trim() : "";
            var id = JsJson.IsString(JsJson.Get(obj, "id").Value, out var i) ? i.Trim() : "";
            if (name.Length > 0 && id.Length > 0) return $"{name} ({id})";
            if (id.Length > 0 || name.Length > 0) return id.Length > 0 ? id : name;
        }
        return $"Exercise {position}";
    }

    /// <summary>
    /// Parses an exported library file. Throws <see cref="FormatException"/> with a human-readable message when the
    /// file as a whole is unusable; invalid entries are skipped and fixable ones adjusted, both with warnings.
    /// </summary>
    public static ParsedLibrary ParseLibraryExport(string json)
    {
        var data = JsJson.Parse(json, "The file is not valid JSON.");
        if (data is not JsonObject obj || !JsJson.IsString(JsJson.Get(obj, "format").Value, out var format) || format != Format)
            throw new FormatException("This is not a Gym Buddy exercise library file.");
        var (hasVersion, versionNode) = JsJson.Get(obj, "version");
        if (!JsJson.IsNumber(versionNode, out var version) || (version != Version && version != LegacyVersion))
            throw new FormatException($"Unsupported file version ({JsJson.JsString(hasVersion, versionNode)}). Update Gym Buddy and try again.");
        if (JsJson.Get(obj, "exercises").Value is not JsonArray list)
            throw new FormatException("The file does not contain a list of exercises.");

        var ctx = new ParseContext();
        var warnings = ctx.Warnings;
        // Insertion-ordered by id; a duplicate moves to its later position (delete + set in the TS Map).
        var byId = new List<Exercise>();
        for (var index = 0; index < list.Count; index++)
        {
            var raw = list[index];
            var position = index + 1;
            Exercise exercise;
            try
            {
                exercise = ValidateEntry(raw, position, ctx);
            }
            catch (SkipEntry e)
            {
                warnings.Add($"{EntryLabel(raw, position)}: skipped, {e.Message}");
                continue;
            }
            var existing = byId.FindIndex(x => x.Id == exercise.Id);
            if (existing >= 0)
            {
                warnings.Add($"{exercise.Id}: appears more than once, the last entry is used");
                byId.RemoveAt(existing);
            }
            byId.Add(exercise);
        }

        if (ctx.ConvertedLegacy) warnings.Insert(0, LegacyRatingsWarning);
        return new ParsedLibrary(byId, warnings);
    }

    /// <summary>Deep equality of two exercises, independent of muscle key order (exercisesEqual).</summary>
    public static bool ExercisesEqual(Exercise a, Exercise b) => a.Equals(b);

    /// <summary>Compares incoming entries with the current library by id.</summary>
    public static LibraryDiff DiffLibrary(IEnumerable<Exercise> incoming, IEnumerable<Exercise> current)
    {
        var currentById = new Dictionary<string, Exercise>(StringComparer.Ordinal);
        foreach (var e in current) currentById[e.Id] = e;
        var added = new List<Exercise>();
        var updated = new List<Exercise>();
        var unchanged = new List<Exercise>();
        foreach (var e in incoming)
        {
            if (!currentById.TryGetValue(e.Id, out var existing)) added.Add(e);
            else if (ExercisesEqual(e, existing)) unchanged.Add(e);
            else updated.Add(e);
        }
        return new LibraryDiff(added, updated, unchanged);
    }
}
