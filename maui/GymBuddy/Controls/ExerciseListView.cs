using GymBuddy.Core;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>
/// Searchable, filterable list of exercises (src/components/ExerciseList.tsx): search box, muscle chips, equipment
/// chips, count, rows with thumb + name + "Pattern · Equipment" + mini difficulty dots.
/// </summary>
public sealed class ExerciseListView : ContentView
{
    private readonly CollectionView _list;
    private readonly Entry _search;
    private readonly Label _count;
    private readonly HorizontalStackLayout _muscleChips;
    private readonly HorizontalStackLayout _equipmentChips;
    private IReadOnlyList<Exercise> _exercises = Array.Empty<Exercise>();
    private MuscleGroup? _muscle;
    private Equipment? _equipment;

    public event EventHandler<Exercise>? ExercisePressed;

    public ExerciseListView()
    {
        _search = new Entry { Placeholder = "Search exercises", IsSpellCheckEnabled = false, IsTextPredictionEnabled = false, ClearButtonVisibility = ClearButtonVisibility.WhileEditing };
        _search.TextChanged += (_, _) => ScheduleApply();
        var searchBox = new Border { Content = _search };
        searchBox.SetDynamicResource(StyleProperty, "InputBox");

        _muscleChips = new HorizontalStackLayout { Spacing = 8, Padding = new Thickness(0, 4) };
        _equipmentChips = new HorizontalStackLayout { Spacing = 8, Padding = new Thickness(0, 4) };
        _count = new Label { FontSize = 13, TextColor = Theme.Muted };

        var header = new VerticalStackLayout
        {
            Spacing = 8,
            Padding = new Thickness(16, 16, 16, 12),
            Children =
            {
                searchBox,
                new ScrollView { Orientation = ScrollOrientation.Horizontal, HorizontalScrollBarVisibility = ScrollBarVisibility.Never, Content = _muscleChips },
                new ScrollView { Orientation = ScrollOrientation.Horizontal, HorizontalScrollBarVisibility = ScrollBarVisibility.Never, Content = _equipmentChips },
                _count,
            },
        };

        _list = new CollectionView
        {
            Header = header,
            Footer = new BoxView { HeightRequest = 48, Color = Colors.Transparent },
            SelectionMode = SelectionMode.None,
            ItemsLayout = new LinearItemsLayout(ItemsLayoutOrientation.Vertical) { ItemSpacing = 8 },
            EmptyView = new Label { Text = "No exercises match these filters.", TextColor = Theme.Muted, HorizontalTextAlignment = TextAlignment.Center, Margin = new Thickness(16, 24) },
            ItemTemplate = new DataTemplate(BuildRow),
        };
        Content = _list;
        BuildChips();
    }

    public IReadOnlyList<Exercise> Exercises
    {
        get => _exercises;
        set
        {
            _exercises = value;
            Apply();
        }
    }

    private View BuildRow()
    {
        var figure = new ExerciseFigureView { Variant = FigureVariant.Thumb, Size = 56 };
        figure.SetBinding(ExerciseFigureView.ExerciseProperty, ".");
        var name = new Label { FontSize = 15, FontAttributes = FontAttributes.Bold, MaxLines = 1, LineBreakMode = LineBreakMode.TailTruncation };
        name.SetBinding(Label.TextProperty, nameof(Exercise.Name));
        var meta = new Label { FontSize = 13, TextColor = Theme.Muted, MaxLines = 1, LineBreakMode = LineBreakMode.TailTruncation };
        meta.SetBinding(Label.TextProperty, new Binding(".", converter: new FuncConverter(o => o is Exercise ex ? $"{ex.Pattern.Label()} · {Format.EquipmentSummary(ex)}" : "")));
        var rating = new RatingDotsView { Mini = true, VerticalOptions = LayoutOptions.Center };
        rating.SetBinding(RatingDotsView.ValueProperty, nameof(Exercise.Difficulty));

        var grid = new Grid
        {
            ColumnSpacing = 12,
            ColumnDefinitions = { new ColumnDefinition(GridLength.Auto), new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Auto) },
        };
        grid.Add(figure, 0, 0);
        grid.Add(new VerticalStackLayout { Spacing = 2, VerticalOptions = LayoutOptions.Center, Children = { name, meta } }, 1, 0);
        grid.Add(rating, 2, 0);

