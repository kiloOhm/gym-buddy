using GymBuddy.Services;
using Microsoft.Maui.Controls.PlatformConfiguration.AndroidSpecific;

namespace GymBuddy;

public partial class App : Microsoft.Maui.Controls.Application
{
    public App(RestCoordinator rest)
    {
        // Created eagerly so the rest ticker runs whichever page is visible.
        _ = rest;
        InitializeComponent();
        UserAppTheme = AppTheme.Light;
        // Resize (not pan) so the focused set row scrolls into view above the keyboard.
        Current?.On<Microsoft.Maui.Controls.PlatformConfiguration.Android>().UseWindowSoftInputModeAdjust(WindowSoftInputModeAdjust.Resize);
    }

    protected override Window CreateWindow(IActivationState? activationState) => new(new AppShell());
}
