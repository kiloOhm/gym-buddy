using GymBuddy.Core.Data;
using GymBuddy.Core.Store;

namespace GymBuddy.Tests;

/// <summary>Port of src/data/seedPlans.test.ts.</summary>
public class SeedPlansTests
{
    [Fact]
    public void is_a_four_day_push_pull_legs_arms_split()
    {
        Assert.Equal(["Push", "Pull", "Legs", "Arms"], SeedPlans.All.Select(p => p.Name));
    }

    [Fact]
    public void only_references_exercises_that_exist()
    {
        foreach (var plan in SeedPlans.All)
            foreach (var e in plan.Exercises)
                Assert.True(ExerciseLibrary.BuiltInById.ContainsKey(e.ExerciseId), e.ExerciseId);
    }

    [Fact]
    public void has_at_most_five_exercises_per_day_no_duplicates_and_sensible_set_rep_rest_values()
    {
        foreach (var plan in SeedPlans.All)
        {
            var ids = plan.Exercises.Select(e => e.ExerciseId).ToList();
            Assert.Equal(ids.Count, ids.Distinct().Count());
            Assert.InRange(plan.Exercises.Count, 4, 5);
            foreach (var e in plan.Exercises)
            {
                Assert.InRange(e.Sets, 1, 10);
                Assert.InRange(e.Reps, 1, 30);
                Assert.True(e.RestSec >= 30);
            }
        }
    }

    [Fact]
    public void buildSeedPlans_creates_the_plans_with_fresh_unique_ids()
    {
        var a = GymStore.BuildSeedPlans();
        var b = GymStore.BuildSeedPlans();
        Assert.Equal(SeedPlans.All.Select(p => p.Name), a.Select(p => p.Name));
        var ids = a.Concat(b).SelectMany(p => p.Exercises.Select(e => e.Id).Append(p.Id)).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        Assert.All(a, p => Assert.Equal(p.CreatedAt, p.UpdatedAt));
    }
}
