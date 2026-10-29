namespace GymBuddy.Services;

/// <summary>Alerts and confirmations (the Expo app's alert() wrapper).</summary>
public static class Dialogs
{
    private static Page? Host => Shell.Current?.CurrentPage ?? Application.Current?.Windows.FirstOrDefault()?.Page;

    public static Task AlertAsync(string title, string message)
    {
        var page = Host;
        return page is null ? Task.CompletedTask : page.DisplayAlertAsync(title, message, "OK");
    }

    /// <summary>Two-button confirmation; true when <paramref name="accept"/> was chosen.</summary>
    public static Task<bool> ConfirmAsync(string title, string message, string accept, string cancel = "Cancel")
    {
        var page = Host;
        return page is null ? Task.FromResult(false) : page.DisplayAlertAsync(title, message, accept, cancel);
    }
}
