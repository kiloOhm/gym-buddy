using System.Text.RegularExpressions;
using GymBuddy.Core;
using GymBuddy.Core.Geometry;

namespace GymBuddy.Tests;

/// <summary>Port of src/components/BodyMap.test.ts (on the polygon data and the path strings).</summary>
public class BodyMapRegionsTests
{
    private static readonly MuscleGroup[] Front =
    [
        MuscleGroup.Chest, MuscleGroup.FrontDelts, MuscleGroup.SideDelts, MuscleGroup.Biceps, MuscleGroup.Forearms, MuscleGroup.Abs, MuscleGroup.Obliques,
        MuscleGroup.Quads, MuscleGroup.Adductors, MuscleGroup.HipFlexors, MuscleGroup.Calves, MuscleGroup.Traps,
    ];

    private static readonly MuscleGroup[] Back =
    [
        MuscleGroup.Traps, MuscleGroup.RearDelts, MuscleGroup.SideDelts, MuscleGroup.UpperBack, MuscleGroup.Lats, MuscleGroup.LowerBack, MuscleGroup.Triceps,
        MuscleGroup.Forearms, MuscleGroup.Glutes, MuscleGroup.Hamstrings, MuscleGroup.Adductors, MuscleGroup.Calves,
    ];

    private static int CommandCount(string d) => Regex.Matches(d, "[MLHVCSQTAZ]", RegexOptions.IgnoreCase).Count;

    public static TheoryData<MuscleGroup> AllMuscles => new(Muscles.All);
    public static TheoryData<MuscleGroup> FrontMuscles => new(Front);
    public static TheoryData<MuscleGroup> BackMuscles => new(Back);

    [Theory]
    [MemberData(nameof(AllMuscles))]
    public void has_at_least_one_path(MuscleGroup m)
    {
        var r = BodyMapRegions.Regions[m];
        Assert.True(r.Front.Count + r.Back.Count > 0);
    }

    [Fact]
    public void every_path_is_a_non_trivial_path_starting_with_M()
    {
        foreach (var m in Muscles.All)
            foreach (var poly in BodyMapRegions.Regions[m].Front.Concat(BodyMapRegions.Regions[m].Back))
            {
                var d = BodyMapRegions.PolygonPath(poly);
                Assert.StartsWith("M", d);
                Assert.True(d.Length > 10);
                Assert.True(poly.Length >= 3);
            }
    }

    [Theory]
    [MemberData(nameof(FrontMuscles))]
    public void appears_in_the_front_view(MuscleGroup m)
    {
        Assert.NotEmpty(BodyMapRegions.Regions[m].Front);
    }

    [Theory]
    [MemberData(nameof(BackMuscles))]
    public void appears_in_the_back_view(MuscleGroup m)
    {
        Assert.NotEmpty(BodyMapRegions.Regions[m].Back);
    }

    [Fact]
    public void left_right_paths_are_mirrored_same_number_of_commands()
    {
        foreach (var m in Muscles.All)
            foreach (var paths in new[] { BodyMapRegions.Regions[m].Front, BodyMapRegions.Regions[m].Back })
                if (paths.Count == 2)
                {
                    Assert.Equal(CommandCount(BodyMapRegions.PolygonPath(paths[0])), CommandCount(BodyMapRegions.PolygonPath(paths[1])));
                    Assert.Equal(paths[1], BodyMapRegions.Mirror(paths[0]));
                }
    }

    [Fact]
    public void polygonPath_matches_the_typescript_format()
    {
        Assert.Equal("M56 68 L48 80 L48 98 L54 90 Z", BodyMapRegions.PolygonPath(BodyMapRegions.Regions[MuscleGroup.SideDelts].Front[0]));
        Assert.Equal("M144 68 L152 80 L152 98 L146 90 Z", BodyMapRegions.PolygonPath(BodyMapRegions.Regions[MuscleGroup.SideDelts].Front[1]));
        Assert.Equal("M1.3 2 L3 4.5 Z", BodyMapRegions.PolygonPath([new Pt(1.25f, 2), new Pt(3, 4.5f)]));
    }

    [Fact]
    public void outline_has_torso_arms_hands_feet_and_neck()
    {
        Assert.Equal(8, BodyMapRegions.Outline.Count);
        Assert.Equal(50, BodyMapRegions.Outline[0].Length); // 25 left points + 25 mirrored
        Assert.Equal(6, BodyMapRegions.Outline[^1].Length);
        Assert.Equal((100f, 28f, 15f, 19f), BodyMapRegions.Head);
    }

    [Fact]
    public void hit_test_finds_the_muscle_under_a_point()
    {
        Assert.Equal(MuscleGroup.Chest, BodyMapRegions.HitTest(new Pt(85, 85), back: false));
        Assert.Equal(MuscleGroup.Chest, BodyMapRegions.HitTest(new Pt(115, 85), back: false));
        Assert.Equal(MuscleGroup.UpperBack, BodyMapRegions.HitTest(new Pt(90, 95), back: true));
        Assert.Null(BodyMapRegions.HitTest(new Pt(5, 5), back: false));
    }
}
