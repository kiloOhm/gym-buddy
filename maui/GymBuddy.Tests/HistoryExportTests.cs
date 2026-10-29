using System.Text.Json.Nodes;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>The "gym-buddy-history" v1 file: serialization (byte-exact), parsing rules and warnings, dedupe.</summary>
public class HistoryExportTests
{
    private static readonly DateTimeOffset NOW = new(2026, 10, 29, 16, 4, 5, 123, TimeSpan.FromHours(1));

    // Timestamps at midday UTC so the local date (used in labels) is the same in every test time zone.
    private static WorkoutSession Push() => new()
    {
        Id = "s1",
        PlanId = "p1",
        PlanName = "Push",
        StartedAt = "2026-10-29T11:40:00.000Z",
        FinishedAt = "2026-10-29T12:26:30.000Z",
        Deload = true,
        Exercises =
        [
            new SessionExercise
            {
                Id = "e1",
                ExerciseId = "dumbbell_bench_press",
                SubstitutedFor = "barbell_bench_press",
                TargetSets = 5,
                TargetReps = 6,
                RestSec = 150,
                Sets = [new SetLog { Reps = 6, Weight = 82.5, Completed = true }, new SetLog { Reps = 6, Weight = 0, Completed = false }],
            },
        ],
    };

    private static WorkoutSession Free() => new()
    {
        Id = "s0",
        PlanName = "Free workout",
        StartedAt = "2026-10-27T11:00:00.000Z",
        FinishedAt = "2026-10-27T12:00:00.000Z",
        Exercises =
        [
            new SessionExercise
            {
                Id = "e2", ExerciseId = "pull_up", TargetSets = 3, TargetReps = 10, RestSec = 90,
                Sets = [new SetLog { Reps = 8, Weight = 80, Completed = true }],
            },
        ],
    };

    private const string PushLabel = "Push on Thu, 29 Oct 2026";

    private static string FileWith(JsonNode? sessions, Action<JsonObject>? extra = null)
    {
        var o = new JsonObject { ["format"] = "gym-buddy-history", ["version"] = 1, ["exportedAt"] = GymJson.ToIso(NOW), ["weightUnit"] = "kg", ["sessions"] = sessions };
        extra?.Invoke(o);
        return o.ToJsonString();
    }

    private static string FileWithJson(string sessionsJson, Action<JsonObject>? extra = null) => FileWith(JsonNode.Parse(sessionsJson), extra);

    /// <summary>A valid session JSON object with <paramref name="change"/> applied.</summary>
    private static string SessionJson(Action<JsonObject>? change = null)
    {
        var o = JsonNode.Parse("""
            {"id":"s1","planName":"Push","startedAt":"2026-10-29T11:40:00.000Z","finishedAt":"2026-10-29T12:26:30.000Z",
             "exercises":[{"id":"e1","exerciseId":"barbell_bench_press","targetSets":4,"targetReps":6,"restSec":150,
                           "sets":[{"reps":6,"weight":80,"completed":true}]}]}
            """)!.AsObject();
        change?.Invoke(o);
        return o.ToJsonString();
    }

    private static JsonObject Ex0(JsonObject session) => session["exercises"]![0]!.AsObject();

    private static ParsedHistory Parse(string json, WeightUnit unit = WeightUnit.Kg) => HistoryExport.ParseHistoryExport(json, unit, Real);

    private static ParsedHistory ParseOne(Action<JsonObject> change) => Parse(FileWithJson($"[{SessionJson(change)}]"));

    private static string Throws(Func<object> f) => Assert.Throws<FormatException>(f).Message;

    private static string Serialize(WorkoutSession s) => System.Text.Json.JsonSerializer.Serialize(s, GymJson.Compact);

    // ── serializeHistory ──

