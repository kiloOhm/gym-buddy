using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace GymBuddy.Core.Logic;

public sealed record ParsedHistory(IReadOnlyList<WorkoutSession> Sessions, IReadOnlyList<string> Warnings);

/// <param name="Sessions">Sessions to import, in file order, with in-file duplicates removed (first occurrence wins).</param>
/// <param name="Skipped">One line per skipped session: "Push on Thu, 29 Oct 2026: already in your history" or "…: duplicate within the file".</param>
public sealed record SessionDedupeResult(IReadOnlyList<WorkoutSession> Sessions, IReadOnlyList<string> Skipped);

// The "gym-buddy-history" file. Property order is the wire format (byte-equal with the TypeScript app's output).
public sealed record HistoryExportFile(string Format, int Version, string ExportedAt, WeightUnit WeightUnit, IReadOnlyList<HistorySessionDto> Sessions);

public sealed record HistorySessionDto(string Id, string? PlanId, string PlanName, string StartedAt, string FinishedAt, bool? Deload, IReadOnlyList<HistoryExerciseDto> Exercises);

public sealed record HistoryExerciseDto(string Id, string ExerciseId, string? SubstitutedFor, int TargetSets, int TargetReps, int RestSec, IReadOnlyList<HistorySetDto> Sets);

public sealed record HistorySetDto(int Reps, double Weight, bool Completed);

/// <summary>Workout-history export/import file format (shared with src/logic/historyExport.ts).</summary>
public static class HistoryExport
{
    public const string Format = "gym-buddy-history";
    public const int Version = 1;
    private const string FallbackPlanName = "Workout";

    private static bool IsFinished(WorkoutSession s) => s.FinishedAt is not null;

    private static HistorySessionDto ToDto(WorkoutSession s) => new(
        s.Id, s.PlanId, s.PlanName, s.StartedAt, s.FinishedAt!, s.Deload,
        s.Exercises.Select(e => new HistoryExerciseDto(
            e.Id, e.ExerciseId, e.SubstitutedFor, e.TargetSets, e.TargetReps, e.RestSec,
            e.Sets.Select(set => new HistorySetDto(set.Reps, set.Weight, set.Completed)).ToList())).ToList());

    /// <summary>Finished sessions (in the given order) as pretty-printed JSON; weights as stored.</summary>
    public static string SerializeHistory(IEnumerable<WorkoutSession> sessions, WeightUnit unit, DateTimeOffset now)
    {
        var file = new HistoryExportFile(Format, Version, GymJson.ToIso(now), unit, sessions.Where(IsFinished).Select(ToDto).ToList());
        return JsonSerializer.Serialize(file, GymJson.Indented);
    }

    /// <summary>"gym-buddy-history-2026-10-29.json" (local date of <paramref name="localNow"/>).</summary>
    public static string HistoryFileName(DateTimeOffset localNow) =>
        string.Create(CultureInfo.InvariantCulture, $"gym-buddy-history-{localNow.Year:0000}-{localNow.Month:00}-{localNow.Day:00}.json");

    /// <summary>"Push on Thu, 29 Oct 2026" (date like the History list); just the plan name while unfinished.</summary>
    public static string SessionLabel(WorkoutSession s) =>
        string.IsNullOrEmpty(s.FinishedAt) ? s.PlanName : $"{s.PlanName} on {SessionFormat.FormatSessionDate(s.FinishedAt)}";

    private static int ReadInt(JsonObject obj, string field, string context, string exerciseName, List<string> warnings)
    {
        if (!JsJson.IsNumber(JsJson.Get(obj, field).Value, out var n))
        {
            warnings.Add($"{context}: invalid {field} for {exerciseName}, using 0");
            return 0;
        }
        return (int)Math.Min(int.MaxValue, Math.Max(0, JsMath.Round(n)));
    }

    private static SetLog? ReadSet(JsonNode? node)
    {
        if (node is not JsonObject obj) return null;
        if (!JsJson.IsNumber(JsJson.Get(obj, "reps").Value, out var reps)) return null;
        if (!JsJson.IsNumber(JsJson.Get(obj, "weight").Value, out var weight)) return null;
        var (hasCompleted, completedNode) = JsJson.Get(obj, "completed");
        var completed = false;
        if (hasCompleted && !JsJson.IsBool(completedNode, out completed)) return null;
        return new SetLog
        {
            Reps = (int)Math.Min(int.MaxValue, Math.Max(0, JsMath.Round(reps))),
            Weight = Math.Max(0, weight),
            Completed = completed,
        };
    }

