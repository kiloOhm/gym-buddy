using System.Text.Json;
using System.Text.Json.Nodes;
using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/store/exercises.test.ts plus seeding, persistence, corrupt-file handling and a full workout flow.</summary>
public class GymStoreTests
{
    private static readonly Exercise Custom = new()
    {
        Id = "zercher_carry",
        Name = "Zercher carry",
        Equipment = [Equipment.Barbell],
        Pattern = MovementPattern.Carry,
        Compound = true,
        Muscles = M((MuscleGroup.UpperBack, 1), (MuscleGroup.Abs, 0.6)),
        Difficulty = 3,
        Cues = [],
    };

    private DateTimeOffset _now = DateTimeOffset.Parse("2026-10-27T18:00:00Z", System.Globalization.CultureInfo.InvariantCulture);

    private GymStore NewStore(MemoryStateStorage? storage = null)
    {
        var store = new GymStore(storage ?? new MemoryStateStorage(), () => _now);
        store.Load();
        return store;
    }

    // ── exercise library (exercises.test.ts) ──

    [Fact]
    public void adds_new_and_edited_entries_and_syncs_the_library()
    {
        var store = NewStore();
        var editedSquat = BuiltIn("barbell_back_squat") with { Difficulty = 5 };
        var result = store.ImportExercises([Custom, editedSquat, BuiltIn("leg_press")]);
        Assert.Equal(new ImportResult(1, 1, 1), result);
        Assert.Equal([Custom, editedSquat], store.CustomExercises);
        Assert.Equal(Custom, store.GetExercise("zercher_carry"));
        Assert.Equal(5, store.GetExercise("barbell_back_squat")?.Difficulty);
        Assert.Equal(BuiltInExercises.All.Count + 1, store.Library.Count);
        Assert.Same(Custom, store.Library[^1]);
    }

    [Fact]
    public void re_importing_an_unmodified_built_in_removes_the_override()
    {
        var store = NewStore();
        var squat = BuiltIn("barbell_back_squat");
        store.ImportExercises([squat with { Difficulty = 5 }]);
        Assert.Single(store.CustomExercises);
        var result = store.ImportExercises(BuiltInExercises.All);
        Assert.Equal(1, result.Updated);
        Assert.Empty(store.CustomExercises);
        Assert.Same(squat, store.GetExercise("barbell_back_squat"));
    }

    [Fact]
    public void importing_the_unmodified_library_stores_nothing()
    {
        var storage = new MemoryStateStorage();
        var store = NewStore(storage);
        var writes = storage.WriteCount;
        var result = store.ImportExercises(BuiltInExercises.All);
        Assert.Equal(new ImportResult(0, 0, BuiltInExercises.All.Count), result);
        Assert.Empty(store.CustomExercises);
        Assert.Equal(writes, storage.WriteCount);
    }

    [Fact]
    public void reset_restores_the_built_in_library()
    {
        var store = NewStore();
        store.ImportExercises([Custom]);
        store.ResetExerciseLibrary();
        Assert.Null(store.GetExercise("zercher_carry"));
        Assert.Equal(BuiltInExercises.All, store.Library);
    }

    // ── persisted state migration (exercises.test.ts) ──

    private static JsonObject Obj(string json) => JsonNode.Parse(json)!.AsObject();

    [Fact]
    public void drops_the_removed_equipment_list_from_version_0_and_1_settings()
    {
        foreach (var version in new[] { 0, 1 })
        {
            var migrated = PersistedState.MigratePersistedState(Obj("""{"settings":{"availableEquipment":["barbell","bench"],"weightUnit":"lb"},"plans":[]}"""), version)!;
            Assert.Equal("""{"weightUnit":"lb"}""", migrated["settings"]!.ToJsonString());
            Assert.Equal("[]", migrated["plans"]!.ToJsonString());
        }
    }

