using System.Globalization;

namespace GymBuddy.Core.Logic;

/// <summary>ID and timestamp helpers (src/logic/ids.ts).</summary>
public static class Ids
{
    private static readonly Random Rng = new();

    /// <summary>Short unique id, good enough for a single-device app: base-36 time plus 6 random base-36 chars.</summary>
    public static string NewId()
    {
        var ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var rnd = Rng.NextInt64(0, 2_176_782_336L); // 36^6
        return ToBase36(ms) + ToBase36(rnd).PadLeft(6, '0');
    }

    /// <summary>Now as "2026-10-28T19:04:05.123Z".</summary>
    public static string NowIso() => GymJson.ToIso(DateTimeOffset.UtcNow);

    public static string ToIso(long unixMs) => GymJson.ToIso(DateTimeOffset.FromUnixTimeMilliseconds(unixMs));

    /// <summary>Unix milliseconds of an ISO-8601 timestamp, or null when it does not parse (Date.parse → NaN).</summary>
    public static long? ParseIsoMs(string? iso)
    {
        if (string.IsNullOrEmpty(iso)) return null;
        return DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var t)
            ? t.ToUnixTimeMilliseconds()
            : null;
    }

    public static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static string ToBase36(long value)
    {
        const string digits = "0123456789abcdefghijklmnopqrstuvwxyz";
        if (value == 0) return "0";
        var chars = new Stack<char>();
        while (value > 0)
        {
            chars.Push(digits[(int)(value % 36)]);
            value /= 36;
        }
        return new string(chars.ToArray());
    }
}
