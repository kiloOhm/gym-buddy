using GymBuddy.Controls;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.Views;

/// <summary>Exercises tab (src/app/(tabs)/exercises.tsx): the full library; tap → detail.</summary>
public sealed class ExercisesPage : ContentPage
{
    private readonly GymStore _store;
    private readonly ExerciseListView _list = new();

    public ExercisesPage(GymStore store)
    {
        _store = store;
        Title = "Exercises";
        Content = _list;
        _list.ExercisePressed += async (_, ex) => await Nav.PushAsync("exercise", "id", ex.Id);
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _store.Changed += Sync;
        Sync();
    }

    protected override void OnDisappearing()
    {
        _store.Changed -= Sync;
        base.OnDisappearing();
    }

    /// <summary>Re-render after a library import or reset.</summary>
    private void Sync()
    {
        if (!ReferenceEquals(_list.Exercises, _store.Library)) _list.Exercises = _store.Library;
    }
}
