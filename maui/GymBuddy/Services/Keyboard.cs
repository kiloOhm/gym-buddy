using Android.Content;
using Android.Views.InputMethods;

namespace GymBuddy.Services;

public static class Keyboard
{
    /// <summary>Closes the soft keyboard (called when a page goes away so it does not linger over the next one).</summary>
    public static void Hide()
    {
        try
        {
            var activity = Platform.CurrentActivity;
            if (activity?.Window?.DecorView is not { } decor) return;
            var imm = (InputMethodManager?)activity.GetSystemService(Context.InputMethodService);
            imm?.HideSoftInputFromWindow(decor.WindowToken, HideSoftInputFlags.None);
            activity.CurrentFocus?.ClearFocus();
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"Keyboard.Hide failed: {e.Message}");
        }
    }
}
