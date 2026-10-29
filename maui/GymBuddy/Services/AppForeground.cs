namespace GymBuddy.Services;

/// <summary>Whether the activity is resumed (set by MainActivity). The rest alarm receiver skips the notification then.</summary>
public static class AppForeground
{
    public static volatile bool IsActive;
}
