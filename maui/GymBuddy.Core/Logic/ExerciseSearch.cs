using System.Text;

namespace GymBuddy.Core.Logic;

/// <summary>
/// Fuzzy, ranked exercise search for the exercise list's search box. Every query token has to match the exercise
/// name (or, weighted lower, one of its equipment labels); per token the best rule wins:
/// <list type="bullet">
/// <item>exact word 1.0, word prefix 0.85–0.95 (longer share of the word = higher)</item>
/// <item>alias (db, bb, kb, ohp, rdl, sldl) whose words are all name words 0.95</item>
/// <item>initials of consecutive words ("bss" = Bulgarian split squat) 0.75</item>
/// <item>substring anywhere in the name with spaces removed (3+ chars) 0.7</item>
/// <item>characters in order, fzf-style (3+ chars, matched span at most twice the token length) 0.35–0.65</item>
/// <item>typo: Damerau-Levenshtein distance 1 to a word (4+ chars) 0.5, or to a word's prefix (5+ chars) 0.45</item>
/// </list>
/// The exercise score is the sum of its token scores plus 0.2 × the share of name words the query covered, so the
/// exercise whose name is exactly the query ranks above longer names containing the same words.
/// </summary>
public static class ExerciseSearch
{
    private const double EquipmentWeight = 0.6;
    private const double CoverageWeight = 0.2;

    private static readonly Dictionary<string, string[]> Aliases = new()
    {
        ["db"] = ["dumbbell"],
        ["bb"] = ["barbell"],
        ["kb"] = ["kettlebell"],
        ["ohp"] = ["overhead", "press"],
        ["rdl"] = ["romanian", "deadlift"],
        ["sldl"] = ["single", "leg", "romanian", "deadlift"],
    };

    /// <summary>
    /// The matching exercises, best first (ties by name via <see cref="LocaleComparer"/>). An empty or whitespace
    /// query returns the input unchanged, in its order.
    /// </summary>
    public static IReadOnlyList<Exercise> Search(IEnumerable<Exercise> exercises, string query)
    {
        var tokens = Words(query);
        if (tokens.Count == 0) return exercises as IReadOnlyList<Exercise> ?? exercises.ToList();
        var scored = new List<(Exercise Ex, double Score)>();
        foreach (var ex in exercises)
        {
            var s = Score(tokens, ex);
            if (s > 0) scored.Add((ex, s));
        }
        scored.Sort((a, b) =>
        {
            var c = b.Score.CompareTo(a.Score);
            if (c != 0) return c;
            c = LocaleComparer.Instance.Compare(a.Ex.Name, b.Ex.Name);
            return c != 0 ? c : string.CompareOrdinal(a.Ex.Id, b.Ex.Id);
        });
        return scored.Select(x => x.Ex).ToList();
    }

    /// <summary>Relevance of <paramref name="exercise"/> for <paramref name="query"/>; 0 = no match.</summary>
    public static double Score(string query, Exercise exercise) => Score(Words(query), exercise);

    private static double Score(List<string> tokens, Exercise exercise)
    {
        if (tokens.Count == 0) return 0;
        var words = Words(exercise.Name);
        if (words.Count == 0) return 0;
        var compact = string.Concat(words);
        // Word index of every char of compact, to tell whether a subsequence stayed inside one word.
        var wordOf = new int[compact.Length];
        for (int w = 0, i = 0; w < words.Count; w++)
            for (var k = 0; k < words[w].Length; k++) wordOf[i++] = w;

        var covered = new bool[words.Count];
        double total = 0;
        foreach (var token in tokens)
        {
            var (score, coveredWords) = NameTokenScore(token, words, compact, wordOf);
            var equipment = EquipmentScore(token, exercise) * EquipmentWeight;
            if (equipment > score)
            {
                score = equipment;
                coveredWords = null;
            }
            if (score <= 0) return 0;
            total += score;
            if (coveredWords is not null)
                foreach (var w in coveredWords) covered[w] = true;
        }
        var coverage = covered.Count(c => c) / (double)words.Count;
        return total + CoverageWeight * coverage;
    }

