namespace GymBuddy.Core.Store;

/// <summary>In-memory storage for tests (and previews).</summary>
public sealed class MemoryStateStorage(string? initial = null) : IStateStorage
{
    public string? Content { get; set; } = initial;

    /// <summary>What <see cref="Quarantine"/> moved aside, if anything.</summary>
    public string? Quarantined { get; private set; }

    public int WriteCount { get; private set; }

    /// <summary>When set, Write throws this (to test that the store keeps running).</summary>
    public Exception? FailWritesWith { get; set; }

    public string? Read() => Content;

    public void Write(string json)
    {
        if (FailWritesWith is not null) throw FailWritesWith;
        Content = json;
        WriteCount++;
    }

    public void Quarantine()
    {
        Quarantined = Content;
        Content = null;
    }
}
