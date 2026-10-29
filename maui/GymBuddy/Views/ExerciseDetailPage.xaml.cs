using GymBuddy.ViewModels;

namespace GymBuddy.Views;

public partial class ExerciseDetailPage : PageBase
{
    public ExerciseDetailPage(ExerciseDetailViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