    [Fact]
    public void leaves_current_state_and_state_without_settings_alone()
    {
        const string current = """{"settings":{"weightUnit":"kg"},"plans":[]}""";
        Assert.Equal(current, PersistedState.MigratePersistedState(Obj(current), PersistedState.PersistVersion)!.ToJsonString());
        Assert.Equal("""{"settings":{"weightUnit":"kg"}}""", PersistedState.MigratePersistedState(Obj("""{"settings":{"weightUnit":"kg"}}"""), 1)!.ToJsonString());
        Assert.Equal("""{"plans":[]}""", PersistedState.MigratePersistedState(Obj("""{"plans":[]}"""), 1)!.ToJsonString());
        Assert.Null(PersistedState.MigratePersistedState(null, 0));
    }

    [Fact]
    public void derives_difficulty_for_imported_exercises_saved_with_the_old_ratings()
    {
        var old = ToJson(Custom);
        old.Remove("difficulty");
        old["formDifficulty"] = 3;
        old["injuryRisk"] = 4;
        var state = new JsonObject { ["customExercises"] = new JsonArray(old, ToJson(Custom)) };
        var migrated = PersistedState.MigratePersistedState(state, 0)!;
        var exercises = migrated["customExercises"].Deserialize<List<Exercise>>(GymJson.Compact)!;
        Assert.Equal([Custom with { Difficulty = 4 }, Custom], exercises);
        Assert.DoesNotContain("formDifficulty", migrated.ToJsonString());
        Assert.NotNull(state["customExercises"]![0]!["formDifficulty"]); // the input is not modified
    }

    // ── seeding and hydration ──

    [Fact]
    public void first_load_seeds_the_four_example_plans_once()
    {
        var storage = new MemoryStateStorage();
        var store = NewStore(storage);
        Assert.True(store.Hydrated);
        Assert.True(store.Seeded);
        Assert.Equal(["Push", "Pull", "Legs", "Arms"], store.Plans.Select(p => p.Name));
        Assert.All(store.Plans, p => Assert.Equal("2026-10-27T18:00:00.000Z", p.CreatedAt));

        foreach (var p in store.Plans.ToList()) store.DeletePlan(p.Id);
        var reloaded = NewStore(storage);
        Assert.Empty(reloaded.Plans); // deleting the examples does not bring them back
    }

    [Fact]
    public void load_raises_changed_and_hydrated_is_false_before()
    {
        var store = new GymStore(new MemoryStateStorage());
        Assert.False(store.Hydrated);
        var changed = 0;
        store.Changed += () => changed++;
        store.Load();
        Assert.Equal(1, changed);
    }

    [Fact]
    public void persists_the_zustand_envelope_shape()
    {
        var storage = new MemoryStateStorage();
        NewStore(storage);
        var doc = Obj(storage.Content!);
        Assert.Equal(["state", "version"], doc.Select(kv => kv.Key));
        Assert.Equal(2, (int)doc["version"]!);
        var state = doc["state"]!.AsObject();
        Assert.Equal(["seeded", "plans", "sessions", "activeSession", "settings", "customExercises"], state.Select(kv => kv.Key));
        Assert.True(state.ContainsKey("activeSession"));
        Assert.Null(state["activeSession"]);
        Assert.Equal("""{"weightUnit":"kg"}""", state["settings"]!.ToJsonString());
        Assert.DoesNotContain("\n", storage.Content);
        var plan = state["plans"]![0]!.AsObject();
        Assert.Equal(["id", "name", "exercises", "createdAt", "updatedAt"], plan.Select(kv => kv.Key));
        Assert.Equal(["id", "exerciseId", "sets", "reps", "restSec"], plan["exercises"]![0]!.AsObject().Select(kv => kv.Key));
    }

