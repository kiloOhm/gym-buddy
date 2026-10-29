using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class SettingsPage : PageBase
{
    public SettingsPage(SettingsViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
