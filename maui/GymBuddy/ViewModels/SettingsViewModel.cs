using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Data;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed partial class ExportChoice : ObservableObject
{
    public ExportChoice(string id, string name, string meta, System.Windows.Input.ICommand toggle)
    {
        Id = id;
        Name = name;
        Meta = meta;
        ToggleCommand = toggle;
    }

    public string Id { get; }
    public string Name { get; }
    public string Meta { get; }
    public System.Windows.Input.ICommand ToggleCommand { get; }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Glyph))]
    public partial bool Checked { get; set; }

    public string Glyph => Checked ? Icons.Checkbox : Icons.SquareOutline;
}

/// <summary>src/app/settings.tsx</summary>
public sealed partial class SettingsViewModel : StoreViewModel
{
    private const int MaxListedPlans = 5;
    private const int MaxListedWarnings = 8;

    public SettingsViewModel(GymStore store) : base(store) { }

    [ObservableProperty] public partial bool IsKg { get; set; }
    [ObservableProperty] public partial string LibraryLine { get; set; } = "";
    [ObservableProperty] public partial bool HasCustom { get; set; }

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ToggleExportChooserCommand))]
    public partial bool HasPlans { get; set; }

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ExportHistoryCommand))]
    public partial bool HasHistory { get; set; }

    [ObservableProperty] public partial bool ChooserOpen { get; set; }
    [ObservableProperty] public partial IReadOnlyList<ExportChoice> Choices { get; set; } = Array.Empty<ExportChoice>();

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ExportSelectedCommand))]
    public partial int SelectedCount { get; set; }

    public string ExportSelectedText => $"Export {SelectedCount} plan{(SelectedCount == 1 ? "" : "s")}";

    partial void OnSelectedCountChanged(int value) => OnPropertyChanged(nameof(ExportSelectedText));

    protected override void Refresh()
    {
        IsKg = Store.Settings.WeightUnit == WeightUnit.Kg;
        var custom = Store.CustomExercises.Count;
        LibraryLine = $"{BuiltInExercises.All.Count} built-in · {custom} custom or edited";
        HasCustom = custom > 0;
        HasPlans = Store.Plans.Count > 0;
        HasHistory = Store.Sessions.Any(x => x.FinishedAt is not null);
        if (ChooserOpen)
        {
            // Keep ticks; drop plans deleted while the chooser was open, add new ones ticked.
            var ticked = Choices.Where(c => c.Checked).Select(c => c.Id).ToHashSet();
            var known = Choices.Select(c => c.Id).ToHashSet();
            BuildChoices(p => ticked.Contains(p.Id) || !known.Contains(p.Id));
        }
    }

    private void BuildChoices(Func<WorkoutPlan, bool> isChecked)
    {
        Choices = Store.Plans.Select(p => new ExportChoice(p.Id, p.Name, Format.Plural(p.Exercises.Count, "exercise"), ToggleChoiceCommand) { Checked = isChecked(p) }).ToList();
        UpdateCount();
    }

    private void UpdateCount() => SelectedCount = Choices.Count(c => c.Checked);

    [RelayCommand] private void SetKg() => Store.SetWeightUnit(WeightUnit.Kg);
    [RelayCommand] private void SetLb() => Store.SetWeightUnit(WeightUnit.Lb);

    [RelayCommand(CanExecute = nameof(HasPlans))]
    private void ToggleExportChooser()
    {
        if (ChooserOpen)
        {
            ChooserOpen = false;
            return;
        }
        BuildChoices(_ => true);
        ChooserOpen = true;
    }

    [RelayCommand]
    private void ToggleChoice(ExportChoice choice)
    {
        choice.Checked = !choice.Checked;
        UpdateCount();
    }

    [RelayCommand]
    private void SelectAll()
    {
        foreach (var c in Choices) c.Checked = true;
        UpdateCount();
    }

    [RelayCommand]
    private void SelectNone()
    {
        foreach (var c in Choices) c.Checked = false;
        UpdateCount();
    }

    [RelayCommand] private void CancelChooser() => ChooserOpen = false;

    private bool CanExportSelected() => SelectedCount > 0;

    [RelayCommand(CanExecute = nameof(CanExportSelected))]
    private async Task ExportSelected()
    {
        var ids = Choices.Where(c => c.Checked).Select(c => c.Id).ToHashSet();
        var plans = Store.Plans.Where(p => ids.Contains(p.Id)).ToList();
        if (plans.Count == 0) return;
        try
        {
            var now = DateTimeOffset.Now;
            await FileExchange.ShareJsonAsync(PlanExport.SuggestedFileName(plans, now), PlanExport.SerializePlans(plans, now), "Export plans");
            ChooserOpen = false;
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Export failed", e.Message);
        }
    }

    [RelayCommand]
    private async Task ImportPlans()
    {
        ParsedImport parsed;
        try
        {
            var text = await FileExchange.PickTextAsync("Import plans");
            if (text is null) return;
            parsed = PlanExport.ParsePlanExport(text, Store.LibraryById);
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Import failed", e.Message);
            return;
        }
        if (parsed.Plans.Count == 0)
        {
            await Dialogs.AlertAsync("Import failed", "The file does not contain any plans.");
            return;
        }
        var dedupe = PlanExport.DedupePlans(parsed.Plans, Store.Plans);
        var incoming = dedupe.Plans;
        if (incoming.Count == 0)
        {
            await Dialogs.AlertAsync("Nothing to import", string.Join("\n", dedupe.Skipped));
            return;
        }
        var names = string.Join(", ", incoming.Take(MaxListedPlans).Select(p => p.Name));
        var more = incoming.Count > MaxListedPlans ? "…" : "";
        var summary = $"{incoming.Count} plan{(incoming.Count == 1 ? "" : "s")}: {names}{more}";
        var details = (parsed.Warnings.Count > 0 ? $"\n\n{string.Join("\n", parsed.Warnings)}" : "")
            + (dedupe.Skipped.Count > 0 ? $"\n\nSkipped as duplicates:\n{string.Join("\n", dedupe.Skipped)}" : "");
        if (!await Dialogs.ConfirmAsync("Import plans?", summary + details, "Import")) return;
        Store.ImportPlans(incoming);
        await Nav.GoToTabAsync("plans");
    }

    [RelayCommand(CanExecute = nameof(HasHistory))]
    private async Task ExportHistory()
    {
        try
        {
            var now = DateTimeOffset.Now;
            await FileExchange.ShareJsonAsync(HistoryExport.HistoryFileName(now),
                HistoryExport.SerializeHistory(Store.Sessions, Store.Settings.WeightUnit, now), "Export history");
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Export failed", e.Message);
        }
    }

    [RelayCommand]
    private async Task ImportHistory()
    {
        ParsedHistory parsed;
        try
        {
            var text = await FileExchange.PickTextAsync("Import history");
            if (text is null) return;
            parsed = HistoryExport.ParseHistoryExport(text, Store.Settings.WeightUnit, Store.LibraryById);
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Import failed", e.Message);
            return;
        }
        if (parsed.Sessions.Count == 0)
        {
            await Dialogs.AlertAsync("Import failed", "The file does not contain any workouts.");
            return;
        }
        var dedupe = HistoryExport.DedupeSessions(parsed.Sessions, Store.Sessions);
        var incoming = dedupe.Sessions;
        if (incoming.Count == 0)
        {
            await Dialogs.AlertAsync("Nothing to import", string.Join("\n", dedupe.Skipped));
            return;
        }
        var finished = incoming.Select(s => s.FinishedAt ?? "").OrderBy(f => Ids.ParseIsoMs(f) ?? 0).ToList();
        var oldest = SessionFormat.FormatSessionDate(finished[0]);
        var newest = SessionFormat.FormatSessionDate(finished[^1]);
        var range = incoming.Count == 1 ? newest : $"{oldest} – {newest}";
        var summary = $"{Format.Plural(incoming.Count, "workout")}, {range}";
        var warnings = parsed.Warnings;
        var listed = string.Join("\n", warnings.Take(MaxListedWarnings));
        var moreWarnings = warnings.Count > MaxListedWarnings ? $"\n…and {warnings.Count - MaxListedWarnings} more" : "";
        var details = (warnings.Count > 0 ? $"\n\n{listed}{moreWarnings}" : "")
            + (dedupe.Skipped.Count > 0 ? $"\n\nSkipped:\n{string.Join("\n", dedupe.Skipped)}" : "");
        if (!await Dialogs.ConfirmAsync("Import history?", summary + details, "Import")) return;
        Store.ImportSessions(incoming);
        await Nav.GoToTabAsync("history");
    }

    [RelayCommand]
    private async Task ExportLibrary()
    {
        try
        {
            var now = DateTimeOffset.Now;
            await FileExchange.ShareJsonAsync(LibraryFormat.LibraryFileName(now), LibraryFormat.SerializeLibrary(Store.Library, now), "Export exercise library");
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Export failed", e.Message);
        }
    }

    [RelayCommand]
    private async Task ImportLibrary()
    {
        ParsedLibrary parsed;
        try
        {
            var text = await FileExchange.PickTextAsync("Import exercise library");
            if (text is null) return;
            parsed = LibraryFormat.ParseLibraryExport(text);
        }
        catch (Exception e)
        {
            await Dialogs.AlertAsync("Import failed", e.Message);
            return;
        }
        var warnings = parsed.Warnings;
        var diff = LibraryFormat.DiffLibrary(parsed.Exercises, Store.Library);
        var listed = string.Join("\n", warnings.Take(MaxListedWarnings));
        var moreWarnings = warnings.Count > MaxListedWarnings ? $"\n…and {warnings.Count - MaxListedWarnings} more" : "";
        var details = warnings.Count > 0 ? $"\n\n{listed}{moreWarnings}" : "";
        if (diff.Added.Count + diff.Updated.Count == 0)
        {
            await Dialogs.AlertAsync("Nothing to import", $"{diff.Unchanged.Count} unchanged{details}");
            return;
        }
        var summary = $"{diff.Added.Count} new, {diff.Updated.Count} changed, {diff.Unchanged.Count} unchanged";
        if (await Dialogs.ConfirmAsync("Import exercise library?", summary + details, "Import"))
            Store.ImportExercises(parsed.Exercises);
    }

    [RelayCommand]
    private async Task ResetLibrary()
    {
        var n = Store.CustomExercises.Count;
        if (await Dialogs.ConfirmAsync("Reset exercise library?",
                $"Removes {n} custom or edited exercise{(n == 1 ? "" : "s")} and restores the built-in versions.", "Reset"))
            Store.ResetExerciseLibrary();
    }
}
