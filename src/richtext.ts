// Posts are plain text plus facets: ranges that are links, mentions or hashtags. Every source (Jolt,
// ActivityPub HTML, Bluesky) is normalised to this, so clients render one format and never inject HTML.
// Offsets are UTF-16 code units, which is what JavaScript strings index by.

export type FacetKind = 'link' | 'mention' | 'tag';

export interface Facet {
  start: number;
  end: number;
  kind: FacetKind;
  /** The URL for links, the `handle@instance` address for mentions, and the tag without `#` for tags. */
  value: string;
  /** Set on mentions the server resolved to a known user. */
  userId?: string;
}

export interface RichText {
  text: string;
  facets: Facet[];
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const MENTION_PATTERN =
  /(^|[^\w@/.])@([a-z0-9_][a-z0-9_.-]{0,63})(?:@((?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{1,5})?|localhost(?::\d{1,5})?))?/gi;
const TAG_PATTERN = /(^|[^\w&#/])#([\p{L}\p{N}_]{1,64})/gu;

/** Trailing punctuation usually belongs to the sentence, not the URL, unless it closes a bracket in it. */
function trimUrl(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1]!;
    if ('.,;:!?\'"'.includes(ch)) {
      end--;
    } else if (ch === ')' && count(url.slice(0, end), '(') < count(url.slice(0, end), ')')) {
      end--;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Finds links, `@handle` or `@handle@instance` mentions and `#tags`. A mention without an instance is
 * returned as just the handle; the server qualifies it with its own domain.
 */
export function detectFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    if (url.length > 'https://'.length) {
      facets.push({ start: match.index, end: match.index + url.length, kind: 'link', value: url });
    }
  }
  const insideLink = (pos: number) => facets.some((f) => f.kind === 'link' && pos >= f.start && pos < f.end);

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const start = match.index + match[1]!.length;
    if (insideLink(start)) continue;
    const handle = match[2]!.replace(/[.-]+$/, '');
    const instance = match[3];
    const end = start + 1 + handle.length + (instance ? instance.length + 1 : 0);
    facets.push({
      start,
      end,
      kind: 'mention',
      value: (instance ? `${handle}@${instance}` : handle).toLowerCase(),
    });
  }

  for (const match of text.matchAll(TAG_PATTERN)) {
    const start = match.index + match[1]!.length;
    const tag = match[2]!;
    if (insideLink(start) || /^\d+$/.test(tag)) continue;
    facets.push({ start, end: start + 1 + tag.length, kind: 'tag', value: tag });
  }
  return facets.sort((a, b) => a.start - b.start);
}

/** Splits text into plain runs and facet runs, in order, for rendering. Overlapping facets are dropped. */
export function segmentRichText({ text, facets }: RichText): Array<{ text: string; facet?: Facet }> {
  const parts: Array<{ text: string; facet?: Facet }> = [];
  let cursor = 0;
  for (const facet of [...facets].sort((a, b) => a.start - b.start)) {
    if (facet.start < cursor || facet.end > text.length || facet.end <= facet.start) continue;
    if (facet.start > cursor) parts.push({ text: text.slice(cursor, facet.start) });
    parts.push({ text: text.slice(facet.start, facet.end), facet });
    cursor = facet.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

/** Converts a UTF-8 byte offset (Bluesky's facet unit) into a UTF-16 index into the same string. */
export function utf8ToUtf16Offset(text: string, byteOffset: number): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    if (bytes >= byteOffset) return i;
    const code = text.codePointAt(i)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (code >= 0x10000) i++;
  }
  return text.length;
}

/** The reverse of {@link utf8ToUtf16Offset}, for sending facets to Bluesky. */
export function utf16ToUtf8Offset(text: string, index: number): number {
  return new TextEncoder().encode(text.slice(0, index)).length;
}
