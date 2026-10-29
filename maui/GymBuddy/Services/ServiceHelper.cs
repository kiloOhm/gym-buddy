namespace GymBuddy.Services;

public static class ServiceHelper
{
    public static T Get<T>() where T : notnull =>
        IPlatformApplication.Current!.Services.GetRequiredService<T>();
}
