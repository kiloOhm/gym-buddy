using GymBuddy.Core.Logic;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>
/// Rest countdown bar for the active workout (src/components/RestTimer.tsx): "Rest · 1:23" with "+30 s" and "Skip",
/// "Rest over" for 3 s after the end, thin progress bar. Hidden when no rest is running.
/// Ticking, vibration and the auto-clear live in <see cref="RestCoordinator"/>.
/// </summary>
public sealed class RestTimerBar : ContentView
{
    private readonly RestCoordinator _rest;
    private readonly Label _label;
    private readonly Button _extend;
    private readonly Button _skip;
    private readonly BoxView _fill;
    private readonly Grid _track;
    private bool _subscribed;

    public RestTimerBar()
    {
        _rest = ServiceHelper.Get<RestCoordinator>();
        _label = new Label { FontSize = 17, FontAttributes = FontAttributes.Bold, TextColor = Theme.Primary, VerticalOptions = LayoutOptions.Center };
        _extend = new Button { Text = "+30 s" };
        _extend.SetDynamicResource(StyleProperty, "SecondarySmall");
        _skip = new Button { Text = "Skip" };
        _skip.SetDynamicResource(StyleProperty, "GhostSmall");
        _extend.Clicked += (_, _) => _rest.Timer.Extend(30);
        _skip.Clicked += (_, _) => _rest.Timer.Clear();

        var row = new Grid
        {
            ColumnSpacing = 8,
            ColumnDefinitions = { new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Auto), new ColumnDefinition(GridLength.Auto) },
        };
        row.Add(_label, 0, 0);
        row.Add(_extend, 1, 0);
        row.Add(_skip, 2, 0);

        _fill = new BoxView { Color = Theme.Primary, HorizontalOptions = LayoutOptions.Start, CornerRadius = 0 };
        _track = new Grid { HeightRequest = 4, BackgroundColor = Theme.Border, Children = { _fill } };
        var trackBorder = new Border { StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 2 }, Content = _track };

        Content = new Border
        {
            BackgroundColor = Theme.PrimarySoft,
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            Padding = 12,
            Content = new VerticalStackLayout { Spacing = 8, Children = { row, trackBorder } },
        };
        IsVisible = false;
        _track.SizeChanged += (_, _) => Render();
        Loaded += (_, _) => Subscribe();
        Unloaded += (_, _) => Unsubscribe();
    }

    private void Subscribe()
    {
        if (_subscribed) return;
        _subscribed = true;
        _rest.Tick += Render;
        Render();
    }

    private void Unsubscribe()
    {
        if (!_subscribed) return;
        _subscribed = false;
        _rest.Tick -= Render;
    }

    private void Render()
    {
        var timer = _rest.Timer;
        if (timer.EndsAtMs is not { } endsAt)
        {
            IsVisible = false;
            return;
        }
        var now = Ids.NowMs();
        var over = now >= endsAt;
        if (over && now >= endsAt + RestCoordinator.OverMs)
        {
            IsVisible = false;
            return;
        }
        IsVisible = true;
        var left = Math.Min(Rest.RemainingSec(endsAt, now), timer.TotalSec);
        _label.Text = over ? "Rest over" : $"Rest · {Rest.FormatRest(left)}";
        _extend.IsVisible = !over;
        _skip.IsVisible = !over;
        var progress = Rest.RestProgress(endsAt, timer.TotalSec, now);
        if (_track.Width > 0) _fill.WidthRequest = _track.Width * Math.Clamp(progress, 0, 1);
    }
}
