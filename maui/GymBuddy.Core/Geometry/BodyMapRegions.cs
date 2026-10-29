using System.Globalization;

namespace GymBuddy.Core.Geometry;

public readonly record struct Pt(float X, float Y);

/// <summary>
/// Geometry for the BodyMap figure (src/components/bodyMapRegions.ts). Both views share the same 200 × 400
/// silhouette; every shape is defined for the figure's left half (x ≤ 100) and mirrored about x = 100 for the
/// right half. Polygons are returned as point arrays (left, then mirrored right); <see cref="PolygonPath"/> gives
/// the SVG path data of the TypeScript app.
/// </summary>
public static class BodyMapRegions
{
    public const float ViewBoxWidth = 200;
    public const float ViewBoxHeight = 400;

    /// <summary>Polygons of one muscle group per view (empty when the muscle is not visible in that view).</summary>
    public sealed record MuscleRegion(IReadOnlyList<Pt[]> Front, IReadOnlyList<Pt[]> Back);

    private static Pt[] P(params float[] xy)
    {
        var pts = new Pt[xy.Length / 2];
        for (var i = 0; i < pts.Length; i++) pts[i] = new Pt(xy[2 * i], xy[2 * i + 1]);
        return pts;
    }

    private static string Fmt(float n) =>
        Logic.JsMath.ToJsString(Logic.JsMath.Round(n * 10.0) / 10);

    /// <summary>Closed polygon path: "M x y L x y ... Z".</summary>
    public static string PolygonPath(Pt[] points) =>
        string.Join(" ", points.Select((p, i) => $"{(i == 0 ? "M" : "L")}{Fmt(p.X)} {Fmt(p.Y)}")) + " Z";

    public static Pt[] Mirror(Pt[] points) => points.Select(p => new Pt(ViewBoxWidth - p.X, p.Y)).ToArray();

    /// <summary>Left polygon + mirrored right polygon.</summary>
    private static IReadOnlyList<Pt[]> Pair(Pt[] points) => [points, Mirror(points)];

    private static readonly IReadOnlyList<Pt[]> None = [];

    // Left-half polygons. Shared vertices make neighbouring regions tile exactly.

    // Shoulder cap (deltoid) split: the outer sliver is the side delt in both views; the rest is the front delt
    // (front view) or rear delt (back view).
    private static readonly Pt[] SideDelt = P(56, 68, 48, 80, 48, 98, 54, 90);
    private static readonly Pt[] DeltCap = P(68, 65, 56, 68, 54, 90, 48, 98, 60, 104, 70, 96, 72, 72);

    private static readonly Pt[] UpperArm = P(48, 98, 60, 104, 70, 96, 66, 116, 62, 132, 46, 132);
    private static readonly Pt[] Forearm = P(46, 132, 62, 132, 60, 150, 54, 190, 40, 190, 43, 150);
    private static readonly Pt[] LowerLeg = P(72, 288, 90, 288, 90, 310, 86, 350, 80, 362, 76, 362, 72, 340, 70, 310);

    // Front view
    private static readonly Pt[] TrapsFront = P(91, 50, 91, 62, 68, 65, 80, 57);
    private static readonly Pt[] Chest = P(100, 63, 91, 62, 68, 65, 72, 72, 70, 96, 80, 105, 88, 107, 100, 106);
    private static readonly Pt[] Obliques = P(70, 96, 80, 105, 88, 107, 88, 168, 76, 172, 77, 150, 74, 125);
    private static readonly Pt[] Abs = P(88, 107, 100, 106, 100, 182, 90, 178, 88, 168);
    private static readonly Pt[] HipFlexors = P(76, 172, 88, 168, 90, 178, 94, 192, 84, 200, 72, 184);
    private static readonly Pt[] AdductorsFront = P(90, 178, 100, 182, 100, 202, 97, 212, 94, 240, 88, 220, 84, 200, 94, 192);
    private static readonly Pt[] Quads = P(72, 184, 84, 200, 88, 220, 94, 240, 92, 272, 86, 282, 76, 282, 70, 270, 67, 240, 68, 205);

    // Back view
    private static readonly Pt[] TrapsBack = P(100, 52, 91, 50, 80, 57, 68, 65, 72, 72, 84, 76, 100, 92);
    private static readonly Pt[] UpperBack = P(72, 72, 84, 76, 100, 92, 100, 124, 88, 118, 76, 104, 70, 96);
    private static readonly Pt[] Lats = P(70, 96, 76, 104, 88, 118, 100, 124, 100, 140, 88, 150, 77, 150, 74, 125);
    private static readonly Pt[] LowerBack = P(77, 150, 88, 150, 100, 140, 100, 178, 76, 172);
    private static readonly Pt[] Glutes = P(76, 172, 100, 178, 100, 202, 97, 212, 84, 216, 68, 205, 72, 184);
    private static readonly Pt[] AdductorsBack = P(84, 216, 97, 212, 94, 240, 93, 256, 88, 240);
    private static readonly Pt[] Hamstrings = P(68, 205, 84, 216, 88, 240, 93, 256, 92, 272, 86, 282, 76, 282, 70, 270, 67, 240);