    [Fact]
    public void serializeHistory_writes_the_exact_text()
    {
        var expected = """
            {
              "format": "gym-buddy-history",
              "version": 1,
              "exportedAt": "2026-10-29T15:04:05.123Z",
              "weightUnit": "lb",
              "sessions": [
                {
                  "id": "s1",
                  "planId": "p1",
                  "planName": "Push",
                  "startedAt": "2026-10-29T11:40:00.000Z",
                  "finishedAt": "2026-10-29T12:26:30.000Z",
                  "deload": true,
                  "exercises": [
                    {
                      "id": "e1",
                      "exerciseId": "dumbbell_bench_press",
                      "substitutedFor": "barbell_bench_press",
                      "targetSets": 5,
                      "targetReps": 6,
                      "restSec": 150,
                      "sets": [
                        {
                          "reps": 6,
                          "weight": 82.5,
                          "completed": true
                        },
                        {
                          "reps": 6,
                          "weight": 0,
                          "completed": false
                        }
                      ]
                    }
                  ]
                },
                {
                  "id": "s0",
                  "planName": "Free workout",
                  "startedAt": "2026-10-27T11:00:00.000Z",
                  "finishedAt": "2026-10-27T12:00:00.000Z",
                  "exercises": [
                    {
                      "id": "e2",
                      "exerciseId": "pull_up",
                      "targetSets": 3,
                      "targetReps": 10,
                      "restSec": 90,
                      "sets": [
                        {
                          "reps": 8,
                          "weight": 80,
                          "completed": true
                        }
                      ]
                    }
                  ]
                }
              ]
            }
            """;
        Assert.Equal(expected, HistoryExport.SerializeHistory([Push(), Free()], WeightUnit.Lb, NOW));
    }

    [Fact]
    public void serializeHistory_skips_unfinished_sessions()
    {
        var active = Push();
        active.Id = "active";
        active.FinishedAt = null;
        var json = HistoryExport.SerializeHistory([active, Free()], WeightUnit.Kg, NOW);
        var sessions = JsonNode.Parse(json)!["sessions"]!.AsArray();
        Assert.Equal(["s0"], sessions.Select(s => (string?)s!["id"]));
        Assert.Equal("kg", (string?)JsonNode.Parse(json)!["weightUnit"]);
    }

    [Fact]
    public void serializeHistory_round_trips_through_parseHistoryExport()
    {
        var original = new[] { Push(), Free() };
        var result = Parse(HistoryExport.SerializeHistory(original, WeightUnit.Kg, NOW));
        Assert.Empty(result.Warnings);
        Assert.Equal(original.Select(Serialize), result.Sessions.Select(Serialize));
    }

    [Fact]
    public void historyFileName_uses_the_local_date()
    {
        Assert.Equal("gym-buddy-history-2026-10-29.json", HistoryExport.HistoryFileName(NOW));
        Assert.Equal("gym-buddy-history-2027-01-05.json", HistoryExport.HistoryFileName(new DateTimeOffset(2027, 1, 5, 0, 30, 0, TimeSpan.FromHours(2))));
    }

    [Fact]
    public void Expo_file_round_trips_byte_for_byte()
    {
        var text = File.ReadAllText(Path.Combine(RepoRoot, "maui/GymBuddy.Tests/Fixtures/history-from-expo.json"));
        var parsed = HistoryExport.ParseHistoryExport(text, WeightUnit.Kg, GymBuddy.Core.Data.ExerciseLibrary.BuiltInById);
        Assert.Equal(["sess_push_0001", "sess_free_0002"], parsed.Sessions.Select(s => s.Id));
        Assert.Equal(["Free workout on Tue, 27 Oct 2026: unknown exercises kept as 'Unknown exercise': not_in_library"], parsed.Warnings);
        var exportedAt = new DateTimeOffset(2026, 10, 29, 15, 4, 5, 123, TimeSpan.Zero);
        Assert.Equal(text, HistoryExport.SerializeHistory(parsed.Sessions, WeightUnit.Kg, exportedAt));
    }

    // ── file-level errors ──

    [Fact]
    public void rejects_invalid_json()
    {
        Assert.Equal("The file is not valid JSON.", Throws(() => Parse("{nope")));
        Assert.Equal("The file is not valid JSON.", Throws(() => Parse("")));
    }

