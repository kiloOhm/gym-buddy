using System.Globalization;

namespace GymBuddy.Core.Logic;

/// <summary>JavaScript number semantics the TypeScript logic relies on.</summary>
public static class JsMath
{
    /// <summary>Math.round: halves round towards +∞ (Math.round(-2.5) = -2, Math.round(2.5) = 3).</summary>
    public static double Round(double x) => Math.Floor(x + 0.5);

    /// <summary>round(value, decimals) helper of the TS logic: Math.round(value * 10^d) / 10^d.</summary>
    public static double Round(double value, int decimals)
    {
        var f = Math.Pow(10, decimals);
        return Round(value * f) / f;
    }

    /// <summary>String(n) for a finite number: shortest round-trip text, invariant culture ("80", "82.5", "0.1").</summary>
    public static string ToJsString(double n)
    {
        if (n == 0) return "0"; // also -0
        return n.ToString("R", CultureInfo.InvariantCulture);
    }
}

/// <summary>
/// Approximation of JavaScript's <c>a.localeCompare(b)</c> (ICU root collation) for the ASCII names in the
/// exercise data: case-insensitive first, lowercase before uppercase on a tie. A culture-aware
/// <see cref="StringComparer.InvariantCulture"/> would be plain ordinal here because InvariantGlobalization is on,
/// which would sort "Zulu" before "alpha".
/// </summary>
public sealed class LocaleComparer : IComparer<string>
{
    public static readonly LocaleComparer Instance = new();

    public int Compare(string? a, string? b)
    {
        if (ReferenceEquals(a, b)) return 0;
        if (a is null) return -1;
        if (b is null) return 1;
        var primary = string.CompareOrdinal(a.ToLowerInvariant(), b.ToLowerInvariant());
        if (primary != 0) return primary;
        return -string.CompareOrdinal(a, b);
    }
}
