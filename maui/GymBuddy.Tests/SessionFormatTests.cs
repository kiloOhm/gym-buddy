using GymBuddy.Core;
using GymBuddy.Core.Logic;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/sessionFormat.test.ts.</summary>
public class SessionFormatTests
{
    private static WorkoutSession MakeSession() => new()
    {
        Id = "s1",
        PlanName = "Push",
        StartedAt = "2026-01-01T10:00:00.000Z",
        FinishedAt = "2026-01-01T10:45:20.000Z",
        Exercises =
        [
            new SessionExercise
            {
                Id = "e1", ExerciseId = "x", TargetSets = 2, TargetReps = 8, RestSec = 90,
                Sets = [new SetLog { Weight = 80, Reps = 8, Completed = true }, new SetLog { Weight = 80, Reps = 6, Completed = false }],
            },
            new SessionExercise
            {
                Id = "e2", ExerciseId = "y", TargetSets = 1, TargetReps = 10, RestSec = 60,
                Sets = [new SetLog { Weight = 12.5, Reps = 10, Completed = true }],
            },
        ],
    };

    [Fact]
    public void formats_elapsed_time()
    {
        Assert.Equal("00:00", SessionFormat.FormatElapsed(0));
        Assert.Equal("01:05", SessionFormat.FormatElapsed(65_000));
        Assert.Equal("1:02:05", SessionFormat.FormatElapsed(3_725_000));
        Assert.Equal("00:00", SessionFormat.FormatElapsed(-5));
    }

    [Fact]
    public void formats_weights_and_set_lists()
    {
        Assert.Equal("80", SessionFormat.FormatWeight(80));
        Assert.Equal("82.5", SessionFormat.FormatWeight(82.5));
        Assert.Equal("80.33", SessionFormat.FormatWeight(80.333));
        Assert.Equal(
            "80 kg × 8, 80 × 7",
            SessionFormat.FormatSetList([new SetLog { Weight = 80, Reps = 8, Completed = true }, new SetLog { Weight = 80, Reps = 7, Completed = true }], WeightUnit.Kg));
    }

    [Fact]
    public void parses_numeric_input_safely()
    {
        Assert.Equal(0, SessionFormat.ParseNumberInput("", true));
        Assert.Equal(7, SessionFormat.ParseNumberInput("7.", true));
        Assert.Equal(7.5, SessionFormat.ParseNumberInput("7,5", true));
        Assert.Equal(7, SessionFormat.ParseNumberInput("7.5", false));
        Assert.Equal(0, SessionFormat.ParseNumberInput("abc", true));
        Assert.Equal(0, SessionFormat.ParseNumberInput("-3", true));
        Assert.Equal(12, SessionFormat.ParseNumberInput(" 12kg", true));
    }

    [Fact]
    public void computes_volume_duration_and_completed_sets()
    {
        var session = MakeSession();
        Assert.Equal(80 * 8 + 12.5 * 10, SessionFormat.SessionVolume(session));
        Assert.Equal(45, SessionFormat.SessionDurationMin(session));
        session.FinishedAt = null;
        Assert.Null(SessionFormat.SessionDurationMin(session));
        Assert.Equal(2, SessionFormat.CompletedSetCount(MakeSession()));
    }

    [Fact]
    public void formatSessionDate_includes_the_day_of_month_and_year()
    {
        var text = SessionFormat.FormatSessionDate("2026-10-27T12:00:00Z");
        Assert.Contains("27", text);
        Assert.Contains("2026", text);
    }

    [Fact]
    public void formatSessionDate_is_invariant_english_in_the_given_zone()
    {
        Assert.Equal("Tue, 27 Oct 2026", SessionFormat.FormatSessionDate("2026-10-27T12:00:00Z", TimeZoneInfo.Utc));
        Assert.Equal("Wed, 28 Oct 2026", SessionFormat.FormatSessionDate("2026-10-27T23:30:00Z", TimeZoneInfo.CreateCustomTimeZone("plus2", TimeSpan.FromHours(2), "plus2", "plus2")));
    }
}
