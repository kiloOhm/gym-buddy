using System.Globalization;
using GymBuddy.Core;

namespace GymBuddy.Services;

/// <summary>Small display helpers shared by several screens.</summary>
public static class Format
{
    public static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    /// <summary>"Barbell, Bench" (equipmentSummary in ExerciseList.tsx).</summary>
    public static string EquipmentSummary(Exercise ex) => string.Join(", ", ex.Equipment.Select(e => e.Label()));

    public static string Plural(int n, string word) => $"{n} {word}{(n == 1 ? "" : "s")}";

    /// <summary>Integer as is, otherwise one decimal (formatSets in index.tsx).</summary>
    public static string Sets(double value) =>
        value == Math.Floor(value) ? ((long)value).ToString(Inv) : value.ToString("0.0", Inv);

    public static string Fixed1(double value) => value.ToString("0.0", Inv);
}

/// <summary>One-way converter from a lambda.</summary>
public sealed class FuncConverter : IValueConverter
{
    private readonly Func<object?, object?> _convert;
    public FuncConverter(Func<object?, object?> convert) => _convert = convert;
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => _convert(value);
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}