    /// <summary>
    /// Parses a history file. Throws <see cref="FormatException"/> with a human-readable message when the file as a
    /// whole is unusable; broken sessions, exercises and sets are skipped or fixed up and reported as warnings.
    /// </summary>
    public static ParsedHistory ParseHistoryExport(string json, WeightUnit unit, IReadOnlyDictionary<string, Exercise> db)
    {
        var data = JsJson.Parse(json, "The file is not valid JSON.");
        if (data is not JsonObject obj || !JsJson.IsString(JsJson.Get(obj, "format").Value, out var format) || format != Format)
            throw new FormatException("This is not a Gym Buddy history file.");
        var (hasVersion, versionNode) = JsJson.Get(obj, "version");
        if (!JsJson.IsNumber(versionNode, out var version) || version != Version)
            throw new FormatException($"Unsupported file version ({JsJson.JsString(hasVersion, versionNode)}). Update Gym Buddy and try again.");
        if (JsJson.Get(obj, "sessions").Value is not JsonArray rawSessions)
            throw new FormatException("The file does not contain a list of workouts.");

        var warnings = new List<string>();
        if (JsJson.IsString(JsJson.Get(obj, "weightUnit").Value, out var unitSlug) && WeightUnits.TryParse(unitSlug, out var fileUnit) && fileUnit != unit)
            warnings.Add($"The file's weights are in {fileUnit.Slug()}, your unit is {unit.Slug()}. They are imported as entered, without conversion.");

        var sessions = new List<WorkoutSession>();
        for (var index = 0; index < rawSessions.Count; index++)
        {
            var position = $"Workout {index + 1}";
            if (rawSessions[index] is not JsonObject raw || !JsJson.IsString(JsJson.Get(raw, "id").Value, out var id) || id.Length == 0)
            {
                warnings.Add($"{position}: skipped, no id");
                continue;
            }
            var planName = JsJson.IsString(JsJson.Get(raw, "planName").Value, out var rawName) ? rawName.Trim() : "";
            if (planName.Length == 0) planName = FallbackPlanName;
            string? planId = JsJson.IsString(JsJson.Get(raw, "planId").Value, out var rawPlanId) ? rawPlanId : null;

            if (!JsJson.IsString(JsJson.Get(raw, "finishedAt").Value, out var finishedAt) || Ids.ParseIsoMs(finishedAt) is null)
            {
                warnings.Add($"{position}: skipped, not finished");
                continue;
            }
            var label = $"{planName} on {SessionFormat.FormatSessionDate(finishedAt)}";
            if (!JsJson.IsString(JsJson.Get(raw, "startedAt").Value, out var startedAt) || Ids.ParseIsoMs(startedAt) is null)
            {
                warnings.Add($"{label}: skipped, invalid start time");
                continue;
            }
            if (JsJson.Get(raw, "exercises").Value is not JsonArray rawExercises)
            {
                warnings.Add($"{label}: skipped, no exercise list");
                continue;
            }

            var exercises = new List<SessionExercise>();
            var unknown = new List<string>();
            for (var exIndex = 0; exIndex < rawExercises.Count; exIndex++)
            {
                if (rawExercises[exIndex] is not JsonObject rawEx
                    || !JsJson.IsString(JsJson.Get(rawEx, "exerciseId").Value, out var exerciseId)
                    || exerciseId.Length == 0)
                {
                    warnings.Add($"{label}: skipped exercise {exIndex + 1} without an exercise id");
                    continue;
                }
                string exerciseName;
                if (db.TryGetValue(exerciseId, out var known)) exerciseName = known.Name;
                else
                {
                    exerciseName = exerciseId;
                    if (!unknown.Contains(exerciseId)) unknown.Add(exerciseId);
                }
                var exId = JsJson.IsString(JsJson.Get(rawEx, "id").Value, out var rawExId) ? rawExId : Ids.NewId();
                string? substitutedFor = JsJson.IsString(JsJson.Get(rawEx, "substitutedFor").Value, out var rawSub) ? rawSub : null;
                var targetSets = ReadInt(rawEx, "targetSets", label, exerciseName, warnings);
                var targetReps = ReadInt(rawEx, "targetReps", label, exerciseName, warnings);
                var restSec = ReadInt(rawEx, "restSec", label, exerciseName, warnings);

                var sets = new List<SetLog>();
                if (JsJson.Get(rawEx, "sets").Value is JsonArray rawSets)
                {
                    foreach (var rawSet in rawSets)
                    {
                        if (ReadSet(rawSet) is { } set) sets.Add(set);
                        else warnings.Add($"{label}: skipped an invalid set of {exerciseName}");
                    }
                }
                else warnings.Add($"{label}: {exerciseName} has no set list");

                exercises.Add(new SessionExercise
                {
                    Id = exId,
                    ExerciseId = exerciseId,
                    SubstitutedFor = substitutedFor,
                    TargetSets = targetSets,
                    TargetReps = targetReps,
                    RestSec = restSec,
                    Sets = sets,
                });
            }
            if (unknown.Count > 0)
                warnings.Add($"{label}: unknown exercises kept as 'Unknown exercise': {string.Join(", ", unknown)}");

            sessions.Add(new WorkoutSession
            {
                Id = id,
                PlanId = planId,
                PlanName = planName,
                StartedAt = startedAt,
                FinishedAt = finishedAt,
                Deload = JsJson.IsBool(JsJson.Get(raw, "deload").Value, out var deload) ? deload : null,
                Exercises = exercises,
            });
        }

        return new ParsedHistory(sessions, warnings);
    }

    /// <summary>Drops incoming sessions whose id is already in <paramref name="existing"/> or earlier in the file.</summary>
    public static SessionDedupeResult DedupeSessions(IEnumerable<WorkoutSession> incoming, IEnumerable<WorkoutSession> existing)
    {
        var existingIds = existing.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var sessions = new List<WorkoutSession>();
        var skipped = new List<string>();
        foreach (var s in incoming)
        {
            if (existingIds.Contains(s.Id)) skipped.Add($"{SessionLabel(s)}: already in your history");
            else if (!seen.Add(s.Id)) skipped.Add($"{SessionLabel(s)}: duplicate within the file");
            else sessions.Add(s);
        }
        return new SessionDedupeResult(sessions, skipped);
    }
}
