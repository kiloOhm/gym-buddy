using GymBuddy.Core;
using GymBuddy.Core.Data;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/data/exercises.test.ts (the runtime registry lives in GymStore, see GymStoreTests).</summary>
public class ExercisesDataTests
{
    private static readonly IReadOnlyList<Exercise> EXERCISES = BuiltInExercises.All;
    private static readonly HashSet<Equipment> HomeEquipment = [Equipment.Bodyweight, Equipment.PullUpBar, Equipment.DipStation];

    private static Exercise ById(string id) => ExerciseLibrary.BuiltInById.TryGetValue(id, out var e) ? e : throw new Exception($"missing exercise {id}");

    // ── shape ──

    [Fact]
    public void has_123_exercises()
    {
        Assert.Equal(123, EXERCISES.Count);
        Assert.Equal(BuiltInExercises.Count, EXERCISES.Count);
    }

    [Fact]
    public void has_unique_slug_shaped_IDs()
    {
        var ids = EXERCISES.Select(e => e.Id).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.All(ids, id => Assert.Matches("^[a-z0-9_]+$", id));
    }

    [Fact]
    public void has_unique_non_empty_names()
    {
        var names = EXERCISES.Select(e => e.Name.ToLowerInvariant()).ToList();
        Assert.Equal(names.Count, names.Distinct().Count());
        Assert.All(EXERCISES, e => Assert.NotEmpty(e.Name.Trim()));
    }

    [Fact]
    public void keeps_the_original_stub_IDs()
    {
        foreach (var id in new[] { "barbell_back_squat", "leg_press", "dumbbell_bench_press" }) Assert.True(ExerciseLibrary.BuiltInById.ContainsKey(id));
    }

    [Fact]
    public void starts_and_ends_like_the_typescript_source()
    {
        Assert.Equal("barbell_bench_press", EXERCISES[0].Id);
        Assert.Equal("power_clean", EXERCISES[^1].Id);
        Assert.Equal(
            [MuscleGroup.Glutes, MuscleGroup.Quads, MuscleGroup.Hamstrings, MuscleGroup.Traps, MuscleGroup.UpperBack, MuscleGroup.LowerBack, MuscleGroup.Calves, MuscleGroup.Forearms],
            EXERCISES[^1].Muscles.Keys);
    }

    public static TheoryData<string> Ids => new(BuiltInExercises.All.Select(e => e.Id));

    [Theory]
    [MemberData(nameof(Ids))]
    public void is_well_formed(string id)
    {
        var e = ById(id);
        Assert.NotEmpty(e.Equipment);
        Assert.Equal(e.Equipment.Count, e.Equipment.Distinct().Count());
        if (e.Equipment.Contains(Equipment.Bodyweight)) Assert.Equal([Equipment.Bodyweight], e.Equipment);

        Assert.NotEmpty(e.Muscles);
        Assert.All(e.Muscles.Values, v => Assert.True(v > 0 && v <= 1));
        Assert.Contains(e.Muscles.Values, v => v == 1);

        Assert.InRange(e.Difficulty, 1, 5);

        Assert.InRange(e.Cues.Count, 2, 4);
        Assert.All(e.Cues, cue =>
        {
            Assert.NotEmpty(cue.Trim());
            Assert.True(cue.Length <= 100);
        });
    }

    // ── coverage ──

    public static TheoryData<MuscleGroup> AllMuscles => new(Muscles.All);
    public static TheoryData<Equipment> AllEquipment => new(Equipments.All);
    public static TheoryData<MovementPattern> AllPatterns => new(MovementPatterns.All);

    [Theory]
    [MemberData(nameof(AllMuscles))]
    public void muscle_is_the_primary_target_of_at_least_3_exercises(MuscleGroup muscle)
    {
        Assert.True(EXERCISES.Count(e => e.Activation(muscle) == 1) >= 3);
    }

    [Theory]
    [MemberData(nameof(AllEquipment))]
    public void equipment_is_required_by_at_least_2_exercises(Equipment item)
    {
        Assert.True(EXERCISES.Count(e => e.Equipment.Contains(item)) >= 2);
    }

    [Theory]
    [MemberData(nameof(AllPatterns))]
    public void pattern_is_used_by_at_least_3_exercises(MovementPattern pattern)
    {
        Assert.True(EXERCISES.Count(e => e.Pattern == pattern) >= 3);
    }

    [Fact]
    public void has_at_least_12_exercises_doable_at_home_with_bodyweight_a_bar_or_dip_station()
    {
        Assert.True(EXERCISES.Count(e => e.Equipment.All(HomeEquipment.Contains)) >= 12);
    }

    // ── lookup ──

    [Fact]
    public void the_built_in_index_has_every_built_in_exercise()
    {
        Assert.Equal(EXERCISES.Count, ExerciseLibrary.BuiltInById.Count);
        foreach (var e in EXERCISES) Assert.Same(e, ExerciseLibrary.BuiltInById[e.Id]);
    }

    [Fact]
    public void lookup_returns_the_exercise_or_nothing()
    {
        Assert.Equal("Barbell back squat", ById("barbell_back_squat").Name);
        Assert.False(ExerciseLibrary.BuiltInById.ContainsKey("not_a_real_exercise"));
        Assert.False(ExerciseLibrary.BuiltInById.ContainsKey(""));
        Assert.False(ExerciseLibrary.BuiltInById.ContainsKey("toString"));
    }

