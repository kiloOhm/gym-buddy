using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class HistoryPage : PageBase
{
    public HistoryPage(HistoryViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
