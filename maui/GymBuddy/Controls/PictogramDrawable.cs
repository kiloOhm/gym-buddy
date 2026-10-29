using GymBuddy.Core;
using GymBuddy.Core.Geometry;
using GymBuddy.Services;
using static GymBuddy.Core.Geometry.Pictogram;

namespace GymBuddy.Controls;

/// <summary>
/// Procedural stick-figure pictogram from movement pattern + equipment (drawing part of
/// src/components/ExercisePictogram.tsx; the poses come from Core's <see cref="Pictogram"/>). viewBox 0 0 100 100.
/// </summary>
public sealed class PictogramDrawable : IDrawable
{
    /// <summary>Figure colour: text at 85 % opacity over the thumbnail background (the SVG's group opacity).</summary>
    private static readonly Color Figure = BodyMapView.Mix(Theme.Background, Theme.Text, 0.85);

    public Exercise? Exercise { get; set; }

    public void Draw(ICanvas canvas, RectF dirtyRect)
    {
        var exercise = Exercise;
        if (exercise is null) return;
        var size = Math.Min(dirtyRect.Width, dirtyRect.Height);
        if (size <= 0) return;
        var glyph = GlyphFor(exercise.Equipment);
        var pose = PoseFor(exercise.Pattern, glyph);

        canvas.SaveState();
        canvas.Translate((dirtyRect.Width - size) / 2, (dirtyRect.Height - size) / 2);
        canvas.Scale(size / 100f, size / 100f);
        canvas.StrokeLineCap = LineCap.Round;
        canvas.StrokeLineJoin = LineJoin.Round;

        if (pose.Support is { } support)
        {
            canvas.StrokeColor = Theme.Muted;
            canvas.StrokeSize = 5;
            DrawSupport(canvas, support);
        }

        canvas.StrokeColor = Figure;
        canvas.StrokeSize = 6;
        foreach (var limb in pose.Limbs) Polyline(canvas, limb);
        canvas.FillColor = Figure;
        canvas.FillCircle(pose.Head.X, pose.Head.Y, 7);

        DrawGlyph(canvas, glyph, pose);
        canvas.RestoreState();
    }

    private static void Polyline(ICanvas canvas, IReadOnlyList<Pt> points)
    {
        if (points.Count < 2) return;
        var path = new PathF(points[0].X, points[0].Y);
        for (var i = 1; i < points.Count; i++) path.LineTo(points[i].X, points[i].Y);
        canvas.DrawPath(path);
    }

    private static void Line(ICanvas canvas, float x1, float y1, float x2, float y2, float? width = null)
    {
        if (width is { } w)
        {
            canvas.SaveState();
            canvas.StrokeSize = w;
            canvas.DrawLine(x1, y1, x2, y2);
            canvas.RestoreState();
        }
        else
        {
            canvas.DrawLine(x1, y1, x2, y2);
        }
    }

    private static void DrawSupport(ICanvas canvas, PoseSupport kind)
    {
        switch (kind)
        {
            case PoseSupport.Floor:
                Line(canvas, 6, 91, 94, 91);
                break;
            case PoseSupport.Seat:
                Line(canvas, 14, 73, 44, 73);
                Line(canvas, 28, 73, 28, 91, 3);
                break;
            default:
                BenchShape(canvas, 64);
                break;
        }
    }

    private static void BenchShape(ICanvas canvas, float y)
    {
        Line(canvas, 12, y, 88, y);
        Line(canvas, 22, y, 22, 91, 3);
        Line(canvas, 78, y, 78, 91, 3);
    }

    private static PathF Wave(Pt from, Pt to, int waves = 3, float amp = 4)
    {
        var (x0, y0) = (from.X, from.Y);
        var dx = (to.X - x0) / (waves * 2);
        var dy = (to.Y - y0) / (waves * 2);
        var len = MathF.Sqrt(dx * dx + dy * dy);
        if (len == 0) len = 1;
        var nx = -dy / len;
        var ny = dx / len;
        var path = new PathF(x0, y0);
        for (var i = 0; i < waves * 2; i++)
        {
            var s = i % 2 == 0 ? amp : -amp;
            var cx = x0 + dx * (i + 0.5f) + nx * s;
            var cy = y0 + dy * (i + 0.5f) + ny * s;
            path.QuadTo(cx, cy, x0 + dx * (i + 1), y0 + dy * (i + 1));
        }
        return path;
    }

    private static void Accent(ICanvas canvas, float width = 4)
    {
        canvas.StrokeColor = Theme.Primary;
        canvas.StrokeSize = width;
    }

    private static void MutedStroke(ICanvas canvas)
    {
        canvas.StrokeColor = Theme.Muted;
        canvas.StrokeSize = 3;
    }

