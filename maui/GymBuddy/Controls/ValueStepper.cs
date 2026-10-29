using System.Windows.Input;
using GymBuddy.Services;

namespace GymBuddy.Controls;

/// <summary>Small "− value +" control with a label above (src/components/ValueStepper.tsx).</summary>
public sealed class ValueStepper : ContentView
{
    public static readonly BindableProperty ValueProperty = BindableProperty.Create(
        nameof(Value), typeof(int), typeof(ValueStepper), 0, propertyChanged: (b, _, _) => ((ValueStepper)b).Sync());

    public static readonly BindableProperty CommandProperty = BindableProperty.Create(
        nameof(Command), typeof(ICommand), typeof(ValueStepper));

    public int Value { get => (int)GetValue(ValueProperty); set => SetValue(ValueProperty, value); }

    /// <summary>Executed with the new value (int) when a button is pressed. The store update flows back via <see cref="Value"/>.</summary>
    public ICommand? Command { get => (ICommand?)GetValue(CommandProperty); set => SetValue(CommandProperty, value); }

    public string Label { get => _label.Text; set { _label.Text = value; Sync(); } }
    public int Min { get => _min; set { _min = value; Sync(); } }
    public int Max { get => _max; set { _max = value; Sync(); } }
    public int Step { get; set; } = 1;
    /// <summary>Optional suffix, e.g. "s" for "90s".</summary>
    public string Suffix { get => _suffix; set { _suffix = value; Sync(); } }

    private int _min;
    private int _max = int.MaxValue;
    private string _suffix = "";

    private readonly Microsoft.Maui.Controls.Label _label;
    private readonly Microsoft.Maui.Controls.Label _value;
    private readonly Button _dec;
    private readonly Button _inc;

    public ValueStepper()
    {
        _label = new Microsoft.Maui.Controls.Label { FontSize = 12, TextColor = Theme.Muted, HorizontalOptions = LayoutOptions.Center };
        _value = new Microsoft.Maui.Controls.Label { FontSize = 15, FontAttributes = FontAttributes.Bold, MinimumWidthRequest = 36, HorizontalTextAlignment = TextAlignment.Center, VerticalOptions = LayoutOptions.Center };
        _dec = StepButton("−");
        _inc = StepButton("+");
        _dec.Clicked += (_, _) => Fire(Math.Max(Min, Value - Step));
        _inc.Clicked += (_, _) => Fire(Math.Min(Max, Value + Step));
        Content = new VerticalStackLayout
        {
            Spacing = 4,
            HorizontalOptions = LayoutOptions.Center,
            Children =
            {
                _label,
                new HorizontalStackLayout { Spacing = 2, Children = { _dec, _value, _inc } },
            },
        };
        Sync();
    }

    private static Button StepButton(string symbol) => new()
    {
        Text = symbol,
        FontSize = 18,
        FontAttributes = FontAttributes.Bold,
        TextColor = Theme.Primary,
        BackgroundColor = Theme.PrimarySoft,
        BorderWidth = 0,
        CornerRadius = 6,
        Padding = 0,
        WidthRequest = 32,
        HeightRequest = 40,
        MinimumWidthRequest = 32,
        MinimumHeightRequest = 40,
    };

    private void Fire(int next)
    {
        if (next == Value) return;
        if (Command?.CanExecute(next) == true) Command.Execute(next);
    }

    private void Sync()
    {
        if (_value is null || _dec is null) return;
        _value.Text = $"{Value}{Suffix}";
        _dec.IsEnabled = Value > Min;
        _inc.IsEnabled = Value < Max;
        _dec.Opacity = _dec.IsEnabled ? 1 : 0.35;
        _inc.Opacity = _inc.IsEnabled ? 1 : 0.35;
        SemanticProperties.SetDescription(_dec, $"Decrease {_label.Text}");
        SemanticProperties.SetDescription(_inc, $"Increase {_label.Text}");
    }

}
