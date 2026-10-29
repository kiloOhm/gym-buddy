using Android.App;
using Android.Content;
using Android.OS;
using AndroidX.Core.App;
using GymBuddy.Core.Store;
using Application = Android.App.Application;

namespace GymBuddy.Platforms.Android;

/// <summary>
/// Android side of the rest timer (port of src/store/restNotification.ts): one exact alarm clock per rest that
/// fires <see cref="RestAlarmReceiver"/>, which posts the "Rest over" notification when the app is not in the
/// foreground. AlarmManager.SetAlarmClock is never deferred by Doze or OEM battery policies (status bar shows the
/// alarm icon while a rest runs). POST_NOTIFICATIONS is requested lazily on the first rest; when denied, only the
/// in-app bar and vibration remain.
/// </summary>
public sealed class RestAlarm : IRestAlarm
{
    public const string ChannelId = "rest-timer";
    public const int NotificationId = 1;
    public static readonly long[] VibrationPattern = { 0, 400, 200, 400 };

    private static bool _channelCreated;
    private bool _permissionAsked;

    public void Schedule(long endsAtMs)
    {
        try
        {
            var ctx = Application.Context;
            EnsureChannel(ctx);
            RequestPermissionOnce();
            var alarms = (AlarmManager?)ctx.GetSystemService(Context.AlarmService);
            if (alarms is null) return;
            var alarmPi = AlarmIntent(ctx);
            alarms.Cancel(alarmPi);
            NotificationManagerCompat.From(ctx).Cancel(NotificationId);
            if (endsAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) return;

            if (Build.VERSION.SdkInt >= BuildVersionCodes.S && !alarms.CanScheduleExactAlarms())
            {
                alarms.SetExactAndAllowWhileIdle(AlarmType.RtcWakeup, endsAtMs, alarmPi);
                return;
            }
            var showPi = PendingIntent.GetActivity(ctx, 1, LaunchIntent(ctx), PendingIntentFlags.Immutable | PendingIntentFlags.UpdateCurrent);
            alarms.SetAlarmClock(new AlarmManager.AlarmClockInfo(endsAtMs, showPi), alarmPi);
        }
        catch (Exception e)
        {
            // The alarm is a bonus on top of the in-app timer; never surface its errors.
            System.Diagnostics.Debug.WriteLine($"RestAlarm.Schedule failed: {e}");
        }
    }

    public void Cancel()
    {
        try
        {
            var ctx = Application.Context;
            var alarms = (AlarmManager?)ctx.GetSystemService(Context.AlarmService);
            alarms?.Cancel(AlarmIntent(ctx));
            NotificationManagerCompat.From(ctx).Cancel(NotificationId);
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"RestAlarm.Cancel failed: {e}");
        }
    }

    internal static PendingIntent AlarmIntent(Context ctx) =>
        PendingIntent.GetBroadcast(ctx, 0, new Intent(ctx, typeof(RestAlarmReceiver)), PendingIntentFlags.Immutable | PendingIntentFlags.UpdateCurrent)!;

    internal static Intent LaunchIntent(Context ctx)
    {
        var intent = new Intent(ctx, typeof(MainActivity));
        intent.SetFlags(ActivityFlags.NewTask | ActivityFlags.SingleTop | ActivityFlags.ClearTop);
        return intent;
    }

    /// <summary>The channel must exist before the Android 13 permission prompt and before posting.</summary>
    internal static void EnsureChannel(Context ctx)
    {
        if (_channelCreated || Build.VERSION.SdkInt < BuildVersionCodes.O) return;
        var channel = new NotificationChannel(ChannelId, "Rest timer", NotificationImportance.High)
        {
            Description = "Alerts when the rest between sets is over",
        };
        channel.EnableVibration(true);
        channel.SetVibrationPattern(VibrationPattern);
        channel.SetSound(global::Android.Media.RingtoneManager.GetDefaultUri(global::Android.Media.RingtoneType.Notification),
            new global::Android.Media.AudioAttributes.Builder()
                .SetUsage(global::Android.Media.AudioUsageKind.Notification)!
                .SetContentType(global::Android.Media.AudioContentType.Sonification)!
                .Build());
        var manager = (NotificationManager?)ctx.GetSystemService(Context.NotificationService);
        manager?.CreateNotificationChannel(channel);
        _channelCreated = true;
    }

    private void RequestPermissionOnce()
    {
        if (_permissionAsked || Build.VERSION.SdkInt < BuildVersionCodes.Tiramisu) return;
        _permissionAsked = true;
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                var status = await Permissions.CheckStatusAsync<Permissions.PostNotifications>();
                if (status != PermissionStatus.Granted)
                    await Permissions.RequestAsync<Permissions.PostNotifications>();
            }
            catch (Exception e)
            {
                System.Diagnostics.Debug.WriteLine($"Notification permission request failed: {e}");
            }
        });
    }
}

/// <summary>Fires at the end of a rest. In the foreground the in-app bar already shows "Rest over" and vibrates.</summary>
[BroadcastReceiver(Enabled = true, Exported = false)]
public sealed class RestAlarmReceiver : BroadcastReceiver
{
    public override void OnReceive(Context? context, Intent? intent)
    {
        if (context is null || Services.AppForeground.IsActive) return;
        try
        {
            RestAlarm.EnsureChannel(context);
            var manager = NotificationManagerCompat.From(context);
            if (!manager.AreNotificationsEnabled()) return;
            var contentPi = PendingIntent.GetActivity(context, 2, RestAlarm.LaunchIntent(context), PendingIntentFlags.Immutable | PendingIntentFlags.UpdateCurrent);
            var notification = new NotificationCompat.Builder(context, RestAlarm.ChannelId)
                .SetSmallIcon(Resource.Drawable.ic_rest_notification)!
                .SetContentTitle("Rest over")!
                .SetContentText("Time for your next set.")!
                .SetPriority(NotificationCompat.PriorityHigh)!
                .SetCategory(NotificationCompat.CategoryAlarm)!
                .SetVibrate(RestAlarm.VibrationPattern)!
                .SetDefaults(NotificationCompat.DefaultSound)!
                .SetAutoCancel(true)!
                .SetContentIntent(contentPi)!
                .Build()!;
            manager.Notify(RestAlarm.NotificationId, notification);
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"RestAlarmReceiver failed: {e}");
        }
    }
}
