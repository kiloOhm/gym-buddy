namespace GymBuddy.Core.Store;

/// <summary>
/// The platform alert at the end of a rest (a scheduled local notification / alarm on Android), so the phone also
/// alerts when the app is in the background. At most one is pending; Schedule replaces it.
/// </summary>
public interface IRestAlarm
{
    void Schedule(long endsAtMs);
    void Cancel();
}
