using System.Text.Json;
using System.Text.Json.Nodes;
using GymBuddy.Core;
using GymBuddy.Core.Data;

namespace GymBuddy.Tests;

/// <summary>Fixture builders shared by the ported tests (the TS tests' local ex()/session() helpers).</summary>
internal static class Fx
{
    public static Dictionary<MuscleGroup, double> M(params (MuscleGroup Muscle, double Value)[] values) =>
        values.ToDictionary(v => v.Muscle, v => v.Value);

    public static Exercise Ex(
        string id,
        Dictionary<MuscleGroup, double>? muscles = null,
        string? name = null,
        Equipment[]? equipment = null,
        MovementPattern pattern = MovementPattern.Isolation,
        bool compound = false,
        int difficulty = 2,
        string[]? cues = null) => new()
        {
            Id = id,
            Name = name ?? id,
            Equipment = equipment ?? [Equipment.Bodyweight],
            Pattern = pattern,
            Compound = compound,
            Muscles = muscles ?? M((MuscleGroup.Biceps, 1)),
            Difficulty = difficulty,
            Cues = cues ?? [],
        };

    public static IReadOnlyDictionary<string, Exercise> Db(params Exercise[] exercises) => ExerciseLibrary.IndexById(exercises);

    public static IReadOnlyDictionary<string, Exercise> Real => ExerciseLibrary.BuiltInById;

    public static Exercise BuiltIn(string id) => ExerciseLibrary.BuiltInById[id];

    public static long Ms(string iso) => DateTimeOffset.Parse(iso, System.Globalization.CultureInfo.InvariantCulture).ToUnixTimeMilliseconds();

    public static string Iso(long ms) => GymJson.ToIso(DateTimeOffset.FromUnixTimeMilliseconds(ms));

    public static JsonObject ToJson(Exercise e) => JsonSerializer.SerializeToNode(e, GymJson.Compact)!.AsObject();

    /// <summary>Repo root (walks up from the test binary to the folder containing src/ and maui/).</summary>
    public static string RepoRoot
    {
        get
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !(Directory.Exists(Path.Combine(dir.FullName, "src")) && Directory.Exists(Path.Combine(dir.FullName, "maui"))))
                dir = dir.Parent;
            return dir?.FullName ?? throw new InvalidOperationException("repo root not found");
        }
    }
}
