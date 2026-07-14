/**
 * Generic CSV/TSV-style tokenizer (§5.2): quote-aware, single-character
 * delimiter, RFC4180-ish (double-quote escaping, embedded newlines inside
 * quoted fields, CRLF/LF/CR row breaks). Used for file-based CSV/TSV import,
 * where spreadsheet exports commonly quote fields containing the delimiter.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  function pushField() {
    row.push(field);
    field = '';
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop fully blank trailing/interstitial lines (a single empty field).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const CSV_DELIMITER_CANDIDATES = [',', '\t', ';', '|'];

/** Auto-detects the column delimiter from a sample of the file's lines,
 * preferring whichever candidate yields the most consistent field count
 * (>1) across sampled lines. Falls back to comma. */
export function detectDelimiter(text: string): string {
  const sampleLines = text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 5);
  if (sampleLines.length === 0) return ',';

  let best = ',';
  let bestScore = -1;
  for (const candidate of CSV_DELIMITER_CANDIDATES) {
    const counts = sampleLines.map((line) => parseDelimited(line, candidate)[0]?.length ?? 0);
    const [first, ...rest] = counts;
    const consistent = first !== undefined && first > 1 && rest.every((c) => c === first);
    if (consistent && first > bestScore) {
      bestScore = first;
      best = candidate;
    }
  }
  return best;
}

export interface DelimitedImportOptions {
  delimiter: string;
  hasHeaderRow: boolean;
  /** 0-based column index for the card's front; defaults to 0. */
  frontColumn?: number;
  /** 0-based column index for the card's back; defaults to 1. */
  backColumn?: number;
}

export interface ImportedCard {
  front: string;
  back: string;
}

export interface SkippedRow {
  raw: string;
  reason: string;
}

export interface DelimitedImportResult {
  cards: ImportedCard[];
  skipped: SkippedRow[];
}

/** Parses delimited text into cards per §5.2: pick delimiter, map columns,
 * preview before committing (the mapping/preview UI lives above this). */
export function importDelimited(text: string, options: DelimitedImportOptions): DelimitedImportResult {
  const frontColumn = options.frontColumn ?? 0;
  const backColumn = options.backColumn ?? 1;
  const rows = parseDelimited(text, options.delimiter);
  const dataRows = options.hasHeaderRow ? rows.slice(1) : rows;

  const cards: ImportedCard[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of dataRows) {
    const raw = row.join(options.delimiter);
    const front = row[frontColumn]?.trim();
    const back = row[backColumn]?.trim();
    if (!front || !back) {
      skipped.push({ raw, reason: 'missing front or back column' });
      continue;
    }
    cards.push({ front, back });
  }

  return { cards, skipped };
}
