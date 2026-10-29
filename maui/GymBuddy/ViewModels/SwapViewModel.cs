using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record SuggestionRow(Exercise Exercise, string Score, string Reasons, bool HasReasons, System.Windows.Input.ICommand ChooseCommand);

/// <summary>
/// src/app/swap/[id].tsx. Renders from a snapshot taken when the page opens (no store subscription): nothing shown
/// here may change after the swap while the page is being dismissed. Further taps are ignored once one was chosen.
/// </summary>
public sealed partial class SwapViewModel : ObservableObject, IQueryAttributable
{
    private readonly GymStore _store;
    private bool _chosen;
    private string? _sessionExerciseId;
    private IReadOnlyList<string> _sessionIds = Array.Empty<string>();

    public SwapViewModel(GymStore store) => _store = store;

    [ObservableProperty] public partial bool Found { get; set; } = true;
    [ObservableProperty] public partial string OriginalName { get; set; } = "";
    [ObservableProperty] public partial string? OriginalEquipment { get; set; }
    [ObservableProperty] public partial IReadOnlyList<SuggestionRow> Suggestions { get; set; } = Array.Empty<SuggestionRow>();
    [ObservableProperty] public partial bool HasNoSuggestions { get; set; }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (_sessionExerciseId is not null) return; // snapshot once
        var id = query.TryGetValue("id", out var v) ? v?.ToString() : null;
        var target = Swap.SwapTargetSnapshot(_store.ActiveSession, id);
        Found = target.SessionExercise is not null;
        if (target.SessionExercise is not { } se) return;
        _sessionExerciseId = se.Id;
        _sessionIds = target.SessionIds;
        var original = _store.GetExercise(se.ExerciseId);
        OriginalName = original?.Name ?? "Unknown exercise";
        OriginalEquipment = original is null ? null : string.Join(", ", original.Equipment.Select(e => e.Label()));
        Suggestions = Alternatives.SuggestAlternatives(se.ExerciseId, _store.LibraryById, _sessionIds, 8)
            .Select(a => new SuggestionRow(a.Exercise, $"{(int)JsMath.Round(a.Score * 100)}%", string.Join(" · ", a.Reasons), a.Reasons.Count > 0, ChooseCommand))
            .ToList();
        HasNoSuggestions = Suggestions.Count == 0;
    }

    [RelayCommand]
    private async Task Choose(Exercise exercise)
    {
        if (_chosen || _sessionExerciseId is null) return;
        _chosen = true;
        _store.SwapExercise(_sessionExerciseId, exercise.Id);
        await Nav.BackAsync();
    }

    [RelayCommand]
    private Task Browse()
    {
        if (_sessionExerciseId is null || _chosen) return Task.CompletedTask;
        return Nav.PushAsync($"pick?sessionSwap={Uri.EscapeDataString(_sessionExerciseId)}&exclude={Uri.EscapeDataString(string.Join(",", _sessionIds))}");
    }

    [RelayCommand] private Task GoBack() => Nav.BackAsync();
}
