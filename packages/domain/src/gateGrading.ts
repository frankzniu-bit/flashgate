/**
 * Objective-check grading for gate sessions (§4.4) — self-graded
 * flip-and-rate is trivially cheatable when the reward is screen time, so
 * gate sessions check answers objectively instead.
 */

/** Minimum time a card must be on screen before its answers become
 * tappable, to blunt reflex-tapping (§4.4). */
export const MIN_DISPLAY_MS = 2000;

/** Multiple choice needs at least 4 distinct answers in the pool (the
 * correct one plus 3 distractors) — below that, callers should fall back
 * to typed input (§4.4). */
const MIN_POOL_SIZE = 4;
const DISTRACTOR_COUNT = 3;

export interface MultipleChoiceQuestion {
  correctAnswer: string;
  /** Shuffled; includes the correct answer exactly once. */
  options: string[];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Builds a multiple-choice question from a pool of candidate answers
 * (other cards' backs, same deck preferred, falling back to all decks per
 * §4.4). Returns null when the pool is too small, signaling the caller to
 * fall back to typed input.
 */
export function buildMultipleChoiceQuestion(
  correctAnswer: string,
  answerPool: string[],
  random: () => number = Math.random,
): MultipleChoiceQuestion | null {
  const distractorCandidates = Array.from(
    new Set(answerPool.filter((answer) => answer !== correctAnswer)),
  );
  if (distractorCandidates.length < MIN_POOL_SIZE - 1) return null;

  const distractors = shuffle(distractorCandidates, random).slice(0, DISTRACTOR_COUNT);
  return { correctAnswer, options: shuffle([correctAnswer, ...distractors], random) };
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[rows - 1]![cols - 1]!;
}

/** Case-insensitive, whitespace-trimmed match with a small Levenshtein
 * tolerance of 1 edit per 8 characters of the correct answer (§4.4). */
export function matchesTypedAnswer(input: string, correctAnswer: string): boolean {
  const normalizedInput = input.trim().toLowerCase();
  const normalizedAnswer = correctAnswer.trim().toLowerCase();
  if (normalizedInput === normalizedAnswer) return true;

  const tolerance = Math.floor(normalizedAnswer.length / 8);
  return levenshteinDistance(normalizedInput, normalizedAnswer) <= tolerance;
}