    [Fact]
    public void rejects_other_files()
    {
        Assert.Equal("This is not a Gym Buddy history file.", Throws(() => Parse("[]")));
        Assert.Equal("This is not a Gym Buddy history file.", Throws(() => Parse("null")));
        Assert.Equal("This is not a Gym Buddy history file.", Throws(() => Parse(FileWithJson("[]", o => o["format"] = "gym-buddy-plans"))));
        Assert.Equal("This is not a Gym Buddy history file.", Throws(() => Parse(FileWithJson("[]", o => o.Remove("format")))));
    }

    [Fact]
    public void rejects_other_versions()
    {
        Assert.Equal("Unsupported file version (2). Update Gym Buddy and try again.", Throws(() => Parse(FileWithJson("[]", o => o["version"] = 2))));
        Assert.Equal("Unsupported file version (1). Update Gym Buddy and try again.", Throws(() => Parse(FileWithJson("[]", o => o["version"] = "1"))));
        Assert.Equal("Unsupported file version (undefined). Update Gym Buddy and try again.", Throws(() => Parse(FileWithJson("[]", o => o.Remove("version")))));
    }

    [Fact]
    public void rejects_a_missing_session_list()
    {
        Assert.Equal("The file does not contain a list of workouts.", Throws(() => Parse(FileWithJson("{}"))));
        Assert.Equal("The file does not contain a list of workouts.", Throws(() => Parse(FileWithJson("[]", o => o.Remove("sessions")))));
    }

    [Fact]
    public void an_empty_list_parses_to_no_sessions()
    {
        var r = Parse(FileWithJson("[]"));
        Assert.Empty(r.Sessions);
        Assert.Empty(r.Warnings);
    }

    // ── per-session rules ──

    [Fact]
    public void skips_sessions_without_an_id()
    {
        var r = Parse(FileWithJson($"""[42, {SessionJson(o => o.Remove("id"))}, {SessionJson(o => o["id"] = "")}, {SessionJson()}]"""));
        Assert.Equal(["Workout 1: skipped, no id", "Workout 2: skipped, no id", "Workout 3: skipped, no id"], r.Warnings);
        Assert.Equal(["s1"], r.Sessions.Select(s => s.Id));
    }

    [Fact]
    public void plan_name_is_trimmed_and_defaults_to_Workout_plan_id_is_optional()
    {
        var r = Parse(FileWithJson($"""
            [{SessionJson(o => { o["id"] = "a"; o["planName"] = "  Legs  "; o["planId"] = "p9"; })},
             {SessionJson(o => { o["id"] = "b"; o["planName"] = "   "; o["planId"] = 7; })},
             {SessionJson(o => { o["id"] = "c"; o.Remove("planName"); })}]
            """));
        Assert.Empty(r.Warnings);
        Assert.Equal([("Legs", "p9"), ("Workout", null), ("Workout", null)], r.Sessions.Select(s => (s.PlanName, s.PlanId)));
    }

    [Fact]
    public void skips_unfinished_sessions_and_bad_start_times()
    {
        var r = Parse(FileWithJson($"""
            [{SessionJson(o => o.Remove("finishedAt"))},
             {SessionJson(o => o["finishedAt"] = "yesterday")},
             {SessionJson(o => o["finishedAt"] = null)},
             {SessionJson(o => o["startedAt"] = "soon")},
             {SessionJson(o => o.Remove("startedAt"))}]
            """));
        Assert.Empty(r.Sessions);
        Assert.Equal(
            ["Workout 1: skipped, not finished", "Workout 2: skipped, not finished", "Workout 3: skipped, not finished",
             $"{PushLabel}: skipped, invalid start time", $"{PushLabel}: skipped, invalid start time"],
            r.Warnings);
    }

    [Fact]
    public void skips_sessions_without_an_exercise_list()
    {
        var r = ParseOne(o => o["exercises"] = "bench");
        Assert.Empty(r.Sessions);
        Assert.Equal([$"{PushLabel}: skipped, no exercise list"], r.Warnings);
    }

    [Fact]
    public void a_session_with_zero_exercises_is_imported_without_warning()
    {
        var r = ParseOne(o => o["exercises"] = new JsonArray());
        Assert.Empty(r.Warnings);
        Assert.Empty(Assert.Single(r.Sessions).Exercises);
    }

