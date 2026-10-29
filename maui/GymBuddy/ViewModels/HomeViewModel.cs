using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

/// <summary>src/app/(tabs)/index.tsx</summary>
public sealed partial class HomeViewModel : StoreViewModel
{
    public HomeViewModel(GymStore store) : base(store) { }

    [ObservableProperty] public partial bool HasActive { get; set; }
    [ObservableProperty] public partial string ActiveTitle { get; set; } = "";
    [ObservableProperty] public partial bool HasLast { get; set; }
    [ObservableProperty] public partial string LastDate { get; set; } = "";
    [ObservableProperty] public partial string LastName { get; set; } = "";
    [ObservableProperty] public partial string LastMeta { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyDictionary<MuscleGroup, double>? LoadValues { get; set; }
    [ObservableProperty] public partial IReadOnlyList<LoadHint>? Hints { get; set; }

    private string? _lastId;

    public string LoadTitle => $"Muscle load · last {Load.LoadWindowDays} days";

    public string Caption =>
        $"Effective sets = sets × how hard the exercise hits the muscle. Guideline: {Load.LowThreshold}–{Load.HighThreshold} per muscle per week.";

    protected override void Refresh()
    {
        var active = Store.ActiveSession;
        HasActive = active is not null;
        ActiveTitle = active is null ? "" : $"Workout in progress — {active.PlanName}";

        var last = Store.Sessions.FirstOrDefault();
        HasLast = last is not null;
        _lastId = last?.Id;
        if (last is not null)
        {
            LastDate = SessionFormat.FormatSessionDate(last.StartedAt);
            LastName = last.PlanName;
            var meta = new List<string>();
            if (SessionFormat.SessionDurationMin(last) is { } min) meta.Add($"{min} min");
            var volume = SessionFormat.SessionVolume(last);
            if (volume > 0) meta.Add($"{SessionFormat.FormatWeight(volume)} {Store.Settings.WeightUnit.Label()}");
            LastMeta = string.Join(" · ", meta);
        }

        var load = Load.RecentMuscleLoad(Store.Sessions, Ids.NowMs(), Store.LibraryById);
        LoadValues = load.ToDictionary();
        Hints = Load.LoadHints(load, Store.LibraryById);
    }

    [RelayCommand] private Task Continue() => Nav.GoToTabAsync("workout");
    [RelayCommand] private Task GoToHistory() => Nav.GoToTabAsync("history");
    [RelayCommand] private Task GoToPlans() => Nav.GoToTabAsync("plans");

    [RelayCommand]
    private Task OpenLast() => _lastId is null ? Task.CompletedTask : Nav.PushAsync("session", "id", _lastId);
}