    // ── rating anchors ──

    [Theory]
    [InlineData("machine_chest_press", 1)]
    [InlineData("leg_extension", 1)]
    [InlineData("pec_deck", 1)]
    [InlineData("cable_lateral_raise", 1)]
    [InlineData("push_up", 1)]
    [InlineData("dumbbell_bench_press", 2)]
    [InlineData("leg_press", 2)]
    [InlineData("lat_pulldown", 2)]
    [InlineData("seated_cable_row", 2)]
    [InlineData("dumbbell_curl", 2)]
    [InlineData("barbell_bench_press", 3)]
    [InlineData("barbell_row", 3)]
    [InlineData("overhead_press", 3)]
    [InlineData("kettlebell_swing", 3)]
    [InlineData("bulgarian_split_squat", 3)]
    [InlineData("hip_thrust", 3)]
    [InlineData("pull_up", 3)]
    [InlineData("barbell_back_squat", 4)]
    [InlineData("front_squat", 4)]
    [InlineData("romanian_deadlift", 4)]
    [InlineData("weighted_pull_up", 4)]
    [InlineData("barbell_upright_row", 4)]
    [InlineData("rack_pull", 4)]
    [InlineData("conventional_deadlift", 5)]
    [InlineData("snatch_grip_deadlift", 5)]
    [InlineData("good_morning", 5)]
    [InlineData("behind_the_neck_press", 5)]
    [InlineData("power_clean", 5)]
    public void has_difficulty(string id, int difficulty)
    {
        Assert.Equal(difficulty, ById(id).Difficulty);
    }

    [Theory]
    [InlineData("reverse_crunch", 1)]
    [InlineData("incline_push_up", 1)]
    [InlineData("dumbbell_goblet_squat", 2)]
    [InlineData("machine_lateral_raise", 1)]
    [InlineData("cable_overhead_triceps_extension", 2)]
    public void new_entry_has_difficulty(string id, int difficulty)
    {
        Assert.Equal(difficulty, ById(id).Difficulty);
    }

    [Fact]
    public void matches_the_documented_activation_profiles()
    {
        Assert.Equal(M((MuscleGroup.Hamstrings, 1), (MuscleGroup.Glutes, 0.8), (MuscleGroup.LowerBack, 0.5), (MuscleGroup.Forearms, 0.3)), ById("romanian_deadlift").Muscles);
        Assert.Equal(M((MuscleGroup.Lats, 1), (MuscleGroup.UpperBack, 0.5), (MuscleGroup.Biceps, 0.5), (MuscleGroup.RearDelts, 0.3)), ById("lat_pulldown").Muscles);
        var ohp = ById("overhead_press");
        Assert.Equal(1, ohp.Activation(MuscleGroup.FrontDelts));
        Assert.Equal(0.5, ohp.Activation(MuscleGroup.SideDelts));
        Assert.Equal(0.6, ohp.Activation(MuscleGroup.Triceps));
        Assert.Equal(0.2, ohp.Activation(MuscleGroup.UpperBack));
    }

    [Fact]
    public void lists_every_required_item_of_equipment_for_common_lifts()
    {
        Assert.Equal([Equipment.Barbell, Equipment.Bench], ById("barbell_bench_press").Equipment);
        Assert.Equal([Equipment.PullUpBar], ById("pull_up").Equipment);
        Assert.Equal([Equipment.Bodyweight], ById("push_up").Equipment);
        Assert.Equal([Equipment.DipStation], ById("chest_dip").Equipment);
        Assert.Equal([Equipment.PullUpBar], ById("weighted_pull_up").Equipment);
        Assert.Equal([Equipment.Machine], ById("back_extension").Equipment);
        Assert.Equal([Equipment.EzBar, Equipment.Machine], ById("preacher_curl").Equipment);
    }

    [Fact]
    public void requires_a_rack_for_the_lifts_that_start_from_one()
    {
        foreach (var id in new[] { "barbell_back_squat", "front_squat", "good_morning", "rack_pull", "inverted_row" })
            Assert.Equal([Equipment.Barbell, Equipment.Rack], ById(id).Equipment);
    }

    [Fact]
    public void marks_isolation_exercises_as_non_compound()
    {
        Assert.All(EXERCISES.Where(x => x.Pattern == MovementPattern.Isolation), e => Assert.False(e.Compound));
    }

    // ── photos ──

    [Fact]
    public void photos_exist_for_known_ids_only_and_point_at_the_bundled_assets()
    {
        Assert.Equal(104, ExerciseImages.IdsWithPhotos.Count);
        Assert.Equal(ExerciseImages.IdsWithPhotos.Order(StringComparer.Ordinal), ExerciseImages.IdsWithPhotos);
        Assert.All(ExerciseImages.IdsWithPhotos, id => Assert.True(ExerciseLibrary.BuiltInById.ContainsKey(id)));
        Assert.True(ExerciseImages.HasPhotos("barbell_back_squat"));
        Assert.Equal(["exercises/barbell_back_squat/0.jpg", "exercises/barbell_back_squat/1.jpg"], ExerciseImages.AssetPaths("barbell_back_squat"));
        Assert.Empty(ExerciseImages.AssetPaths("nope"));
        foreach (var id in ExerciseImages.IdsWithPhotos)
            foreach (var asset in ExerciseImages.AssetPaths(id))
                Assert.True(File.Exists(Path.Combine(RepoRoot, "assets", asset)), asset);
    }
}
