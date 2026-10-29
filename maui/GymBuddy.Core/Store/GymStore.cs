using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;

namespace GymBuddy.Core.Store;

/// <param name="Added">Entries whose id was not in the library before.</param>
/// <param name="Updated">Entries that differ from the library entry with the same id.</param>
/// <param name="Unchanged">Entries identical to the library entry with the same id.</param>
public sealed record ImportResult(int Added, int Updated, int Unchanged);

/// <summary>
/// The app state (port of the zustand store in src/store/index.ts): plans, finished sessions, the active session,
/// settings and imported exercises. Every mutation persists synchronously (write-through) and then raises
/// <see cref="Changed"/>. Not thread-safe: call it from the UI thread only.
/// </summary>
public sealed class GymStore
{
    public const int DefaultSets = 3;
    public const int DefaultReps = 10;
    public const int DefaultRestSec = 90;
    public const string FreeWorkoutName = "Free workout";

    private readonly IStateStorage _storage;
    private readonly Func<DateTimeOffset> _clock;
    private PersistedState _state = new();
    private IReadOnlyList<Exercise> _library = BuiltInExercises.All;
    private IReadOnlyDictionary<string, Exercise> _libraryById = ExerciseLibrary.BuiltInById;

    /// <param name="clock">Source of "now" for timestamps; defaults to the system clock (tests pass a fixed one).</param>
    public GymStore(IStateStorage storage, Func<DateTimeOffset>? clock = null)
    {
        _storage = storage;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    /// <summary>Raised after every mutation, once the new state has been persisted.</summary>
    public event Action? Changed;

    public bool Hydrated { get; private set; }

    /// <summary>True once the example plans have been created (so deleting them does not bring them back).</summary>
    public bool Seeded => _state.Seeded;

    public IReadOnlyList<WorkoutPlan> Plans => _state.Plans;

    /// <summary>Finished sessions, newest first.</summary>
    public IReadOnlyList<WorkoutSession> Sessions => _state.Sessions;

    public WorkoutSession? ActiveSession => _state.ActiveSession;

    public Settings Settings => _state.Settings;

    /// <summary>Imported exercises: overrides of built-ins (same id) and additions. See LibraryFormat.MergeLibrary.</summary>
    public IReadOnlyList<Exercise> CustomExercises => _state.CustomExercises;

    /// <summary>The library in use: built-ins merged with the custom entries (cached until the custom entries change).</summary>
    public IReadOnlyList<Exercise> Library => _library;

    public IReadOnlyDictionary<string, Exercise> LibraryById => _libraryById;

    public Exercise? GetExercise(string id) => _libraryById.TryGetValue(id, out var e) ? e : null;

    public WorkoutPlan? GetPlan(string planId) => _state.Plans.FirstOrDefault(p => p.Id == planId);

    public WorkoutSession? GetSession(string sessionId) => _state.Sessions.FirstOrDefault(s => s.Id == sessionId);

    private string NowIso() => GymJson.ToIso(_clock());

    // ───────────────────────────── Hydration ─────────────────────────────

    /// <summary>
    /// Reads and migrates the stored state, creates the example plans once, builds the library and sets
    /// <see cref="Hydrated"/>. Unreadable data is quarantined (see IStateStorage.Quarantine) and the store starts
    /// empty; Load never throws because of the stored content.
    /// </summary>
    public void Load()
    {
        _state = ReadState() ?? new PersistedState();
        _state.Normalize();
        if (!_state.Seeded)
        {
            _state.Plans.AddRange(BuildSeedPlans(_clock()));
            _state.Seeded = true;
        }
        RebuildLibrary();
        Hydrated = true;
        Persist();
        Changed?.Invoke();
    }

    private PersistedState? ReadState()
    {
        string? json;
        try
        {
            json = _storage.Read();
        }
        catch (Exception e)
        {
            Debug.WriteLine($"GymStore: reading the stored state failed: {e}");
            TryQuarantine();
            return null;
        }
        if (json is null) return null;

        try
        {
            if (JsonNode.Parse(json) is not JsonObject envelope || envelope["state"] is not JsonObject state)
                throw new JsonException("Unknown shape: expected {\"state\":{...},\"version\":n}");
            var version = JsJson.IsNumber(envelope["version"], out var v) ? (int)v : 0;
            var migrated = (JsonObject)(version < PersistedState.PersistVersion ? PersistedState.MigratePersistedState(state, version)! : state).DeepClone();

            // The parts that can carry foreign values (imported exercises, a setting from a newer app) are read
            // leniently below; everything else must deserialize or the whole state counts as unreadable.
            var customNode = migrated["customExercises"];
            var settingsNode = migrated["settings"];
            migrated.Remove("customExercises");
            migrated.Remove("settings");
            var result = migrated.Deserialize<PersistedState>(GymJson.Compact) ?? throw new JsonException("state is null");
            result.CustomExercises = ReadCustomExercises(customNode);
            result.Settings = ReadSettings(settingsNode);
            return result;
        }
        catch (Exception e) when (e is JsonException or FormatException or InvalidOperationException or ArgumentException or NotSupportedException)
        {
            Debug.WriteLine($"GymStore: the stored state is unreadable, starting empty: {e}");
            TryQuarantine();
            return null;
        }
    }

    /// <summary>Imported exercises one by one; an entry that does not deserialize (unknown slug, bad shape) is dropped.</summary>
    private static List<Exercise> ReadCustomExercises(JsonNode? node)
    {
        var list = new List<Exercise>();
        if (node is not JsonArray array)
        {
            if (node is not null) Debug.WriteLine("GymStore: customExercises is not a list, ignoring it");
            return list;
        }
        for (var i = 0; i < array.Count; i++)
        {
            try
            {
                if (array[i]?.Deserialize<Exercise>(GymJson.Compact) is { } e) list.Add(e);
                else Debug.WriteLine($"GymStore: dropping custom exercise {i + 1}: null");
            }
            catch (Exception ex) when (ex is JsonException or FormatException or InvalidOperationException or ArgumentException or NotSupportedException)
            {
                Debug.WriteLine($"GymStore: dropping unreadable custom exercise {i + 1}: {ex.Message}");
            }
        }
        return list;
    }

    /// <summary>Settings with an unknown or missing weight unit fall back to kg.</summary>
    private static Settings ReadSettings(JsonNode? node)
    {
        var settings = new Settings();
        if (node is JsonObject obj && obj["weightUnit"] is JsonValue v && v.GetValueKind() == JsonValueKind.String)
        {
            var slug = v.GetValue<string>();
            if (WeightUnits.TryParse(slug, out var unit)) settings.WeightUnit = unit;
            else Debug.WriteLine($"GymStore: unknown weight unit '{slug}', using kg");
        }
        return settings;
    }

    private void TryQuarantine()
    {
        try
        {
            _storage.Quarantine();
        }
        catch (Exception e)
        {
            Debug.WriteLine($"GymStore: quarantining the stored state failed: {e}");
        }
    }

    /// <summary>The JSON document the store persists ({"state":{...},"version":2}).</summary>
    public string Serialize() =>
        JsonSerializer.Serialize(new PersistedEnvelope { State = _state, Version = PersistedState.PersistVersion }, GymJson.Compact);

    private void Persist()
    {
        try
        {
            _storage.Write(Serialize());
        }
        catch (Exception e)
        {
            Debug.WriteLine($"GymStore: persisting failed: {e}");
        }
    }

    /// <summary>Persist, then notify.</summary>
    private void Commit()
    {
        Persist();
        Changed?.Invoke();
    }

    private void RebuildLibrary()
    {
        _library = LibraryFormat.MergeLibrary(BuiltInExercises.All, _state.CustomExercises);
        _libraryById = ExerciseLibrary.IndexById(_library);
    }

    /// <summary>The push/pull/legs/arms example plans, with fresh ids.</summary>
    public static IReadOnlyList<WorkoutPlan> BuildSeedPlans() => BuildSeedPlans(DateTimeOffset.UtcNow);

    private static List<WorkoutPlan> BuildSeedPlans(DateTimeOffset now)
    {
        var iso = GymJson.ToIso(now);
        return SeedPlans.All.Select(seed => new WorkoutPlan
        {
            Id = Ids.NewId(),
            Name = seed.Name,
            CreatedAt = iso,
            UpdatedAt = iso,
            Exercises = seed.Exercises.Select(e => new PlannedExercise
            {
                Id = Ids.NewId(),
                ExerciseId = e.ExerciseId,
                Sets = e.Sets,
                Reps = e.Reps,
                RestSec = e.RestSec,
            }).ToList(),
        }).ToList();
    }

    // ───────────────────────────── Plans ─────────────────────────────

    public WorkoutPlan CreatePlan(string name)
    {
        var now = NowIso();
        var plan = new WorkoutPlan { Id = Ids.NewId(), Name = name, Exercises = new(), CreatedAt = now, UpdatedAt = now };
        _state.Plans.Add(plan);
        Commit();
        return plan;
    }

    public void RenamePlan(string planId, string name)
    {
        var plan = GetPlan(planId);
        if (plan is not null)
        {
            plan.Name = name;
            plan.UpdatedAt = NowIso();
        }
        Commit();
    }

    public void DeletePlan(string planId)
    {
        _state.Plans.RemoveAll(p => p.Id == planId);
        Commit();
    }

    private void UpdatePlanExercises(string planId, Action<List<PlannedExercise>> change)
    {
        var plan = GetPlan(planId);
        if (plan is not null)
        {
            change(plan.Exercises);
            plan.UpdatedAt = NowIso();
        }
        Commit();
    }

    /// <summary>Appends the exercise with the defaults (3 × 10, 90 s rest).</summary>
    public void AddExerciseToPlan(string planId, string exerciseId) =>
        UpdatePlanExercises(planId, exs => exs.Add(new PlannedExercise
        {
            Id = Ids.NewId(),
            ExerciseId = exerciseId,
            Sets = DefaultSets,
            Reps = DefaultReps,
            RestSec = DefaultRestSec,
        }));

    public void UpdatePlannedExercise(string planId, string plannedId, int? sets = null, int? reps = null, int? restSec = null, string? exerciseId = null) =>
        UpdatePlanExercises(planId, exs =>
        {
            var e = exs.FirstOrDefault(x => x.Id == plannedId);
            if (e is null) return;
            if (sets is not null) e.Sets = sets.Value;
            if (reps is not null) e.Reps = reps.Value;
            if (restSec is not null) e.RestSec = restSec.Value;
            if (exerciseId is not null) e.ExerciseId = exerciseId;
        });

    public void RemovePlannedExercise(string planId, string plannedId) =>
        UpdatePlanExercises(planId, exs => exs.RemoveAll(e => e.Id == plannedId));

    /// <summary>direction -1 moves up, +1 moves down; no-op at the ends.</summary>
    public void MovePlannedExercise(string planId, string plannedId, int direction) =>
        UpdatePlanExercises(planId, exs =>
        {
            var i = exs.FindIndex(e => e.Id == plannedId);
            var j = i + direction;
            if (i < 0 || j < 0 || j >= exs.Count) return;
            (exs[i], exs[j]) = (exs[j], exs[i]);
        });

    // ───────────────────────────── Active session ─────────────────────────────

    /// <summary>
    /// <paramref name="count"/> sets prefilled from the last performance of the exercise: same index reps/weight,
    /// else the target reps and the last set's weight (0 without history).
    /// </summary>
    private List<SetLog> MakeSets(string exerciseId, int count, int reps)
    {
        var last = History.LastPerformanceOf(_state.Sessions, exerciseId);
        return Enumerable.Range(0, count).Select(i => new SetLog
        {
            Reps = last is not null && i < last.Sets.Count ? last.Sets[i].Reps : reps,
            Weight = last is not null && i < last.Sets.Count ? last.Sets[i].Weight : last?.Sets[^1].Weight ?? 0,
            Completed = false,
        }).ToList();
    }

    /// <summary>Starts a workout from the plan, or an empty "Free workout" when planId is null or unknown.</summary>
    public WorkoutSession StartSession(string? planId)
    {
        var plan = planId is null ? null : GetPlan(planId);
        var session = new WorkoutSession
        {
            Id = Ids.NewId(),
            PlanId = plan?.Id,
            PlanName = plan?.Name ?? FreeWorkoutName,
            StartedAt = NowIso(),
            Exercises = (plan?.Exercises ?? []).Select(pe => new SessionExercise
            {
                Id = Ids.NewId(),
                ExerciseId = pe.ExerciseId,
                TargetSets = pe.Sets,
                TargetReps = pe.Reps,
                RestSec = pe.RestSec,
                Sets = MakeSets(pe.ExerciseId, pe.Sets, pe.Reps),
            }).ToList(),
        };
        _state.ActiveSession = session;
        Commit();
        return session;
    }

    private void UpdateSessionExercise(string sessionExerciseId, Action<SessionExercise> change)
    {
        var ex = _state.ActiveSession?.Exercises.FirstOrDefault(e => e.Id == sessionExerciseId);
        if (ex is not null) change(ex);
        Commit();
    }

    public void LogSet(string sessionExerciseId, int setIndex, int? reps = null, double? weight = null, bool? completed = null) =>
        UpdateSessionExercise(sessionExerciseId, ex =>
        {
            if (setIndex < 0 || setIndex >= ex.Sets.Count) return;
            var s = ex.Sets[setIndex];
            if (reps is not null) s.Reps = reps.Value;
            if (weight is not null) s.Weight = weight.Value;
            if (completed is not null) s.Completed = completed.Value;
        });

    /// <summary>Adds a set copying the previous set's reps and weight (target reps and 0 when there is none).</summary>
    public void AddSet(string sessionExerciseId) =>
        UpdateSessionExercise(sessionExerciseId, ex =>
        {
            var prev = ex.Sets.Count > 0 ? ex.Sets[^1] : null;
            ex.Sets.Add(new SetLog { Reps = prev?.Reps ?? ex.TargetReps, Weight = prev?.Weight ?? 0, Completed = false });
        });

    public void RemoveSet(string sessionExerciseId, int setIndex) =>
        UpdateSessionExercise(sessionExerciseId, ex =>
        {
            if (setIndex >= 0 && setIndex < ex.Sets.Count) ex.Sets.RemoveAt(setIndex);
        });

    /// <summary>Replaces the exercise, keeping the set/rep targets; records the original once in SubstitutedFor; rebuilds the sets.</summary>
    public void SwapExercise(string sessionExerciseId, string newExerciseId) =>
        UpdateSessionExercise(sessionExerciseId, ex =>
        {
            var count = Math.Max(ex.Sets.Count, 1);
            ex.SubstitutedFor ??= ex.ExerciseId;
            ex.ExerciseId = newExerciseId;
            ex.Sets = MakeSets(newExerciseId, count, ex.TargetReps);
        });

    public void AddSessionExercise(string exerciseId)
    {
        _state.ActiveSession?.Exercises.Add(new SessionExercise
        {
            Id = Ids.NewId(),
            ExerciseId = exerciseId,
            TargetSets = DefaultSets,
            TargetReps = DefaultReps,
            RestSec = DefaultRestSec,
            Sets = MakeSets(exerciseId, DefaultSets, DefaultReps),
        });
        Commit();
    }

    public void RemoveSessionExercise(string sessionExerciseId)
    {
        _state.ActiveSession?.Exercises.RemoveAll(e => e.Id == sessionExerciseId);
        Commit();
    }

    /// <summary>Stamps finishedAt and moves the active session to the front of the history.</summary>
    public void FinishSession()
    {
        var active = _state.ActiveSession;
        if (active is null) return;
        active.FinishedAt = NowIso();
        _state.ActiveSession = null;
        _state.Sessions.Insert(0, active);
        Commit();
    }

    public void DiscardSession()
    {
        _state.ActiveSession = null;
        Commit();
    }

    // ───────────────────────────── History / settings ─────────────────────────────

    public void DeleteSession(string sessionId)
    {
        _state.Sessions.RemoveAll(s => s.Id == sessionId);
        Commit();
    }

    public void SetWeightUnit(WeightUnit unit)
    {
        _state.Settings.WeightUnit = unit;
        Commit();
    }

    // ───────────────────────────── Import ─────────────────────────────

    /// <summary>Adds the plans as new plans (fresh ids, timestamps now). Returns the created plans.</summary>
    public IReadOnlyList<WorkoutPlan> ImportPlans(IEnumerable<ExportedPlan> plans)
    {
        var now = NowIso();
        var created = plans.Select(p => new WorkoutPlan
        {
            Id = Ids.NewId(),
            Name = p.Name,
            CreatedAt = now,
            UpdatedAt = now,
            Exercises = p.Exercises.Select(e => new PlannedExercise
            {
                Id = Ids.NewId(),
                ExerciseId = e.ExerciseId,
                Sets = e.Sets,
                Reps = e.Reps,
                RestSec = e.RestSec,
            }).ToList(),
        }).ToList();
        _state.Plans.AddRange(created);
        Commit();
        return created;
    }

    /// <summary>
    /// Upserts the exercises into CustomExercises by id. An entry identical to the built-in with that id removes the
    /// custom override instead. Counts are relative to the library before the import.
    /// </summary>
    public ImportResult ImportExercises(IEnumerable<Exercise> exercises)
    {
        var incoming = exercises.ToList();
        var diff = LibraryFormat.DiffLibrary(incoming, _library);
        var next = new List<Exercise>(_state.CustomExercises);
        foreach (var e in incoming)
        {
            var index = next.FindIndex(c => c.Id == e.Id);
            if (ExerciseLibrary.BuiltInById.TryGetValue(e.Id, out var builtIn) && LibraryFormat.ExercisesEqual(e, builtIn))
            {
                if (index >= 0) next.RemoveAt(index);
            }
            else if (index >= 0) next[index] = e;
            else next.Add(e);
        }
        if (diff.Added.Count + diff.Updated.Count > 0 || next.Count != _state.CustomExercises.Count)
        {
            _state.CustomExercises = next;
            RebuildLibrary();
            Commit();
        }
        return new ImportResult(diff.Added.Count, diff.Updated.Count, diff.Unchanged.Count);
    }

    /// <summary>Drops every custom or edited exercise.</summary>
    public void ResetExerciseLibrary()
    {
        _state.CustomExercises = new();
        RebuildLibrary();
        Commit();
    }
}
