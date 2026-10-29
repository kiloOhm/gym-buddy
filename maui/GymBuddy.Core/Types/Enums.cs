// Shared domain enums. The slugs (see Slugs.cs) are the wire format: they must match the TypeScript
// app's string unions in src/types/index.ts exactly, because plan/library files and exercise ids are
// exchanged between both apps.
namespace GymBuddy.Core;

public enum MuscleGroup
{
    Chest,
    FrontDelts,
    SideDelts,
    RearDelts,
    Lats,
    UpperBack,
    Traps,
    LowerBack,
    Biceps,
    Triceps,
    Forearms,
    Abs,
    Obliques,
    Quads,
    Hamstrings,
    Glutes,
    Adductors,
    HipFlexors,
    Calves,
}

public enum Equipment
{
    Barbell,
    Dumbbell,
    Kettlebell,
    Cable,
    Machine,
    SmithMachine,
    EzBar,
    Band,
    Bench,
    /// <summary>Power rack / squat stand: required by lifts that start from the hooks.</summary>
    Rack,
    PullUpBar,
    DipStation,
    /// <summary>Only listed when nothing else is needed.</summary>
    Bodyweight,
}

public enum MovementPattern
{
    HorizontalPush,
    VerticalPush,
    HorizontalPull,
    VerticalPull,
    Squat,
    Hinge,
    Lunge,
    Carry,
    Core,
    Isolation,
}

public enum WeightUnit
{
    Kg,
    Lb,
}
