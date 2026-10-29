namespace GymBuddy.Core.Logic;

/// <summary>Rest countdown helpers (src/logic/rest.ts).</summary>
public static class Rest
{
    /// <summary>Whole seconds left until endsAt, rounded up so the display hits 0 exactly at the end. Never negative.</summary>
    public static int RemainingSec(long endsAtMs, long nowMs) => (int)Math.Max(0, Math.Ceiling((endsAtMs - nowMs) / 1000.0));

    /// <summary>Fraction of the rest still left, 1 at the start and 0 at the end.</summary>
    public static double RestProgress(long endsAtMs, int totalSec, long nowMs)
    {
        if (totalSec <= 0) return 0;
        return Math.Min(1, Math.Max(0, (endsAtMs - nowMs) / (totalSec * 1000.0)));
    }

    /// <summary>Seconds as m:ss, e.g. 83 → "1:23".</summary>
    public static string FormatRest(int seconds)
    {
        var s = Math.Max(0, seconds);
        return $"{s / 60}:{(s % 60).ToString("00", System.Globalization.CultureInfo.InvariantCulture)}";
    }
}
