import { describe, expect, it } from 'vitest';
import { buildMultipleChoiceQuestion, matchesTypedAnswer } from './gateGrading';

function fixedRandom(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length]!;
}

describe('buildMultipleChoiceQuestion', () => {
  it('builds a question with the correct answer plus 3 distractors when the pool is large enough', () => {
    const question = buildMultipleChoiceQuestion('cat', ['dog', 'bird', 'fish', 'cat', 'lion'], fixedRandom([0]));

    expect(question).not.toBeNull();
    expect(question!.options).toHaveLength(4);
    expect(question!.options).toContain('cat');
    expect(new Set(question!.options).size).toBe(4);
  });

  it('falls back to null (typed input) when the pool has fewer than 3 usable distractors', () => {
    expect(buildMultipleChoiceQuestion('cat', ['dog', 'bird'])).toBeNull();
    expect(buildMultipleChoiceQuestion('cat', [])).toBeNull();
  });

  it('excludes duplicate distractor values and the correct answer itself from the pool', () => {
    const pool = ['cat', 'cat', 'cat', 'dog', 'dog', 'bird', 'fish'];
    const question = buildMultipleChoiceQuestion('cat', pool, fixedRandom([0]));

    expect(question).not.toBeNull();
    expect(question!.options.filter((o) => o === 'cat')).toHaveLength(1);
  });
});

describe('matchesTypedAnswer', () => {
  it('matches exactly (case-insensitive, trimmed)', () => {
    expect(matchesTypedAnswer('Paris', 'paris')).toBe(true);
    expect(matchesTypedAnswer('  paris  ', 'Paris')).toBe(true);
  });

  it('tolerates 1 edit per 8 characters of the correct answer', () => {
    // "photosynthesis" is 14 chars -> tolerance floor(14/8) = 1
    expect(matchesTypedAnswer('photosynthesls', 'photosynthesis')).toBe(true); // 1 substitution
    expect(matchesTypedAnswer('photosynthesi', 'photosynthesis')).toBe(true); // 1 deletion
  });

  it('rejects answers beyond the tolerance', () => {
    expect(matchesTypedAnswer('phxtxsynthesls', 'photosynthesis')).toBe(false); // 2 edits, tolerance 1
    expect(matchesTypedAnswer('banana', 'apple')).toBe(false);
  });

  it('gives short answers zero tolerance (floor(<8/8) = 0)', () => {
    expect(matchesTypedAnswer('cat', 'cat')).toBe(true);
    expect(matchesTypedAnswer('cot', 'cat')).toBe(false);
  });
});