    [Fact]
    public void reads_and_migrates_a_state_file_written_by_the_typescript_app()
    {
        const string ts = """
            {"state":{"seeded":true,"plans":[{"id":"p1","name":"Mine","exercises":[{"id":"x1","exerciseId":"pull_up","sets":3,"reps":8,"restSec":120}],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-02T00:00:00.000Z"}],
            "sessions":[{"id":"s1","planId":"p1","planName":"Mine","startedAt":"2026-10-20T10:00:00.000Z","finishedAt":"2026-10-20T10:40:00.000Z","exercises":[{"id":"e1","exerciseId":"chin_up","substitutedFor":"pull_up","targetSets":3,"targetReps":8,"restSec":120,"sets":[{"reps":8,"weight":0,"completed":true}]}]}],
            "activeSession":null,"settings":{"weightUnit":"lb","availableEquipment":["barbell"]},
            "customExercises":[{"id":"my_move","name":"My move","equipment":["band"],"pattern":"isolation","compound":false,"muscles":{"biceps":1},"formDifficulty":2,"injuryRisk":3,"cues":[]}]},"version":0}
            """;
        var storage = new MemoryStateStorage(ts);
        var store = NewStore(storage);
        Assert.Equal(["Mine"], store.Plans.Select(p => p.Name)); // seeded already: no examples added
        Assert.Equal(WeightUnit.Lb, store.Settings.WeightUnit);
        Assert.Equal("pull_up", store.Sessions[0].Exercises[0].SubstitutedFor);
        Assert.Null(store.ActiveSession);
        Assert.Equal(3, store.GetExercise("my_move")?.Difficulty);
        Assert.Equal(BuiltInExercises.All.Count + 1, store.Library.Count);
        Assert.Null(storage.Quarantined);

        // Re-persisted at the current version, without the removed setting or the old ratings.
        Assert.Equal(2, (int)Obj(storage.Content!)["version"]!);
        Assert.DoesNotContain("availableEquipment", storage.Content);
        Assert.DoesNotContain("formDifficulty", storage.Content);
    }

    [Theory]
    [InlineData("{not json")]
    [InlineData("[]")]
    [InlineData("""{"version":2}""")]
    [InlineData("""{"state":{"plans":"nope"},"version":2}""")]
    [InlineData("""{"state":{"sessions":[{"id":"s","exercises":"nope"}]},"version":2}""")]
    public void unreadable_state_is_quarantined_and_the_store_starts_empty(string json)
    {
        var storage = new MemoryStateStorage(json);
        var store = NewStore(storage);
        Assert.True(store.Hydrated);
        Assert.Equal(json, storage.Quarantined);
        Assert.Equal(4, store.Plans.Count); // fresh start, examples seeded
        Assert.NotNull(storage.Content);
    }

    [Fact]
    public void an_unreadable_custom_exercise_is_dropped_without_quarantining_the_state()
    {
        var bad = """{"id":"x","name":"X","equipment":["rope"],"pattern":"core","compound":true,"muscles":{"abs":1},"difficulty":1}""";
        var good = JsonSerializer.Serialize(Custom, GymJson.Compact);
        var storage = new MemoryStateStorage($$"""{"state":{"seeded":true,"plans":[],"customExercises":[{{bad}},{{good}}]},"version":2}""");
        var store = NewStore(storage);
        Assert.Null(storage.Quarantined);
        Assert.Equal([Custom], store.CustomExercises);
        Assert.Equal(Custom, store.GetExercise("zercher_carry"));
        Assert.Null(store.GetExercise("x"));
        Assert.Empty(store.Plans); // seeded flag kept: the state was not thrown away
    }

    [Fact]
    public void an_unknown_weight_unit_falls_back_to_kg()
    {
        var storage = new MemoryStateStorage("""{"state":{"seeded":true,"plans":[],"settings":{"weightUnit":"stone"}},"version":2}""");
        var store = NewStore(storage);
        Assert.Null(storage.Quarantined);
        Assert.Equal(WeightUnit.Kg, store.Settings.WeightUnit);
        Assert.Contains("\"settings\":{\"weightUnit\":\"kg\"}", storage.Content);
    }

    [Fact]
    public void nulls_in_the_stored_state_fall_back_to_defaults()
    {
        var storage = new MemoryStateStorage("""{"state":{"seeded":true,"plans":null,"sessions":null,"activeSession":null,"settings":null,"customExercises":null},"version":2}""");
        var store = NewStore(storage);
        Assert.Empty(store.Plans);
        Assert.Empty(store.Sessions);
        Assert.Equal(WeightUnit.Kg, store.Settings.WeightUnit);
        Assert.Null(storage.Quarantined);
    }

