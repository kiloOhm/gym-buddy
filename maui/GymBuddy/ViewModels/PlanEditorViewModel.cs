using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

/// <summary>src/app/plan/[id].tsx</summary>
public sealed partial class PlanEditorViewModel : StoreViewModel, IQueryAttributable
{
    public PlanEditorViewModel(GymStore store) : base(store) { }

    public string PlanId { get; private set; } = "";
    public ObservableCollection<PlannedRowViewModel> Rows { get; } = new();

    [ObservableProperty] public partial bool Found { get; set; } = true;
    [ObservableProperty] public partial string Title { get; set; } = "Plan";
    [ObservableProperty] public partial string NameText { get; set; } = "";
    [ObservableProperty] public partial bool HasNoExercises { get; set; }
    [ObservableProperty] public partial string SummaryLine { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyDictionary<MuscleGroup, double>? CoverageValues { get; set; }
    [ObservableProperty] public partial MuscleGroup? Tapped { get; set; }
    [ObservableProperty] public partial string? TappedText { get; set; }
    [ObservableProperty] public partial bool HasActive { get; set; }
    [ObservableProperty] public partial string ActiveText { get; set; } = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(StartCommand))]
    public partial bool CanStart { get; set; }

    private Coverage? _coverage;
    private bool _nameLoaded;

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        PlanId = query.TryGetValue("id", out var id) ? id?.ToString() ?? "" : "";
        _nameLoaded = false;
        Refresh();
    }

    protected override void Refresh()
    {
        var plan = Store.GetPlan(PlanId);
        Found = plan is not null;
        if (plan is null)
        {
            Title = "Plan";
            Rows.Clear();
            return;
        }
        Title = string.IsNullOrEmpty(plan.Name) ? "Plan" : plan.Name;
        if (!_nameLoaded)
        {
            NameText = plan.Name;
            _nameLoaded = true;
        }

        // Sync rows in place (keyed by planned-exercise id), so steppers do not flicker.
        var ids = plan.Exercises.Select(e => e.Id).ToList();
        for (var i = Rows.Count - 1; i >= 0; i--)
            if (!ids.Contains(Rows[i].Id)) Rows.RemoveAt(i);
        for (var i = 0; i < plan.Exercises.Count; i++)
        {
            var pe = plan.Exercises[i];
            var row = Rows.FirstOrDefault(r => r.Id == pe.Id);
            if (row is null)
            {
                row = new PlannedRowViewModel(Store, this, pe.Id);
                Rows.Insert(Math.Min(i, Rows.Count), row);
            }
            else if (Rows.IndexOf(row) != i)
            {
                Rows.Move(Rows.IndexOf(row), i);
            }
            row.Sync(pe, i, plan.Exercises.Count);
        }
        HasNoExercises = plan.Exercises.Count == 0;
        CanStart = plan.Exercises.Count > 0;

        var items = CoverageLogic.ItemsOf(plan).ToList();
        _coverage = CoverageLogic.ComputeCoverage(items, Store.LibraryById);
        CoverageValues = _coverage.ToDictionary();
        var summary = CoverageLogic.SummarizePlan(items, Store.LibraryById);
        if (summary.TotalSets == 0)
        {
            SummaryLine = "No sets planned yet.";
        }
        else
        {
            var parts = new List<string>
            {
                Format.Plural(summary.TotalSets, "set"),
                $"avg difficulty {Format.Fixed1(summary.AvgDifficulty)}/5",
            };
            if (summary.Hardest is not null) parts.Add($"hardest: {summary.Hardest.Name} ({summary.MaxDifficulty}/5)");
            SummaryLine = string.Join(" · ", parts);
        }
        UpdateTappedText();

        var active = Store.ActiveSession;
        HasActive = active is not null;
        ActiveText = active is null ? "" : $"A workout is in progress ({active.PlanName}).";
    }

    private void UpdateTappedText() =>
        TappedText = Tapped is { } m && _coverage is not null ? $"{m.Label()}: {Format.Fixed1(_coverage[m])} effective sets" : null;

    public void OnMusclePressed(MuscleGroup m)
    {
        Tapped = m;
        UpdateTappedText();
    }

    /// <summary>Save on unfocus / done; blank reverts to the stored name.</summary>
    [RelayCommand]
    private void SaveName()
    {
        var plan = Store.GetPlan(PlanId);
        if (plan is null) return;
        var trimmed = (NameText ?? "").Trim();
        if (trimmed.Length == 0)
        {
            NameText = plan.Name;
            return;
        }
        if (trimmed != plan.Name) Store.RenamePlan(plan.Id, trimmed);
    }

    [RelayCommand]
    private async Task Export()
    {
        var plan = Store.GetPlan(PlanId);
        if (plan is null) return;
        try
        {
            var now = DateTimeOffset.Now;
            var json = PlanExport.SerializePlans(new[] { plan }, now);
            await FileExchange.ShareJsonAsync(PlanExport.SuggestedFileName(new[] { plan }, now), json, "Export plans");
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Export failed", e.Message);
        }
    }

    [RelayCommand] private Task AddExercise() => Nav.PushAsync("pick", "planId", PlanId);

    [RelayCommand(CanExecute = nameof(CanStart))]
    private async Task Start()
    {
        Store.StartSession(PlanId);
        await Nav.GoToTabAsync("workout");
    }

    [RelayCommand] private Task GoToWorkout() => Nav.GoToTabAsync("workout");

    [RelayCommand] private Task GoBack() => Nav.BackAsync();
}

