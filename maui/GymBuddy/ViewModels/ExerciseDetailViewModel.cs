using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using GymBuddy.Core;
using GymBuddy.Core.Logic;
using GymBuddy.Core.Store;
using GymBuddy.Services;

namespace GymBuddy.ViewModels;

public sealed record SubstituteRow(string Id, string Name, string Reasons, bool HasReasons, string Score, System.Windows.Input.ICommand OpenCommand);

/// <summary>src/app/exercise/[id].tsx</summary>
public sealed partial class ExerciseDetailViewModel : StoreViewModel, IQueryAttributable
{
    private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };

    public ExerciseDetailViewModel(GymStore store) : base(store) { }

    private string _id = "";

    [ObservableProperty] public partial Exercise? Exercise { get; set; }
    [ObservableProperty] public partial bool Found { get; set; } = true;
    [ObservableProperty] public partial string Title { get; set; } = "Exercise";
    [ObservableProperty] public partial string Meta { get; set; } = "";
    [ObservableProperty] public partial string EquipmentLine { get; set; } = "";
    [ObservableProperty] public partial string? LastLine { get; set; }
    [ObservableProperty] public partial int Difficulty { get; set; }
    [ObservableProperty] public partial bool HasPhotos { get; set; }
    [ObservableProperty] public partial IReadOnlyDictionary<MuscleGroup, double>? Activation { get; set; }
    [ObservableProperty] public partial IReadOnlyDictionary<MuscleGroup, double>? CoverageValues { get; set; }
    [ObservableProperty] public partial IReadOnlyList<string> Cues { get; set; } = Array.Empty<string>();
    [ObservableProperty] public partial bool HasCues { get; set; }
    [ObservableProperty] public partial IReadOnlyList<SubstituteRow> Substitutes { get; set; } = Array.Empty<SubstituteRow>();
    [ObservableProperty] public partial bool HasNoSubstitutes { get; set; }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        _id = query.TryGetValue("id", out var id) ? id?.ToString() ?? "" : "";
        Refresh();
    }

    protected override void Refresh()
    {
        var ex = Store.GetExercise(_id);
        Found = ex is not null;
        if (ex is null)
        {
            Title = "Exercise";
            return;
        }
        if (!Equals(Exercise, ex)) Exercise = ex;
        Title = ex.Name;
        Meta = $"{ex.Pattern.Label()} · {(ex.Compound ? "Compound" : "Isolation")}";
        EquipmentLine = $"Equipment: {Format.EquipmentSummary(ex)}";
        Difficulty = ex.Difficulty;
        HasPhotos = ExercisePhotos.Has(ex.Id);

        var last = History.LastPerformanceOf(Store.Sessions, ex.Id);
        LastLine = null;
        if (last is { Sets.Count: > 0 })
        {
            var top = last.Sets.Aggregate((a, b) => b.Weight > a.Weight ? b : a);
            var weight = top.Weight > 0 ? $" @ {SessionFormat.FormatWeight(top.Weight)} {Store.Settings.WeightUnit.Label()}" : "";
            LastLine = $"Last: {last.Sets.Count} × {top.Reps}{weight} on {ShortDate(last.Date)}";
        }

        Activation = ex.Muscles;
        CoverageValues = CoverageLogic.ComputeCoverage(new[] { new CoverageItem(ex.Id, 1) }, Store.LibraryById).ToDictionary();
        Cues = ex.Cues;
        HasCues = ex.Cues.Count > 0;
        Substitutes = Alternatives.SuggestAlternatives(ex.Id, Store.LibraryById, limit: 5)
            .Select(a => new SubstituteRow(
                a.Exercise.Id,
                a.Exercise.Name,
                string.Join(" · ", a.Reasons),
                a.Reasons.Count > 0,
                $"{(int)JsMath.Round(a.Score * 100)}%",
                OpenCommand))
            .ToList();
        HasNoSubstitutes = Substitutes.Count == 0;
    }

    private static string ShortDate(string iso)
    {
        var ms = Ids.ParseIsoMs(iso);
        if (ms is null) return "";
        var d = DateTimeOffset.FromUnixTimeMilliseconds(ms.Value).ToLocalTime();
        return $"{d.Day} {Months[d.Month - 1]}";
    }

    [RelayCommand] private Task Open(string id) => Nav.PushAsync("exercise", "id", id);
    [RelayCommand] private Task GoBack() => Nav.BackAsync();
}
