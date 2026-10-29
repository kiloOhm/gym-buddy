namespace GymBuddy.Core.Geometry;

/// <summary>Equipment glyph drawn next to the figure; None for bodyweight-only exercises (= Equipment minus Bodyweight).</summary>
public enum PictogramGlyph
{
    None,
    Barbell,
    Dumbbell,
    Kettlebell,
    Cable,
    Machine,
    SmithMachine,
    EzBar,
    Band,
    Bench,
    Rack,
    PullUpBar,
    DipStation,
}

/// <summary>Muted furniture that is part of a pose.</summary>
public enum PoseSupport { Bench, Floor, Seat }

/// <param name="Head">Head centre (radius 7).</param>
/// <param name="Limbs">Polylines for torso, arms, legs.</param>
/// <param name="Hands">Hand positions (1–2); dumbbells / handles are drawn here.</param>
/// <param name="Bar">Centre of a long bar (barbell, EZ bar, Smith bar).</param>
/// <param name="Support">Furniture that is part of the pose itself.</param>
public sealed record Pose(Pt Head, IReadOnlyList<Pt[]> Limbs, IReadOnlyList<Pt> Hands, Pt Bar, PoseSupport? Support);

/// <summary>
/// Procedural stick-figure pictogram data from movement pattern + equipment (src/components/ExercisePictogram.tsx).
/// Poses use a 0..100 viewBox, y down, floor at ~90. Drawing happens in the app.
/// </summary>
public static class Pictogram
{
    /// <summary>
    /// Which equipment item wins when an exercise lists several (e.g. dumbbell + bench → dumbbell). Apparatus that
    /// fixes the body position wins, then the load the hands hold; bands and benches come last.
    /// </summary>
    public static readonly IReadOnlyList<PictogramGlyph> GlyphPriority =
    [
        PictogramGlyph.SmithMachine,
        PictogramGlyph.Rack,
        PictogramGlyph.PullUpBar,
        PictogramGlyph.DipStation,
        PictogramGlyph.Barbell,
        PictogramGlyph.EzBar,
        PictogramGlyph.Dumbbell,
        PictogramGlyph.Kettlebell,
        PictogramGlyph.Cable,
        PictogramGlyph.Machine,
        PictogramGlyph.Band,
        PictogramGlyph.Bench,
    ];

    /// <summary>The glyph for an equipment item (None for Bodyweight).</summary>
    public static PictogramGlyph GlyphOf(Equipment e) => e switch
    {
        Equipment.Barbell => PictogramGlyph.Barbell,
        Equipment.Dumbbell => PictogramGlyph.Dumbbell,
        Equipment.Kettlebell => PictogramGlyph.Kettlebell,
        Equipment.Cable => PictogramGlyph.Cable,
        Equipment.Machine => PictogramGlyph.Machine,
        Equipment.SmithMachine => PictogramGlyph.SmithMachine,
        Equipment.EzBar => PictogramGlyph.EzBar,
        Equipment.Band => PictogramGlyph.Band,
        Equipment.Bench => PictogramGlyph.Bench,
        Equipment.Rack => PictogramGlyph.Rack,
        Equipment.PullUpBar => PictogramGlyph.PullUpBar,
        Equipment.DipStation => PictogramGlyph.DipStation,
        _ => PictogramGlyph.None,
    };

    /// <summary>"none", or the equipment slug ("ez_bar", "pull_up_bar", …).</summary>
    public static string Slug(this PictogramGlyph glyph)
    {
        if (glyph == PictogramGlyph.None) return "none";
        var e = Equipments.All.First(x => GlyphOf(x) == glyph);
        return e.Slug();
    }

    public static PictogramGlyph GlyphFor(IReadOnlyList<Equipment> equipment)
    {
        foreach (var g in GlyphPriority)
            if (equipment.Any(e => GlyphOf(e) == g)) return g;
        return PictogramGlyph.None;
    }

    /// <summary>"pattern:glyph", e.g. "squat:barbell". Identifies the rendered variant.</summary>
    public static string Variant(MovementPattern pattern, IReadOnlyList<Equipment> equipment) =>
        $"{pattern.Slug()}:{GlyphFor(equipment).Slug()}";

    public static string Variant(Exercise exercise) => Variant(exercise.Pattern, exercise.Equipment);

    private static Pt[] L(params float[] xy)
    {
        var pts = new Pt[xy.Length / 2];
        for (var i = 0; i < pts.Length; i++) pts[i] = new Pt(xy[2 * i], xy[2 * i + 1]);
        return pts;
    }

    private static Pose MakePose(Pt head, Pt[][] limbs, Pt[] hands, Pt bar, PoseSupport? support = null) => new(head, limbs, hands, bar, support);

    private static Pt Pt(float x, float y) => new(x, y);