public sealed partial class PlannedRowViewModel : ObservableObject
{
    private readonly GymStore _store;
    private readonly PlanEditorViewModel _owner;
    private string _exerciseId = "";

    public PlannedRowViewModel(GymStore store, PlanEditorViewModel owner, string id)
    {
        _store = store;
        _owner = owner;
        Id = id;
    }

    public string Id { get; }

    [ObservableProperty] public partial string Title { get; set; } = "";
    [ObservableProperty] public partial string? EquipmentText { get; set; }
    [ObservableProperty] public partial bool HasEquipment { get; set; }
    [ObservableProperty] public partial int Sets { get; set; }
    [ObservableProperty] public partial int Reps { get; set; }
    [ObservableProperty] public partial int RestSec { get; set; }
    [ObservableProperty] public partial bool CanMoveUp { get; set; }
    [ObservableProperty] public partial bool CanMoveDown { get; set; }

    public void Sync(PlannedExercise pe, int index, int count)
    {
        _exerciseId = pe.ExerciseId;
        var ex = _store.GetExercise(pe.ExerciseId);
        Title = $"{index + 1}. {ex?.Name ?? $"Unknown exercise ({pe.ExerciseId})"}";
        EquipmentText = ex is null ? null : Format.EquipmentSummary(ex);
        HasEquipment = ex is not null;
        Sets = pe.Sets;
        Reps = pe.Reps;
        RestSec = pe.RestSec;
        CanMoveUp = index > 0;
        CanMoveDown = index < count - 1;
    }

    [RelayCommand] private void ChangeSets(int v) => _store.UpdatePlannedExercise(_owner.PlanId, Id, sets: v);
    [RelayCommand] private void ChangeReps(int v) => _store.UpdatePlannedExercise(_owner.PlanId, Id, reps: v);
    [RelayCommand] private void ChangeRest(int v) => _store.UpdatePlannedExercise(_owner.PlanId, Id, restSec: v);
    [RelayCommand] private void MoveUp() => _store.MovePlannedExercise(_owner.PlanId, Id, -1);
    [RelayCommand] private void MoveDown() => _store.MovePlannedExercise(_owner.PlanId, Id, 1);
    [RelayCommand] private Task Open() => Nav.PushAsync("exercise", "id", _exerciseId);

    [RelayCommand]
    private async Task Remove()
    {
        var name = _store.GetExercise(_exerciseId)?.Name ?? "this exercise";
        if (await Dialogs.ConfirmAsync("Remove exercise?", $"Remove {name} from the plan?", "Remove"))
            _store.RemovePlannedExercise(_owner.PlanId, Id);
    }
}
