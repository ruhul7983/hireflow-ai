// src/sourcing/candidate-parser.ts
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

export function normalizeEmail(email: string | undefined): string | null {
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
