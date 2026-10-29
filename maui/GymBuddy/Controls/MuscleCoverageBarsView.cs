using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>One horizontal bar per muscle group, strongest first (src/components/MuscleCoverageBars.tsx).</summary>
public sealed class MuscleCoverageBarsView : ContentView
{
    public static readonly BindableProperty ValuesProperty = BindableProperty.Create(
        nameof(Values), typeof(IReadOnlyDictionary<MuscleGroup, double>), typeof(MuscleCoverageBarsView), null, propertyChanged: (b, _, _) => ((MuscleCoverageBarsView)b).Build());

    public IReadOnlyDictionary<MuscleGroup, double>? Values
    {
        get => (IReadOnlyDictionary<MuscleGroup, double>?)GetValue(ValuesProperty);
        set => SetValue(ValuesProperty, value);
    }

    public MuscleCoverageBarsView() => Build();

    private void Build()
    {
        var values = Values;
        var rows = Muscles.All
            .Select(m => (Muscle: m, Value: values is not null && values.TryGetValue(m, out var v) ? v : 0))
            .Where(r => r.Value > 0)
            .OrderByDescending(r => r.Value) // stable, like Array.prototype.sort
            .ToList();
        if (rows.Count == 0)
        {
            Content = new Label { Text = "No muscles targeted yet.", FontSize = 14, TextColor = Theme.Muted };
            return;
        }
        var max = Math.Max(1, rows.Max(r => r.Value));
        var list = new VerticalStackLayout { Spacing = 8 };
        foreach (var (muscle, value) in rows)
        {
            var color = CoverageLogic.CoverageLevel(value) switch
            {
                CoverageLevel.Light => Theme.CoverageLight,
                CoverageLevel.Moderate => Theme.CoverageModerate,
                CoverageLevel.High => Theme.CoverageHigh,
                _ => Theme.CoverageNone,
            };
            var fraction = Math.Round(value / max * 100) / 100;
            var track = new Grid
            {
                HeightRequest = 10,
                VerticalOptions = LayoutOptions.Center,
                ColumnDefinitions =
                {
                    new ColumnDefinition(new GridLength(Math.Max(fraction, 0.0001), GridUnitType.Star)),
                    new ColumnDefinition(new GridLength(Math.Max(1 - fraction, 0.0001), GridUnitType.Star)),
                },
            };
            var trackBg = new Border { BackgroundColor = Theme.CoverageNone, StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 6 } };
            track.Add(trackBg, 0, 0);
            Grid.SetColumnSpan(trackBg, 2);
            track.Add(new Border { BackgroundColor = color, StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 6 } }, 0, 0);

            var row = new Grid
            {
                ColumnSpacing = 8,
                ColumnDefinitions = { new ColumnDefinition(92), new ColumnDefinition(GridLength.Star), new ColumnDefinition(32) },
            };
            row.Add(new Label { Text = muscle.Label(), FontSize = 13, LineBreakMode = LineBreakMode.TailTruncation, MaxLines = 1, VerticalOptions = LayoutOptions.Center }, 0, 0);
            row.Add(track, 1, 0);
            row.Add(new Label { Text = value.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture), FontSize = 12, TextColor = Theme.Muted, HorizontalTextAlignment = TextAlignment.End, VerticalOptions = LayoutOptions.Center }, 2, 0);
            list.Children.Add(row);
        }
        Content = list;
    }
}
