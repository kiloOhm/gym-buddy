using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/coverage.test.ts.</summary>
public class CoverageTests
{
    private static readonly IReadOnlyDictionary<string, Exercise> DB = Db(
        Ex("squat", M((MuscleGroup.Quads, 1), (MuscleGroup.Glutes, 0.7), (MuscleGroup.LowerBack, 0.3)), difficulty: 4),
        Ex("bench", M((MuscleGroup.Chest, 1), (MuscleGroup.FrontDelts, 0.5), (MuscleGroup.Triceps, 0.5)), difficulty: 4),
        Ex("curl", M((MuscleGroup.Biceps, 1), (MuscleGroup.Forearms, 0.3)), difficulty: 2),
        Ex("thirds", M((MuscleGroup.Abs, 0.1)), difficulty: 3));

    [Fact]
    public void emptyCoverage_has_every_muscle_at_zero()
    {
        var c = Coverage.Empty();
        Assert.Equal(Muscles.All, c.Select(kv => kv.Key));
        Assert.All(c, kv => Assert.Equal(0, kv.Value));
    }

    [Fact]
    public void computeCoverage_sums_sets_times_activation_per_muscle()
    {
        var c = CoverageLogic.ComputeCoverage([new("squat", 4), new("bench", 3), new("squat", 2)], DB);
        Assert.Equal(6, c[MuscleGroup.Quads]);
        Assert.Equal(4.2, c[MuscleGroup.Glutes]);
        Assert.Equal(1.8, c[MuscleGroup.LowerBack]);
        Assert.Equal(3, c[MuscleGroup.Chest]);
        Assert.Equal(1.5, c[MuscleGroup.Triceps]);
        Assert.Equal(0, c[MuscleGroup.Biceps]);
    }

    [Fact]
    public void computeCoverage_rounds_to_2_decimals_to_avoid_float_noise()
    {
        var c = CoverageLogic.ComputeCoverage([new("thirds", 3)], DB);
        Assert.Equal(0.3, c[MuscleGroup.Abs]); // 3 × 0.1 = 0.30000000000000004 unrounded
    }

    [Fact]
    public void computeCoverage_ignores_unknown_exercise_IDs()
    {
        var c = CoverageLogic.ComputeCoverage([new("nope", 10), new("curl", 3)], DB);
        var expected = Coverage.Empty();
        expected[MuscleGroup.Biceps] = 3;
        expected[MuscleGroup.Forearms] = 0.9;
        Assert.Equal(expected, c);
    }

    [Fact]
    public void computeCoverage_returns_empty_coverage_for_no_items()
    {
        Assert.Equal(Coverage.Empty(), CoverageLogic.ComputeCoverage([], DB));
    }

    [Theory]
    [InlineData(0, CoverageLevel.None)]
    [InlineData(0.01, CoverageLevel.Light)]
    [InlineData(3.99, CoverageLevel.Light)]
    [InlineData(4, CoverageLevel.Moderate)]
    [InlineData(9.99, CoverageLevel.Moderate)]
    [InlineData(10, CoverageLevel.High)]
    [InlineData(25, CoverageLevel.High)]
    public void coverageLevel_buckets(double sets, CoverageLevel level)
    {
        Assert.Equal(level, CoverageLogic.CoverageLevel(sets));
    }

    [Fact]
    public void summarizePlan_returns_zeros_for_an_empty_plan()
    {
        Assert.Equal(new PlanSummary(0, 0, 0, null), CoverageLogic.SummarizePlan([], DB));
    }

    [Fact]
    public void summarizePlan_returns_zeros_when_every_ID_is_unknown()
    {
        var s = CoverageLogic.SummarizePlan([new("nope", 5)], DB);
        Assert.Equal(0, s.TotalSets);
        Assert.Equal(0, s.AvgDifficulty);
        Assert.Equal(0, s.MaxDifficulty);
        Assert.Null(s.Hardest);
    }

    [Fact]
    public void summarizePlan_totals_sets_averages_difficulty_to_1_decimal_and_finds_the_hardest()
    {
        var s = CoverageLogic.SummarizePlan([new("curl", 3), new("bench", 4), new("nope", 9), new("squat", 5)], DB);
        Assert.Equal(12, s.TotalSets);
        Assert.Equal(3.3, s.AvgDifficulty); // (2 + 4 + 4) / 3 = 3.333…
        Assert.Equal(4, s.MaxDifficulty);
        // bench and squat tie at difficulty 4; the first one wins.
        Assert.Equal("bench", s.Hardest?.Id);
    }

    [Fact]
    public void database_invariants_computeCoverage_on_the_real_DB_yields_finite_non_negative_values()
    {
        var c = CoverageLogic.ComputeCoverage(BuiltInExercises.All.Select(e => new CoverageItem(e.Id, 3)), Real);
        Assert.All(c, kv =>
        {
            Assert.True(double.IsFinite(kv.Value));
            Assert.True(kv.Value >= 0);
        });
    }

    [Fact]
    public void database_invariants_summarizePlan_on_the_real_DB_stays_within_rating_bounds()
    {
        var all = BuiltInExercises.All;
        var s = CoverageLogic.SummarizePlan(all.Select(e => new CoverageItem(e.Id, 2)), Real);
        Assert.Equal(all.Count * 2, s.TotalSets);
        Assert.InRange(s.AvgDifficulty, 1, 5);
        Assert.Equal(all.Max(e => e.Difficulty), s.MaxDifficulty);
    }
}
