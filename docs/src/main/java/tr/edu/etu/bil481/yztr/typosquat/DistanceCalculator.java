package tr.edu.etu.bil481.yztr.typosquat;

import java.util.Locale;
import java.util.Objects;

 /*
 * Computes string similarity metrics for detecting potential typosquatting
 * attacks in npm and PyPI dependencies using Damerau-Levenshtein distance (FR-5.1).
 */
public class DistanceCalculator {

    public int calculateDamerauLevenshtein(String source, String target) {
        Objects.requireNonNull(source, "Source package name must not be null");
        Objects.requireNonNull(target, "Target package name must not be null");

        String s1 = normalize(source);
        String s2 = normalize(target);

        int len1 = s1.length();
        int len2 = s2.length();

        if (len1 == 0) return len2;
        if (len2 == 0) return len1;

        int[][] dp = new int[len1 + 1][len2 + 1];

        for (int i = 0; i <= len1; i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= len2; j++) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= len1; i++) {
            for (int j = 1; j <= len2; j++) {
                int cost = (s1.charAt(i - 1) == s2.charAt(j - 1)) ? 0 : 1;

                int deletion = dp[i - 1][j] + 1;
                int insertion = dp[i][j - 1] + 1;
                int substitution = dp[i - 1][j - 1] + cost;

                int minDistance = Math.min(deletion, Math.min(insertion, substitution));

                if (i > 1 && j > 1
                        && s1.charAt(i - 1) == s2.charAt(j - 2)
                        && s1.charAt(i - 2) == s2.charAt(j - 1)) {
                    minDistance = Math.min(minDistance, dp[i - 2][j - 2] + cost);
                }

                dp[i][j] = minDistance;
            }
        }

        return dp[len1][len2];
    }

     /*
     * Evaluates typosquatting risk per FR-5.1:
     * Threshold is 1 for package names shorter than 4 characters, and 2 otherwise.
     */
    public boolean isPotentialTyposquat(String candidate, String popular) {
        String normCandidate = normalize(candidate);
        String normPopular = normalize(popular);

        if (normCandidate.equals(normPopular)) {
            return false;
        }

        int distance = calculateDamerauLevenshtein(normCandidate, normPopular);
        int threshold = normPopular.length() < 4 ? 1 : 2;

        return distance <= threshold;
    }

    private String normalize(String input) {
        return input.trim().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
