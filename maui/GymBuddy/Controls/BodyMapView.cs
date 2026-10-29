using GymBuddy.Core;
using GymBuddy.Core.Geometry;
using GymBuddy.Core.Logic;
using GymBuddy.Services;
using Microsoft.Maui.Controls.Shapes;

namespace GymBuddy.Controls;

/// <summary>How BodyMapView colours a value (src/components/BodyMap.tsx).</summary>
public enum BodyMapScale
{
    /// <summary>coverageLevel buckets (plans/sessions).</summary>
    Level,
    /// <summary>value / max of the given values (a single exercise's activation).</summary>
    Relative,
    /// <summary>loadLevel (weekly effective sets: untrained / low / good / over).</summary>
    Load,
}

/// <summary>Front + back muscle map; each region is filled by its value. Tapping a region raises <see cref="MusclePressed"/>.</summary>
public sealed class BodyMapView : ContentView
{
    public static readonly BindableProperty ValuesProperty = BindableProperty.Create(
        nameof(Values), typeof(IReadOnlyDictionary<MuscleGroup, double>), typeof(BodyMapView), null, propertyChanged: (b, _, _) => ((BodyMapView)b).Redraw());

    public static readonly BindableProperty MapScaleProperty = BindableProperty.Create(
        nameof(MapScale), typeof(BodyMapScale), typeof(BodyMapView), BodyMapScale.Level, propertyChanged: (b, _, _) => ((BodyMapView)b).OnScaleChanged());

    public static readonly BindableProperty SelectedProperty = BindableProperty.Create(
        nameof(Selected), typeof(MuscleGroup?), typeof(BodyMapView), null, propertyChanged: (b, _, _) => ((BodyMapView)b).Redraw());

    public static readonly BindableProperty TappableProperty = BindableProperty.Create(
        nameof(Tappable), typeof(bool), typeof(BodyMapView), false, propertyChanged: (b, _, n) => ((BodyMapView)b).SetTappable((bool)n));

    public IReadOnlyDictionary<MuscleGroup, double>? Values
    {
        get => (IReadOnlyDictionary<MuscleGroup, double>?)GetValue(ValuesProperty);
        set => SetValue(ValuesProperty, value);
    }

    public BodyMapScale MapScale
    {
        get => (BodyMapScale)GetValue(MapScaleProperty);
        set => SetValue(MapScaleProperty, value);
    }

    public MuscleGroup? Selected
    {
        get => (MuscleGroup?)GetValue(SelectedProperty);
        set => SetValue(SelectedProperty, value);
    }

    /// <summary>When true, taps on a region raise <see cref="MusclePressed"/>.</summary>
    public bool Tappable
    {
        get => (bool)GetValue(TappableProperty);
        set => SetValue(TappableProperty, value);
    }

    public event EventHandler<MuscleGroup>? MusclePressed;

    /// <summary>Height of each figure (default 260).</summary>
    public double MapHeight
    {
        get => _frontView.HeightRequest;
        set
        {
            _frontView.HeightRequest = value;
            _backView.HeightRequest = value;
        }
    }

    private readonly BodyDrawable _front;
    private readonly BodyDrawable _back;
    private readonly GraphicsView _frontView;
    private readonly GraphicsView _backView;
    private readonly HorizontalStackLayout _legend;

    public BodyMapView()
    {
        _front = new BodyDrawable(this, back: false);
        _back = new BodyDrawable(this, back: true);
        _frontView = new GraphicsView { Drawable = _front, HeightRequest = 260, BackgroundColor = Colors.Transparent };
        _backView = new GraphicsView { Drawable = _back, HeightRequest = 260, BackgroundColor = Colors.Transparent };
        _legend = new HorizontalStackLayout { Spacing = 12, HorizontalOptions = LayoutOptions.Center };

        var grid = new Grid { ColumnDefinitions = { new ColumnDefinition(GridLength.Star), new ColumnDefinition(GridLength.Star) } };
        grid.Add(Column(_frontView, "Front"), 0, 0);
        grid.Add(Column(_backView, "Back"), 1, 0);

        Content = new VerticalStackLayout { Spacing = 8, Children = { grid, _legend } };
        BuildLegend();
    }

    private static View Column(GraphicsView view, string label) => new VerticalStackLayout
    {
        Spacing = 4,
        Children =
        {
            view,
            new Label { Text = label, FontSize = 12, TextColor = Theme.Muted, HorizontalOptions = LayoutOptions.Center },
        },
    };

