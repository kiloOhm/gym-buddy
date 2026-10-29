namespace GymBuddy.Services;

/// <summary>src/theme.ts colours for code that draws or styles in C#. Must match Resources/Styles/Colors.xaml.</summary>
public static class Theme
{
    public static readonly Color Background = Color.FromArgb("#F4F5F7");
    public static readonly Color Card = Color.FromArgb("#FFFFFF");
    public static readonly Color Border = Color.FromArgb("#E3E5E8");
    public static readonly Color Text = Color.FromArgb("#15181C");
    public static readonly Color Muted = Color.FromArgb("#6B7280");
    public static readonly Color Primary = Color.FromArgb("#2563EB");
    public static readonly Color PrimarySoft = Color.FromArgb("#DBEAFE");
    public static readonly Color Success = Color.FromArgb("#16A34A");
    public static readonly Color SuccessSoft = Color.FromArgb("#DCFCE7");
    public static readonly Color Warning = Color.FromArgb("#D97706");
    public static readonly Color WarningSoft = Color.FromArgb("#FEF3C7");
    public static readonly Color Danger = Color.FromArgb("#DC2626");
    public static readonly Color DangerSoft = Color.FromArgb("#FEE2E2");
    public static readonly Color CoverageNone = Color.FromArgb("#E3E5E8");
    public static readonly Color CoverageLight = Color.FromArgb("#93C5FD");
    public static readonly Color CoverageModerate = Color.FromArgb("#3B82F6");
    public static readonly Color CoverageHigh = Color.FromArgb("#1D4ED8");

    /// <summary>Difficulty colour: 1-2 green, 3 amber, 4-5 red (difficultyColor in RatingDots.tsx).</summary>
    public static Color DifficultyColor(int value) => value >= 4 ? Danger : value == 3 ? Warning : Success;

    public static Style? Style(string key) =>
        Application.Current?.Resources.TryGetValue(key, out var v) == true ? v as Style : null;
}
