using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class PlanEditorPage : PageBase
{
    private readonly PlanEditorViewModel _vm;

    public PlanEditorPage(PlanEditorViewModel vm)
    {
        InitializeComponent();
        BindingContext = _vm = vm;
        NameEntry.Unfocused += (_, _) => vm.SaveNameCommand.Execute(null);
        NameEntry.Completed += (_, _) => NameEntry.Unfocus();
        BodyMap.MusclePressed += (_, m) => vm.OnMusclePressed(m);
    }

    protected override void OnDisappearing()
    {
        // Leaving with the keyboard still open: keep what was typed.
        if (NameEntry.IsFocused) _vm.SaveNameCommand.Execute(null);
        base.OnDisappearing();
    }
}
