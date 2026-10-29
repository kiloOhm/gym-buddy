using GymBuddy.Core.Logic;

namespace GymBuddy.Tests;

/// <summary>Port of src/logic/rest.test.ts.</summary>
public class RestTests
{
    [Fact]
    public void remainingSec_rounds_up_partial_seconds_and_clamps_at_0()
    {
        Assert.Equal(10, Rest.RemainingSec(10_000, 0));
        Assert.Equal(1, Rest.RemainingSec(10_000, 9_001));
        Assert.Equal(0, Rest.RemainingSec(10_000, 10_000));
        Assert.Equal(0, Rest.RemainingSec(10_000, 15_000));
    }

    [Fact]
    public void restProgress_goes_from_1_to_0_over_the_rest()
    {
        Assert.Equal(1, Rest.RestProgress(90_000, 90, 0));
        Assert.Equal(0.5, Rest.RestProgress(90_000, 90, 45_000), 2);
        Assert.Equal(0, Rest.RestProgress(90_000, 90, 90_000));
    }

    [Fact]
    public void restProgress_clamps_to_0_1_and_handles_a_zero_total()
    {
        Assert.Equal(0, Rest.RestProgress(90_000, 90, 100_000));
        Assert.Equal(1, Rest.RestProgress(90_000, 60, 0));
        Assert.Equal(0, Rest.RestProgress(90_000, 0, 0));
    }

    [Fact]
    public void formatRest_formats_m_ss()
    {
        Assert.Equal("1:23", Rest.FormatRest(83));
        Assert.Equal("0:05", Rest.FormatRest(5));
        Assert.Equal("10:00", Rest.FormatRest(600));
    }
}
