namespace GymBuddy.Core.Store;

/// <summary>Where GymStore keeps its single JSON document (the zustand persist envelope).</summary>
public interface IStateStorage
{
    /// <summary>The stored JSON, or null when nothing has been stored yet.</summary>
    string? Read();

    /// <summary>Replaces the stored JSON. Implementations should make this atomic.</summary>
    void Write(string json);

    /// <summary>Moves unreadable data out of the way (kept for inspection) so the app can start empty. Default: no-op.</summary>
    void Quarantine() { }
}
