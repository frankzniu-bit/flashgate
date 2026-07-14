import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectDelimiter, importDelimited } from './delimited';
import { detectPasteDelimiters, parsePastedSet } from './pasteParser';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

describe('Quizlet/Knowt paste-parser fixtures', () => {
  it('parses Quizlet\'s default tab/newline export', () => {
    const text = fixture('quizlet-default.txt');
    const detected = detectPasteDelimiters(text);
    expect(detected).toEqual({ termDelimiter: '\t', rowDelimiter: '\n' });

    const { cards, skipped } = parsePastedSet(text, detected);
    expect(skipped).toEqual([]);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({ front: 'mitochondria', back: 'the powerhouse of the cell' });
  });

  it('parses a custom-delimiter Quizlet export ("::" terms, ";;" rows)', () => {
    const text = fixture('quizlet-custom-delims.txt');
    const detected = detectPasteDelimiters(text);
    expect(detected).toEqual({ termDelimiter: '::', rowDelimiter: ';;' });

    const { cards, skipped } = parsePastedSet(text, detected);
    expect(skipped).toEqual([]);
    expect(cards).toHaveLength(3);
    expect(cards[1]).toEqual({ front: 'ephemeral', back: 'lasting a very short time' });
  });
});

describe('CSV/TSV delimited-import fixtures', () => {
  it('imports a Knowt-style CSV export with a header row', () => {
    const text = fixture('knowt-export.csv');
    const delimiter = detectDelimiter(text);
    expect(delimiter).toBe(',');

    const { cards, skipped } = importDelimited(text, { delimiter, hasHeaderRow: true });
    expect(skipped).toEqual([]);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({
      front: 'allele',
      back: 'one of two or more alternative forms of a gene',
    });
  });

  it('imports a plain CSV with a header row', () => {
    const text = fixture('plain-csv-with-header.csv');
    const { cards } = importDelimited(text, { delimiter: ',', hasHeaderRow: true });
    expect(cards).toEqual([
      { front: 'hola', back: 'hello' },
      { front: 'adios', back: 'goodbye' },
      { front: 'gracias', back: 'thank you' },
    ]);
  });

  it('imports a plain CSV with no header row', () => {
    const text = fixture('plain-csv-no-header.csv');
    const { cards } = importDelimited(text, { delimiter: ',', hasHeaderRow: false });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({ front: 'bonjour', back: 'hello' });
  });

  it('auto-detects and imports a tab-separated file', () => {
    const text = fixture('tab-separated.tsv');
    const delimiter = detectDelimiter(text);
    expect(delimiter).toBe('\t');

    const { cards } = importDelimited(text, { delimiter, hasHeaderRow: true });
    expect(cards).toEqual([
      { front: 'Hund', back: 'dog' },
      { front: 'Katze', back: 'cat' },
      { front: 'Vogel', back: 'bird' },
    ]);
  });

  it('auto-detects and imports a semicolon-delimited file', () => {
    const text = fixture('semicolon-delimited.csv');
    const delimiter = detectDelimiter(text);
    expect(delimiter).toBe(';');

    const { cards } = importDelimited(text, { delimiter, hasHeaderRow: true });
    expect(cards).toEqual([
      { front: 'Haus', back: 'house' },
      { front: 'Baum', back: 'tree' },
      { front: 'Wasser', back: 'water' },
    ]);
  });

  it('handles quoted fields containing the delimiter', () => {
    const text = fixture('csv-quoted-commas.csv');
    const { cards, skipped } = importDelimited(text, { delimiter: ',', hasHeaderRow: true });
    expect(skipped).toEqual([]);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({
      front: 'comma, splice',
      back: 'a punctuation error joining two independent clauses with just a comma',
    });
    expect(cards[1]!.back).toBe('the comma before "and" or "or" in a list of three or more items');
  });

  it('handles quoted fields containing embedded newlines', () => {
    const text = fixture('csv-quoted-newlines.csv');
    const { cards } = importDelimited(text, { delimiter: ',', hasHeaderRow: true });
    expect(cards).toHaveLength(2);
    expect(cards[0]!.back).toBe('an old silent pond\na frog jumps into the pond\nsplash! silence again');
  });

  it('skips rows missing a column and reports them, without dropping valid rows', () => {
    const text = fixture('malformed-missing-column.csv');
    const { cards, skipped } = importDelimited(text, { delimiter: ',', hasHeaderRow: true });

    expect(cards).toEqual([
      { front: 'complete', back: 'this row is fine' },
      { front: 'another complete', back: 'this one is fine too' },
    ]);
    expect(skipped).toHaveLength(2);
    expect(skipped.every((row) => row.reason.includes('missing front or back'))).toBe(true);
  });

  it('tolerates CRLF line endings and blank lines', () => {
    const text = fixture('malformed-blank-lines-crlf.csv');
    const { cards } = importDelimited(text, { delimiter: ',', hasHeaderRow: true });
    expect(cards).toEqual([
      { front: 'foo', back: 'bar' },
      { front: 'baz', back: 'qux' },
    ]);
  });
});
