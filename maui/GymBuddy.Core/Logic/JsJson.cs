using System.Text.Json;
using System.Text.Json.Nodes;

namespace GymBuddy.Core.Logic;

/// <summary>
/// JavaScript-like inspection of parsed JSON for the hand-written validators. A property that is absent
/// is "undefined" and distinct from an explicit JSON null, exactly like in the TypeScript validators.
/// </summary>
internal static class JsJson
{
    /// <summary>JSON.parse; throws FormatException(message) on invalid JSON. Returns null for the literal null.</summary>
    public static JsonNode? Parse(string json, string invalidMessage)
    {
        try
        {
            return JsonNode.Parse(json, documentOptions: new JsonDocumentOptions { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
        }
        catch (Exception e) when (e is JsonException or ArgumentException or InvalidOperationException)
        {
            throw new FormatException(invalidMessage, e);
        }
    }

    public static bool IsRecord(JsonNode? node) => node is JsonObject;

    /// <summary>Property lookup: (true, value) when present (value may be null for JSON null), (false, null) when absent ("undefined").</summary>
    public static (bool Present, JsonNode? Value) Get(JsonObject obj, string key)
    {
        try
        {
            return obj.TryGetPropertyValue(key, out var v) ? (true, v) : (false, null);
        }
        catch (ArgumentException)
        {
            // Duplicate keys: JSON.parse keeps the last one.
            JsonNode? last = null;
            var found = false;
            foreach (var kv in obj.AsEnumerable()) if (kv.Key == key) { last = kv.Value; found = true; }
            return (found, last);
        }
    }

    public static bool IsString(JsonNode? node, out string value)
    {
        if (node is JsonValue v && v.GetValueKind() == JsonValueKind.String)
        {
            value = v.GetValue<string>();
            return true;
        }
        value = "";
        return false;
    }

    /// <summary>typeof x === 'number' (JSON numbers are always finite).</summary>
    public static bool IsNumber(JsonNode? node, out double value)
    {
        if (node is JsonValue v && v.GetValueKind() == JsonValueKind.Number && TryDouble(v, out value))
            return double.IsFinite(value);
        value = 0;
        return false;
    }

    /// <summary>The numeric value of a parsed or constructed JSON number (a constructed int node does not convert with GetValue&lt;double&gt;).</summary>
    public static bool TryDouble(JsonValue v, out double value)
    {
        if (v.TryGetValue(out value)) return true;
        if (v.TryGetValue(out int i)) { value = i; return true; }
        if (v.TryGetValue(out long l)) { value = l; return true; }
        if (v.TryGetValue(out decimal m)) { value = (double)m; return true; }
        if (v.TryGetValue(out float f)) { value = f; return true; }
        value = 0;
        return false;
    }

    public static bool IsBool(JsonNode? node, out bool value)
    {
        if (node is JsonValue v && v.GetValueKind() is JsonValueKind.True or JsonValueKind.False)
        {
            value = v.GetValue<bool>();
            return true;
        }
        value = false;
        return false;
    }

    /// <summary>String(x) of a property value; <paramref name="present"/> false means undefined.</summary>
    public static string JsString(bool present, JsonNode? node) => present ? JsString(node) : "undefined";

    /// <summary>String(x) of a parsed JSON value.</summary>
    public static string JsString(JsonNode? node)
    {
        switch (node)
        {
            case null: return "null";
            case JsonObject: return "[object Object]";
            case JsonArray arr: return string.Join(",", arr.Select(x => x is null ? "" : JsString(x)));
            case JsonValue v:
                return v.GetValueKind() switch
                {
                    JsonValueKind.String => v.GetValue<string>(),
                    JsonValueKind.Number => TryDouble(v, out var d) ? JsMath.ToJsString(d) : v.ToJsonString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => "null",
                };
            default: return "";
        }
    }
}
