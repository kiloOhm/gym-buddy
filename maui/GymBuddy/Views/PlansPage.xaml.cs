using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class PlansPage : PageBase
{
    public PlansPage(PlansViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
        vm.PropertyChanged += (_, e) =>
        {
            // autoFocus on the new-plan field
            if (e.PropertyName != nameof(PlansViewModel.Creating)) return;
            if (vm.Creating)
            {
                Dispatcher.Dispatch(() => NameEntry.Focus());
            }
            else
            {
                _ = NameEntry.HideSoftInputAsync(CancellationToken.None);
                NameEntry.Unfocus();
            }
        };
    }
}
