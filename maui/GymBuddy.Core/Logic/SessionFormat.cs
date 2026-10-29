using System.Globalization;
using System.Text.RegularExpressions;

namespace GymBuddy.Core.Logic;

/// <summary>Display helpers for sessions (src/logic/sessionFormat.ts). All output is culture-invariant.</summary>
public static partial class SessionFormat
{
    private static string Pad(long n) => n.ToString("00", CultureInfo.InvariantCulture);

    /// <summary>Elapsed milliseconds as mm:ss (or h:mm:ss past an hour). Negative values clamp to 0.</summary>
    public static string FormatElapsed(long ms)
    {
        var total = Math.Max(0, (long)Math.Floor(ms / 1000.0));
        var h = total / 3600;
        var m = total % 3600 / 60;
        var s = total % 60;
        return h > 0 ? $"{h}:{Pad(m)}:{Pad(s)}" : $"{Pad(m)}:{Pad(s)}";
    }

    /// <summary>Trim pointless decimals: 80 → "80", 82.5 → "82.5" (at most 2 decimals).</summary>
    public static string FormatWeight(double weight) =>
        weight == Math.Floor(weight) && !double.IsInfinity(weight)
            ? JsMath.ToJsString(weight)
            : JsMath.ToJsString(JsMath.Round(weight * 100) / 100);

    /// <summary>"80 kg × 8, 80 × 8, 80 × 7" — unit only on the first set.</summary>
    public static string FormatSetList(IEnumerable<SetLog> sets, WeightUnit unit) =>
        string.Join(", ", sets.Select((s, i) => $"{FormatWeight(s.Weight)}{(i == 0 ? $" {unit.Slug()}" : "")} × {s.Reps}"));

    [GeneratedRegex(@"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")]
    private static partial Regex FloatPrefix();

    [GeneratedRegex(@"^[+-]?\d+")]
    private static partial Regex IntPrefix();

    /// <summary>
    /// Parse a user-typed number like JS parseFloat/parseInt (longest valid prefix). Accepts "," as decimal
    /// separator (the first one); empty, invalid or negative → 0.
    /// </summary>
    public static double ParseNumberInput(string text, bool allowDecimal)
    {
        var idx = text.IndexOf(',');
        var normalised = (idx >= 0 ? text[..idx] + "." + text[(idx + 1)..] : text).Trim();
        if (normalised.Length == 0) return 0;
        var match = (allowDecimal ? FloatPrefix() : IntPrefix()).Match(normalised);
        if (!match.Success) return 0;
        if (!double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var n)) return 0;
        return double.IsFinite(n) && n >= 0 ? (n == 0 ? 0 : n) : 0;
    }

    /// <summary>Σ weight × reps over completed sets.</summary>
    public static double SessionVolume(WorkoutSession session)
    {
        double total = 0;
        foreach (var ex in session.Exercises)
            foreach (var s in ex.Sets)
                if (s.Completed) total += s.Weight * s.Reps;
        return total;
    }

    /// <summary>Whole minutes between start and finish, or null while in progress.</summary>
    public static int? SessionDurationMin(WorkoutSession session)
    {
        if (string.IsNullOrEmpty(session.FinishedAt)) return null;
        var finished = Ids.ParseIsoMs(session.FinishedAt);
        var started = Ids.ParseIsoMs(session.StartedAt);
        if (finished is null || started is null) return null;
        return (int)Math.Max(0, JsMath.Round((finished.Value - started.Value) / 60000.0));
    }

    public static int CompletedSetCount(WorkoutSession session) => session.Exercises.Sum(ex => ex.Sets.Count(s => s.Completed));

    /// <summary>Short weekday + date in local time, invariant English: "Tue, 27 Oct 2026". Empty for an unparsable timestamp.</summary>
    public static string FormatSessionDate(string iso) => FormatSessionDate(iso, TimeZoneInfo.Local);

    public static string FormatSessionDate(string iso, TimeZoneInfo zone)
    {
        if (Ids.ParseIsoMs(iso) is not { } ms) return "";
        var local = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeMilliseconds(ms), zone);
        return local.ToString("ddd, d MMM yyyy", CultureInfo.InvariantCulture);
    }
}
