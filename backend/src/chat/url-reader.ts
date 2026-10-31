// src/chat/url-reader.ts
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 2_000_000;
const MAX_TEXT_LENGTH = 15_000;

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

function isPrivateAddress(address: string) {
  const mapped = address.replace(/^::ffff:/i, '');
  if (isIP(mapped) === 4) {
    return PRIVATE_V4.some((range) => range.test(mapped));
  }
  return /^(::1?$|f[cd]|fe[89ab])/i.test(address);
}

// The recruiter supplies this URL, so it must not reach the server's own network
async function assertPublicUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https links are supported');
  }

  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('That address is not public');
  }
  return url;
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function readPublicPage(rawUrl: string): Promise<string> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HireFlowBot/1.0)' },
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`The page returned status ${response.status}`);
    }

    const body = await response.text();
    if (body.length > MAX_BYTES) {
      throw new Error('The page is too large');
    }
    return htmlToText(body);
  }

  throw new Error('The link redirected too many times');
}