    [Fact]
    public void deload_is_kept_when_boolean_and_dropped_otherwise()
    {
        var r = Parse(FileWithJson($"""
            [{SessionJson(o => { o["id"] = "a"; o["deload"] = true; })},
             {SessionJson(o => { o["id"] = "b"; o["deload"] = false; })},
             {SessionJson(o => { o["id"] = "c"; o["deload"] = "yes"; })},
             {SessionJson(o => { o["id"] = "d"; o["deload"] = null; })},
             {SessionJson(o => o["id"] = "e")}]
            """));
        Assert.Empty(r.Warnings);
        Assert.Equal([true, false, null, null, null], r.Sessions.Select(s => s.Deload));
        var json = HistoryExport.SerializeHistory(r.Sessions, WeightUnit.Kg, NOW);
        var sessions = JsonNode.Parse(json)!["sessions"]!.AsArray();
        Assert.Equal(["true", "false", null, null, null], sessions.Select(s => s!["deload"]?.ToJsonString()));
        Assert.Contains("\"finishedAt\": \"2026-10-29T12:26:30.000Z\",\n      \"deload\": false,\n      \"exercises\"", json);
    }

    // ── per-exercise rules ──

    [Fact]
    public void skips_exercises_without_an_exercise_id()
    {
        var r = ParseOne(o =>
        {
            var arr = o["exercises"]!.AsArray();
            arr.Insert(0, "x");
            arr.Add(new JsonObject { ["exerciseId"] = "" });
        });
        Assert.Equal([$"{PushLabel}: skipped exercise 1 without an exercise id", $"{PushLabel}: skipped exercise 3 without an exercise id"], r.Warnings);
        Assert.Equal(["barbell_bench_press"], Assert.Single(r.Sessions).Exercises.Select(e => e.ExerciseId));
    }

    [Fact]
    public void exercise_id_is_kept_or_generated_substitutedFor_optional()
    {
        var r = ParseOne(o =>
        {
            Ex0(o)["substitutedFor"] = "pull_up";
            o["exercises"]!.AsArray().Add(new JsonObject
            {
                ["id"] = 5, ["exerciseId"] = "pull_up", ["substitutedFor"] = false, ["targetSets"] = 1, ["targetReps"] = 1, ["restSec"] = 1, ["sets"] = new JsonArray(),
            });
        });
        Assert.Empty(r.Warnings);
        var exs = Assert.Single(r.Sessions).Exercises;
        Assert.Equal(("e1", "pull_up"), (exs[0].Id, exs[0].SubstitutedFor));
        Assert.False(string.IsNullOrEmpty(exs[1].Id));
        Assert.NotEqual("5", exs[1].Id);
        Assert.Null(exs[1].SubstitutedFor);
    }

    [Fact]
    public void targets_are_rounded_clamped_at_0_and_invalid_ones_become_0_with_a_warning()
    {
        var r = ParseOne(o =>
        {
            var ex = Ex0(o);
            ex["targetSets"] = 3.6;
            ex["targetReps"] = -4;
            ex["restSec"] = "90";
        });
        Assert.Equal([$"{PushLabel}: invalid restSec for Barbell bench press, using 0"], r.Warnings);
        var e = Assert.Single(Assert.Single(r.Sessions).Exercises);
        Assert.Equal((4, 0, 0), (e.TargetSets, e.TargetReps, e.RestSec));

        r = ParseOne(o =>
        {
            var ex = Ex0(o);
            ex.Remove("targetSets");
            ex["targetReps"] = null;
        });
        Assert.Equal(
            [$"{PushLabel}: invalid targetSets for Barbell bench press, using 0", $"{PushLabel}: invalid targetReps for Barbell bench press, using 0"],
            r.Warnings);
    }

    [Fact]
    public void a_missing_set_list_becomes_empty_with_a_warning()
    {
        var r = ParseOne(o => Ex0(o).Remove("sets"));
        Assert.Equal([$"{PushLabel}: Barbell bench press has no set list"], r.Warnings);
        Assert.Empty(Assert.Single(Assert.Single(r.Sessions).Exercises).Sets);
    }

