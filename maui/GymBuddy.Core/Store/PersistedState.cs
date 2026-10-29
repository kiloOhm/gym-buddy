using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using GymBuddy.Core.Logic;

namespace GymBuddy.Core.Store;

/// <summary>
/// The persisted part of the store, same shape as the TypeScript app's zustand partialize:
/// {"seeded","plans","sessions","activeSession","settings","customExercises"}.
/// </summary>
public sealed class PersistedState
{
    /// <summary>Version of the persisted state; bump together with a step in <see cref="MigratePersistedState"/>.</summary>
    public const int PersistVersion = 2;

    public bool Seeded { get; set; }
    public List<WorkoutPlan> Plans { get; set; } = new();
    public List<WorkoutSession> Sessions { get; set; } = new();

    /// <summary>Written as null (not omitted) when no workout runs, like zustand does.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public WorkoutSession? ActiveSession { get; set; }

    public Settings Settings { get; set; } = new();
    public List<Exercise> CustomExercises { get; set; } = new();

    /// <summary>Replaces nulls a hand-edited or foreign file may contain with the defaults.</summary>
    internal void Normalize()
    {
        Plans ??= new();
        Sessions ??= new();
        Settings ??= new();
        CustomExercises ??= new();
        foreach (var p in Plans) p.Exercises ??= new();
        foreach (var s in Sessions) NormalizeSession(s);
        if (ActiveSession is not null) NormalizeSession(ActiveSession);
    }

    private static void NormalizeSession(WorkoutSession s)
    {
        s.Exercises ??= new();
        foreach (var e in s.Exercises) e.Sets ??= new();
    }

    /// <summary>
    /// Upgrades persisted state (the "state" object) from an older version. Returns a modified copy.
    /// - 0 → 1: imported exercises saved before the single difficulty score get it derived from formDifficulty/injuryRisk.
    /// - 1 → 2: the "my equipment" setting was removed, so settings.availableEquipment is dropped.
    /// </summary>
    public static JsonObject? MigratePersistedState(JsonObject? persisted, int version)
    {
        if (persisted is null) return null;
        var state = (JsonObject)persisted.DeepClone();
        if (version < 1 && state["customExercises"] is JsonArray custom)
        {
            for (var i = 0; i < custom.Count; i++)
            {
                if (custom[i] is not JsonObject raw) continue;
                if (Number(raw["difficulty"]) is not null) continue;
                var form = Number(raw["formDifficulty"]) ?? 3;
                var risk = Number(raw["injuryRisk"]) ?? form;
                var rest = new JsonObject();
                foreach (var (key, value) in raw)
                {
                    if (key is "formDifficulty" or "injuryRisk" or "difficulty") continue;
                    rest[key] = value?.DeepClone();
                }
                rest["difficulty"] = LibraryFormat.DifficultyFromLegacy(form, risk);
                custom[i] = rest;
            }
        }
        if (version < 2 && state["settings"] is JsonObject settings && settings.ContainsKey("availableEquipment"))
        {
            settings.Remove("availableEquipment");
        }
        return state;
    }

    private static double? Number(JsonNode? node) => JsJson.IsNumber(node, out var d) ? d : null;
}

/// <summary>The stored document: {"state":{...},"version":2} (zustand persist envelope).</summary>
public sealed class PersistedEnvelope
{
    public PersistedState State { get; set; } = new();
    public int Version { get; set; } = PersistedState.PersistVersion;
}
