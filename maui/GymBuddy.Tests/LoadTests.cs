using GymBuddy.Core;
using GymBuddy.Core.Logic;
using static GymBuddy.Tests.Fx;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/load.test.ts.</summary>
public class LoadTests
{
    private static readonly IReadOnlyDictionary<string, Exercise> DB = Db(
        Ex("bench", M((MuscleGroup.Chest, 1), (MuscleGroup.Triceps, 0.5)), equipment: [Equipment.Barbell, Equipment.Bench], difficulty: 4),
        Ex("pushup", M((MuscleGroup.Chest, 1), (MuscleGroup.Triceps, 0.5)), difficulty: 2),
        Ex("db_press", M((MuscleGroup.Chest, 1)), equipment: [Equipment.Dumbbell, Equipment.Bench], difficulty: 1),
        Ex("cable_fly", M((MuscleGroup.Chest, 1)), equipment: [Equipment.Cable], difficulty: 3),
        Ex("pec_deck", M((MuscleGroup.Chest, 0.9)), equipment: [Equipment.Machine], difficulty: 1),
        Ex("curl", M((MuscleGroup.Biceps, 1), (MuscleGroup.Forearms, 0.3)), difficulty: 1));

    private static readonly long NOW = Ms("2026-10-27T12:00:00Z");
    private const long DAY = 24L * 60 * 60 * 1000;

    private static SessionExercise SessionExercise(string exerciseId, int completed, int skipped = 0) => new()
    {
        Id = $"{exerciseId}-{completed}-{skipped}",
        ExerciseId = exerciseId,
        TargetSets = completed + skipped,
        TargetReps = 10,
        RestSec = 90,
        Sets =
        [
            .. Enumerable.Range(0, completed).Select(_ => new SetLog { Reps = 10, Weight = 20, Completed = true }),
            .. Enumerable.Range(0, skipped).Select(_ => new SetLog { Reps = 10, Weight = 20, Completed = false }),
        ],
    };

    private static WorkoutSession Session(string id, double? daysAgo, params SessionExercise[] exercises) => new()
    {
        Id = id,
        PlanName = id,
        StartedAt = Iso(NOW - (long)((daysAgo ?? 0) * DAY) - 3_600_000),
        FinishedAt = daysAgo is null ? null : Iso(NOW - (long)(daysAgo.Value * DAY)),
        Exercises = exercises.ToList(),
    };

    private static Coverage Cov(params (MuscleGroup Muscle, double Value)[] values) => Coverage.From(values.Select(v => KeyValuePair.Create(v.Muscle, v.Value)));

    private static Coverage AllAt(double value, params (MuscleGroup Muscle, double Value)[] overrides)
    {
        var c = Coverage.From(Muscles.All.Select(m => KeyValuePair.Create(m, value)));
        foreach (var (m, v) in overrides) c[m] = v;
        return c;
    }

    [Fact]
    public void loadLevel_buckets_at_the_thresholds()
    {
        Assert.Equal(LoadLevel.None, Load.LoadLevelFor(0));
        Assert.Equal(LoadLevel.None, Load.LoadLevelFor(-1));
        Assert.Equal(LoadLevel.Low, Load.LoadLevelFor(0.3));
        Assert.Equal(LoadLevel.Low, Load.LoadLevelFor(Load.LowThreshold - 0.01));
        Assert.Equal(LoadLevel.Good, Load.LoadLevelFor(Load.LowThreshold));
        Assert.Equal(LoadLevel.Good, Load.LoadLevelFor(Load.HighThreshold));
        Assert.Equal(LoadLevel.High, Load.LoadLevelFor(Load.HighThreshold + 0.01));
    }

    [Fact]
    public void recentMuscleLoad_counts_sessions_finished_within_the_window_and_drops_older_ones()
    {
        var load = Load.RecentMuscleLoad([Session("inside", 6.9, SessionExercise("bench", 3)), Session("outside", 7.1, SessionExercise("bench", 5))], NOW, DB);
        Assert.Equal(3, load[MuscleGroup.Chest]);
        Assert.Equal(1.5, load[MuscleGroup.Triceps]);
    }