    /// <summary>Equipment drawn in primary blue; frames and rails in muted grey.</summary>
    private static void DrawGlyph(ICanvas canvas, PictogramGlyph glyph, Pose pose)
    {
        var (bx, by) = (pose.Bar.X, pose.Bar.Y);
        var hand = pose.Hands.Count > 0 ? pose.Hands[0] : pose.Bar;
        var (hx, hy) = (hand.X, hand.Y);

        switch (glyph)
        {
            case PictogramGlyph.Barbell:
                Accent(canvas);
                Line(canvas, bx - 27, by, bx + 27, by);
                Line(canvas, bx - 22, by - 8, bx - 22, by + 8, 5);
                Line(canvas, bx + 22, by - 8, bx + 22, by + 8, 5);
                break;
            case PictogramGlyph.EzBar:
                Accent(canvas);
                Polyline(canvas, new[] { new Pt(bx - 22, by), new Pt(bx - 11, by), new Pt(bx - 6, by - 4), new Pt(bx, by), new Pt(bx + 6, by - 4), new Pt(bx + 11, by), new Pt(bx + 22, by) });
                Line(canvas, bx - 19, by - 6, bx - 19, by + 6, 5);
                Line(canvas, bx + 19, by - 6, bx + 19, by + 6, 5);
                break;
            case PictogramGlyph.SmithMachine:
                MutedStroke(canvas);
                Line(canvas, 8, 4, 8, 94);
                Line(canvas, 92, 4, 92, 94);
                Accent(canvas);
                Line(canvas, 8, by, 92, by);
                break;
            case PictogramGlyph.Rack:
                MutedStroke(canvas);
                Line(canvas, 10, 4, 10, 94);
                Line(canvas, 90, 4, 90, 94);
                Polyline(canvas, new[] { new Pt(10, by - 6), new Pt(15, by - 6), new Pt(15, by) });
                Polyline(canvas, new[] { new Pt(90, by - 6), new Pt(85, by - 6), new Pt(85, by) });
                Accent(canvas);
                Line(canvas, 15, by, 85, by);
                break;
            case PictogramGlyph.Dumbbell:
                Accent(canvas);
                foreach (var h in pose.Hands)
                {
                    Line(canvas, h.X - 7, h.Y, h.X + 7, h.Y);
                    Line(canvas, h.X - 7, h.Y - 5, h.X - 7, h.Y + 5, 5);
                    Line(canvas, h.X + 7, h.Y - 5, h.X + 7, h.Y + 5, 5);
                }
                break;
            case PictogramGlyph.Kettlebell:
            {
                Accent(canvas, 3);
                var handle = new PathF(hx - 5, hy + 3);
                handle.QuadTo(hx, hy - 6, hx + 5, hy + 3);
                canvas.DrawPath(handle);
                canvas.FillColor = Theme.Primary;
                canvas.FillCircle(hx, hy + 9, 7);
                break;
            }
            case PictogramGlyph.Cable:
            {
                var py = Math.Min(90, Math.Max(8, hy));
                MutedStroke(canvas);
                Line(canvas, 94, 4, 94, 94);
                Accent(canvas, 2);
                Line(canvas, 90, py, hx, hy);
                canvas.FillColor = Theme.Primary;
                canvas.FillCircle(90, py, 4);
                break;
            }
            case PictogramGlyph.Machine:
                MutedStroke(canvas);
                canvas.DrawRoundedRectangle(5, 5, 90, 88, 8);
                Accent(canvas, 5);
                Line(canvas, hx - 6, hy, hx + 6, hy);
                break;
            case PictogramGlyph.Band:
            {
                var to = hy < 70 ? new Pt(hx, 92) : new Pt(94, hy);
                Accent(canvas, 2.5f);
                canvas.DrawPath(Wave(new Pt(hx, hy), to));
                break;
            }
            case PictogramGlyph.PullUpBar:
            {
                var y = pose.Hands.Count > 0 ? pose.Hands.Min(h => h.Y) - 2 : by;
                Accent(canvas);
                Line(canvas, 14, y, 86, y);
                break;
            }
            case PictogramGlyph.DipStation:
            {
                var y = hy + 2;
                MutedStroke(canvas);
                Line(canvas, 24, y, 24, 94);
                Line(canvas, 80, y + 7, 80, 94);
                Accent(canvas, 3.5f);
                Line(canvas, 20, y, 76, y);
                Line(canvas, 26, y + 7, 84, y + 7);
                break;
            }
            case PictogramGlyph.Bench:
                canvas.StrokeColor = Theme.Muted;
                canvas.StrokeSize = 5;
                BenchShape(canvas, 72);
                break;
        }
    }
}

/// <summary>A GraphicsView showing an exercise's pictogram.</summary>
public sealed class PictogramView : GraphicsView
{
    private readonly PictogramDrawable _drawable = new();

    public PictogramView()
    {
        Drawable = _drawable;
        BackgroundColor = Colors.Transparent;
        InputTransparent = true;
    }

    public Exercise? Exercise
    {
        get => _drawable.Exercise;
        set
        {
            _drawable.Exercise = value;
            Invalidate();
        }
    }
}
