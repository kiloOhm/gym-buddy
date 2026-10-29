using Android.App;
using Android.Content.PM;
using Android.OS;
using GymBuddy.Services;

namespace GymBuddy;

[Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop, ScreenOrientation = ScreenOrientation.Portrait,
    ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        // White status bar with dark icons (expo-status-bar style="dark").
        if (Window is { } window)
        {
            if (Build.VERSION.SdkInt < BuildVersionCodes.VanillaIceCream)
#pragma warning disable CA1422
                window.SetStatusBarColor(Android.Graphics.Color.White);
#pragma warning restore CA1422
            AndroidX.Core.View.WindowCompat.GetInsetsController(window, window.DecorView).AppearanceLightStatusBars = true;
        }
    }

    protected override void OnResume()
    {
        base.OnResume();
        AppForeground.IsActive = true;
    }

    protected override void OnPause()
    {
        AppForeground.IsActive = false;
        base.OnPause();
    }
}