        var card = new Border
        {
            BackgroundColor = Theme.Card,
            Stroke = Theme.Border,
            StrokeThickness = 1,
            StrokeShape = new RoundRectangle { CornerRadius = 14 },
            Padding = new Thickness(8, 8, 16, 8),
            MinimumHeightRequest = 56,
            Margin = new Thickness(16, 0),
            Content = grid,
        };
        var tap = new TapGestureRecognizer();
        tap.Tapped += (s, _) =>
        {
            if (((BindableObject)s!).BindingContext is Exercise ex) ExercisePressed?.Invoke(this, ex);
        };
        card.GestureRecognizers.Add(tap);
        return card;
    }

    private void BuildChips()
    {
        _muscleChips.Children.Clear();
        _muscleChips.Children.Add(Chip("All muscles", _muscle is null, () => { _muscle = null; ChipsChanged(); }));
        foreach (var m in Muscles.All)
            _muscleChips.Children.Add(Chip(m.Label(), _muscle == m, () => { _muscle = _muscle == m ? null : m; ChipsChanged(); }));

        _equipmentChips.Children.Clear();
        _equipmentChips.Children.Add(Chip("All equipment", _equipment is null, () => { _equipment = null; ChipsChanged(); }));
        foreach (var e in Equipments.All)
            _equipmentChips.Children.Add(Chip(e.Label(), _equipment == e, () => { _equipment = _equipment == e ? null : e; ChipsChanged(); }));
    }

    private void ChipsChanged()
    {
        // Restyle in place so the horizontal scroll positions are kept.
        var i = 0;
        foreach (var child in _muscleChips.Children.OfType<Border>())
        {
            StyleChip(child, i == 0 ? _muscle is null : _muscle == Muscles.All[i - 1]);
            i++;
        }
        i = 0;
        foreach (var child in _equipmentChips.Children.OfType<Border>())
        {
            StyleChip(child, i == 0 ? _equipment is null : _equipment == Equipments.All[i - 1]);
            i++;
        }
        Apply();
    }

    private static Border Chip(string label, bool active, Action onTap)
    {
        var chip = new Border
        {
            StrokeThickness = 1,
            StrokeShape = new RoundRectangle { CornerRadius = 18 },
            Padding = new Thickness(12, 0),
            MinimumHeightRequest = 36,
            HeightRequest = 36,
            Content = new Label { Text = label, FontSize = 13, VerticalOptions = LayoutOptions.Center },
        };
        StyleChip(chip, active);
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, _) => onTap();
        chip.GestureRecognizers.Add(tap);
        return chip;
    }

    private static void StyleChip(Border chip, bool active)
    {
        chip.BackgroundColor = active ? Theme.Primary : Theme.Card;
        chip.Stroke = active ? Theme.Primary : Theme.Border;
        if (chip.Content is Label l)
        {
            l.TextColor = active ? Colors.White : Theme.Text;
            l.FontAttributes = active ? FontAttributes.Bold : FontAttributes.None;
        }
    }

    private CancellationTokenSource? _debounce;

    /// <summary>Filters 150 ms after the last keystroke so typing stays responsive.</summary>
    private async void ScheduleApply()
    {
        _debounce?.Cancel();
        var cts = _debounce = new CancellationTokenSource();
        try
        {
            await Task.Delay(150, cts.Token);
        }
        catch (TaskCanceledException)
        {
            return;
        }
        Apply();
    }

    private void Apply()
    {
        var q = (_search?.Text ?? "").Trim().ToLowerInvariant();
        var filtered = _exercises.Where(ex =>
        {
            if (q.Length > 0 && !ex.Name.ToLowerInvariant().Contains(q)) return false;
            if (_muscle is { } m && ex.Activation(m) < 0.5) return false;
            if (_equipment is { } e && !ex.Equipment.Contains(e)) return false;
            return true;
        }).ToList();
        _count.Text = $"{filtered.Count} exercise{(filtered.Count == 1 ? "" : "s")}";
        _list.ItemsSource = filtered;
    }
}
