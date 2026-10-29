using System.Text.Json.Nodes;
using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/planExport.test.ts, plus round trips and the repo's seed plans file.</summary>
public class PlanExportTests
{
    private static readonly DateTimeOffset NOW = new(2026, 10, 27, 21, 0, 0, TimeSpan.FromHours(1)); // local time, 27 Oct 2026

    private static WorkoutPlan Plan(string name, params (string ExerciseId, int Sets, int Reps, int RestSec)[] exercises) => new()
    {
        Id = $"plan-{name}",
        Name = name,
        CreatedAt = "2026-01-01T00:00:00.000Z",
        UpdatedAt = "2026-02-02T00:00:00.000Z",
        Exercises = exercises.Select((e, i) => new PlannedExercise { Id = $"pe-{name}-{i}", ExerciseId = e.ExerciseId, Sets = e.Sets, Reps = e.Reps, RestSec = e.RestSec }).ToList(),
    };

    private static readonly WorkoutPlan PUSH = Plan("Push", ("barbell_bench_press", 4, 6, 150), ("overhead_press", 3, 8, 120));
    private static readonly WorkoutPlan PULL = Plan("Pull", ("barbell_bench_press", 3, 10, 90));

    private static string FileWith(JsonNode? plans, Action<JsonObject>? extra = null)
    {
        var o = new JsonObject { ["format"] = "gym-buddy-plans", ["version"] = 1, ["exportedAt"] = GymJson.ToIso(NOW), ["plans"] = plans };
        extra?.Invoke(o);
        return o.ToJsonString();
    }

    private static string FileWithJson(string plansJson, Action<JsonObject>? extra = null) => FileWith(JsonNode.Parse(plansJson), extra);

    private static ParsedImport Parse(string json) => PlanExport.ParsePlanExport(json, Real);

    private static string Throws(Func<object> f) => Assert.Throws<FormatException>(f).Message;

    // ── serializePlans ──

    [Fact]
    public void serializePlans_writes_the_header_and_pretty_prints_with_2_spaces()
    {
        var json = PlanExport.SerializePlans([PUSH], NOW);
        var parsed = JsonNode.Parse(json)!;
        Assert.Equal("gym-buddy-plans", (string?)parsed["format"]);
        Assert.Equal(1, (int?)parsed["version"]);
        Assert.Equal(GymJson.ToIso(NOW), (string?)parsed["exportedAt"]);
        Assert.Contains("\n  \"format\"", json);
    }

    [Fact]
    public void serializePlans_drops_ids_and_timestamps()
    {
        var json = PlanExport.SerializePlans([PUSH, PULL], NOW);
        Assert.DoesNotContain("plan-Push", json);
        Assert.DoesNotContain("pe-Push", json);
        Assert.DoesNotContain("createdAt", json);
        Assert.DoesNotContain("updatedAt", json);
        Assert.DoesNotContain("\"id\"", json);
        Assert.Equal(
            """{"name":"Push","exercises":[{"exerciseId":"barbell_bench_press","sets":4,"reps":6,"restSec":150},{"exerciseId":"overhead_press","sets":3,"reps":8,"restSec":120}]}""",
            JsonNode.Parse(json)!["plans"]![0]!.ToJsonString());
    }

    [Fact]
    public void serializePlans_round_trips_through_parsePlanExport()
    {
        var result = Parse(PlanExport.SerializePlans([PUSH, PULL], NOW));
        Assert.Empty(result.Warnings);
        Assert.Equal([PlanExport.ToExported(PUSH), PlanExport.ToExported(PULL)], result.Plans);
    }

