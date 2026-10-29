using GymBuddy.ViewModels;

namespace GymBuddy.Views;

/// <summary>Forwards OnAppearing/OnDisappearing to an <see cref="IActivatable"/> binding context.</summary>
public class PageBase : ContentPage
{
    protected override void OnAppearing()
    {
        base.OnAppearing();
        (BindingContext as IActivatable)?.Activate();
    }

    protected override void OnDisappearing()
    {
        Services.Keyboard.Hide();
        (BindingContext as IActivatable)?.Deactivate();
        base.OnDisappearing();
    }
}
