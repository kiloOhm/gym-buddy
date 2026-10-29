using System.Text.Json;
using System.Text.Json.Nodes;
using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/library.test.ts, plus the file-compatibility checks against the TypeScript app.</summary>
public class LibraryFormatTests
{
    private static Exercise E(string id, string name) => Ex(id, name: name, cues: ["Stay tight"]);

    private static readonly Exercise A = E("a", "Alpha");
    private static readonly Exercise B = E("b", "Bravo");
    private static readonly Exercise C = E("c", "Charlie");

    private static string File(IEnumerable<JsonNode?> exercises, Action<JsonObject>? extra = null)
    {
        var o = new JsonObject
        {
            ["format"] = "gym-buddy-exercises",
            ["version"] = 2,
            ["exportedAt"] = "x",
            ["exercises"] = new JsonArray(exercises.Select(e => e?.DeepClone()).ToArray()),
        };
        extra?.Invoke(o);
        return o.ToJsonString();
    }

    private static string File(params Exercise[] exercises) => File(exercises.Select(e => (JsonNode)ToJson(e)));

    /// <summary>A version 1 entry: formDifficulty + injuryRisk instead of difficulty (null = leave the key out).</summary>
    private static JsonObject Legacy(Exercise e, JsonNode? formDifficulty, JsonNode? injuryRisk)
    {
        var o = ToJson(e);
        o.Remove("difficulty");
        if (formDifficulty is not null) o["formDifficulty"] = formDifficulty;
        if (injuryRisk is not null) o["injuryRisk"] = injuryRisk;
        return o;
    }

    /// <summary>Parses a file with a single entry built from A plus the change.</summary>
    private static ParsedLibrary ParseOne(Action<JsonObject> change)
    {
        var o = ToJson(A);
        change(o);
        return LibraryFormat.ParseLibraryExport(File([o]));
    }

    // ── mergeLibrary ──

    [Fact]
    public void mergeLibrary_returns_the_built_ins_when_there_are_no_custom_entries()
    {
        Assert.Equal([A, B], LibraryFormat.MergeLibrary([A, B], []));
    }

    [Fact]
    public void mergeLibrary_replaces_built_ins_with_custom_entries_of_the_same_id_in_place()
    {
        var editedB = B with { Difficulty = 5 };
        Assert.Equal([A, editedB, C], LibraryFormat.MergeLibrary([A, B, C], [editedB]));
    }

    [Fact]
    public void mergeLibrary_appends_new_ids_after_the_built_ins_sorted_by_name()
    {
        var zulu = E("z", "Zulu");
        var delta = E("d", "Delta");
        var editedA = A with { Name = "Alpha 2" };
        var merged = LibraryFormat.MergeLibrary([A, B], [zulu, editedA, delta]);
        Assert.Equal(["a", "b", "d", "z"], merged.Select(e => e.Id));
        Assert.Same(editedA, merged[0]);
    }

    // ── serializeLibrary / libraryFileName ──

    private static readonly DateTimeOffset Now = new(2026, 10, 7, 12, 0, 0, TimeSpan.FromHours(2));

    [Fact]
    public void serializeLibrary_writes_pretty_JSON_with_the_file_header()
    {
        var json = LibraryFormat.SerializeLibrary([A, B], Now);
        var data = JsonNode.Parse(json)!.AsObject();
        Assert.Equal("gym-buddy-exercises", (string?)data["format"]);
        Assert.Equal(2, (int?)data["version"]);
        Assert.Equal(GymJson.ToIso(Now), (string?)data["exportedAt"]);
        Assert.Equal("2026-10-07T10:00:00.000Z", (string?)data["exportedAt"]);
        Assert.Equal([A, B], data["exercises"].Deserialize<List<Exercise>>(GymJson.Compact)!);
        Assert.Contains("\n  \"format\"", json);
    }

    [Fact]
    public void serializeLibrary_round_trips_the_whole_built_in_library_without_warnings()
    {
        var parsed = LibraryFormat.ParseLibraryExport(LibraryFormat.SerializeLibrary(BuiltInExercises.All, Now));
        Assert.Empty(parsed.Warnings);
        Assert.Equal(123, parsed.Exercises.Count);
        Assert.Equal(BuiltInExercises.All, parsed.Exercises);
        var diff = LibraryFormat.DiffLibrary(parsed.Exercises, BuiltInExercises.All);
        Assert.Equal(BuiltInExercises.All.Count, diff.Unchanged.Count);
        Assert.Empty(diff.Added);
        Assert.Empty(diff.Updated);
    }