    /// <summary>The named poses (keys as in the TypeScript POSES object).</summary>
    public static readonly IReadOnlyDictionary<string, Pose> Poses = new Dictionary<string, Pose>(StringComparer.Ordinal)
    {
        ["vertical_push"] = MakePose(Pt(50, 22),
            [L(50, 31, 50, 62), L(50, 36, 36, 26, 34, 10), L(50, 36, 64, 26, 66, 10), L(50, 62, 42, 92), L(50, 62, 58, 92)],
            [Pt(34, 10), Pt(66, 10)], Pt(50, 10)),
        ["bench"] = MakePose(Pt(18, 52),
            [L(27, 56, 62, 56), L(32, 56, 32, 24), L(62, 56, 76, 68, 76, 90)],
            [Pt(32, 24)], Pt(32, 22), PoseSupport.Bench),
        ["pushup"] = MakePose(Pt(18, 52),
            [L(26, 57, 88, 84), L(30, 58, 30, 88)],
            [Pt(30, 88)], Pt(30, 88), PoseSupport.Floor),
        ["standPress"] = MakePose(Pt(38, 16),
            [L(38, 25, 38, 58), L(38, 30, 56, 36, 74, 34), L(38, 58, 30, 90), L(38, 58, 48, 90)],
            [Pt(74, 34)], Pt(74, 34)),
        ["bentRow"] = MakePose(Pt(22, 38),
            [L(30, 42, 62, 46), L(34, 44, 38, 58, 40, 68), L(62, 46, 58, 68, 62, 90), L(62, 46, 68, 68, 72, 90)],
            [Pt(40, 68)], Pt(40, 70)),
        ["seatedRow"] = MakePose(Pt(30, 30),
            [L(30, 39, 30, 66), L(30, 44, 46, 54, 62, 48), L(30, 66, 58, 66, 70, 80)],
            [Pt(62, 48)], Pt(62, 48), PoseSupport.Seat),
        ["hang"] = MakePose(Pt(50, 30),
            [L(50, 39, 50, 68), L(50, 42, 38, 28, 34, 12), L(50, 42, 62, 28, 66, 12), L(50, 68, 44, 90), L(50, 68, 56, 88)],
            [Pt(34, 12), Pt(66, 12)], Pt(50, 11)),
        ["support"] = MakePose(Pt(50, 16),
            [L(50, 25, 50, 56), L(50, 30, 38, 40, 36, 52), L(50, 30, 62, 40, 64, 52), L(50, 56, 46, 74, 56, 86)],
            [Pt(36, 52), Pt(64, 52)], Pt(50, 54)),
        ["squat"] = MakePose(Pt(50, 18),
            [L(52, 27, 38, 56), L(52, 32, 62, 40, 56, 30), L(38, 56, 62, 64, 56, 90), L(38, 56, 56, 72, 46, 90)],
            [Pt(57, 31)], Pt(52, 28)),
        ["hinge"] = MakePose(Pt(22, 44),
            [L(30, 48, 64, 42), L(34, 50, 38, 76), L(64, 42, 62, 66, 64, 90), L(64, 42, 70, 66, 72, 90)],
            [Pt(38, 76)], Pt(42, 78)),
        ["lunge"] = MakePose(Pt(48, 14),
            [L(48, 23, 48, 54), L(48, 28, 42, 54), L(48, 54, 66, 66, 66, 90), L(48, 54, 34, 84, 18, 88)],
            [Pt(42, 54)], Pt(48, 27)),
        ["carry"] = MakePose(Pt(50, 14),
            [L(50, 23, 50, 56), L(50, 28, 38, 56), L(50, 28, 62, 56), L(50, 56, 38, 90), L(50, 56, 64, 88)],
            [Pt(38, 56), Pt(62, 56)], Pt(50, 56)),
        ["core"] = MakePose(Pt(16, 56),
            [L(24, 62, 88, 76), L(26, 62, 26, 80, 40, 80)],
            [Pt(40, 80)], Pt(40, 78), PoseSupport.Floor),
        ["isolation"] = MakePose(Pt(46, 14),
            [L(46, 23, 46, 56), L(46, 28, 38, 54), L(46, 28, 54, 50, 66, 36), L(46, 56, 38, 90), L(46, 56, 54, 90)],
            [Pt(66, 36)], Pt(62, 37)),
    };

    private static readonly PictogramGlyph[] FreeWeights =
    [
        PictogramGlyph.Barbell, PictogramGlyph.Dumbbell, PictogramGlyph.EzBar, PictogramGlyph.Kettlebell,
        PictogramGlyph.SmithMachine, PictogramGlyph.Bench,
    ];

    /// <summary>The key of the pose in <see cref="Poses"/> for a pattern and glyph (poseFor in the TS app).</summary>
    public static string PoseKeyFor(MovementPattern pattern, PictogramGlyph glyph)
    {
        // The apparatus decides the body position for these, whatever the pattern.
        if (glyph == PictogramGlyph.PullUpBar || pattern == MovementPattern.VerticalPull) return "hang";
        if (glyph == PictogramGlyph.DipStation) return "support";
        if (pattern == MovementPattern.HorizontalPush)
        {
            if (FreeWeights.Contains(glyph)) return "bench";
            return glyph is PictogramGlyph.Cable or PictogramGlyph.Machine ? "standPress" : "pushup";
        }
        if (pattern == MovementPattern.HorizontalPull)
            return glyph is PictogramGlyph.Cable or PictogramGlyph.Machine or PictogramGlyph.Band ? "seatedRow" : "bentRow";
        return pattern.Slug();
    }

    public static Pose PoseFor(MovementPattern pattern, PictogramGlyph glyph) => Poses[PoseKeyFor(pattern, glyph)];
}
