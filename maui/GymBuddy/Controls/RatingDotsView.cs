using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>Label + five dots filled up to the value and coloured by difficulty (RatingDots / MiniRating).</summary>
public sealed class RatingDotsView : ContentView
{
    public static readonly BindableProperty ValueProperty = BindableProperty.Create(
        nameof(Value), typeof(int), typeof(RatingDotsView), 0, propertyChanged: (b, _, _) => ((RatingDotsView)b).Build());

    public static readonly BindableProperty LabelProperty = BindableProperty.Create(
        nameof(Label), typeof(string), typeof(RatingDotsView), "Difficulty", propertyChanged: (b, _, _) => ((RatingDotsView)b).Build());

    public static readonly BindableProperty MiniProperty = BindableProperty.Create(
        nameof(Mini), typeof(bool), typeof(RatingDotsView), false, propertyChanged: (b, _, _) => ((RatingDotsView)b).Build());

    public int Value { get => (int)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }
    public string Label { get => (string)GetValue(LabelProperty); set => SetValue(LabelProperty, value); }
    /// <summary>Compact variant for list rows (11 pt label, 6 px dots).</summary>
    public bool Mini { get => (bool)GetValue(MiniProperty); set => SetValue(MiniProperty, value); }

    public RatingDotsView() => Build();

    private void Build()
    {
        var fill = Theme.DifficultyColor(Value);
        var dotSize = Mini ? 6 : 10;
        var dots = new HorizontalStackLayout { Spacing = Mini ? 2 : 4, VerticalOptions = LayoutOptions.Center };
        for (var i = 1; i <= 5; i++)
        {
            dots.Children.Add(new Ellipse
            {
                WidthRequest = dotSize,
                HeightRequest = dotSize,
                Fill = new SolidColorBrush(i <= Value ? fill : Theme.Border),
                StrokeThickness = 0,
            });
        }
        var label = new Microsoft.Maui.Controls.Label { Text = Label, FontSize = Mini ? 11 : 13, TextColor = Theme.Muted, VerticalOptions = LayoutOptions.Center };
        SemanticProperties.SetDescription(this, $"{Label} {Value} of 5");
        if (Mini)
        {
            Content = new HorizontalStackLayout { Spacing = 6, Children = { label, dots } };
        }
        else
        {
            var grid = new Grid { ColumnDefinitions = { new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Auto) }, ColumnSpacing = 8 };
            grid.Add(label, 0, 0);
            grid.Add(dots, 1, 0);
            Content = grid;
        }
    }
}
