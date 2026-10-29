using GymBuddy.Core;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

public enum FigureVariant { Thumb, Hero }

/// <summary>
/// Bundled demonstration photo(s) for an exercise, falling back to its pictogram (src/components/ExerciseFigure.tsx).
/// Thumb: one square photo; hero: start/end photos side by side at 4:3, or the pictogram + "No photo for this exercise".
/// </summary>
public sealed class ExerciseFigureView : ContentView
{
    public static readonly BindableProperty ExerciseProperty = BindableProperty.Create(
        nameof(Exercise), typeof(Exercise), typeof(ExerciseFigureView), null, propertyChanged: (b, _, _) => ((ExerciseFigureView)b).Build());

    public static readonly BindableProperty VariantProperty = BindableProperty.Create(
        nameof(Variant), typeof(FigureVariant), typeof(ExerciseFigureView), FigureVariant.Thumb, propertyChanged: (b, _, _) => ((ExerciseFigureView)b).Build());

    public static readonly BindableProperty SizeProperty = BindableProperty.Create(
        nameof(Size), typeof(double), typeof(ExerciseFigureView), 56.0, propertyChanged: (b, _, _) => ((ExerciseFigureView)b).Build());

    public Exercise? Exercise
    {
        get => (Exercise?)GetValue(ExerciseProperty);
        set => SetValue(ExerciseProperty, value);
    }

    public FigureVariant Variant
    {
        get => (FigureVariant)GetValue(VariantProperty);
        set => SetValue(VariantProperty, value);
    }

    /// <summary>Thumb edge length (default 56). Ignored for the hero.</summary>
    public double Size
    {
        get => (double)GetValue(SizeProperty);
        set => SetValue(SizeProperty, value);
    }

    private string? _builtFor;

    private void Build()
    {
        var ex = Exercise;
        var key = ex is null ? null : $"{ex.Id}|{ex.Pattern}|{string.Join(",", ex.Equipment)}|{Variant}|{Size}";
        if (key == _builtFor && Content is not null) return;
        _builtFor = key;
        if (ex is null)
        {
            Content = null;
            return;
        }
        Content = Variant == FigureVariant.Thumb ? BuildThumb(ex) : BuildHero(ex);
    }

    private View BuildThumb(Exercise ex)
    {
        var size = Size;
        View inner;
        var photos = ExercisePhotos.Paths(ex.Id);
        if (photos.Count > 0)
            inner = new Image { Source = ExercisePhotos.Source(photos[0]), Aspect = Aspect.AspectFill, WidthRequest = size, HeightRequest = size };
        else
            inner = new PictogramView { Exercise = ex, WidthRequest = size, HeightRequest = size };
        return new Border
        {
            WidthRequest = size,
            HeightRequest = size,
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            BackgroundColor = Theme.Background,
            Content = inner,
            VerticalOptions = LayoutOptions.Center,
            InputTransparent = true,
        };
    }

    private View BuildHero(Exercise ex)
    {
        var photos = ExercisePhotos.Paths(ex.Id);
        var box = new Border
        {
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            BackgroundColor = Theme.Background,
            Padding = 8,
        };
        if (photos.Count == 0)
        {
            box.Padding = new Thickness(8, 12);
            box.Content = new VerticalStackLayout
            {
                Spacing = 4,
                HorizontalOptions = LayoutOptions.Center,
                Children =
                {
                    new PictogramView { Exercise = ex, WidthRequest = 140, HeightRequest = 140, HorizontalOptions = LayoutOptions.Center },
                    new Label { Text = "No photo for this exercise", FontSize = 11, TextColor = Theme.Muted, HorizontalOptions = LayoutOptions.Center },
                },
            };
            return box;
        }

        var shown = photos.Take(2).ToList();
        var grid = new Grid { ColumnSpacing = 8 };
        var images = new List<Image>();
        for (var i = 0; i < shown.Count; i++)
        {
            grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Star));
            var image = new Image { Source = ExercisePhotos.Source(shown[i]), Aspect = Aspect.AspectFit, BackgroundColor = Theme.Card };
            images.Add(image);
            var cell = new VerticalStackLayout { Spacing = 4 };
            cell.Children.Add(new Border { StrokeThickness = 0, StrokeShape = new RoundRectangle { CornerRadius = 6 }, Content = image });
            if (shown.Count == 2)
                cell.Children.Add(new Label { Text = i == 0 ? "Start" : "End", FontSize = 11, TextColor = Theme.Muted, HorizontalOptions = LayoutOptions.Center });
            grid.Add(cell, i, 0);
        }
        if (shown.Count == 1) grid.WidthRequest = -1;
        // 4:3 photos: the height follows the measured column width.
        grid.SizeChanged += (_, _) =>
        {
            if (grid.Width <= 0) return;
            var colWidth = shown.Count == 2 ? (grid.Width - 8) / 2 : grid.Width * 0.72;
            foreach (var image in images) image.HeightRequest = Math.Round(colWidth * 3 / 4);
        };
        box.Content = grid;
        return box;
    }
}