    private void OnScaleChanged()
    {
        BuildLegend();
        Redraw();
    }

    private void Redraw()
    {
        _frontView?.Invalidate();
        _backView?.Invalidate();
    }

    private bool _tapAttached;

    private void SetTappable(bool on)
    {
        if (!on || _tapAttached) return;
        _tapAttached = true;
        Attach(_frontView, _front);
        Attach(_backView, _back);
    }

    private void Attach(GraphicsView view, BodyDrawable drawable)
    {
        var tap = new TapGestureRecognizer();
        tap.Tapped += (_, e) =>
        {
            var p = e.GetPosition(view);
            if (p is null) return;
            var hit = drawable.HitTest((float)p.Value.X, (float)p.Value.Y, (float)view.Width, (float)view.Height);
            if (hit is { } m) MusclePressed?.Invoke(this, m);
        };
        view.GestureRecognizers.Add(tap);
    }

    private void BuildLegend()
    {
        if (_legend is null) return;
        _legend.Children.Clear();
        switch (MapScale)
        {
            case BodyMapScale.Level:
                foreach (var (color, label) in new[] { (Theme.CoverageNone, "none"), (Theme.CoverageLight, "light"), (Theme.CoverageModerate, "moderate"), (Theme.CoverageHigh, "high") })
                    _legend.Children.Add(LegendItem(color, label, dot: false));
                _legend.IsVisible = true;
                break;
            case BodyMapScale.Load:
                var items = new[] { (LoadColor(LoadLevel.None), "untrained"), (LoadColor(LoadLevel.Low), "low"), (LoadColor(LoadLevel.Good), "good"), (LoadColor(LoadLevel.High), "over") };
                for (var i = 0; i < items.Length; i++)
                    _legend.Children.Add(LegendItem(items[i].Item1, items[i].Item2, dot: i > 0));
                _legend.IsVisible = true;
                break;
            default:
                _legend.IsVisible = false;
                break;
        }
    }

    private static View LegendItem(Color color, string label, bool dot)
    {
        var row = new HorizontalStackLayout { Spacing = 4 };
        if (dot) row.Children.Add(new Label { Text = "·", FontSize = 12, TextColor = Theme.Muted, VerticalOptions = LayoutOptions.Center });
        row.Children.Add(new Border
        {
            WidthRequest = 12,
            HeightRequest = 12,
            BackgroundColor = color,
            StrokeThickness = 0,
            StrokeShape = new RoundRectangle { CornerRadius = 3 },
            VerticalOptions = LayoutOptions.Center,
        });
        row.Children.Add(new Label { Text = label, FontSize = 12, TextColor = Theme.Muted, VerticalOptions = LayoutOptions.Center });
        return row;
    }

    internal static Color LoadColor(LoadLevel level) => level switch
    {
        LoadLevel.Low => Theme.CoverageLight,
        LoadLevel.Good => Theme.CoverageModerate,
        LoadLevel.High => Theme.Danger,
        _ => Theme.CoverageNone,
    };

    internal Color FillFor(double value, double max)
    {
        if (MapScale == BodyMapScale.Load) return LoadColor(Load.LoadLevelFor(value));
        if (value <= 0) return Theme.CoverageNone;
        if (MapScale == BodyMapScale.Level)
        {
            return CoverageLogic.CoverageLevel(value) switch
            {
                CoverageLevel.Light => Theme.CoverageLight,
                CoverageLevel.Moderate => Theme.CoverageModerate,
                CoverageLevel.High => Theme.CoverageHigh,
                _ => Theme.CoverageNone,
            };
        }
        return Mix(Theme.CoverageLight, Theme.CoverageHigh, Math.Min(1, value / max));
    }

    /// <summary>Linear RGB mix rounded to whole channel values (mix() in BodyMap.tsx).</summary>
    internal static Color Mix(Color from, Color to, double t)
    {
        static int Channel(float a, float b, double t) => (int)Math.Round(a * 255 + (b * 255 - a * 255) * t, MidpointRounding.AwayFromZero);
        return Color.FromRgb(Channel(from.Red, to.Red, t), Channel(from.Green, to.Green, t), Channel(from.Blue, to.Blue, t));
    }

    private sealed class BodyDrawable : IDrawable
    {
        private static readonly Color OutlineFill = Color.FromArgb("#F7F8FA");
        private static readonly Lazy<PathF[]> OutlinePaths = new(() => BodyMapRegions.Outline.Select(ToPath).ToArray());
        private static readonly Dictionary<(MuscleGroup, bool), (Pt[] Poly, PathF Path)[]> RegionPaths = new();

