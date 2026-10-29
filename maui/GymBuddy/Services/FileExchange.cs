namespace GymBuddy.Services;

/// <summary>Export = write into the cache dir + share sheet; import = file picker + read text (src/logic/planFiles.ts).</summary>
public static class FileExchange
{
    public static async Task ShareJsonAsync(string fileName, string json, string title)
    {
        var path = Path.Combine(FileSystem.CacheDirectory, fileName);
        await File.WriteAllTextAsync(path, json);
        await Share.Default.RequestAsync(new ShareFileRequest
        {
            Title = title,
            File = new ShareFile(path, "application/json"),
        });
    }

    /// <summary>The picked file's text, or null when the picker was cancelled.</summary>
    public static async Task<string?> PickTextAsync(string pickerTitle)
    {
        var result = await FilePicker.Default.PickAsync(new PickOptions
        {
            PickerTitle = pickerTitle,
            FileTypes = new FilePickerFileType(new Dictionary<DevicePlatform, IEnumerable<string>>
            {
                [DevicePlatform.Android] = new[] { "application/json", "text/plain", "*/*" },
            }),
        });
        if (result is null) return null;
        await using var stream = await result.OpenReadAsync();
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync();
    }
}
