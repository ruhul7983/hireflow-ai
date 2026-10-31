// src/sourcing/candidate-parser.ts
import { parse } from 'csv-parse/sync';

export type ParsedCandidate = {
  name: string | null;
  email: string | null;
  profileUrl: string | null;
  headline: string | null;
  location: string | null;
  snippet: string | null;
};

const LINKEDIN_PROFILE = /linkedin\.com\/in\/([^/?#]+)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CSV_COLUMNS: Record<keyof ParsedCandidate, string[]> = {
  name: ['name', 'full_name', 'fullname'],
  email: ['email', 'email_address'],
  profileUrl: ['profile_url', 'profileurl', 'linkedin', 'linkedin_url', 'url'],
  headline: ['headline', 'title', 'current_title'],
  location: ['location', 'city'],
  snippet: ['summary', 'notes', 'about', 'skills'],
};

// The same person appears on www., in. and other country subdomains
export function normalizeProfileUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const linkedin = trimmed.match(LINKEDIN_PROFILE);
  if (linkedin) {
    return `https://www.linkedin.com/in/${linkedin[1].toLowerCase()}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeEmail(email: string | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && EMAIL.test(trimmed) ? trimmed : null;
}

// Result titles look like "Jane Doe - Staff Engineer - Acme | LinkedIn". Anything
// else keeps a null name, because a guessed name would be invented data.
export function parseSearchResult(result: {
  title?: string;
  link?: string;
  snippet?: string;
}): ParsedCandidate | null {
  const profileUrl = result.link ? normalizeProfileUrl(result.link) : null;
  if (!profileUrl || !LINKEDIN_PROFILE.test(profileUrl)) return null;

  const title = (result.title ?? '').replace(/\s*[|–-]\s*LinkedIn\s*$/i, '');
  const [name, ...rest] = title.split(/\s+[-–]\s+/);

  return {
    name: name?.trim() || null,
    email: null,
    profileUrl,
    headline: rest.join(' - ').replace(/^[\s|·]+/, '').trim() || null,
    location: null,
    snippet: result.snippet?.trim() || null,
  };
}

function pick(row: Record<string, string>, columns: string[]) {
  const column = columns.find((name) => row[name]?.trim());
  return column ? row[column].trim() : null;
}

export function parseCandidateCsv(buffer: Buffer) {
  const rows = parse(buffer, {
    columns: (header: string[]) =>
      header.map((name) =>
        name.trim().toLowerCase().replace(/[\s-]+/g, '_'),
      ),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];

  const candidates: ParsedCandidate[] = [];
  let skipped = 0;

  for (const row of rows) {
    const email = normalizeEmail(pick(row, CSV_COLUMNS.email) ?? undefined);
    const rawUrl = pick(row, CSV_COLUMNS.profileUrl);
    const profileUrl = rawUrl ? normalizeProfileUrl(rawUrl) : null;

    // A row with neither can't be deduped or contacted
    if (!email && !profileUrl) {
      skipped += 1;
      continue;
    }

    candidates.push({
      name: pick(row, CSV_COLUMNS.name),
      email,
      profileUrl,
      headline: pick(row, CSV_COLUMNS.headline),
      location: pick(row, CSV_COLUMNS.location),
      snippet: pick(row, CSV_COLUMNS.snippet),
    });
  }

  return { candidates, skipped };
}
