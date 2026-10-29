using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;

namespace GymBuddy.Tests;

public class ExerciseSearchTests
{
    private static IReadOnlyList<Exercise> All => BuiltInExercises.All;

    private static List<string> Names(string query) => ExerciseSearch.Search(All, query).Select(e => e.Name).ToList();

    [Theory]
    [InlineData("bnch pres", "Barbell bench press")]
    [InlineData("pulldwn", "Lat pulldown")]
    [InlineData("rdl", "Romanian deadlift")]
    [InlineData("db curl", "Dumbbell curl")]
    [InlineData("squat bar", "Barbell back squat")]
    [InlineData("lat", "Lat pulldown")]
    [InlineData("ohp", "Overhead press")]
    [InlineData("bss", "Bulgarian split squat")]
    [InlineData("benhc press", "Barbell bench press")]
    [InlineData("Romanian Deadlift", "Romanian deadlift")]
    [InlineData("farmers", "Farmer's carry")]
    [InlineData("pushup", "Push-up")]
    [InlineData("crünch", "Crunch")]
    public void FindsTheExpectedExerciseFirst(string query, string expected)
    {
        var names = Names(query);
        Assert.NotEmpty(names);
        Assert.Equal(expected, names[0]);
    }

    [Fact]
    public void PartialWordMatchesEveryWordWithThatPrefix()
    {
        var names = Names("lat");
        Assert.Contains("Lat pulldown", names);
        Assert.Contains("Dumbbell lateral raise", names);
        Assert.Contains("Cable lateral raise", names);
        Assert.Contains("Dumbbell lateral lunge", names);
    }

    [Fact]
    public void WordPrefixMatchesRankBeforeFuzzyMatches()
    {
        var results = ExerciseSearch.Search(All, "lat");
        var isPrefix = results.Select(e => e.Name.ToLowerInvariant().Split(' ', '-').Any(w => w.StartsWith("lat"))).ToList();
        var firstFuzzy = isPrefix.IndexOf(false);
        if (firstFuzzy >= 0) Assert.DoesNotContain(true, isPrefix.Skip(firstFuzzy));
        Assert.True(ExerciseSearch.Score("lat", Ex("Lat pulldown")) > ExerciseSearch.Score("lat", Ex("Lateral raise")));
        Assert.True(ExerciseSearch.Score("lat", Ex("Lateral raise")) > ExerciseSearch.Score("lat", Ex("Lancet raise")));
    }

    [Fact]
    public void EmptyQueryReturnsTheInputUnchanged()
    {
        var input = All.Reverse().ToList();
        Assert.Same(input, ExerciseSearch.Search(input, ""));
        Assert.Same(input, ExerciseSearch.Search(input, "   "));
        Assert.Equal(input, ExerciseSearch.Search(input.AsEnumerable().Select(e => e), " \t "));
    }

    [Fact]
    public void UnrelatedQueryFindsNothing()
    {
        Assert.Empty(ExerciseSearch.Search(All, "xyzzy"));
        Assert.Equal(0, ExerciseSearch.Score("xyzzy", All[0]));
    }

    [Fact]
    public void EveryTokenMustMatch()
    {
        Assert.Empty(ExerciseSearch.Search(All, "bench xyzzy"));
        Assert.All(ExerciseSearch.Search(All, "curl"), e => Assert.Contains("curl", e.Name.ToLowerInvariant()));
    }

    [Fact]
    public void EveryExerciseIsFoundFirstByItsOwnName()
    {
        foreach (var ex in All)
        {
            var results = ExerciseSearch.Search(All, ex.Name);
            Assert.True(results.Count > 0 && results[0].Id == ex.Id, $"\"{ex.Name}\" ranked {results.Select(r => r.Name).ToList().IndexOf(ex.Name)}, first was \"{results.FirstOrDefault()?.Name}\"");
        }
    }

    [Fact]
    public void TiesAreOrderedByName()
    {
        var names = Names("bench press");
        var exact = names.Where(n => n.EndsWith("bench press")).ToList();
        Assert.Equal("Barbell bench press", names[0]);
        Assert.Contains("Dumbbell bench press", exact);
    }

    [Fact]
    public void EquipmentLabelsMatchWithLowerWeight()
    {
        // "rack" is no name word, only the equipment of the rack lifts.
        var names = Names("squat rack");
        Assert.Contains("Barbell back squat", names);
        Assert.Contains("Front squat", names);
        Assert.DoesNotContain("Goblet squat", names);
        Assert.True(ExerciseSearch.Score("bench", All.First(e => e.Name == "Barbell bench press"))
            > ExerciseSearch.Score("bench", All.First(e => e.Name == "Dumbbell fly")));
    }

    private static Exercise Ex(string name) => All[0] with { Id = name.Replace(' ', '_').ToLowerInvariant(), Name = name, Equipment = [Equipment.Bodyweight] };
}
