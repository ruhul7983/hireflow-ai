// src/sourcing/csv-mapping.ts
import { parse } from 'csv-parse/sync';
import {
  normalizeEmail,
  normalizeProfileUrl,
  ParsedCandidate,
} from './candidate-parser';

const DELIMITERS = [',', ';', '\t', '|'];
const SAMPLE_COUNT = 3;
const SAMPLE_LENGTH = 80;
const MIN_CONTENT_MATCH = 0.5;
const MAX_DETAIL_LENGTH = 2000;

export const MAX_CSV_ROWS = 1000;

export type MappedField =
  | 'name'
  | 'lastName'
  | 'email'
  | 'profileUrl'
  | 'headline'
  | 'location';

// Columns are tracked by position, so blank or repeated headers can't collide
export type CsvMapping = Partial<Record<MappedField, number>> & {
  detailColumns: number[];
};

export class CsvFormatError extends Error {}

const HEADER_ALIASES: Record<MappedField, string[]> = {
  name: [
    'name',
    'full name',
    'fullname',
    'candidate',
    'candidate name',
    'applicant',
    'applicant name',
    'first name',
    'firstname',
    'given name',
  ],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  email: [
    'email',
    'e mail',
    'email address',
    'mail',
    'mail id',
    'email id',
    'work email',
    'personal email',
    'contact email',
  ],
  profileUrl: [
    'linkedin',
    'linkedin url',
    'linkedin profile',
    'profile',
    'profile url',
    'profile link',
    'url',
    'portfolio',
    'website',
  ],
  headline: [
    'headline',
    'title',
    'job title',
    'current title',
    'role',
    'current role',
    'position',
    'designation',
  ],
  location: ['location', 'city', 'based in', 'country', 'region', 'address'],
};

// Useful for scoring, so these start ticked. Anything else stays out unless chosen,
// because a column such as a phone number shouldn't go to the AI by default.
const DETAIL_ALIASES = [
  'summary',
  'notes',
  'about',
  'bio',
  'skills',
  'experience',
  'years of experience',
  'description',
  'company',
  'current company',
  'employer',
  'education',
];

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Excel's "Unicode text" export is UTF-16, which would otherwise read as garbage
function decode(buffer: Buffer) {
  const isUtf16 = buffer[0] === 0xff && buffer[1] === 0xfe;
  return buffer.toString(isUtf16 ? 'utf16le' : 'utf8').replace(/^﻿/, '');
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');

  return DELIMITERS.reduce((best, delimiter) =>
    firstLine.split(delimiter).length > firstLine.split(best).length
      ? delimiter
      : best,
  );
}

function readCsv(buffer: Buffer) {
  const text = decode(buffer);

  let records: string[][];
  try {
    records = parse(text, {
      delimiter: detectDelimiter(text),
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch {
    throw new CsvFormatError('That file could not be read as a CSV');
  }

  const [header, ...rows] = records;
  if (!header || rows.length === 0) {
    throw new CsvFormatError(
      'That file has no candidate rows below its header.',
    );
  }
  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvFormatError(
      `Please upload ${MAX_CSV_ROWS} candidates or fewer at a time`,
    );
  }

  const width = Math.max(...records.map((record) => record.length));
  const headers = Array.from(
    { length: width },
    (_, index) => header[index] || `Column ${index + 1}`,
  );

  return { headers, rows };
}

function columnValues(rows: string[][], index: number) {
  return rows.map((row) => row[index] ?? '').filter(Boolean);
}

function matchesContent(values: string[], test: (value: string) => boolean) {
  if (values.length === 0) return false;
  return values.filter(test).length / values.length >= MIN_CONTENT_MATCH;
}

function suggestMapping(headers: string[], rows: string[][]) {
  const names = headers.map(normalizeHeader);
  const values = headers.map((_, index) => columnValues(rows, index));
  const used = new Set<number>();
  const mapping: Partial<Record<MappedField, number>> = {};

  function assign(field: MappedField, index: number) {
    if (index === -1 || used.has(index) || mapping[field] !== undefined) return;
    mapping[field] = index;
    used.add(index);
  }

  // The data is better evidence than a header, so these are checked first
  assign(
    'email',
    values.findIndex((column) => matchesContent(column, (v) => !!normalizeEmail(v))),
  );
  assign(
    'profileUrl',
    values.findIndex((column) => matchesContent(column, (v) => /linkedin\.com\/in\//i.test(v))),
  );

  const fields = Object.keys(HEADER_ALIASES) as MappedField[];
  for (const field of fields) {
    assign(
      field,
      names.findIndex(
        (name, index) =>
          !used.has(index) && HEADER_ALIASES[field].includes(name),
      ),
    );
  }

  const detailColumns = names.flatMap((name, index) =>
    !used.has(index) && DETAIL_ALIASES.includes(name) ? [index] : [],
  );

  return { ...mapping, detailColumns };
}

export function previewCsv(buffer: Buffer) {
  const { headers, rows } = readCsv(buffer);

  return {
    rowCount: rows.length,
    columns: headers.map((name, index) => ({
      index,
      name,
      samples: columnValues(rows, index)
        .slice(0, SAMPLE_COUNT)
        .map((value) => value.slice(0, SAMPLE_LENGTH)),
    })),
    suggestion: suggestMapping(headers, rows),
  };
}

export function parseCandidateCsv(buffer: Buffer, mapping: CsvMapping) {
  const { headers, rows } = readCsv(buffer);

  const mapped = [
    mapping.name,
    mapping.lastName,
    mapping.email,
    mapping.profileUrl,
    mapping.headline,
    mapping.location,
    ...mapping.detailColumns,
  ];
  if (mapped.some((index) => index !== undefined && index >= headers.length)) {
    throw new CsvFormatError('That column is not in this file.');
  }
  if (mapping.email === undefined && mapping.profileUrl === undefined) {
    throw new CsvFormatError('Match an email or a profile URL column first.');
  }

  const cell = (row: string[], index: number | undefined) =>
    (index === undefined ? '' : row[index]) || null;

  const candidates: ParsedCandidate[] = [];
  let skipped = 0;

  for (const row of rows) {
    const email = normalizeEmail(cell(row, mapping.email) ?? undefined);
    const rawUrl = cell(row, mapping.profileUrl);
    const profileUrl = rawUrl ? normalizeProfileUrl(rawUrl) : null;

    // A row with neither can't be deduped or contacted
    if (!email && !profileUrl) {
      skipped += 1;
      continue;
    }

    const name = [cell(row, mapping.name), cell(row, mapping.lastName)]
      .filter(Boolean)
      .join(' ');
    const details = mapping.detailColumns
      .map((index) => row[index] && `${headers[index]}: ${row[index]}`)
      .filter(Boolean)
      .join('. ');

    candidates.push({
      name: name || null,
      email,
      profileUrl,
      headline: cell(row, mapping.headline),
      location: cell(row, mapping.location),
      snippet: details.slice(0, MAX_DETAIL_LENGTH) || null,
    });
  }

  return { candidates, skipped };
}
