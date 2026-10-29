using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymBuddy.Core;

/// <summary>
/// JSON conventions shared by the persisted store and the exchange files: camelCase properties,
/// enums as slugs (also as dictionary keys), nulls omitted, no escaping of non-ASCII characters
/// (so output matches JavaScript's JSON.stringify), 2-space indentation when indented.
/// </summary>
public static class GymJson
{
    public static readonly JsonSerializerOptions Compact = Create(indented: false);
    public static readonly JsonSerializerOptions Indented = Create(indented: true);

    private static JsonSerializerOptions Create(bool indented)
    {
        var o = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = indented,
            IndentSize = 2,
            IndentCharacter = ' ',
            NewLine = "\n",
        };
        o.Converters.Add(new SlugEnumConverter<MuscleGroup>(Muscles.Table));
        o.Converters.Add(new SlugEnumConverter<Equipment>(Equipments.Table));
        o.Converters.Add(new SlugEnumConverter<MovementPattern>(MovementPatterns.Table));
        o.Converters.Add(new SlugEnumConverter<WeightUnit>(WeightUnits.Table));
        return o;
    }

    /// <summary>"2026-10-28T19:04:05.123Z": the exact shape of JavaScript's Date.prototype.toISOString().</summary>
    public static string ToIso(DateTimeOffset t) => t.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture);
}

/// <summary>Writes enums as their slug, both as values and as object keys; unknown slugs throw JsonException.</summary>
public sealed class SlugEnumConverter<T> : JsonConverter<T> where T : struct, Enum
{
    private readonly SlugTable<T> _table;

    public SlugEnumConverter(SlugTable<T> table) => _table = table;

    public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => Parse(reader.GetString());

    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        => writer.WriteStringValue(_table.Slug(value));

    public override T ReadAsPropertyName(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => Parse(reader.GetString());

    public override void WriteAsPropertyName(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        => writer.WritePropertyName(_table.Slug(value));

    private T Parse(string? slug) => _table.TryParse(slug, out var v) ? v : throw new JsonException($"Unknown {typeof(T).Name} '{slug}'");
}
