using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>
/// The Home screen's weekly load hints (LoadHints/HintBox in src/app/(tabs)/index.tsx): collapsible tinted boxes
/// "Overtraining risk" (open by default), "Not trained this week", "Under-trained", each with "Try: …" links.
/// </summary>
public sealed class LoadHintsView : ContentView
{
    public static readonly BindableProperty HintsProperty = BindableProperty.Create(
        nameof(Hints), typeof(IReadOnlyList<LoadHint>), typeof(LoadHintsView), null, propertyChanged: (b, _, _) => ((LoadHintsView)b).Build());

    public IReadOnlyList<LoadHint>? Hints
    {
        get => (IReadOnlyList<LoadHint>?)GetValue(HintsProperty);
        set => SetValue(HintsProperty, value);
    }

    private readonly Dictionary<string, bool> _open = new() { ["high"] = true, ["none"] = false, ["low"] = false };

    private void Build()
    {
        var hints = Hints ?? Array.Empty<LoadHint>();
        if (hints.Count == 0)
        {
            Content = new Label { Text = "Balanced week — nothing to flag.", FontSize = 15, FontAttributes = FontAttributes.Bold, TextColor = Theme.Success };
            return;
        }
        var high = hints.Where(h => h.Level == LoadLevel.High).ToList();
        var none = hints.Where(h => h.Level == LoadLevel.None).ToList();
        var low = hints.Where(h => h.Level == LoadLevel.Low).ToList();
        var stack = new VerticalStackLayout { Spacing = 8 };
        if (high.Count > 0)
        {
            var items = high.Select(h => (View)new Label
            {
                Text = $"{h.Muscle.Label()} · {Format.Sets(h.EffectiveSets)} effective sets this week (over {Load.HighThreshold})",
            }).ToList();
            items.Add(new Label { Text = "Give these a lighter session or an extra rest day.", FontSize = 13, TextColor = Theme.Muted });
            stack.Children.Add(Box("high", "Overtraining risk", high.Count, Theme.DangerSoft, items));
        }
        if (none.Count > 0)
        {
            stack.Children.Add(Box("none", "Not trained this week", none.Count, Theme.WarningSoft,
                none.Select(h => Item(h.Muscle.Label(), h)).ToList()));
        }
        if (low.Count > 0)
        {
            stack.Children.Add(Box("low", "Under-trained", low.Count, Theme.PrimarySoft,
                low.Select(h => Item($"{h.Muscle.Label()} · {Format.Sets(h.EffectiveSets)} effective sets", h)).ToList()));
        }
        Content = stack;
    }

    private static View Item(string title, LoadHint hint)
    {
        var stack = new VerticalStackLayout { Spacing = 2, Children = { new Label { Text = title } } };
        if (hint.Suggestions.Count > 0)
        {
            var text = new FormattedString();
            text.Spans.Add(new Span { Text = "Try: " });
            for (var i = 0; i < hint.Suggestions.Count; i++)
            {
                var ex = hint.Suggestions[i];
                if (i > 0) text.Spans.Add(new Span { Text = ", " });
                var link = new Span { Text = ex.Name, TextColor = Theme.Primary, FontAttributes = FontAttributes.Bold };
                var tap = new TapGestureRecognizer();
                tap.Tapped += async (_, _) => await Nav.PushAsync("exercise", "id", ex.Id);
                link.GestureRecognizers.Add(tap);
                text.Spans.Add(link);
            }
            stack.Children.Add(new Label { FormattedText = text, FontSize = 13, TextColor = Theme.Muted });
        }
        return stack;
    }

    private View Box(string key, string title, int count, Color background, IReadOnlyList<View> children)
    {
        var open = _open[key];
        var body = new VerticalStackLayout { Spacing = 8, IsVisible = open };
        foreach (var c in children) body.Children.Add(c);
        var chevron = new Label { FontFamily = Icons.FontFamily, Text = open ? Icons.ChevronUp : Icons.ChevronDown, FontSize = 20, VerticalOptions = LayoutOptions.Center };
        var header = new Grid
        {
            MinimumHeightRequest = 44,
            ColumnDefinitions = { new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Auto) },
        };
        header.Add(new Label { Text = $"{title} ({count})", FontSize = 15, FontAttributes = FontAttributes.Bold, VerticalOptions = LayoutOptions.Center }, 0, 0);
        header.Add(chevron, 1, 0);
        SemanticProperties.SetDescription(header, $"{title}, {count} muscle groups");
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) =>
        {
            _open[key] = !_open[key];
            body.IsVisible = _open[key];
            chevron.Text = _open[key] ? Icons.ChevronUp : Icons.ChevronDown;
        };
        header.GestureRecognizers.Add(tap);
        return new Border
        {
            BackgroundColor = background,
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 10 },
            Padding = 12,
            Content = new VerticalStackLayout { Spacing = 8, Children = { header, body } },
        };
    }
}
