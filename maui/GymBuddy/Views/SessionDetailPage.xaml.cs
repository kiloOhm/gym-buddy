using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class SessionDetailPage : PageBase
{
    public SessionDetailPage(SessionDetailViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