    [Fact]
    public void libraryFileName_names_the_file_after_the_local_date()
    {
        Assert.Equal("gym-buddy-exercises-2026-10-07.json", LibraryFormat.LibraryFileName(Now));
    }

    // ── compatibility with the TypeScript app's files ──

    [Fact]
    public void serializeLibrary_is_byte_identical_to_the_typescript_export_of_the_built_ins()
    {
        // Fixture written by maui/scripts/generate-exercises.mjs with JSON.stringify(file, null, 2).
        var expected = System.IO.File.ReadAllText(Path.Combine(RepoRoot, "maui/GymBuddy.Tests/Fixtures/built-in-library.json"));
        var actual = LibraryFormat.SerializeLibrary(BuiltInExercises.All, DateTimeOffset.Parse("2026-01-01T00:00:00Z", System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void serializeLibrary_reproduces_the_repo_gym_buddy_exercises_json_byte_for_byte()
    {
        // The repo file may lag behind the source by an exercise, so export exactly the ids it contains.
        var text = System.IO.File.ReadAllText(Path.Combine(RepoRoot, "gym-buddy-exercises.json"));
        var file = JsonNode.Parse(text)!.AsObject();
        var ids = file["exercises"]!.AsArray().Select(e => (string)e!["id"]!).ToHashSet();
        var exportedAt = DateTimeOffset.Parse((string)file["exportedAt"]!, System.Globalization.CultureInfo.InvariantCulture);
        var json = LibraryFormat.SerializeLibrary(BuiltInExercises.All.Where(e => ids.Contains(e.Id)), exportedAt);
        Assert.Equal(text, json + "\n");
    }

    [Fact]
    public void the_repo_gym_buddy_exercises_json_parses_without_warnings()
    {
        var parsed = LibraryFormat.ParseLibraryExport(System.IO.File.ReadAllText(Path.Combine(RepoRoot, "gym-buddy-exercises.json")));
        Assert.Empty(parsed.Warnings);
        Assert.True(parsed.Exercises.Count >= 122);
        foreach (var e in parsed.Exercises) Assert.Equal(ExerciseLibrary.BuiltInById[e.Id], e);
    }

    // ── parseLibraryExport: whole-file errors ──

    [Fact]
    public void parseLibraryExport_rejects_invalid_JSON()
    {
        Assert.Contains("not valid JSON", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport("{nope")).Message);
    }

    [Theory]
    [InlineData("a plans file", """{"format":"gym-buddy-plans","version":1,"plans":[]}""")]
    [InlineData("a missing format", """{"version":1,"exercises":[]}""")]
    [InlineData("an array", "[]")]
    [InlineData("null", "null")]
    public void parseLibraryExport_rejects(string label, string json)
    {
        _ = label;
        Assert.Contains("not a Gym Buddy exercise library file", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport(json)).Message);
    }

    [Fact]
    public void parseLibraryExport_rejects_an_unsupported_version()
    {
        Assert.Contains("Unsupported file version (3)", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport(File([], o => o["version"] = 3))).Message);
        Assert.Contains("Unsupported file version", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport(File([], o => o.Remove("version")))).Message);
        Assert.Contains("Unsupported file version (undefined)", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport(File([], o => o.Remove("version")))).Message);
    }

    [Fact]
    public void parseLibraryExport_rejects_a_missing_exercise_list()
    {
        Assert.Contains("list of exercises", Assert.Throws<FormatException>(() => LibraryFormat.ParseLibraryExport(File([], o => o["exercises"] = new JsonObject { ["a"] = 1 }))).Message);
    }

    [Fact]
    public void parseLibraryExport_accepts_an_empty_list()
    {
        var parsed = LibraryFormat.ParseLibraryExport(File([]));
        Assert.Empty(parsed.Exercises);
        Assert.Empty(parsed.Warnings);
    }

    // ── parseLibraryExport: entries ──

    [Fact]
    public void accepts_a_valid_entry_unchanged()
    {
        var parsed = ParseOne(_ => { });
        Assert.Equal([A], parsed.Exercises);
        Assert.Empty(parsed.Warnings);
    }

    [Fact]
    public void drops_unknown_keys_and_trims_the_name()
    {
        var parsed = ParseOne(o => { o["name"] = "  Alpha  "; o["note"] = "x"; });
        Assert.Equal([A], parsed.Exercises);
        Assert.Empty(parsed.Warnings);
    }

    [Fact]
    public void skips_entries_that_are_not_objects()
    {
        var parsed = LibraryFormat.ParseLibraryExport(File([JsonValue.Create(42), ToJson(A)]));
        Assert.Equal([A], parsed.Exercises);
        Assert.Equal(["Exercise 1: skipped, entry 1 is not an object"], parsed.Warnings);
    }

    public static TheoryData<string, string, string> SkipCases => new()
    {
        { "a missing id", """{"id":null}""", "id must be" },
        { "an id with capitals", """{"id":"Bad_Id"}""", "id must be" },
        { "an id with dashes", """{"id":"bad-id"}""", "id must be" },
        { "a missing name", """{"name":null}""", "name is missing" },
        { "a blank name", """{"name":"   "}""", "name is missing" },
        { "missing equipment", """{"equipment":null}""", "equipment must be a non-empty list" },
        { "empty equipment", """{"equipment":[]}""", "equipment must be a non-empty list" },
        { "unknown equipment", """{"equipment":["rope"]}""", "unknown equipment 'rope'" },
        { "an unknown pattern", """{"pattern":"jump"}""", "unknown movement pattern 'jump'" },
        { "a non-boolean compound", """{"compound":"yes"}""", "compound must be true or false" },
        { "missing muscles", """{"muscles":null}""", "muscles must be an object" },
        { "muscles as an array", """{"muscles":["biceps"]}""", "muscles must be an object" },
        { "empty muscles", """{"muscles":{}}""", "muscles is empty" },
        { "an unknown muscle", """{"muscles":{"biceps":1,"neck":0.5}}""", "unknown muscle group 'neck'" },
        { "a zero activation", """{"muscles":{"biceps":1,"forearms":0}}""", "activation for forearms" },
        { "an activation above 1", """{"muscles":{"biceps":1.2}}""", "activation for biceps" },
        { "a string activation", """{"muscles":{"biceps":"1"}}""", "activation for biceps" },
        { "a non-numeric difficulty", """{"difficulty":"hard"}""", "difficulty must be a number from 1 to 5" },
        { "a missing difficulty", """{"difficulty":"__undefined__"}""", "difficulty must be a number from 1 to 5" },
        { "a NaN-like difficulty", """{"difficulty":null}""", "difficulty must be a number from 1 to 5" },
        { "cues that are not a list", """{"cues":"Stay tight"}""", "cues must be a list of strings" },
        { "a non-string cue", """{"cues":["ok",3]}""", "cues must be a list of strings" },
    };

    /// <summary>
    /// Overrides as JSON. In the TS test `{ id: undefined }` removes the key (JSON.stringify drops it); here a
    /// null override removes the key too, except for difficulty/cues where "__undefined__" removes and null stays null.
    /// </summary>
    [Theory]
    [MemberData(nameof(SkipCases))]
    public void skips_an_entry_with(string label, string overridesJson, string problem)
    {
        _ = label;
        var overrides = JsonNode.Parse(overridesJson)!.AsObject();
        var parsed = ParseOne(o =>
        {
            foreach (var (key, value) in overrides)
            {
                var keepNull = key is "difficulty" or "cues";
                if (value is null && !keepNull) o.Remove(key);
                else if (value is JsonValue v && v.GetValueKind() == JsonValueKind.String && v.GetValue<string>() == "__undefined__") o.Remove(key);
                else o[key] = value?.DeepClone();
            }
        });
        Assert.Empty(parsed.Exercises);
        var warning = Assert.Single(parsed.Warnings);
        Assert.Contains("skipped", warning);
        Assert.Contains(problem, warning);
    }

    [Fact]
    public void names_a_skipped_entry_by_name_and_id()
    {
        Assert.StartsWith("Alpha (a): skipped", ParseOne(o => o["pattern"] = "jump").Warnings[0]);
        Assert.StartsWith("a: skipped", ParseOne(o => o["name"] = "").Warnings[0]);
    }

    [Fact]
    public void keeps_the_valid_entries_next_to_skipped_ones()
    {
        var badB = ToJson(B);
        badB["pattern"] = "jump";
        var parsed = LibraryFormat.ParseLibraryExport(File([ToJson(A), badB, ToJson(C)]));
        Assert.Equal([A, C], parsed.Exercises);
    }

    [Fact]
    public void dedupes_equipment()
    {
        var parsed = ParseOne(o => o["equipment"] = new JsonArray("dumbbell", "bench", "dumbbell"));
        Assert.Equal([Equipment.Dumbbell, Equipment.Bench], parsed.Exercises[0].Equipment);
        Assert.Empty(parsed.Warnings);
    }

    [Fact]
    public void scales_activations_so_the_max_becomes_1_with_a_warning()
    {
        var parsed = ParseOne(o => o["muscles"] = new JsonObject { ["biceps"] = 0.8, ["forearms"] = 0.4, ["lats"] = 0.2 });
        Assert.Equal(M((MuscleGroup.Biceps, 1), (MuscleGroup.Forearms, 0.5), (MuscleGroup.Lats, 0.25)), parsed.Exercises[0].Muscles);
        Assert.Equal(["Alpha (a): muscle activations scaled so the primary target is 1"], parsed.Warnings);
    }

    [Fact]
    public void clamps_an_out_of_range_difficulty_with_a_warning()
    {
        var high = ParseOne(o => o["difficulty"] = 7);
        Assert.Equal(5, high.Exercises[0].Difficulty);
        Assert.Equal(["Alpha (a): difficulty 7 adjusted to 5"], high.Warnings);
        var low = ParseOne(o => o["difficulty"] = 0);
        Assert.Equal(1, low.Exercises[0].Difficulty);
        Assert.Equal(["Alpha (a): difficulty 0 adjusted to 1"], low.Warnings);
    }

    [Fact]
    public void rounds_a_fractional_difficulty_with_a_warning()
    {
        var parsed = ParseOne(o => o["difficulty"] = 2.6);
        Assert.Equal(3, parsed.Exercises[0].Difficulty);
        Assert.Equal(["Alpha (a): difficulty 2.6 adjusted to 3"], parsed.Warnings);
    }

    [Fact]
    public void treats_missing_cues_as_none()
    {
        var parsed = ParseOne(o => o.Remove("cues"));
        Assert.Empty(parsed.Exercises[0].Cues);
        Assert.Empty(parsed.Warnings);
    }

    [Fact]
    public void trims_cues_and_drops_empty_ones_with_a_warning()
    {
        var parsed = ParseOne(o => o["cues"] = new JsonArray("  Brace  ", "", "   "));
        Assert.Equal(["Brace"], parsed.Exercises[0].Cues);
        Assert.Equal(["Alpha (a): empty cues removed"], parsed.Warnings);
    }

    [Fact]
    public void truncates_more_than_4_cues_with_a_warning()
    {
        var parsed = ParseOne(o => o["cues"] = new JsonArray("1", "2", "3", "4", "5"));
        Assert.Equal(["1", "2", "3", "4"], parsed.Exercises[0].Cues);
        Assert.Equal(["Alpha (a): only the first 4 cues kept"], parsed.Warnings);
    }

    [Fact]
    public void uses_the_last_of_duplicate_ids_with_a_warning()
    {
        var second = A with { Name = "Alpha again" };
        var parsed = LibraryFormat.ParseLibraryExport(File(A, B, second));
        Assert.Equal([B, second], parsed.Exercises);
        Assert.Equal(["a: appears more than once, the last entry is used"], parsed.Warnings);
    }

    // ── parseLibraryExport: version 1 files ──

    private static string V1(params JsonNode[] exercises) => File(exercises, o => o["version"] = 1);

    [Fact]
    public void v1_derives_difficulty_as_the_mean_of_the_old_ratings_rounded_half_up()
    {
        var parsed = LibraryFormat.ParseLibraryExport(V1(Legacy(A, 2, 2), Legacy(B, 3, 4), Legacy(C, 1, 2)));
        Assert.Equal([2, 4, 2], parsed.Exercises.Select(e => e.Difficulty));
        Assert.Equal(A, parsed.Exercises[0]);
        var json = JsonSerializer.Serialize(parsed.Exercises[1], GymJson.Compact);
        Assert.DoesNotContain("formDifficulty", json);
        Assert.DoesNotContain("injuryRisk", json);
        Assert.Equal([LibraryFormat.LegacyRatingsWarning], parsed.Warnings);
    }

    [Fact]
    public void v1_clamps_converted_ratings_to_1_5()
    {
        var parsed = LibraryFormat.ParseLibraryExport(V1(Legacy(A, 7, 9), Legacy(B, 0, -1)));
        Assert.Equal([5, 1], parsed.Exercises.Select(e => e.Difficulty));
        Assert.Equal(["Converted form/injury ratings to the single difficulty score"], parsed.Warnings);
    }

    [Fact]
    public void v1_round_trips_the_built_in_library_through_the_old_format()
    {
        var old = BuiltInExercises.All.Select(e => (JsonNode)Legacy(e, e.Difficulty, e.Difficulty)).ToArray();
        var parsed = LibraryFormat.ParseLibraryExport(V1(old));
        Assert.Equal(BuiltInExercises.All, parsed.Exercises);
        Assert.Equal([LibraryFormat.LegacyRatingsWarning], parsed.Warnings);
    }

    [Fact]
    public void v1_skips_entries_whose_old_ratings_are_missing_or_not_numbers()
    {
        var parsed = LibraryFormat.ParseLibraryExport(V1(Legacy(A, "hard", 2), Legacy(B, 2, null), Legacy(C, 2, 3)));
        Assert.Equal(["c"], parsed.Exercises.Select(e => e.Id));
        Assert.Equal(
            [
                "Converted form/injury ratings to the single difficulty score",
                "Alpha (a): skipped, difficulty must be a number from 1 to 5",
                "Bravo (b): skipped, difficulty must be a number from 1 to 5",
            ],
            parsed.Warnings);
    }

    [Fact]
    public void v1_prefers_difficulty_when_an_entry_has_both_without_the_conversion_warning()
    {
        var both = Legacy(A, 5, 5);
        both["difficulty"] = 1;
        var parsed = LibraryFormat.ParseLibraryExport(V1(both));
        Assert.Equal(1, parsed.Exercises[0].Difficulty);
        Assert.Empty(parsed.Warnings);
    }

    [Fact]
    public void v1_also_converts_old_ratings_found_in_a_version_2_file()
    {
        var parsed = LibraryFormat.ParseLibraryExport(File([Legacy(A, 3, 4)]));
        Assert.Equal(4, parsed.Exercises[0].Difficulty);
        Assert.Equal([LibraryFormat.LegacyRatingsWarning], parsed.Warnings);
    }

    // ── diffLibrary ──

    [Fact]
    public void diffLibrary_classifies_incoming_entries_by_id_against_the_current_library()
    {
        var editedB = B with { Cues = ["Different"] };
        var newD = E("d", "Delta");
        var diff = LibraryFormat.DiffLibrary([A, editedB, newD], [A, B, C]);
        Assert.Equal([newD], diff.Added);
        Assert.Equal([editedB], diff.Updated);
        Assert.Equal([A], diff.Unchanged);
    }

    [Fact]
    public void diffLibrary_ignores_key_order_when_comparing()
    {
        const string reorderedJson = """{"cues":["Stay tight"],"difficulty":2,"muscles":{"biceps":1},"compound":false,"pattern":"isolation","equipment":["bodyweight"],"name":"Alpha","id":"a"}""";
        var reordered = JsonSerializer.Deserialize<Exercise>(reorderedJson, GymJson.Compact)!;
        Assert.True(LibraryFormat.ExercisesEqual(reordered, A));
        Assert.Equal([reordered], LibraryFormat.DiffLibrary([reordered], [A]).Unchanged);
    }

    [Fact]
    public void diffLibrary_treats_a_changed_array_order_as_a_change()
    {
        Assert.False(LibraryFormat.ExercisesEqual(A with { Cues = ["b", "a"] }, A with { Cues = ["a", "b"] }));
    }

    [Fact]
    public void difficultyFromLegacy_is_the_ceil_of_the_mean_clamped()
    {
        Assert.Equal(4, LibraryFormat.DifficultyFromLegacy(3, 4));
        Assert.Equal(2, LibraryFormat.DifficultyFromLegacy(2, 2));
        Assert.Equal(5, LibraryFormat.DifficultyFromLegacy(7, 9));
        Assert.Equal(1, LibraryFormat.DifficultyFromLegacy(0, -1));
    }
}
