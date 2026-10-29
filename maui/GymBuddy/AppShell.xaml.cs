using GymBuddy.Views;

namespace GymBuddy;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        Routing.RegisterRoute("plan", typeof(PlanEditorPage));
        Routing.RegisterRoute("pick", typeof(PickExercisePage));
        Routing.RegisterRoute("exercise", typeof(ExerciseDetailPage));
        Routing.RegisterRoute("session", typeof(SessionDetailPage));
        Routing.RegisterRoute("swap", typeof(SwapPage));
        Routing.RegisterRoute("settings", typeof(SettingsPage));
    }
}
