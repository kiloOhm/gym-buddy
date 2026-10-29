using System.Text.Json;
using GymBuddy.Core;

namespace GymBuddy.Tests;

public class TypesTests
{
    [Fact]
    public void Slugs_round_trip_and_match_the_typescript_unions()
    {
        Assert.Equal(19, Muscles.All.Count);
        Assert.Equal("front_delts", MuscleGroup.FrontDelts.Slug());
        Assert.Equal("Power rack / squat stand", Equipment.Rack.Label());
        Assert.Equal("pull_up_bar", Equipment.PullUpBar.Slug());
        Assert.Equal(MovementPattern.HorizontalPush, MovementPatterns.Parse("horizontal_push"));
        Assert.False(Muscles.TryParse("toString", out _));
        Assert.False(Muscles.TryParse(null, out _));
    }

    [Fact]
    public void Json_uses_slugs_for_enum_values_and_dictionary_keys()
    {
        var e = new Exercise
        {
            Id = "x", Name = "X", Equipment = [Equipment.EzBar, Equipment.Bench], Pattern = MovementPattern.Isolation,
            Compound = false, Muscles = new Dictionary<MuscleGroup, double> { [MuscleGroup.Biceps] = 1, [MuscleGroup.Forearms] = 0.3 },
            Difficulty = 2, Cues = ["Stay tight – 45°"],
        };
        var json = JsonSerializer.Serialize(e, GymJson.Compact);
        Assert.Equal("""{"id":"x","name":"X","equipment":["ez_bar","bench"],"pattern":"isolation","compound":false,"muscles":{"biceps":1,"forearms":0.3},"difficulty":2,"cues":["Stay tight – 45°"]}""", json);
        var back = JsonSerializer.Deserialize<Exercise>(json, GymJson.Compact)!;
        Assert.Equal(e, back);
        Assert.NotEqual(e, e with { Difficulty = 3 });
        Assert.Equal(e, e with { Muscles = new Dictionary<MuscleGroup, double> { [MuscleGroup.Forearms] = 0.3, [MuscleGroup.Biceps] = 1 } });
    }

    [Fact]
    public void Iso_timestamps_match_javascript()
    {
        var iso = GymJson.ToIso(DateTimeOffset.FromUnixTimeMilliseconds(1_761_678_245_123));
        Assert.Equal("2025-10-28T19:04:05.123Z", iso);
        Assert.Equal(1_761_678_245_123, Core.Logic.Ids.ParseIsoMs(iso));
        Assert.Null(Core.Logic.Ids.ParseIsoMs("nope"));
        Assert.Matches("^[0-9a-z]{14,}$", Core.Logic.Ids.NewId());
    }
}
