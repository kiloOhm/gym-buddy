using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class HomePage : PageBase
{
    public HomePage(HomeViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
