using System.Globalization;

namespace GymBuddy.Services;

/// <summary>bool → !bool.</summary>
public sealed class NotConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => value is not true;
}

/// <summary>value → value is not null (and not an empty string).</summary>
public sealed class NotNullConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture) => value is string s ? s.Length > 0 : value is not null;
    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotSupportedException();
}