    [Fact]
    public void keeps_running_when_writing_fails()
    {
        var storage = new MemoryStateStorage { FailWritesWith = new IOException("disk full") };
        var store = NewStore(storage);
        var changed = 0;
        store.Changed += () => changed++;
        store.CreatePlan("Still works");
        Assert.Equal(1, changed);
        Assert.Contains(store.Plans, p => p.Name == "Still works");
    }

    [Fact]
    public void persistence_round_trip_through_storage()
    {
        var storage = new MemoryStateStorage();
        var store = NewStore(storage);
        var plan = store.CreatePlan("Upper");
        store.AddExerciseToPlan(plan.Id, "barbell_bench_press");
        store.SetWeightUnit(WeightUnit.Lb);
        store.ImportExercises([Custom]);
        store.StartSession(plan.Id);
        store.LogSet(store.ActiveSession!.Exercises[0].Id, 0, reps: 5, weight: 82.5, completed: true);

        var reloaded = NewStore(storage);
        Assert.Equal(store.Serialize(), reloaded.Serialize());
        Assert.Equal(WeightUnit.Lb, reloaded.Settings.WeightUnit);
        Assert.Equal(82.5, reloaded.ActiveSession!.Exercises[0].Sets[0].Weight);
        Assert.Equal(Custom, reloaded.GetExercise("zercher_carry"));
    }

    [Fact]
    public void every_mutation_persists_before_changed_fires()
    {
        var storage = new MemoryStateStorage();
        var store = NewStore(storage);
        string? seenOnChange = null;
        store.Changed += () => seenOnChange = storage.Content;
        store.CreatePlan("X");
        Assert.Equal(storage.Content, seenOnChange);
        Assert.Contains("\"name\":\"X\"", seenOnChange);
    }

    // ── plans ──

    [Fact]
    public void plan_editing_actions()
    {
        var store = NewStore();
        var plan = store.CreatePlan("Day");
        store.AddExerciseToPlan(plan.Id, "squat_a");
        store.AddExerciseToPlan(plan.Id, "squat_b");
        store.AddExerciseToPlan(plan.Id, "squat_c");
        var ids = plan.Exercises.Select(e => e.Id).ToList();
        Assert.Equal((3, 10, 90), (plan.Exercises[0].Sets, plan.Exercises[0].Reps, plan.Exercises[0].RestSec));

        _now = _now.AddMinutes(5);
        store.UpdatePlannedExercise(plan.Id, ids[1], sets: 5, restSec: 120);
        Assert.Equal((5, 10, 120), (plan.Exercises[1].Sets, plan.Exercises[1].Reps, plan.Exercises[1].RestSec));
        Assert.Equal("2026-10-27T18:05:00.000Z", plan.UpdatedAt);

        store.MovePlannedExercise(plan.Id, ids[0], -1); // no-op at the top
        store.MovePlannedExercise(plan.Id, ids[0], 1);
        Assert.Equal([ids[1], ids[0], ids[2]], plan.Exercises.Select(e => e.Id));
        store.MovePlannedExercise(plan.Id, ids[2], 1); // no-op at the bottom
        Assert.Equal([ids[1], ids[0], ids[2]], plan.Exercises.Select(e => e.Id));

        store.RemovePlannedExercise(plan.Id, ids[0]);
        Assert.Equal([ids[1], ids[2]], plan.Exercises.Select(e => e.Id));

        store.RenamePlan(plan.Id, "Leg day");
        Assert.Equal("Leg day", store.GetPlan(plan.Id)?.Name);
        store.DeletePlan(plan.Id);
        Assert.Null(store.GetPlan(plan.Id));
    }