        private readonly BodyMapView _owner;
        private readonly bool _back;

        public BodyDrawable(BodyMapView owner, bool back)
        {
            _owner = owner;
            _back = back;
        }

        private static PathF ToPath(Pt[] poly)
        {
            var path = new PathF();
            for (var i = 0; i < poly.Length; i++)
            {
                if (i == 0) path.MoveTo(poly[i].X, poly[i].Y);
                else path.LineTo(poly[i].X, poly[i].Y);
            }
            path.Close();
            return path;
        }

        private static (Pt[] Poly, PathF Path)[] Regions(MuscleGroup m, bool back)
        {
            lock (RegionPaths)
            {
                if (!RegionPaths.TryGetValue((m, back), out var list))
                {
                    var polys = BodyMapRegions.Regions.TryGetValue(m, out var region) ? (back ? region.Back : region.Front) : null;
                    list = (polys ?? Array.Empty<Pt[]>()).Select(p => (p, ToPath(p))).ToArray();
                    RegionPaths[(m, back)] = list;
                }
                return list;
            }
        }

        private static (float Scale, float Ox, float Oy) Fit(float w, float h)
        {
            var s = Math.Min(w / BodyMapRegions.ViewBoxWidth, h / BodyMapRegions.ViewBoxHeight);
            return (s, (w - BodyMapRegions.ViewBoxWidth * s) / 2, (h - BodyMapRegions.ViewBoxHeight * s) / 2);
        }

        /// <summary>Selected muscle last, so its thicker outline is not covered.</summary>
        private IEnumerable<MuscleGroup> Order()
        {
            var selected = _owner.Selected;
            return Muscles.All.Where(m => m != selected).Concat(selected is { } s ? new[] { s } : Array.Empty<MuscleGroup>());
        }

        public void Draw(ICanvas canvas, RectF dirtyRect)
        {
            var (s, ox, oy) = Fit(dirtyRect.Width, dirtyRect.Height);
            if (s <= 0) return;
            canvas.SaveState();
            canvas.Translate(ox, oy);
            canvas.Scale(s, s);
            canvas.StrokeLineJoin = LineJoin.Round;

            canvas.FillColor = OutlineFill;
            canvas.StrokeColor = Theme.Border;
            canvas.StrokeSize = 1;
            var head = BodyMapRegions.Head;
            canvas.FillEllipse(head.Cx - head.Rx, head.Cy - head.Ry, head.Rx * 2, head.Ry * 2);
            canvas.DrawEllipse(head.Cx - head.Rx, head.Cy - head.Ry, head.Rx * 2, head.Ry * 2);
            foreach (var path in OutlinePaths.Value)
            {
                canvas.FillPath(path);
                canvas.DrawPath(path);
            }

            var values = _owner.Values;
            double Value(MuscleGroup m) => values is not null && values.TryGetValue(m, out var v) ? v : 0;
            var max = Muscles.All.Select(Value).Append(0).Max();
            if (max <= 0) max = 1;
            var selected = _owner.Selected;
            foreach (var m in Order())
            {
                var fill = _owner.FillFor(Value(m), max);
                var isSelected = m == selected;
                foreach (var (_, path) in Regions(m, _back))
                {
                    canvas.FillColor = fill;
                    canvas.FillPath(path);
                    canvas.StrokeColor = isSelected ? Theme.Text : Theme.Card;
                    canvas.StrokeSize = isSelected ? 2.5f : 1;
                    canvas.DrawPath(path);
                }
            }
            canvas.RestoreState();
        }

        public MuscleGroup? HitTest(float x, float y, float w, float h)
        {
            var (s, ox, oy) = Fit(w, h);
            if (s <= 0) return null;
            var px = (x - ox) / s;
            var py = (y - oy) / s;
            foreach (var m in Order().Reverse())
                foreach (var (poly, _) in Regions(m, _back))
                    if (Contains(poly, px, py)) return m;
            return null;
        }

        private static bool Contains(Pt[] poly, float x, float y)
        {
            var inside = false;
            for (int i = 0, j = poly.Length - 1; i < poly.Length; j = i++)
            {
                var a = poly[i];
                var b = poly[j];
                if ((a.Y > y) != (b.Y > y) && x < (b.X - a.X) * (y - a.Y) / (b.Y - a.Y) + a.X)
                    inside = !inside;
            }
            return inside;
        }
    }
}
