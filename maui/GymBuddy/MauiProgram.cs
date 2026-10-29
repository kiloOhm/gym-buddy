using GymBuddy.Core.Store;
using GymBuddy.Services;
using GymBuddy.ViewModels;
using GymBuddy.Views;
using Microsoft.Extensions.Logging;

namespace GymBuddy;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts => fonts.AddFont("Ionicons.ttf", "Ionicons"));

#if DEBUG
        builder.Logging.AddDebug();
#endif

        // Plain text fields: no Material underline (the screens draw their own borders, like the Expo app).
        Microsoft.Maui.Handlers.EntryHandler.Mapper.AppendToMapping("NoUnderline", (handler, _) =>
            handler.PlatformView.BackgroundTintList = Android.Content.Res.ColorStateList.ValueOf(Android.Graphics.Color.Transparent));

        builder.Services.AddSingleton(_ =>
        {
            var store = new GymStore(new FileStateStorage(Path.Combine(FileSystem.AppDataDirectory, "gym-buddy-v1.json")));
            store.Load();
            return store;
        });
        builder.Services.AddSingleton(_ => new RestTimer(new Platforms.Android.RestAlarm()));
        builder.Services.AddSingleton<RestCoordinator>();

        builder.Services.AddTransient<HomePage>().AddTransient<HomeViewModel>();
        builder.Services.AddTransient<PlansPage>().AddTransient<PlansViewModel>();
        builder.Services.AddTransient<WorkoutPage>().AddTransient<WorkoutViewModel>();
        builder.Services.AddTransient<ExercisesPage>();
        builder.Services.AddTransient<HistoryPage>().AddTransient<HistoryViewModel>();
        builder.Services.AddTransient<PlanEditorPage>().AddTransient<PlanEditorViewModel>();
        builder.Services.AddTransient<PickExercisePage>();
        builder.Services.AddTransient<ExerciseDetailPage>().AddTransient<ExerciseDetailViewModel>();
        builder.Services.AddTransient<SessionDetailPage>().AddTransient<SessionDetailViewModel>();
        builder.Services.AddTransient<SwapPage>().AddTransient<SwapViewModel>();
        builder.Services.AddTransient<SettingsPage>().AddTransient<SettingsViewModel>();

        return builder.Build();
    }
}
