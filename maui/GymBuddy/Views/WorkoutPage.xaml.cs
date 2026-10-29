using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class WorkoutPage : PageBase
{
    private readonly WorkoutViewModel _vm;
    private IDispatcherTimer? _clock;

    public WorkoutPage(WorkoutViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _clock ??= CreateClock();
        _clock.Start();
    }

    protected override void OnDisappearing()
    {
        _clock?.Stop();
        base.OnDisappearing();
    }

    /// <summary>The elapsed mm:ss clock ticks once a second while the page is visible (ElapsedTimer.tsx).</summary>
    private IDispatcherTimer CreateClock()
    {
        var timer = Dispatcher.CreateTimer();
        timer.Interval = TimeSpan.FromSeconds(1);
        timer.Tick += (_, _) => _vm.TickElapsed();
        return timer;
    }
}
