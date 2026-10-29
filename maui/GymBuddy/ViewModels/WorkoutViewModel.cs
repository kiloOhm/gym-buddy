using System.Collections.ObjectModel;
using System.Text.RegularExpressions;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record StartPlanRow(string Id, string Name, string Meta, System.Windows.Input.ICommand StartCommand);

/// <summary>
/// src/app/(tabs)/workout.tsx + SessionExerciseCard.tsx. The card list is synced in place on every store change
/// (keyed by session-exercise id) so set inputs keep focus and their local text while typing.
/// </summary>
public sealed partial class WorkoutViewModel : StoreViewModel
{
    private readonly RestTimer _rest;

    public WorkoutViewModel(GymStore store, RestTimer rest) : base(store) => _rest = rest;

    [ObservableProperty] public partial bool HasSession { get; set; }
    [ObservableProperty] public partial string PlanName { get; set; } = "";
    [ObservableProperty] public partial string Elapsed { get; set; } = "0:00";
    [ObservableProperty] public partial bool HasNoExercises { get; set; }
    [ObservableProperty] public partial bool HasNoPlans { get; set; }
    [ObservableProperty] public partial IReadOnlyList<StartPlanRow> StartPlans { get; set; } = Array.Empty<StartPlanRow>();

    public ObservableCollection<SessionCardViewModel> Cards { get; } = new();

    private string? _sessionId;
    private long? _startedMs;

    protected override void Refresh()
    {
        var session = Store.ActiveSession;
        HasSession = session is not null;
        if (session is null)
        {
            _sessionId = null;
            Cards.Clear();
            StartPlans = Store.Plans.Select(p => new StartPlanRow(p.Id, p.Name, Format.Plural(p.Exercises.Count, "exercise"), StartCommand)).ToList();
            HasNoPlans = StartPlans.Count == 0;
            return;
        }
        if (_sessionId != session.Id)
        {
            _sessionId = session.Id;
            Cards.Clear();
        }
        PlanName = session.PlanName;
        _startedMs = Ids.ParseIsoMs(session.StartedAt);
        TickElapsed();

        // Remove cards whose exercise is gone, then insert/update in session order.
        var ids = session.Exercises.Select(e => e.Id).ToHashSet();
        for (var i = Cards.Count - 1; i >= 0; i--)
            if (!ids.Contains(Cards[i].Id)) Cards.RemoveAt(i);
        for (var i = 0; i < session.Exercises.Count; i++)
        {
            var se = session.Exercises[i];
            var existing = Cards.FirstOrDefault(c => c.Id == se.Id);
            if (existing is null)
            {
                Cards.Insert(Math.Min(i, Cards.Count), new SessionCardViewModel(Store, _rest, se.Id));
            }
            else if (Cards.IndexOf(existing) != i)
            {
                Cards.Move(Cards.IndexOf(existing), i);
            }
        }
        foreach (var card in Cards) card.Sync();
        HasNoExercises = Cards.Count == 0;
    }

    public void TickElapsed()
    {
        if (_startedMs is { } started) Elapsed = SessionFormat.FormatElapsed(Ids.NowMs() - started);
    }

    [RelayCommand]
    private void Start(string? planId)
    {
        _rest.Clear();
        Store.StartSession(planId);
    }

    [RelayCommand]
    private Task AddExercise()
    {
        var session = Store.ActiveSession;
        if (session is null) return Task.CompletedTask;
        var exclude = string.Join(",", session.Exercises.Select(e => e.ExerciseId));
        return Nav.PushAsync($"pick?sessionAdd=1&exclude={Uri.EscapeDataString(exclude)}");
    }

    [RelayCommand]
    private async Task Finish()
    {
        var session = Store.ActiveSession;
        if (session is null) return;
        var done = SessionFormat.CompletedSetCount(session);
        var message = done == 0
            ? "No sets are marked as done yet. Finish anyway? The workout will be saved without any completed sets."
            : $"Save this workout with {done} completed {(done == 1 ? "set" : "sets")} to your history?";
        if (!await Dialogs.ConfirmAsync("Finish workout?", message, "Finish")) return;
        Store.FinishSession();
        _rest.Clear();
    }

    [RelayCommand]
    private async Task Discard()
    {
        if (!await Dialogs.ConfirmAsync("Discard workout?", "Everything logged in this workout will be lost.", "Discard")) return;
        Store.DiscardSession();
        _rest.Clear();
    }
}

/// <summary>One exercise of the active workout. Holds only ids; reads the session exercise from the store on Sync.</summary>
public sealed partial class SessionCardViewModel : ObservableObject
{
    private readonly GymStore _store;
    private readonly RestTimer _rest;
    private string? _builtForExerciseId;

    public SessionCardViewModel(GymStore store, RestTimer rest, string id)
    {
        _store = store;
        _rest = rest;
        Id = id;
    }

    public string Id { get; }
    public ObservableCollection<SetRowViewModel> Sets { get; } = new();

    [ObservableProperty] public partial Exercise? Exercise { get; set; }
    [ObservableProperty] public partial string Name { get; set; } = "";
    [ObservableProperty] public partial string Targets { get; set; } = "";
    [ObservableProperty] public partial string? SwappedFor { get; set; }
    [ObservableProperty] public partial bool HasSwappedFor { get; set; }
    [ObservableProperty] public partial bool HasStats { get; set; }
    [ObservableProperty] public partial string StatBest { get; set; } = "–";
    [ObservableProperty] public partial string StatLast { get; set; } = "–";
    [ObservableProperty] public partial string StatAvg { get; set; } = "–";
    [ObservableProperty] public partial string StatNote { get; set; } = "";
    [ObservableProperty] public partial string? LastLine { get; set; }
    [ObservableProperty] public partial bool HasLastLine { get; set; }
    [ObservableProperty] public partial string UnitLabel { get; set; } = "kg";
    [ObservableProperty] public partial bool CanRemoveSet { get; set; }

