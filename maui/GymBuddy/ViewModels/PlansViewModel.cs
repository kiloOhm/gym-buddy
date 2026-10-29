using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record PlanRow(string Id, string Name, string Meta)
{
    public System.Windows.Input.ICommand? OpenCommand { get; init; }
    public System.Windows.Input.ICommand? DeleteCommand { get; init; }
    public bool SameAs(PlanRow other) => Id == other.Id && Name == other.Name && Meta == other.Meta;
}

/// <summary>src/app/(tabs)/plans.tsx</summary>
public sealed partial class PlansViewModel : StoreViewModel
{
    public PlansViewModel(GymStore store) : base(store) { }

    public ObservableCollection<PlanRow> Plans { get; } = new();

    [ObservableProperty] public partial bool Creating { get; set; }
    [ObservableProperty] public partial bool IsEmpty { get; set; }

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(CreateCommand))]
    public partial string NewName { get; set; } = "";

    partial void OnCreatingChanged(bool value) => UpdateEmpty();

    private void UpdateEmpty() => IsEmpty = Plans.Count == 0 && !Creating;

    protected override void Refresh()
    {
        var rows = Store.Plans.Select(p =>
        {
            var sets = p.Exercises.Sum(e => e.Sets);
            return new PlanRow(p.Id, p.Name, $"{Format.Plural(p.Exercises.Count, "exercise")} · {Format.Plural(sets, "set")}")
            {
                OpenCommand = OpenCommand,
                DeleteCommand = DeleteCommand,
            };
        }).ToList();
        if (rows.Count != Plans.Count || rows.Zip(Plans).Any(t => !t.First.SameAs(t.Second)))
        {
            Plans.Clear();
            foreach (var r in rows) Plans.Add(r);
        }
        UpdateEmpty();
    }

    [RelayCommand] private void StartCreating() => Creating = true;

    [RelayCommand]
    private void CancelCreating()
    {
        Creating = false;
        NewName = "";
    }

    private bool CanCreate() => !string.IsNullOrWhiteSpace(NewName);

    [RelayCommand(CanExecute = nameof(CanCreate))]
    private async Task Create()
    {
        var trimmed = NewName.Trim();
        if (trimmed.Length == 0) return;
        var plan = Store.CreatePlan(trimmed);
        NewName = "";
        Creating = false;
        await Nav.PushAsync("plan", "id", plan.Id);
    }

    [RelayCommand] private Task Open(PlanRow row) => Nav.PushAsync("plan", "id", row.Id);

    [RelayCommand]
    private async Task Delete(PlanRow row)
    {
        if (await Dialogs.ConfirmAsync("Delete plan?", $"\"{row.Name}\" will be removed. Past workouts stay in History.", "Delete"))
            Store.DeletePlan(row.Id);
    }

    [RelayCommand] private Task OpenSettings() => Nav.PushAsync("settings");
}
