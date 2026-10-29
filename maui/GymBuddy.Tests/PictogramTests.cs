using GymBuddy.Core;
using GymBuddy.Core.Geometry;

namespace GymBuddy.Tests;

/// <summary>Port of src/components/ExercisePictogram.test.ts.</summary>
public class PictogramTests
{
    [Fact]
    public void returns_a_glyph_for_every_equipment_value()
    {
        foreach (var equipment in Equipments.All)
        {
            var variant = Pictogram.Variant(MovementPattern.Isolation, [equipment]);
            Assert.Equal($"isolation:{(equipment == Equipment.Bodyweight ? "none" : equipment.Slug())}", variant);
        }
    }

    [Fact]
    public void returns_a_variant_for_every_movement_pattern()
    {
        foreach (var pattern in MovementPatterns.All)
            Assert.Equal($"{pattern.Slug()}:barbell", Pictogram.Variant(pattern, [Equipment.Barbell]));
    }

    [Fact]
    public void yields_the_bare_pattern_with_glyph_none_for_bodyweight_only_exercises()
    {
        foreach (var pattern in MovementPatterns.All)
            Assert.Equal($"{pattern.Slug()}:none", Pictogram.Variant(pattern, [Equipment.Bodyweight]));
        Assert.Equal("core:none", Pictogram.Variant(MovementPattern.Core, []));
    }

    [Fact]
    public void picks_by_priority_not_list_order_when_several_items_are_listed()
    {
        Assert.Equal("horizontal_push:dumbbell", Pictogram.Variant(MovementPattern.HorizontalPush, [Equipment.Bench, Equipment.Dumbbell]));
        Assert.Equal("vertical_pull:pull_up_bar", Pictogram.Variant(MovementPattern.VerticalPull, [Equipment.Dumbbell, Equipment.PullUpBar]));
    }

    [Fact]
    public void every_pattern_and_glyph_has_a_pose()
    {
        foreach (var pattern in MovementPatterns.All)
            foreach (var glyph in Enum.GetValues<PictogramGlyph>())
            {
                var pose = Pictogram.PoseFor(pattern, glyph);
                Assert.NotEmpty(pose.Limbs);
                Assert.InRange(pose.Hands.Count, 1, 2);
            }
    }

    [Fact]
    public void poseFor_follows_the_apparatus_then_the_pattern()
    {
        Assert.Equal("hang", Pictogram.PoseKeyFor(MovementPattern.Isolation, PictogramGlyph.PullUpBar));
        Assert.Equal("hang", Pictogram.PoseKeyFor(MovementPattern.VerticalPull, PictogramGlyph.Cable));
        Assert.Equal("support", Pictogram.PoseKeyFor(MovementPattern.HorizontalPush, PictogramGlyph.DipStation));
        Assert.Equal("bench", Pictogram.PoseKeyFor(MovementPattern.HorizontalPush, PictogramGlyph.Dumbbell));
        Assert.Equal("standPress", Pictogram.PoseKeyFor(MovementPattern.HorizontalPush, PictogramGlyph.Machine));
        Assert.Equal("pushup", Pictogram.PoseKeyFor(MovementPattern.HorizontalPush, PictogramGlyph.None));
        Assert.Equal("seatedRow", Pictogram.PoseKeyFor(MovementPattern.HorizontalPull, PictogramGlyph.Band));
        Assert.Equal("bentRow", Pictogram.PoseKeyFor(MovementPattern.HorizontalPull, PictogramGlyph.Barbell));
        Assert.Equal("squat", Pictogram.PoseKeyFor(MovementPattern.Squat, PictogramGlyph.Rack));
        var bench = Pictogram.PoseFor(MovementPattern.HorizontalPush, PictogramGlyph.Barbell);
        Assert.Equal(PoseSupport.Bench, bench.Support);
        Assert.Equal(new Pt(32, 22), bench.Bar);
        Assert.Equal(new Pt(18, 52), bench.Head);
    }
}
