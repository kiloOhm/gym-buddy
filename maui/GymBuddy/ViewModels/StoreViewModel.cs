using CommunityToolkit.Mvvm.ComponentModel;
using GymBuddy.Core.Store;

namespace GymBuddy.ViewModels;

/// <summary>Page lifecycle hooks, forwarded by <see cref="Views.PageBase"/>.</summary>
public interface IActivatable
{
    void Activate();
    void Deactivate();
}

/// <summary>
/// Base for view models that render store state: subscribes to <see cref="GymStore.Changed"/> while the page is
/// visible and refreshes from the store (never caches model objects across refreshes: look them up by id).
/// </summary>
public abstract partial class StoreViewModel : ObservableObject, IActivatable
{
    protected StoreViewModel(GymStore store) => Store = store;

    protected GymStore Store { get; }

    private bool _active;

    public void Activate()
    {
        if (!_active)
        {
            _active = true;
            Store.Changed += OnStoreChanged;
        }
        Refresh();
    }

    public void Deactivate()
    {
        if (!_active) return;
        _active = false;
        Store.Changed -= OnStoreChanged;
        OnDeactivated();
    }

    protected virtual void OnDeactivated() { }

    private void OnStoreChanged() => Refresh();

    protected abstract void Refresh();
}