    private SessionExercise? Current => _store.ActiveSession?.Exercises.FirstOrDefault(e => e.Id == Id);

    public void Sync()
    {
        var se = Current;
        if (se is null) return;
        var unit = _store.Settings.WeightUnit;
        var exercise = _store.GetExercise(se.ExerciseId);
        Exercise = exercise;
        Name = exercise?.Name ?? "Unknown exercise";
        Targets = $"{se.TargetSets} × {se.TargetReps} · rest {se.RestSec} s";
        SwappedFor = se.SubstitutedFor is null ? null : $"Swapped in for {_store.GetExercise(se.SubstitutedFor)?.Name ?? "Unknown exercise"}";
        HasSwappedFor = SwappedFor is not null;
        UnitLabel = unit.Label();

        var stats = Stats.ExerciseStatsFor(_store.Sessions, se.ExerciseId, se.TargetReps, Ids.NowMs());
        HasStats = stats is not null;
        if (stats is not null)
        {
            var prefix = stats.Approximate ? "~" : "";
            string Value(double? w) => w is null ? "–" : $"{prefix}{SessionFormat.FormatWeight(w.Value)} {unit.Label()}";
            StatBest = Value(stats.Best);
            StatLast = Value(stats.Last);
            StatAvg = Value(stats.Avg30d);
            var reps = $"{stats.Range.Min}–{stats.Range.Max}";
            StatNote = stats.Approximate ? $"~ estimated from other rep counts (no sets logged at {reps} reps)" : $"for {reps} reps";
        }
        var last = History.LastPerformanceOf(_store.Sessions, se.ExerciseId);
        LastLine = last is null ? null : $"Last: {SessionFormat.FormatSetList(last.Sets, unit)}";
        HasLastLine = LastLine is not null;

        // A swap rebuilds the sets: recreate the rows so the inputs show the new values.
        if (_builtForExerciseId != se.ExerciseId)
        {
            _builtForExerciseId = se.ExerciseId;
            Sets.Clear();
        }
        while (Sets.Count > se.Sets.Count) Sets.RemoveAt(Sets.Count - 1);
        for (var i = 0; i < se.Sets.Count; i++)
        {
            if (i < Sets.Count) Sets[i].Sync(se.Sets[i], se.RestSec);
            else Sets.Add(new SetRowViewModel(_store, _rest, Id, i, se.Sets[i], se.RestSec));
        }
        CanRemoveSet = se.Sets.Count > 1;
    }

    [RelayCommand] private void AddSet() => _store.AddSet(Id);

    [RelayCommand]
    private void RemoveSet()
    {
        var se = Current;
        if (se is { Sets.Count: > 1 }) _store.RemoveSet(Id, se.Sets.Count - 1);
    }

    [RelayCommand] private Task Swap() => Nav.PushAsync("swap", "id", Id);

    [RelayCommand]
    private Task Info() => Current is { } se ? Nav.PushAsync("exercise", "id", se.ExerciseId) : Task.CompletedTask;

    [RelayCommand]
    private async Task Remove()
    {
        if (await Dialogs.ConfirmAsync("Remove exercise?", $"{Name} and its logged sets will be removed from this workout.", "Remove"))
            _store.RemoveSessionExercise(Id);
    }
}

/// <summary>One set row. Weight/reps keep local text while typing; the store gets the parsed numbers (SetRow).</summary>
public sealed partial class SetRowViewModel : ObservableObject
{
    private readonly GymStore _store;
    private readonly RestTimer _rest;
    private readonly string _sessionExerciseId;
    private int _restSec;
    private bool _syncing;

    public SetRowViewModel(GymStore store, RestTimer rest, string sessionExerciseId, int index, SetLog set, int restSec)
    {
        _store = store;
        _rest = rest;
        _sessionExerciseId = sessionExerciseId;
        Index = index;
        _restSec = restSec;
        _syncing = true;
        WeightText = set.Weight != 0 ? SessionFormat.FormatWeight(set.Weight) : "";
        RepsText = set.Reps != 0 ? set.Reps.ToString(Format.Inv) : "";
        Completed = set.Completed;
        _syncing = false;
    }

    public int Index { get; }
    public string Number => (Index + 1).ToString(Format.Inv);

    [ObservableProperty] public partial string WeightText { get; set; } = "";
    [ObservableProperty] public partial string RepsText { get; set; } = "";
    [ObservableProperty] public partial bool Completed { get; set; }

    public void Sync(SetLog set, int restSec)
    {
        _restSec = restSec;
        _syncing = true;
        Completed = set.Completed;
        _syncing = false;
    }

    partial void OnWeightTextChanged(string value)
    {
        if (_syncing) return;
        var cleaned = Regex.Replace(value ?? "", "[^0-9.,]", "");
        if (cleaned != value)
        {
            WeightText = cleaned;
            return;
        }
        _store.LogSet(_sessionExerciseId, Index, weight: SessionFormat.ParseNumberInput(cleaned, true));
    }

    partial void OnRepsTextChanged(string value)
    {
        if (_syncing) return;
        var cleaned = Regex.Replace(value ?? "", "[^0-9]", "");
        if (cleaned != value)
        {
            RepsText = cleaned;
            return;
        }
        _store.LogSet(_sessionExerciseId, Index, reps: (int)SessionFormat.ParseNumberInput(cleaned, false));
    }

    [RelayCommand]
    private void ToggleDone()
    {
        var completed = !Completed;
        _store.LogSet(_sessionExerciseId, Index, completed: completed);
        if (completed) _rest.Start(_restSec);
    }
}
