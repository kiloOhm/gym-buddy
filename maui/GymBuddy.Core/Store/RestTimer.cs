using System.Diagnostics;

namespace GymBuddy.Core.Store;

/// <summary>
/// Rest countdown between sets (src/store/rest.ts). In memory only. Every change is mirrored to the
/// <see cref="IRestAlarm"/>. Not thread-safe: UI thread only.
/// </summary>
public sealed class RestTimer(IRestAlarm? alarm = null, Func<long>? nowMs = null)
{
    private readonly Func<long> _now = nowMs ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

    public event Action? Changed;

    /// <summary>Absolute end time (unix ms), so the countdown stays right across page switches. Null when no rest runs.</summary>
    public long? EndsAtMs { get; private set; }

    /// <summary>Full length of the current rest in seconds, for the progress bar.</summary>
    public int TotalSec { get; private set; }

    public long NowMs => _now();

    /// <summary>Starts a rest of <paramref name="seconds"/>; ignored when ≤ 0.</summary>
    public void Start(int seconds)
    {
        if (seconds <= 0) return;
        var endsAt = _now() + seconds * 1000L;
        EndsAtMs = endsAt;
        TotalSec = seconds;
        Changed?.Invoke();
        Guard(() => alarm?.Schedule(endsAt));
    }

    /// <summary>Adds time to a running rest; a no-op when none runs or it is already over.</summary>
    public void Extend(int seconds)
    {
        if (EndsAtMs is not { } endsAt || endsAt <= _now()) return;
        var next = endsAt + seconds * 1000L;
        EndsAtMs = next;
        TotalSec += seconds;
        Changed?.Invoke();
        Guard(() => alarm?.Schedule(next));
    }

    /// <summary>Stops the rest; cancels the alarm only if a rest was set.</summary>
    public void Clear()
    {
        var hadRest = EndsAtMs is not null;
        EndsAtMs = null;
        TotalSec = 0;
        Changed?.Invoke();
        if (hadRest) Guard(() => alarm?.Cancel());
    }

    private static void Guard(Action action)
    {
        try
        {
            action();
        }
        catch (Exception e)
        {
            Debug.WriteLine($"RestTimer: rest alarm failed: {e}");
        }
    }
}