    [Fact]
    public void recentMuscleLoad_ignores_unfinished_sessions()
    {
        var load = Load.RecentMuscleLoad([Session("active", null, SessionExercise("bench", 4))], NOW, DB);
        Assert.Equal(0, load[MuscleGroup.Chest]);
    }

    [Fact]
    public void recentMuscleLoad_only_counts_completed_sets()
    {
        var load = Load.RecentMuscleLoad([Session("mixed", 1, SessionExercise("curl", 2, 3))], NOW, DB);
        Assert.Equal(2, load[MuscleGroup.Biceps]);
        Assert.Equal(0.6, load[MuscleGroup.Forearms]);
    }

    [Fact]
    public void recentMuscleLoad_sums_across_sessions_in_the_window()
    {
        var load = Load.RecentMuscleLoad([Session("a", 1, SessionExercise("bench", 3)), Session("b", 3, SessionExercise("pushup", 2))], NOW, DB);
        Assert.Equal(5, load[MuscleGroup.Chest]);
    }

    [Fact]
    public void recentMuscleLoad_with_the_real_database_and_now()
    {
        var now = Ids.NowMs();
        var recent = new WorkoutSession
        {
            Id = "x",
            PlanName = "x",
            StartedAt = Iso(now - 2 * 3_600_000),
            FinishedAt = Iso(now - 3_600_000),
            Exercises = [SessionExercise("barbell_bench_press", 3)],
        };
        Assert.Equal(3, Load.RecentMuscleLoad([recent], now, Real)[MuscleGroup.Chest]);
    }

    [Fact]
    public void loadHints_never_includes_good_muscles()
    {
        Assert.Empty(Load.LoadHints(AllAt(10), DB));
        var hints = Load.LoadHints(Cov((MuscleGroup.Chest, 10)), DB);
        Assert.DoesNotContain(hints, h => h.Muscle == MuscleGroup.Chest);
    }

    [Fact]
    public void loadHints_orders_high_desc_then_none_then_low_asc()
    {
        var load = AllAt(10, (MuscleGroup.Chest, 22), (MuscleGroup.Quads, 30), (MuscleGroup.Biceps, 0), (MuscleGroup.Calves, 0), (MuscleGroup.Lats, 3), (MuscleGroup.Abs, 1));
        var hints = Load.LoadHints(load, DB);
        Assert.Equal(
            [
                (MuscleGroup.Quads, LoadLevel.High),
                (MuscleGroup.Chest, LoadLevel.High),
                (MuscleGroup.Biceps, LoadLevel.None),
                (MuscleGroup.Calves, LoadLevel.None),
                (MuscleGroup.Abs, LoadLevel.Low),
                (MuscleGroup.Lats, LoadLevel.Low),
            ],
            hints.Select(h => (h.Muscle, h.Level)));
        Assert.Equal(30, hints[0].EffectiveSets);
    }

    [Fact]
    public void loadHints_gives_no_suggestions_for_high_muscles()
    {
        var hint = Load.LoadHints(Cov((MuscleGroup.Chest, 25)), DB)[0];
        Assert.Equal(MuscleGroup.Chest, hint.Muscle);
        Assert.Equal(LoadLevel.High, hint.Level);
        Assert.Empty(hint.Suggestions);
    }

    [Fact]
    public void loadHints_suggests_up_to_two_primary_exercises_easiest_first()
    {
        var chest = Load.LoadHints(Cov((MuscleGroup.Chest, 1)), DB).First(h => h.Muscle == MuscleGroup.Chest);
        Assert.Equal(LoadLevel.Low, chest.Level);
        // Ranked by difficulty then name; pec_deck (0.9) never qualifies.
        Assert.Equal(["db_press", "pushup"], chest.Suggestions.Select(e => e.Id));
    }

    [Fact]
    public void loadHints_with_the_real_database_every_muscle_gets_a_suggestion()
    {
        var hints = Load.LoadHints(Coverage.Empty(), Real);
        Assert.Equal(Muscles.All.Count, hints.Count);
        foreach (var h in hints)
        {
            Assert.Equal(LoadLevel.None, h.Level);
            Assert.InRange(h.Suggestions.Count, 1, 2);
            foreach (var s in h.Suggestions) Assert.Equal(1, Real[s.Id].Activation(h.Muscle));
        }
    }
}
