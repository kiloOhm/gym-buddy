using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record SessionSetLine(string Text, bool Completed);
public sealed record SessionExerciseBlock(string Name, string? SwappedFor, bool HasSwappedFor, IReadOnlyList<SessionSetLine> Sets);

/// <summary>src/app/session/[id].tsx</summary>
public sealed partial class SessionDetailViewModel : StoreViewModel, IQueryAttributable
{
    public SessionDetailViewModel(GymStore store) : base(store) { }

    private string _id = "";
    private bool _deleting;

    [ObservableProperty] public partial bool Found { get; set; } = true;
    [ObservableProperty] public partial string Title { get; set; } = "Workout";
    [ObservableProperty] public partial string When { get; set; } = "";
    [ObservableProperty] public partial IReadOnlyList<SessionExerciseBlock> Blocks { get; set; } = Array.Empty<SessionExerciseBlock>();
    [ObservableProperty] public partial IReadOnlyDictionary<MuscleGroup, double>? CoverageValues { get; set; }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        _id = query.TryGetValue("id", out var id) ? id?.ToString() ?? "" : "";
        Refresh();
    }

    protected override void Refresh()
    {
        if (_deleting) return;
        var session = Store.GetSession(_id);
        Found = session is not null;
        if (session is null)
        {
            Title = "Workout";
            return;
        }
        var unit = Store.Settings.WeightUnit.Label();
        Title = session.PlanName;
        var started = Ids.ParseIsoMs(session.StartedAt) is { } ms ? DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime() : (DateTimeOffset?)null;
        var duration = SessionFormat.SessionDurationMin(session);
        // toLocaleDateString(weekday long, day numeric, month long, year numeric) · toLocaleTimeString(2-digit) in en.
        When = started is { } d
            ? $"{d.ToString("dddd, d MMMM yyyy", Format.Inv)} · {d.ToString("HH:mm", Format.Inv)}{(duration is { } m ? $" · {m} min" : "")}"
            : "";
        Blocks = session.Exercises.Select(ex =>
        {
            var swapped = ex.SubstitutedFor is null ? null : $"Swapped in for {Store.GetExercise(ex.SubstitutedFor)?.Name ?? "Unknown exercise"}";
            return new SessionExerciseBlock(
                Store.GetExercise(ex.ExerciseId)?.Name ?? "Unknown exercise",
                swapped,
                swapped is not null,
                ex.Sets.Select((s, i) => new SessionSetLine(
                    $"{i + 1}. {SessionFormat.FormatWeight(s.Weight)} {unit} × {s.Reps}{(s.Completed ? "" : " (skipped)")}", s.Completed)).ToList());
        }).ToList();
        CoverageValues = CoverageLogic.ComputeCoverage(
            session.Exercises.Select(e => new CoverageItem(e.ExerciseId, e.Sets.Count(s => s.Completed))), Store.LibraryById).ToDictionary();
    }

    [RelayCommand]
    private async Task Delete()
    {
        if (!await Dialogs.ConfirmAsync("Delete workout?", "This removes it from your history. This cannot be undone.", "Delete")) return;
        _deleting = true;
        Store.DeleteSession(_id);
        await Nav.BackAsync();
    }
}
