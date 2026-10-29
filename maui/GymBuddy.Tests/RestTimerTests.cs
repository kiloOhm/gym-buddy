using GymBuddy.Core.Store;

namespace GymBuddy.Tests;

/// <summary>Port of src/store/rest.test.ts with a fake IRestAlarm.</summary>
public class RestTimerTests
{
    private sealed class FakeAlarm : IRestAlarm
    {
        public List<long> Scheduled { get; } = [];
        public int Cancelled { get; private set; }
        public void Schedule(long endsAtMs) => Scheduled.Add(endsAtMs);
        public void Cancel() => Cancelled++;
    }

    private readonly FakeAlarm _alarm = new();
    private long _now = 1_000_000;
    private readonly RestTimer _timer;

    public RestTimerTests() => _timer = new RestTimer(_alarm, () => _now);

    [Fact]
    public void start_schedules_the_notification_at_endsAt()
    {
        _timer.Start(90);
        Assert.Equal(1_090_000, _timer.EndsAtMs);
        Assert.Equal([1_090_000L], _alarm.Scheduled);
    }

    [Fact]
    public void start_with_no_rest_time_does_nothing()
    {
        _timer.Start(0);
        Assert.Empty(_alarm.Scheduled);
        Assert.Null(_timer.EndsAtMs);
    }

    [Fact]
    public void extend_reschedules_for_the_new_end()
    {
        _timer.Start(90);
        _timer.Extend(30);
        Assert.Equal(1_120_000, _timer.EndsAtMs);
        Assert.Equal(120, _timer.TotalSec);
        Assert.Equal(1_120_000L, _alarm.Scheduled[^1]);
    }

    [Fact]
    public void extend_after_the_end_does_not_reschedule()
    {
        _timer.Start(90);
        _now = 1_100_000;
        _timer.Extend(30);
        Assert.Single(_alarm.Scheduled);
    }

    [Fact]
    public void clear_cancels_a_running_rest_and_is_quiet_when_nothing_runs()
    {
        _timer.Clear();
        Assert.Equal(0, _alarm.Cancelled);
        _timer.Start(90);
        _timer.Clear();
        Assert.Null(_timer.EndsAtMs);
        Assert.Equal(1, _alarm.Cancelled);
    }

    [Fact]
    public void raises_changed_and_survives_a_failing_alarm()
    {
        var timer = new RestTimer(new ThrowingAlarm(), () => _now);
        var changes = 0;
        timer.Changed += () => changes++;
        timer.Start(60);
        timer.Extend(30);
        timer.Clear();
        Assert.Equal(3, changes);
        Assert.Null(timer.EndsAtMs);
        new RestTimer().Start(10); // no alarm at all
    }

    private sealed class ThrowingAlarm : IRestAlarm
    {
        public void Schedule(long endsAtMs) => throw new InvalidOperationException("no permission");
        public void Cancel() => throw new InvalidOperationException("no permission");
    }
}