    [Fact]
    public void the_seed_plans_round_trip_and_match_the_repo_seed_plans_file_byte_for_byte()
    {
        var text = File.ReadAllText(Path.Combine(RepoRoot, "gym-buddy-seed-plans.json"));
        var parsed = Parse(text);
        Assert.Empty(parsed.Warnings);
        Assert.Equal(SeedPlans.All.Select(p => p.Name), parsed.Plans.Select(p => p.Name));
        Assert.Equal(
            SeedPlans.All.SelectMany(p => p.Exercises.Select(e => new ExportedExercise(e.ExerciseId, e.Sets, e.Reps, e.RestSec))),
            parsed.Plans.SelectMany(p => p.Exercises));

        var exportedAt = DateTimeOffset.Parse((string)JsonNode.Parse(text)!["exportedAt"]!, System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal(text, PlanExport.SerializePlans(Core.Store.GymStore.BuildSeedPlans(), exportedAt) + "\n");
    }

    // ── suggestedFileName ──

    [Fact]
    public void suggestedFileName_uses_the_generic_name_for_several_plans()
    {
        Assert.Equal("gym-buddy-plans-2026-10-27.json", PlanExport.SuggestedFileName([PUSH, PULL], NOW));
    }

    [Fact]
    public void suggestedFileName_uses_the_generic_name_for_no_plans()
    {
        Assert.Equal("gym-buddy-plans-2026-10-27.json", PlanExport.SuggestedFileName([], NOW));
    }

    [Fact]
    public void suggestedFileName_includes_the_slugified_plan_name_for_a_single_plan()
    {
        Assert.Equal("gym-buddy-plan-push-2026-10-27.json", PlanExport.SuggestedFileName([PUSH], NOW));
        Assert.Equal("gym-buddy-plan-upper-body-dia-1-2026-10-27.json", PlanExport.SuggestedFileName([Plan("  Upper Body / Día 1! ")], NOW));
    }

    [Fact]
    public void suggestedFileName_falls_back_when_the_name_has_no_usable_characters()
    {
        Assert.Equal("gym-buddy-plan-plan-2026-10-27.json", PlanExport.SuggestedFileName([Plan("💪")], NOW));
    }

    // ── parsePlanExport errors ──

    [Fact]
    public void rejects_invalid_JSON()
    {
        Assert.Contains("not valid JSON", Throws(() => Parse("{not json")));
    }

    [Fact]
    public void rejects_a_missing_or_wrong_format()
    {
        Assert.Contains("not a Gym Buddy plans file", Throws(() => Parse("""{"version":1,"plans":[]}""")));
        Assert.Contains("not a Gym Buddy plans file", Throws(() => Parse(FileWithJson("[]", o => o["format"] = "other"))));
        Assert.Contains("not a Gym Buddy plans file", Throws(() => Parse("[]")));
        Assert.Contains("not a Gym Buddy plans file", Throws(() => Parse("null")));
    }

    [Fact]
    public void rejects_an_unsupported_version()
    {
        Assert.Contains("Unsupported file version (2)", Throws(() => Parse(FileWithJson("[]", o => o["version"] = 2))));
        Assert.Contains("Unsupported file version", Throws(() => Parse(FileWithJson("[]", o => o.Remove("version")))));
    }

    [Fact]
    public void rejects_plans_that_are_not_an_array()
    {
        Assert.Contains("does not contain a list of plans", Throws(() => Parse(FileWithJson("""{"name":"Push"}"""))));
        Assert.Contains("does not contain a list of plans", Throws(() => Parse(FileWith(null, o => o.Remove("plans")))));
    }

    [Fact]
    public void rejects_a_plan_without_a_string_name()
    {
        Assert.Contains("Plan 1 has no name", Throws(() => Parse(FileWithJson("""[{"exercises":[]}]"""))));
        Assert.Contains("Plan 2 has no name", Throws(() => Parse(FileWithJson("""[{"name":"A","exercises":[]},{"name":3,"exercises":[]}]"""))));
        Assert.Contains("Plan 1 has no name", Throws(() => Parse(FileWithJson("""["Push"]"""))));
    }

    [Fact]
    public void rejects_a_plan_without_an_exercises_array()
    {
        Assert.Contains("Plan 1 has no exercise list", Throws(() => Parse(FileWithJson("""[{"name":"Push"}]"""))));
        Assert.Contains("Plan 1 has no exercise list", Throws(() => Parse(FileWithJson("""[{"name":"Push","exercises":{}}]"""))));
    }

    // ── parsePlanExport fix-ups ──

    private static readonly string Bench = BuiltIn("barbell_bench_press").Name;

    [Fact]
    public void skips_unknown_exercises_with_a_warning()
    {
        var result = Parse(FileWithJson("""[{"name":"Push","exercises":[{"exerciseId":"foo_bar","sets":3,"reps":10,"restSec":90},{"exerciseId":"barbell_bench_press","sets":4,"reps":6,"restSec":150}]}]"""));
        Assert.Equal([new ExportedExercise("barbell_bench_press", 4, 6, 150)], result.Plans[0].Exercises);
        Assert.Equal(["Push: skipped unknown exercise 'foo_bar'"], result.Warnings);
    }

    [Fact]
    public void skips_exercises_without_an_id()
    {
        var result = Parse(FileWithJson("""[{"name":"Push","exercises":[{"sets":3},"x"]}]"""));
        Assert.Empty(result.Plans[0].Exercises);
        Assert.Equal(["Push: skipped exercise 1 without an exercise id", "Push: skipped exercise 2 without an exercise id", "Push: no exercises"], result.Warnings);
    }

    [Fact]
    public void clamps_out_of_range_values()
    {
        var result = Parse(FileWithJson("""[{"name":"Push","exercises":[{"exerciseId":"barbell_bench_press","sets":50,"reps":0,"restSec":9999}]}]"""));
        Assert.Equal(new ExportedExercise("barbell_bench_press", 10, 1, 600), result.Plans[0].Exercises[0]);
        Assert.Equal([$"Push / {Bench}: sets 50 adjusted to 10", $"Push / {Bench}: reps 0 adjusted to 1", $"Push / {Bench}: restSec 9999 adjusted to 600"], result.Warnings);
    }

    [Fact]
    public void clamps_negative_rest_and_rounds_fractions()
    {
        var result = Parse(FileWithJson("""[{"name":"Push","exercises":[{"exerciseId":"barbell_bench_press","sets":3.6,"reps":8,"restSec":-5}]}]"""));
        Assert.Equal(new ExportedExercise("barbell_bench_press", 4, 8, 0), result.Plans[0].Exercises[0]);
        Assert.Equal(2, result.Warnings.Count);
        Assert.Equal($"Push / {Bench}: sets 3.6 adjusted to 4", result.Warnings[0]);
    }

    [Fact]
    public void defaults_missing_and_non_numeric_values()
    {
        var result = Parse(FileWithJson("""[{"name":"Push","exercises":[{"exerciseId":"barbell_bench_press","sets":"four","reps":null}]}]"""));
        Assert.Equal(new ExportedExercise("barbell_bench_press", 3, 10, 90), result.Plans[0].Exercises[0]);
        Assert.Equal([$"Push / {Bench}: invalid sets, using 3", $"Push / {Bench}: missing reps, using 10", $"Push / {Bench}: missing restSec, using 90"], result.Warnings);
    }

    [Fact]
    public void keeps_a_plan_that_ends_up_empty_with_a_warning()
    {
        var result = Parse(FileWithJson("""[{"name":"Empty","exercises":[]}]"""));
        Assert.Equal([new ExportedPlan("Empty", [])], result.Plans);
        Assert.Equal(["Empty: no exercises"], result.Warnings);
    }

    [Fact]
    public void trims_names_and_falls_back_for_empty_ones()
    {
        var result = Parse(FileWithJson("""[{"name":"  Legs  ","exercises":[]},{"name":"   ","exercises":[]}]"""));
        Assert.Equal(["Legs", "Imported plan"], result.Plans.Select(p => p.Name));
    }

    [Fact]
    public void honours_a_custom_exercise_db()
    {
        var db = Db(Ex("my_move", M((MuscleGroup.Chest, 1)), "My move", difficulty: 1));
        var result = PlanExport.ParsePlanExport(
            FileWithJson("""[{"name":"Custom","exercises":[{"exerciseId":"my_move","sets":2,"reps":5,"restSec":60},{"exerciseId":"barbell_bench_press","sets":4,"reps":6,"restSec":150}]}]"""),
            db);
        Assert.Equal([new ExportedExercise("my_move", 2, 5, 60)], result.Plans[0].Exercises);
        Assert.Equal(["Custom: skipped unknown exercise 'barbell_bench_press'"], result.Warnings);
    }

    // ── planFingerprint ──

    private static ExportedPlan Exported(WorkoutPlan source, string? name = null) => PlanExport.ToExported(source) with { Name = name ?? source.Name };

    [Fact]
    public void planFingerprint_is_deterministic_and_8_hex_chars()
    {
        var fp = PlanExport.PlanFingerprint(PUSH.Exercises);
        Assert.Matches("^[0-9a-f]{8}$", fp);
        Assert.Equal(fp, PlanExport.PlanFingerprint(PUSH.Exercises));
    }

    [Fact]
    public void planFingerprint_matches_the_typescript_hash()
    {
        // FNV-1a 32 of "a:1x1@0", computed with the TS planFingerprint (Math.imul, >>> 0).
        Assert.Equal("607fea36", PlanExport.PlanFingerprint([new ExportedExercise("a", 1, 1, 0)]));
        Assert.Equal("9547d846", PlanExport.PlanFingerprint(PUSH.Exercises));
        Assert.Equal("811c9dc5", PlanExport.PlanFingerprint(Array.Empty<ExportedExercise>()));
    }

    [Fact]
    public void planFingerprint_ignores_the_plan_name_and_plan_exercise_ids()
    {
        var renamed = Plan("Something else", ("barbell_bench_press", 4, 6, 150), ("overhead_press", 3, 8, 120));
        Assert.NotEqual(PUSH.Id, renamed.Id);
        Assert.NotEqual(PUSH.Exercises[0].Id, renamed.Exercises[0].Id);
        Assert.Equal(PlanExport.PlanFingerprint(PUSH.Exercises), PlanExport.PlanFingerprint(renamed.Exercises));
        Assert.Equal(PlanExport.PlanFingerprint(PUSH.Exercises), PlanExport.PlanFingerprint(Exported(PUSH).Exercises));
    }

    [Fact]
    public void planFingerprint_is_order_sensitive()
    {
        Assert.NotEqual(PlanExport.PlanFingerprint(PUSH.Exercises), PlanExport.PlanFingerprint(PUSH.Exercises.AsEnumerable().Reverse()));
    }

    [Fact]
    public void planFingerprint_changes_when_sets_reps_or_rest_change()
    {
        var baseFp = PlanExport.PlanFingerprint(PUSH.Exercises);
        var first = Exported(PUSH).Exercises[0];
        var second = Exported(PUSH).Exercises[1];
        string Tweak(ExportedExercise e) => PlanExport.PlanFingerprint([e, second]);
        Assert.NotEqual(baseFp, Tweak(first with { Sets = 5 }));
        Assert.NotEqual(baseFp, Tweak(first with { Reps = 7 }));
        Assert.NotEqual(baseFp, Tweak(first with { RestSec = 151 }));
    }

    [Fact]
    public void planFingerprint_distinguishes_field_boundaries()
    {
        Assert.NotEqual(PlanExport.PlanFingerprint([new ExportedExercise("a", 1, 11, 0)]), PlanExport.PlanFingerprint([new ExportedExercise("a", 11, 1, 0)]));
    }

    // ── dedupePlans ──

    [Fact]
    public void dedupePlans_skips_plans_identical_to_an_existing_plan_naming_the_existing_plan()
    {
        var result = PlanExport.DedupePlans([Exported(PUSH, "My push day"), Exported(PULL)], [PUSH]);
        Assert.Equal(["Pull"], result.Plans.Select(p => p.Name));
        Assert.Equal(["My push day: identical to existing plan 'Push'"], result.Skipped);
    }

    [Fact]
    public void dedupePlans_skips_duplicates_within_the_file_keeping_the_first_occurrence()
    {
        var result = PlanExport.DedupePlans([Exported(PUSH, "A"), Exported(PULL), Exported(PUSH, "B")], []);
        Assert.Equal(["A", "Pull"], result.Plans.Select(p => p.Name));
        Assert.Equal(["B: duplicate within the file"], result.Skipped);
    }

    [Fact]
    public void dedupePlans_keeps_a_plan_with_the_same_name_but_different_content()
    {
        var changedPush = Plan("Push", ("barbell_bench_press", 5, 5, 180));
        var result = PlanExport.DedupePlans([Exported(changedPush)], [PUSH]);
        Assert.Equal(["Push"], result.Plans.Select(p => p.Name));
        Assert.Empty(result.Skipped);
    }

    [Fact]
    public void dedupePlans_keeps_everything_when_nothing_matches()
    {
        var result = PlanExport.DedupePlans([Exported(PUSH), Exported(PULL)], []);
        Assert.Equal(2, result.Plans.Count);
        Assert.Empty(result.Skipped);
    }
}
