using GymBuddy.Core.Data;

namespace GymBuddy.Services;

/// <summary>
/// Bundled demonstration photos (MauiAssets "exercises/&lt;id&gt;/&lt;n&gt;.jpg"). The bytes are cached in memory after the
/// first read (about 40 kB per photo), so list thumbnails do not hit the APK again while scrolling.
/// </summary>
public static class ExercisePhotos
{
    private static readonly Dictionary<string, Task<byte[]?>> Cache = new();

    public static bool Has(string exerciseId) => ExerciseImages.HasPhotos(exerciseId);

    public static IReadOnlyList<string> Paths(string exerciseId) => ExerciseImages.AssetPaths(exerciseId);

    public static ImageSource Source(string assetPath) =>
        ImageSource.FromStream(async ct =>
        {
            var bytes = await Load(assetPath);
            return bytes is null ? Stream.Null : new MemoryStream(bytes, writable: false);
        });

    private static Task<byte[]?> Load(string assetPath)
    {
        lock (Cache)
        {
            if (!Cache.TryGetValue(assetPath, out var task))
            {
                task = Read(assetPath);
                Cache[assetPath] = task;
            }
            return task;
        }
    }

    private static async Task<byte[]?> Read(string assetPath)
    {
        try
        {
            await using var stream = await FileSystem.OpenAppPackageFileAsync(assetPath);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms);
            return ms.ToArray();
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"Photo {assetPath} failed: {e.Message}");
            return null;
        }
    }
}
