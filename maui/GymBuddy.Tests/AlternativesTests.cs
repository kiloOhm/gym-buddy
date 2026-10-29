using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/alternatives.test.ts.</summary>
public class AlternativesTests
{
    private static Dictionary<MuscleGroup, double> PressMuscles() =>
        M((MuscleGroup.Chest, 1), (MuscleGroup.FrontDelts, 0.5), (MuscleGroup.Triceps, 0.5));

    private static readonly Exercise[] Fixtures =
    [
        Ex("barbell_bench", PressMuscles(), "Barbell bench press", [Equipment.Barbell, Equipment.Bench], MovementPattern.HorizontalPush, true, 3),
        Ex("dumbbell_bench", PressMuscles(), "Dumbbell bench press", [Equipment.Dumbbell, Equipment.Bench], MovementPattern.HorizontalPush, true, 2),
        Ex("machine_press", PressMuscles(), "Machine chest press", [Equipment.Machine], MovementPattern.HorizontalPush, true, 1),
        Ex("cable_fly", M((MuscleGroup.Chest, 1), (MuscleGroup.FrontDelts, 0.3)), "Cable fly", [Equipment.Cable], MovementPattern.Isolation, false, 1),
        Ex("push_up", M((MuscleGroup.Chest, 1), (MuscleGroup.Triceps, 0.6), (MuscleGroup.FrontDelts, 0.4), (MuscleGroup.Abs, 0.2)),
            "Push-up", [Equipment.Bodyweight], MovementPattern.HorizontalPush, true, 2),
        Ex("guillotine_press", M((MuscleGroup.Chest, 1), (MuscleGroup.FrontDelts, 0.6), (MuscleGroup.Triceps, 0.4)),
            "Smith guillotine press", [Equipment.SmithMachine], MovementPattern.HorizontalPush, true, 5),
        // Similar vector, but the original's primary (chest) is only 0.4 here.
        Ex("close_grip", M((MuscleGroup.Triceps, 1), (MuscleGroup.Chest, 0.4), (MuscleGroup.FrontDelts, 0.5)),
            "Close-grip press", [Equipment.Barbell, Equipment.Bench], MovementPattern.HorizontalPush, true, 3),
        Ex("leg_press", M((MuscleGroup.Quads, 1), (MuscleGroup.Glutes, 0.5), (MuscleGroup.Adductors, 0.3)),
            "Leg press", [Equipment.Machine], MovementPattern.Squat, true, 2),
    ];

    private static readonly IReadOnlyDictionary<string, Exercise> DB = Db(Fixtures);

    private static List<string> Ids(IEnumerable<Alternative> list) => list.Select(a => a.Exercise.Id).ToList();

    [Fact]
    public void muscleSimilarity_is_1_for_identical_vectors_and_symmetric()
    {
        Assert.Equal(1, Alternatives.MuscleSimilarity(DB["barbell_bench"], DB["dumbbell_bench"]), 10);
        Assert.Equal(Alternatives.MuscleSimilarity(DB["push_up"], DB["cable_fly"]), Alternatives.MuscleSimilarity(DB["cable_fly"], DB["push_up"]), 10);
    }

    [Fact]
    public void muscleSimilarity_is_0_for_disjoint_muscles()
    {
        Assert.Equal(0, Alternatives.MuscleSimilarity(DB["barbell_bench"], DB["leg_press"]));
    }

    [Fact]
    public void muscleSimilarity_is_0_when_either_vector_is_empty()
    {
        var empty = Ex("e", M(), "Empty");
        Assert.Equal(0, Alternatives.MuscleSimilarity(empty, DB["barbell_bench"]));
        Assert.Equal(0, Alternatives.MuscleSimilarity(empty, empty));
    }

    [Fact]
    public void muscleSimilarity_stays_within_0_1_for_partial_overlap()
    {
        var s = Alternatives.MuscleSimilarity(DB["barbell_bench"], DB["cable_fly"]);
        Assert.True(s > 0.8);
        Assert.True(s < 1);
    }

    [Fact]
    public void suggestAlternatives_returns_empty_for_an_unknown_ID()
    {
        Assert.Empty(Alternatives.SuggestAlternatives("nope", DB));
    }

