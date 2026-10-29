using GymBuddy.Controls;
using GymBuddy.Core;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.Views;

/// <summary>
/// Exercise picker (src/app/pick-exercise.tsx). Query, all optional: planId (add to that plan), sessionAdd=1 (add to
/// the active workout), sessionSwap=&lt;session-exercise id&gt; (swap it), exclude=comma-separated ids to hide.
/// Renders the library as it was when opened; ignores taps after the first pick.
/// </summary>
public sealed class PickExercisePage : ContentPage, IQueryAttributable
{
    private readonly GymStore _store;
    private readonly ExerciseListView _list = new();
    private string? _planId;
    private string? _sessionSwap;
    private bool _sessionAdd;
    private bool _picked;

    public PickExercisePage(GymStore store)
    {
        _store = store;
        Title = "Pick exercise";
        Shell.SetTabBarIsVisible(this, false);
        Content = _list;
        _list.ExercisePressed += async (_, ex) => await Pick(ex);
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        string? Get(string key) => query.TryGetValue(key, out var v) ? v?.ToString() : null;
        _planId = Get("planId") is { Length: > 0 } p ? p : null;
        _sessionSwap = Get("sessionSwap") is { Length: > 0 } s ? s : null;
        _sessionAdd = Get("sessionAdd") == "1";
        var hidden = (Get("exclude") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
        _list.Exercises = hidden.Count == 0 ? _store.Library : _store.Library.Where(e => !hidden.Contains(e.Id)).ToList();
    }

    private async Task Pick(Exercise exercise)
    {
        // A second tap while the page is closing must not add or swap twice, nor pop another page.
        if (_picked) return;
        _picked = true;
        if (_planId is not null) _store.AddExerciseToPlan(_planId, exercise.Id);
        else if (_sessionSwap is not null) _store.SwapExercise(_sessionSwap, exercise.Id);
        else if (_sessionAdd) _store.AddSessionExercise(exercise.Id);
        // A swap came through the swap page, which renders from a snapshot: drop both and land on the workout.
        await Nav.BackAsync(_sessionSwap is not null ? 2 : 1);
    }
}
