export interface KomootTourLink {
  tourId: string;
  shareToken?: string;
}

const KOMOOT_HOSTS = new Set(['komoot.com', 'www.komoot.com']);
const MAX_LINK_LENGTH = 4096;
const MAX_SHARE_TOKEN_LENGTH = 512;

/** Parse and validate a Komoot Tour share link without retaining its tracking parameters. */
export function parseKomootTourUrl(value: string): KomootTourLink {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Paste a Komoot Tour share link.');
  }
  if (trimmed.length > MAX_LINK_LENGTH) {
    throw new Error('The Komoot link is too long.');
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid Komoot Tour share link.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Komoot links must use HTTPS.');
  }
  if (url.username || url.password || !KOMOOT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Use a link from komoot.com.');
  }

  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tour\/(\d{1,20})\/?$/i);
  if (!match) {
    throw new Error('Use a Tour link in the form komoot.com/tour/123456.');
  }

  const shareToken = url.searchParams.get('share_token')?.trim() || undefined;
  if (shareToken && shareToken.length > MAX_SHARE_TOKEN_LENGTH) {
    throw new Error('The Komoot share token is invalid.');
  }

  return {
    tourId: match[1],
    ...(shareToken ? { shareToken } : {}),
  };
}