    /// <summary>Polygons per muscle group and view (left + mirrored right), in canonical muscle order.</summary>
    public static readonly IReadOnlyDictionary<MuscleGroup, MuscleRegion> Regions = new Dictionary<MuscleGroup, MuscleRegion>
    {
        [MuscleGroup.Chest] = new(Pair(Chest), None),
        [MuscleGroup.FrontDelts] = new(Pair(DeltCap), None),
        [MuscleGroup.SideDelts] = new(Pair(SideDelt), Pair(SideDelt)),
        [MuscleGroup.RearDelts] = new(None, Pair(DeltCap)),
        [MuscleGroup.Lats] = new(None, Pair(Lats)),
        [MuscleGroup.UpperBack] = new(None, Pair(UpperBack)),
        [MuscleGroup.Traps] = new(Pair(TrapsFront), Pair(TrapsBack)),
        [MuscleGroup.LowerBack] = new(None, Pair(LowerBack)),
        [MuscleGroup.Biceps] = new(Pair(UpperArm), None),
        [MuscleGroup.Triceps] = new(None, Pair(UpperArm)),
        [MuscleGroup.Forearms] = new(Pair(Forearm), Pair(Forearm)),
        [MuscleGroup.Abs] = new(Pair(Abs), None),
        [MuscleGroup.Obliques] = new(Pair(Obliques), None),
        [MuscleGroup.Quads] = new(Pair(Quads), None),
        [MuscleGroup.Hamstrings] = new(None, Pair(Hamstrings)),
        [MuscleGroup.Glutes] = new(None, Pair(Glutes)),
        [MuscleGroup.Adductors] = new(Pair(AdductorsFront), Pair(AdductorsBack)),
        [MuscleGroup.HipFlexors] = new(Pair(HipFlexors), None),
        [MuscleGroup.Calves] = new(Pair(LowerLeg), Pair(LowerLeg)),
    };

    // Unassigned silhouette drawn underneath the regions (same for both views).

    private static readonly Pt[] TorsoLegLeft = P(
        100, 50, 91, 50, 80, 57, 68, 65, 72, 72, 70, 96, 74, 125, 77, 150, 76, 172,
        72, 184, 68, 205, 67, 240, 70, 270, 72, 288, 70, 310, 72, 340, 76, 362,
        80, 362, 86, 350, 90, 310, 90, 288, 92, 272, 94, 240, 97, 212, 100, 202);
    private static readonly Pt[] Arm = P(
        68, 65, 56, 68, 48, 80, 48, 98, 46, 132, 43, 150, 40, 190,
        54, 190, 60, 150, 62, 132, 66, 116, 70, 96, 72, 72);
    private static readonly Pt[] Hand = P(40, 190, 54, 190, 55, 202, 50, 213, 42, 213, 37, 203);
    private static readonly Pt[] Foot = P(74, 358, 86, 354, 88, 372, 86, 384, 68, 384, 68, 377);
    private static readonly Pt[] Neck = P(92, 40, 92, 56, 100, 58);

    private static Pt[] Closed(Pt[] left) => [.. left, .. Mirror(left).Reverse()];

    /// <summary>Non-muscle outline polygons: torso/legs (closed), arms ×2, hands ×2, feet ×2, neck.</summary>
    public static readonly IReadOnlyList<Pt[]> Outline =
    [
        Closed(TorsoLegLeft),
        .. Pair(Arm),
        .. Pair(Hand),
        .. Pair(Foot),
        Closed(Neck),
    ];

    /// <summary>Head ellipse.</summary>
    public static readonly (float Cx, float Cy, float Rx, float Ry) Head = (100, 28, 15, 19);

    /// <summary>Point-in-polygon (even-odd ray casting) in viewBox coordinates, for tap hit-testing.</summary>
    public static bool Contains(Pt[] polygon, Pt p)
    {
        var inside = false;
        for (int i = 0, j = polygon.Length - 1; i < polygon.Length; j = i++)
        {
            var a = polygon[i];
            var b = polygon[j];
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
        }
        return inside;
    }

    /// <summary>The muscle whose polygon in the given view contains the point, if any.</summary>
    public static MuscleGroup? HitTest(Pt p, bool back)
    {
        foreach (var (muscle, region) in Regions)
            foreach (var poly in back ? region.Back : region.Front)
                if (Contains(poly, p)) return muscle;
        return null;
    }
}