    [Fact]
    public void importPlans_adds_new_plans_with_fresh_ids()
    {
        var store = NewStore();
        var created = store.ImportPlans([new ExportedPlan("Imported", [new ExportedExercise("pull_up", 4, 6, 150)])]);
        var plan = Assert.Single(created);
        Assert.Same(plan, store.Plans[^1]);
        Assert.Equal("pull_up", plan.Exercises[0].ExerciseId);
        Assert.Equal((4, 6, 150), (plan.Exercises[0].Sets, plan.Exercises[0].Reps, plan.Exercises[0].RestSec));
        Assert.NotEmpty(plan.Id);
        Assert.Equal(plan.CreatedAt, plan.UpdatedAt);
    }

    [Fact]
    public void importSessions_merges_newest_first_keeps_the_active_session_and_persists()
    {
        var storage = new MemoryStateStorage();
        var store = NewStore(storage);
        _now = DateTimeOffset.Parse("2026-10-20T18:00:00Z", System.Globalization.CultureInfo.InvariantCulture);
        store.StartSession(null);
        store.FinishSession();
        _now = DateTimeOffset.Parse("2026-10-25T18:00:00Z", System.Globalization.CultureInfo.InvariantCulture);
        store.StartSession(null);
        store.FinishSession();
        var active = store.StartSession(null);
        var a = store.Sessions[0].Id; // 25 Oct
        var b = store.Sessions[1].Id; // 20 Oct

        static WorkoutSession S(string id, string finishedAt) =>
            new() { Id = id, PlanName = "Imported", StartedAt = finishedAt, FinishedAt = finishedAt };
        var changes = 0;
        store.Changed += () => changes++;
        var incoming = new[]
        {
            S("old", "2026-10-01T10:00:00.000Z"),
            S("newest", "2026-10-28T10:00:00.000Z"),
            S("tie", "2026-10-20T18:00:00.000Z"), // equal to b: existing stays first
        };
        var imported = store.ImportSessions(incoming);

        Assert.Equal(incoming, imported);
        Assert.Equal(["newest", a, b, "tie", "old"], store.Sessions.Select(s => s.Id));
        Assert.Same(active, store.ActiveSession);
        Assert.Equal(1, changes);
        var reloaded = NewStore(storage);
        Assert.Equal(["newest", a, b, "tie", "old"], reloaded.Sessions.Select(s => s.Id));
    }

    // ── a full workout ──

