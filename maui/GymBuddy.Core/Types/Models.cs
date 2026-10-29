// Plans, sessions and settings. Mutable, but only GymStore mutates them (and persists afterwards).
// Timestamps are ISO-8601 strings exactly like the TypeScript app stores them
// ("2026-10-28T19:04:05.123Z"), see Ids.NowIso / Ids.ParseIsoMs.
namespace GymBuddy.Core;

public sealed class PlannedExercise
{
    /// <summary>Unique within the plan so the same exercise can appear twice.</summary>
    public string Id { get; set; } = "";
    public string ExerciseId { get; set; } = "";
    public int Sets { get; set; }
    public int Reps { get; set; }
    public int RestSec { get; set; }
}

public sealed class WorkoutPlan
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public List<PlannedExercise> Exercises { get; set; } = new();
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

public sealed class SetLog
{
    public int Reps { get; set; }
    /// <summary>In the user's chosen unit, stored as entered; 0 for bodyweight.</summary>
    public double Weight { get; set; }
    public bool Completed { get; set; }
}

public sealed class SessionExercise
{
    /// <summary>Unique within the session.</summary>
    public string Id { get; set; } = "";
    public string ExerciseId { get; set; } = "";
    /// <summary>Set when the user swapped the planned exercise for this one (the original exercise id).</summary>
    public string? SubstitutedFor { get; set; }
    public int TargetSets { get; set; }
    public int TargetReps { get; set; }
    public int RestSec { get; set; }
    public List<SetLog> Sets { get; set; } = new();
}

public sealed class WorkoutSession
{
    public string Id { get; set; } = "";
    public string? PlanId { get; set; }
    public string PlanName { get; set; } = "";
    public string StartedAt { get; set; } = "";
    /// <summary>Null while the workout is in progress.</summary>
    public string? FinishedAt { get; set; }
    /// <summary>Set when the workout was logged as a deload.</summary>
    public bool? Deload { get; set; }
    public List<SessionExercise> Exercises { get; set; } = new();
}

public sealed class Settings
{
    public WeightUnit WeightUnit { get; set; } = WeightUnit.Kg;
}