    private static (double Score, IEnumerable<int>? Covered) NameTokenScore(string token, List<string> words, string compact, int[] wordOf)
    {
        double best = 0;
        IEnumerable<int>? covered = null;
        void Offer(double s, IEnumerable<int>? c)
        {
            if (s > best)
            {
                best = s;
                covered = c;
            }
        }

        for (var w = 0; w < words.Count; w++)
            Offer(WordScore(token, words[w]), [w]);

        if (Aliases.TryGetValue(token, out var phrase))
        {
            var idx = phrase.Select(p => words.IndexOf(p)).ToArray();
            if (idx.All(i => i >= 0)) Offer(0.95, idx);
        }

        if (token.Length >= 2 && token.Length <= words.Count)
        {
            for (var start = 0; start + token.Length <= words.Count; start++)
            {
                var ok = true;
                for (var k = 0; k < token.Length && ok; k++) ok = words[start + k][0] == token[k];
                if (ok)
                {
                    Offer(0.75, Enumerable.Range(start, token.Length).ToArray());
                    break;
                }
            }
        }

        if (best < 0.7 && token.Length >= 3)
        {
            var at = compact.IndexOf(token, StringComparison.Ordinal);
            if (at >= 0) Offer(0.7, Enumerable.Range(wordOf[at], wordOf[at + token.Length - 1] - wordOf[at] + 1).ToArray());
        }

        if (best < 0.65 && token.Length >= 3 && Subsequence(token, compact) is var (from, to))
        {
            var span = to - from + 1;
            var atWordStart = from == 0 || wordOf[from - 1] != wordOf[from];
            Offer(0.35 + 0.25 * token.Length / span + (atWordStart ? 0.05 : 0), wordOf[from] == wordOf[to] ? [wordOf[from]] : null);
        }

        if (best < 0.5 && token.Length >= 4)
        {
            for (var w = 0; w < words.Count; w++)
            {
                var word = words[w];
                if (Math.Abs(word.Length - token.Length) <= 1 && Osa(token, word) <= 1) Offer(0.5, [w]);
                else if (token.Length >= 5 && word.Length > token.Length && Osa(token, word[..token.Length]) <= 1) Offer(0.45, [w]);
            }
        }
        return (best, covered);
    }

    /// <summary>Exact word 1.0, word prefix 0.85–0.95, else 0.</summary>
    private static double WordScore(string token, string word)
    {
        if (word == token) return 1.0;
        if (word.StartsWith(token, StringComparison.Ordinal)) return 0.85 + 0.1 * token.Length / word.Length;
        return 0;
    }

    private static double EquipmentScore(string token, Exercise exercise)
    {
        double best = 0;
        foreach (var e in exercise.Equipment)
            foreach (var word in Words(e.Label()))
            {
                var s = WordScore(token, word);
                if (s == 0 && token.Length >= 4 && Math.Abs(word.Length - token.Length) <= 1 && Osa(token, word) <= 1) s = 0.5;
                best = Math.Max(best, s);
            }
        return best;
    }

    /// <summary>
    /// The tightest window of <paramref name="text"/> containing <paramref name="token"/>'s chars in order, or null
    /// when there is none or it is more than twice as long as the token.
    /// </summary>
    private static (int From, int To)? Subsequence(string token, string text)
    {
        (int, int)? best = null;
        var bestSpan = token.Length * 2 + 1;
        for (var start = text.IndexOf(token[0]); start >= 0; start = text.IndexOf(token[0], start + 1))
        {
            int k = 1, i = start + 1;
            for (; i < text.Length && k < token.Length && i - start < bestSpan; i++)
                if (text[i] == token[k]) k++;
            if (k < token.Length) continue;
            var span = i - start;
            if (span < bestSpan)
            {
                bestSpan = span;
                best = (start, i - 1);
            }
        }
        return best;
    }

    /// <summary>Optimal string alignment (restricted Damerau-Levenshtein) distance.</summary>
    private static int Osa(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                var v = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) v = Math.Min(v, d[i - 2, j - 2] + 1);
                d[i, j] = v;
            }
        return d[a.Length, b.Length];
    }

    /// <summary>
    /// Lowercase, accent-folded words: letters and digits, split at everything else; apostrophes are dropped so
    /// "Farmer's" is one word.
    /// </summary>
    private static List<string> Words(string text)
    {
        var words = new List<string>();
        var sb = new StringBuilder();
        foreach (var raw in text ?? "")
        {
            if (raw is '\'' or '’') continue;
            var folded = Fold(raw);
            foreach (var c in folded)
            {
                if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
                else if (sb.Length > 0)
                {
                    words.Add(sb.ToString());
                    sb.Clear();
                }
            }
        }
        if (sb.Length > 0) words.Add(sb.ToString());
        return words;
    }

    private static readonly Dictionary<char, string> LatinFold = BuildLatinFold();

    private static string Fold(char c) => c < 0x80 ? c.ToString() : LatinFold.TryGetValue(c, out var f) ? f : c.ToString();

    /// <summary>Base letters for common accented Latin letters (string.Normalize is a no-op under InvariantGlobalization).</summary>
    private static Dictionary<char, string> BuildLatinFold()
    {
        var groups = new (string Chars, string Base)[]
        {
            ("àáâãäåāăą", "a"), ("æ", "ae"), ("çćĉċč", "c"), ("ď", "d"), ("èéêëēĕėęě", "e"), ("ĝğġģ", "g"),
            ("ìíîïĩīĭįı", "i"), ("ñńņň", "n"), ("òóôõöøōŏő", "o"), ("œ", "oe"), ("ŕŗř", "r"), ("śŝşš", "s"),
            ("ß", "ss"), ("ţť", "t"), ("ùúûüũūŭůűų", "u"), ("ýÿŷ", "y"), ("źżž", "z"),
        };
        var map = new Dictionary<char, string>();
        foreach (var (chars, b) in groups)
            foreach (var c in chars)
            {
                map[c] = b;
                map[char.ToUpperInvariant(c)] = b;
            }
        return map;
    }
}