    [Fact]
    public void full_workout_flow_start_log_swap_finish_history()
    {
        var store = NewStore();
        var push = store.Plans.First(p => p.Name == "Push");

        // First workout: no history, weights start at 0, reps at the target.
        var session = store.StartSession(push.Id);
        Assert.Same(session, store.ActiveSession);
        Assert.Equal("Push", session.PlanName);
        Assert.Equal(push.Id, session.PlanId);
        Assert.Equal(5, session.Exercises.Count);
        var bench = session.Exercises[0];
        Assert.Equal(("barbell_bench_press", 4, 6, 150), (bench.ExerciseId, bench.TargetSets, bench.TargetReps, bench.RestSec));
        Assert.All(bench.Sets, s => Assert.Equal((6, 0.0, false), (s.Reps, s.Weight, s.Completed)));

        store.LogSet(bench.Id, 0, weight: 80, completed: true);
        store.LogSet(bench.Id, 1, reps: 5, weight: 82.5, completed: true);
        store.RemoveSet(bench.Id, 3);
        store.AddSet(bench.Id); // copies the previous set
        Assert.Equal((6, 0.0, false), (bench.Sets[3].Reps, bench.Sets[3].Weight, bench.Sets[3].Completed));

        // Swap the overhead press: targets stay, the original is recorded once.
        var ohp = session.Exercises[1];
        store.SwapExercise(ohp.Id, "dumbbell_shoulder_press");
        store.SwapExercise(ohp.Id, "machine_shoulder_press");
        Assert.Equal(("machine_shoulder_press", "overhead_press", 3, 8), (ohp.ExerciseId, ohp.SubstitutedFor, ohp.TargetSets, ohp.TargetReps));
        Assert.Equal(3, ohp.Sets.Count);

        store.AddSessionExercise("plank");
        Assert.Equal(("plank", 3, 10, 90), (session.Exercises[^1].ExerciseId, session.Exercises[^1].TargetSets, session.Exercises[^1].TargetReps, session.Exercises[^1].RestSec));
        store.RemoveSessionExercise(session.Exercises[^1].Id);
        Assert.Equal(5, session.Exercises.Count);

        _now = _now.AddMinutes(45);
        store.FinishSession();
        Assert.Null(store.ActiveSession);
        var finished = Assert.Single(store.Sessions);
        Assert.Equal("2026-10-27T18:45:00.000Z", finished.FinishedAt);
        Assert.Equal(45, SessionFormat.SessionDurationMin(finished));
        Assert.Equal(2, SessionFormat.CompletedSetCount(finished));
        Assert.Equal(80 * 6 + 82.5 * 5, SessionFormat.SessionVolume(finished));

        var last = History.LastPerformanceOf(store.Sessions, "barbell_bench_press")!;
        Assert.Equal("80 kg × 6, 82.5 × 5", SessionFormat.FormatSetList(last.Sets, store.Settings.WeightUnit));

        // Second workout: sets prefilled from the last performance (same index, else the last weight).
        _now = _now.AddDays(2);
        var next = store.StartSession(push.Id);
        var nextBench = next.Exercises[0];
        Assert.Equal([(6, 80.0), (5, 82.5), (6, 82.5), (6, 82.5)], nextBench.Sets.Select(s => (s.Reps, s.Weight)));
        Assert.All(nextBench.Sets, s => Assert.False(s.Completed));

        // A swap rebuilds the sets from the new exercise's history (none here).
        store.SwapExercise(nextBench.Id, "dumbbell_bench_press");
        Assert.Equal(4, nextBench.Sets.Count);
        Assert.All(nextBench.Sets, s => Assert.Equal((6, 0.0), (s.Reps, s.Weight)));

        store.DiscardSession();
        Assert.Null(store.ActiveSession);
        Assert.Single(store.Sessions);

        // Free workout and history deletion.
        var free = store.StartSession(null);
        Assert.Equal(GymStore.FreeWorkoutName, free.PlanName);
        Assert.Null(free.PlanId);
        Assert.Empty(free.Exercises);
        store.FinishSession();
        Assert.Equal(2, store.Sessions.Count);
        Assert.Same(free, store.Sessions[0]); // newest first
        store.DeleteSession(finished.Id);
        Assert.Equal([free.Id], store.Sessions.Select(s => s.Id));
    }

    [Fact]
    public void session_actions_without_an_active_session_are_no_ops()
    {
        var store = NewStore();
        store.LogSet("nope", 0, reps: 1);
        store.AddSet("nope");
        store.SwapExercise("nope", "plank");
        store.AddSessionExercise("plank");
        store.FinishSession();
        Assert.Null(store.ActiveSession);
        Assert.Empty(store.Sessions);
    }

    // ── file storage ──

    [Fact]
    public void file_storage_writes_atomically_and_quarantines_corrupt_files()
    {
        var dir = Path.Combine(Path.GetTempPath(), "gymbuddy-tests-" + Guid.NewGuid().ToString("N"));
        try
        {
            var path = Path.Combine(dir, "sub", "gym-buddy-v1.json");
            var storage = new FileStateStorage(path);
            Assert.Null(storage.Read());
            var store = new GymStore(storage);
            store.Load();
            Assert.True(File.Exists(path));
            Assert.False(File.Exists(path + ".tmp"));
            store.CreatePlan("On disk");
            var reloaded = new GymStore(new FileStateStorage(path));
            reloaded.Load();
            Assert.Contains(reloaded.Plans, p => p.Name == "On disk");

            File.WriteAllText(path, "garbage");
            var fresh = new GymStore(new FileStateStorage(path));
            fresh.Load();
            Assert.Equal("garbage", File.ReadAllText(storage.QuarantinePath));
            Assert.Equal(4, fresh.Plans.Count);
            Assert.StartsWith("{\"state\":", File.ReadAllText(path));
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        }
    }
}
