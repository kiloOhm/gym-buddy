using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record HistoryRow(string Id, string Date, string Name, string Meta, System.Windows.Input.ICommand OpenCommand);

/// <summary>src/app/(tabs)/history.tsx</summary>
public sealed partial class HistoryViewModel : StoreViewModel
{
    public HistoryViewModel(GymStore store) : base(store) { }

    [ObservableProperty] public partial IReadOnlyList<HistoryRow> Rows { get; set; } = Array.Empty<HistoryRow>();
    [ObservableProperty] public partial bool IsEmpty { get; set; }

    protected override void Refresh()
    {
        var unit = Store.Settings.WeightUnit.Label();
        Rows = Store.Sessions.Select(s =>
        {
            var meta = new List<string>();
            if (SessionFormat.SessionDurationMin(s) is { } min) meta.Add($"{min} min");
            meta.Add($"{s.Exercises.Count} {(s.Exercises.Count == 1 ? "exercise" : "exercises")}");
            var volume = SessionFormat.SessionVolume(s);
            if (volume > 0) meta.Add($"{SessionFormat.FormatWeight(volume)} {unit}");
            return new HistoryRow(s.Id, SessionFormat.FormatSessionDate(s.StartedAt), s.PlanName, string.Join(" · ", meta), OpenCommand);
        }).ToList();
        IsEmpty = Rows.Count == 0;
    }

    [RelayCommand] private Task Open(string id) => Nav.PushAsync("session", "id", id);
}
