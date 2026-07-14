/**
 * Quizlet/Knowt paste-parser (§5.3/§5.4): the user copies exported text and
 * pastes it in. Quizlet's default export is "term<TAB>definition" per line;
 * both the term delimiter and the row delimiter are user-customizable on
 * quizlet.com's export screen, so this accepts arbitrary string delimiters
 * rather than assuming tab/newline. No quote-awareness — these exports are
 * plain text, unlike a spreadsheet's CSV/TSV file (see delimited.ts).
 */
import type { SkippedRow } from './delimited';

export interface PasteParseOptions {
  termDelimiter?: string;
  rowDelimiter?: string;
}

export interface ParsedCard {
  front: string;
  back: string;
}

export interface PasteParseResult {
  cards: ParsedCard[];
  skipped: SkippedRow[];
}

const DEFAULT_TERM_DELIMITER = '\t';
const DEFAULT_ROW_DELIMITER = '\n';

export function parsePastedSet(text: string, options: PasteParseOptions = {}): PasteParseResult {
  const termDelimiter = options.termDelimiter ?? DEFAULT_TERM_DELIMITER;
  const rowDelimiter = options.rowDelimiter ?? DEFAULT_ROW_DELIMITER;

  const rawRows =
    rowDelimiter === DEFAULT_ROW_DELIMITER ? text.split(/\r\n|\r|\n/) : text.split(rowDelimiter);

  const cards: ParsedCard[] = [];
  const skipped: SkippedRow[] = [];

  for (const raw of rawRows) {
    const trimmedRaw = raw.trim();
    if (trimmedRaw.length === 0) continue;

    const idx = raw.indexOf(termDelimiter);
    if (idx === -1) {
      skipped.push({ raw: trimmedRaw, reason: `no "${termDelimiter}" delimiter found in row` });
      continue;
    }

    const front = raw.slice(0, idx).trim();
    const back = raw.slice(idx + termDelimiter.length).trim();
    if (!front || !back) {
      skipped.push({ raw: trimmedRaw, reason: 'empty term or definition after split' });
      continue;
    }

    cards.push({ front, back });
  }

  return { cards, skipped };
}

const TERM_DELIMITER_CANDIDATES = ['\t', '::', ' - ', ';', ','];
const ROW_DELIMITER_CANDIDATES = [';;', '||', '\t\t'];

export interface DetectedPasteDelimiters {
  termDelimiter: string;
  rowDelimiter: string;
}

/** Auto-detects term/row delimiters (§5.3): prefers newline-separated rows
 * (Quizlet's default and the overwhelmingly common paste shape); falls back
 * to a repeated custom row separator only when the pasted text has no
 * newlines at all. Term delimiter is whichever candidate splits the most
 * non-blank rows successfully. */
export function detectPasteDelimiters(text: string): DetectedPasteDelimiters {
  const hasNewlines = /\r\n|\r|\n/.test(text.trim());
  const rowDelimiter = hasNewlines ? DEFAULT_ROW_DELIMITER : detectRowDelimiterFallback(text);

  const rows = rowDelimiter === DEFAULT_ROW_DELIMITER ? text.split(/\r\n|\r|\n/) : text.split(rowDelimiter);
  const nonBlankRows = rows.map((r) => r.trim()).filter((r) => r.length > 0);

  let bestDelimiter = DEFAULT_TERM_DELIMITER;
  let bestScore = -1;
  for (const candidate of TERM_DELIMITER_CANDIDATES) {
    const score = nonBlankRows.filter((row) => row.includes(candidate)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = candidate;
    }
  }

  return { termDelimiter: bestDelimiter, rowDelimiter };
}

function detectRowDelimiterFallback(text: string): string {
  for (const candidate of ROW_DELIMITER_CANDIDATES) {
    if (text.includes(candidate)) return candidate;
  }
  return DEFAULT_ROW_DELIMITER;
}
