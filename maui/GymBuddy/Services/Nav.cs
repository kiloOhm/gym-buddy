namespace GymBuddy.Services;

/// <summary>Shell navigation helpers. Tab routes: home, plans, workout, exercises, history.</summary>
public static class Nav
{
    /// <summary>
    /// Switches to a tab and drops the pages pushed on the current tab (like router.navigate('/(tabs)/x') from a
    /// stack screen in the Expo app, where every pushed screen sits above the tabs).
    /// </summary>
    public static async Task GoToTabAsync(string tab)
    {
        var shell = Shell.Current;
        if (shell is null) return;
        try
        {
            if (shell.Navigation.NavigationStack.Count > 1)
                await shell.Navigation.PopToRootAsync(false);
            await shell.GoToAsync($"//{tab}", false);
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"GoToTab {tab} failed: {e}");
        }
    }

    public static Task PushAsync(string route, IDictionary<string, object>? query = null)
    {
        var shell = Shell.Current;
        if (shell is null) return Task.CompletedTask;
        return query is null ? shell.GoToAsync(route) : shell.GoToAsync(route, query);
    }

    public static Task PushAsync(string route, string key, string value) =>
        PushAsync($"{route}?{key}={Uri.EscapeDataString(value)}");

    public static async Task BackAsync(int count = 1)
    {
        var shell = Shell.Current;
        if (shell is null) return;
        var depth = shell.Navigation.NavigationStack.Count - 1;
        var n = Math.Min(count, depth);
        if (n <= 0) return;
        await shell.GoToAsync(string.Join("/", Enumerable.Repeat("..", n)));
    }
}
