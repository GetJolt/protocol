import { describe, expect, it } from 'vitest';
import { detectFacets, segmentRichText, utf16ToUtf8Offset, utf8ToUtf16Offset } from '../src/richtext.js';

describe('detectFacets', () => {
  it('finds links, mentions and tags in order', () => {
    const text = 'Hi @bob and @alice@mastodon.social! See https://joltapp.org/docs. #jolt';
    const facets = detectFacets(text);
    expect(facets.map((f) => [f.kind, f.value, text.slice(f.start, f.end)])).toEqual([
      ['mention', 'bob', '@bob'],
      ['mention', 'alice@mastodon.social', '@alice@mastodon.social'],
      ['link', 'https://joltapp.org/docs', 'https://joltapp.org/docs'],
      ['tag', 'jolt', '#jolt'],
    ]);
  });

  it('keeps balanced brackets in links but not sentence punctuation', () => {
    const text = 'Read (https://en.wikipedia.org/wiki/Jolt_(drink)), it is great.';
    const [link] = detectFacets(text);
    expect(link!.value).toBe('https://en.wikipedia.org/wiki/Jolt_(drink)');
  });

  it('ignores emails, tags inside links and number-only tags', () => {
    const facets = detectFacets('mail me@example.com, see https://x.example/#top and #2024 or #win');
    expect(facets.map((f) => f.kind + ':' + f.value)).toEqual(['link:https://x.example/#top', 'tag:win']);
  });

  it('supports dev instances with ports and unicode tags', () => {
    const facets = detectFacets('@bob@localhost:4200 #café');
    expect(facets.map((f) => f.value)).toEqual(['bob@localhost:4200', 'café']);
  });
});

describe('segmentRichText', () => {
  it('splits text around facets and skips overlaps', () => {
    const text = 'hello @bob there';
    const parts = segmentRichText({
      text,
      facets: [
        { start: 6, end: 10, kind: 'mention', value: 'bob' },
        { start: 8, end: 12, kind: 'tag', value: 'x' },
      ],
    });
    expect(parts.map((p) => p.text)).toEqual(['hello ', '@bob', ' there']);
  });
});

describe('UTF-8 and UTF-16 offsets', () => {
  it('round-trips through emoji and accents', () => {
    const text = 'é 🎉 #tag';
    const index = text.indexOf('#tag');
    const bytes = utf16ToUtf8Offset(text, index);
    expect(bytes).toBe(8);
    expect(utf8ToUtf16Offset(text, bytes)).toBe(index);
  });
});
