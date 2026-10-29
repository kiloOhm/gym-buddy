using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;

namespace GymBuddy.Services;

/// <summary>
/// Drives the in-app side of the rest timer (src/components/RestTimer.tsx tick logic) independent of which page is
/// visible: ticks 4×/s while a rest runs, vibrates once when the end is reached while the app is open, and clears
/// the rest 3 s after the end. The bar subscribes to <see cref="Tick"/>.
/// </summary>
public sealed class RestCoordinator
{
    /// <summary>How long "Rest over" stays on screen after the countdown hits zero.</summary>
    public const long OverMs = 3000;

    private readonly RestTimer _timer;
    private IDispatcherTimer? _ticker;
    private long? _vibratedFor;

    public RestCoordinator(RestTimer timer)
    {
        _timer = timer;
        _timer.Changed += OnChanged;
    }

    public RestTimer Timer => _timer;

    /// <summary>Raised on every tick and on every rest change (start/extend/clear).</summary>
    public event Action? Tick;

    private void OnChanged()
    {
        if (_timer.EndsAtMs is null)
        {
            _ticker?.Stop();
        }
        else
        {
            if (_ticker is null)
            {
                var dispatcher = Application.Current?.Dispatcher ?? Dispatcher.GetForCurrentThread();
                if (dispatcher is not null)
                {
                    _ticker = dispatcher.CreateTimer();
                    _ticker.Interval = TimeSpan.FromMilliseconds(250);
                    _ticker.Tick += (_, _) => OnTick();
                }
            }
            if (_ticker is { IsRunning: false }) _ticker.Start();
        }
        Tick?.Invoke();
    }

    private void OnTick()
    {
        var endsAt = _timer.EndsAtMs;
        if (endsAt is null)
        {
            _ticker?.Stop();
            return;
        }
        // In the background the in-app bar is not visible and clearing would also dismiss the "Rest over"
        // notification the alarm just posted. Like the JS timers in the Expo app (paused in the background),
        // do nothing until the app is back; then the rest is cleared and the notification dismissed.
        if (!AppForeground.IsActive) return;
        var now = Ids.NowMs();
        if (now >= endsAt && _vibratedFor != endsAt)
        {
            _vibratedFor = endsAt;
            // Only buzz when the end was just now and the app is visible (the notification covers the background).
            if (now < endsAt + OverMs && AppForeground.IsActive)
            {
                try { Vibration.Default.Vibrate(TimeSpan.FromMilliseconds(400)); }
                catch (Exception e) { System.Diagnostics.Debug.WriteLine($"Vibrate failed: {e.Message}"); }
            }
        }
        if (now >= endsAt + OverMs)
        {
            _timer.Clear(); // raises Changed → stops the ticker
            return;
        }
        Tick?.Invoke();
    }
}