    [Fact]
    public void sets_are_normalised_and_invalid_sets_skipped()
    {
        var r = ParseOne(o => Ex0(o)["sets"] = JsonNode.Parse("""
            [{"reps":5.5,"weight":82.5,"completed":true},
             {"reps":-2,"weight":-10},
             {"reps":"5","weight":80},
             {"reps":5},
             {"reps":5,"weight":80,"completed":"yes"},
             7]
            """));
        Assert.Equal(Enumerable.Repeat($"{PushLabel}: skipped an invalid set of Barbell bench press", 4), r.Warnings);
        var sets = Assert.Single(Assert.Single(r.Sessions).Exercises).Sets;
        Assert.Equal([(6, 82.5, true), (0, 0.0, false)], sets.Select(s => (s.Reps, s.Weight, s.Completed)));
    }

    [Fact]
    public void unknown_exercises_are_kept_with_one_warning_per_session()
    {
        var r = ParseOne(o =>
        {
            var arr = o["exercises"]!.AsArray();
            arr.Add(JsonNode.Parse("""{"id":"x1","exerciseId":"moon_press","targetSets":1,"targetReps":1,"restSec":1}"""));
            arr.Add(JsonNode.Parse("""{"id":"x2","exerciseId":"zercher_carry","targetSets":1,"targetReps":1,"restSec":1,"sets":[]}"""));
            arr.Add(JsonNode.Parse("""{"id":"x3","exerciseId":"moon_press","targetSets":1,"targetReps":1,"restSec":1,"sets":[]}"""));
        });
        Assert.Equal(
            [$"{PushLabel}: moon_press has no set list", $"{PushLabel}: unknown exercises kept as 'Unknown exercise': moon_press, zercher_carry"],
            r.Warnings);
        Assert.Equal(["barbell_bench_press", "moon_press", "zercher_carry", "moon_press"], Assert.Single(r.Sessions).Exercises.Select(e => e.ExerciseId));
    }

    // ── unit ──

    [Fact]
    public void a_different_weight_unit_is_the_first_warning()
    {
        var json = FileWithJson($"[{SessionJson(o => o["exercises"] = "x")}]", o => o["weightUnit"] = "lb");
        var r = Parse(json, WeightUnit.Kg);
        Assert.Equal(
            ["The file's weights are in lb, your unit is kg. They are imported as entered, without conversion.", $"{PushLabel}: skipped, no exercise list"],
            r.Warnings);

        r = Parse(FileWithJson("[]", o => o["weightUnit"] = "kg"), WeightUnit.Lb);
        Assert.Equal(["The file's weights are in kg, your unit is lb. They are imported as entered, without conversion."], r.Warnings);
    }

    [Fact]
    public void the_same_missing_or_invalid_weight_unit_gives_no_warning()
    {
        Assert.Empty(Parse(FileWithJson("[]", o => o["weightUnit"] = "kg"), WeightUnit.Kg).Warnings);
        Assert.Empty(Parse(FileWithJson("[]", o => o.Remove("weightUnit")), WeightUnit.Lb).Warnings);
        Assert.Empty(Parse(FileWithJson("[]", o => o["weightUnit"] = "stone"), WeightUnit.Lb).Warnings);
        Assert.Empty(Parse(FileWithJson("[]", o => o["weightUnit"] = 1), WeightUnit.Lb).Warnings);
    }

    // ── dedupe ──

    [Fact]
    public void dedupe_skips_sessions_already_in_the_history_and_in_file_duplicates()
    {
        var existing = new[] { Free() };
        var dupOfExisting = Push();
        dupOfExisting.Id = "s0";
        var first = Push();
        var second = Push();
        second.PlanName = "Push again";
        var other = Free();
        other.Id = "s2";

        var result = HistoryExport.DedupeSessions([dupOfExisting, first, second, other], existing);

        Assert.Equal([first, other], result.Sessions);
        Assert.Equal([$"{PushLabel}: already in your history", "Push again on Thu, 29 Oct 2026: duplicate within the file"], result.Skipped);
    }

    [Fact]
    public void dedupe_with_nothing_existing_keeps_everything()
    {
        var result = HistoryExport.DedupeSessions([Push(), Free()], []);
        Assert.Equal(["s1", "s0"], result.Sessions.Select(s => s.Id));
        Assert.Empty(result.Skipped);
    }
}