    [Fact]
    public void suggestAlternatives_never_returns_the_original()
    {
        Assert.DoesNotContain("barbell_bench", Ids(Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 100)));
    }

    [Fact]
    public void suggestAlternatives_filters_out_unrelated_exercises_and_ones_missing_the_primary_muscle()
    {
        var result = Ids(Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 100));
        Assert.DoesNotContain("leg_press", result);
        Assert.DoesNotContain("close_grip", result);
        Assert.Equal(["cable_fly", "dumbbell_bench", "guillotine_press", "machine_press", "push_up"], result.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void suggestAlternatives_respects_excludeIds()
    {
        var result = Ids(Alternatives.SuggestAlternatives("barbell_bench", DB, ["dumbbell_bench", "push_up"]));
        Assert.DoesNotContain("dumbbell_bench", result);
        Assert.DoesNotContain("push_up", result);
        Assert.NotEmpty(result);
    }

    [Fact]
    public void suggestAlternatives_ranks_a_more_demanding_variant_below_an_easier_one()
    {
        var result = Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 100);
        double Score(string id) => result.First(a => a.Exercise.Id == id).Score;
        Assert.Equal(1, Score("dumbbell_bench"));
        Assert.True(Score("guillotine_press") < Score("dumbbell_bench"));
        // 0.55 × sim + 0.2 + 0.15 + 0 (two points harder) − 0.05 × 2
        var sim = Alternatives.MuscleSimilarity(DB["barbell_bench"], DB["guillotine_press"]);
        Assert.True(Math.Abs(Score("guillotine_press") - (0.55 * sim + 0.25)) < 0.0005);
    }

    [Fact]
    public void suggestAlternatives_sorts_by_score_desc_then_name_asc_and_keeps_scores_in_0_1()
    {
        var result = Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 100);
        for (var i = 1; i < result.Count; i++)
        {
            Assert.True(result[i - 1].Score >= result[i].Score);
            if (result[i - 1].Score == result[i].Score)
                Assert.True(LocaleComparer.Instance.Compare(result[i - 1].Exercise.Name, result[i].Exercise.Name) < 0);
        }
        Assert.All(result, a => Assert.InRange(a.Score, 0, 1));
        // Dumbbell bench and machine press tie at 1.0; name breaks the tie.
        Assert.Equal(["dumbbell_bench", "machine_press"], Ids(result).Take(2));
    }

    [Fact]
    public void suggestAlternatives_respects_limit_default_5()
    {
        Assert.Equal(5, Alternatives.SuggestAlternatives("barbell_bench", DB).Count);
        Assert.Equal(2, Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 2).Count);
        Assert.Empty(Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 0));
    }

    [Fact]
    public void suggestAlternatives_explains_each_suggestion()
    {
        var result = Alternatives.SuggestAlternatives("barbell_bench", DB, limit: 100);
        IReadOnlyList<string> Reasons(string id) => result.First(a => a.Exercise.Id == id).Reasons;
        Assert.Equal(["Same movement pattern", "Hits Chest like the original", "Easier", "Needs: Dumbbells, Bench"], Reasons("dumbbell_bench"));
        Assert.Equal(["Different pattern, same muscles", "Hits Chest like the original", "Easier", "Needs: Cable station"], Reasons("cable_fly"));
        Assert.Contains("More demanding", Reasons("guillotine_press"));
        Assert.Contains("No equipment needed", Reasons("push_up"));
    }

    [Fact]
    public void suggestAlternatives_reports_the_same_difficulty()
    {
        var db = Db([.. Fixtures, DB["barbell_bench"] with { Id = "twin", Name = "Twin" }]);
        var twin = Alternatives.SuggestAlternatives("barbell_bench", db, limit: 100).First(a => a.Exercise.Id == "twin");
        Assert.Contains("Same difficulty", twin.Reasons);
    }

    public static TheoryData<string> RealIds => new(BuiltInExercises.All.Select(e => e.Id));

    [Theory]
    [MemberData(nameof(RealIds))]
    public void database_invariants_suggestions_are_well_formed(string id)
    {
        const int limit = 5;
        var result = Alternatives.SuggestAlternatives(id, Real, limit: limit);
        Assert.True(result.Count <= limit);
        Assert.DoesNotContain(id, Ids(result));
        for (var i = 0; i < result.Count; i++)
        {
            Assert.InRange(result[i].Score, 0, 1);
            if (i > 0) Assert.True(result[i - 1].Score >= result[i].Score);
            Assert.NotEmpty(result[i].Reasons);
        }
    }

    [Fact]
    public void localeCompare_tie_break_is_case_insensitive_like_javascript()
    {
        // ICU: "alpha" < "Bravo" < "bravo2"; ordinal would put "Bravo" first.
        var sorted = new[] { "bravo2", "alpha", "Bravo" }.Order(LocaleComparer.Instance).ToArray();
        Assert.Equal(["alpha", "Bravo", "bravo2"], sorted);
        Assert.True(LocaleComparer.Instance.Compare("a", "A") < 0);
    }
}
