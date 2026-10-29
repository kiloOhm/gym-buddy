using GymBuddy.Services;

namespace GymBuddy.Controls;

/// <summary>Centered title + hint (+ optional button) (src/components/EmptyState.tsx).</summary>
public sealed class EmptyStateView : ContentView
{
    public EmptyStateView(string title, string? hint = null, View? child = null)
    {
        var stack = new VerticalStackLayout { Spacing = 12, Padding = 24, VerticalOptions = LayoutOptions.Center };
        stack.Children.Add(new Label { Text = title, FontSize = 18, FontAttributes = FontAttributes.Bold, HorizontalTextAlignment = TextAlignment.Center });
        if (hint is not null)
            stack.Children.Add(new Label { Text = hint, FontSize = 14, TextColor = Theme.Muted, HorizontalTextAlignment = TextAlignment.Center });
        if (child is not null) stack.Children.Add(child);
        Content = stack;
    }
}
