namespace GymBuddy.Core.Store;

/// <summary>Stores the state in one file. Writes go to a temp file that then replaces the target, so a crash mid-write never leaves half a file.</summary>
public sealed class FileStateStorage(string path) : IStateStorage
{
    public string Path { get; } = path;

    /// <summary>Where <see cref="Quarantine"/> moves an unreadable file: "&lt;file&gt;.corrupt".</summary>
    public string QuarantinePath => Path + ".corrupt";

    public string? Read() => File.Exists(Path) ? File.ReadAllText(Path) : null;

    public void Write(string json)
    {
        var dir = System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(Path));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var temp = Path + ".tmp";
        File.WriteAllText(temp, json);
        File.Move(temp, Path, overwrite: true);
    }

    public void Quarantine()
    {
        if (File.Exists(Path)) File.Move(Path, QuarantinePath, overwrite: true);
    }
}
