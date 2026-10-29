using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class SwapPage : ContentPage
{
    public SwapPage(SwapViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
