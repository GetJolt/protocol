import { describe, expect, it } from 'vitest';
import { formatAddress, isValidInstance, parseAddress } from '../src/address.js';
import { canonicalJson, fromBase64Url, toBase64Url } from '../src/encoding.js';
import { extractUserMentions, mentionsEveryone } from '../src/mentions.js';
import { compareSnowflakes, createSnowflakeGenerator, snowflakeTime } from '../src/snowflake.js';
import { createMessageBodySchema, registerBodySchema } from '../src/schemas/rest.js';

describe('snowflakes', () => {
  it('are unique and increasing even within one millisecond', () => {
    const next = createSnowflakeGenerator(1);
    const ids = Array.from({ length: 5000 }, () => next(1_800_000_000_000));
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++) expect(compareSnowflakes(ids[i - 1]!, ids[i]!)).toBe(-1);
  });

  it('encode their creation time', () => {
    const next = createSnowflakeGenerator();
    expect(snowflakeTime(next(1_800_000_000_123))).toBe(1_800_000_000_123);
  });

  it('stay monotonic when the clock goes backwards', () => {
    const next = createSnowflakeGenerator();
    const a = next(1_800_000_000_500);
    const b = next(1_800_000_000_100);
    expect(compareSnowflakes(a, b)).toBe(-1);
  });
});

describe('addresses', () => {
  it('parses and normalizes', () => {
    expect(parseAddress('Alice@Jolt.Chat')).toEqual({ handle: 'alice', instance: 'jolt.chat' });
    expect(parseAddress('bob@localhost:4001')).toEqual({ handle: 'bob', instance: 'localhost:4001' });
    expect(formatAddress({ handle: 'a1', instance: 'x.y' })).toBe('a1@x.y');
  });

  it('rejects junk', () => {
    expect(parseAddress('nobody')).toBeNull();
    expect(parseAddress('@jolt.chat')).toBeNull();
    expect(parseAddress('a@bad_domain!')).toBeNull();
    expect(isValidInstance('jolt.chat/evil')).toBe(false);
  });
});

describe('encoding', () => {
  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 1, 2, 3]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('produces canonical json regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 'x'], c: null } })).toBe(
      canonicalJson({ a: { c: null, d: [1, 'x'] }, b: 1 }),
    );
    expect(canonicalJson({ a: undefined, b: 2 })).toBe('{"b":2}');
  });
});

describe('mentions', () => {
  it('extracts unique user mentions', () => {
    expect(extractUserMentions('hi <@12> and <@34> and <@12>')).toEqual(['12', '34']);
  });

  it('detects @everyone but not inside words or code', () => {
    expect(mentionsEveryone('hey @everyone')).toBe(true);
    expect(mentionsEveryone('email@everyone.com')).toBe(false);
    expect(mentionsEveryone('`@everyone`')).toBe(false);
  });
});

describe('schemas', () => {
  it('normalizes handles on register', () => {
    const parsed = registerBodySchema.parse({ handle: '  Alice ', password: 'correct horse' });
    expect(parsed.handle).toBe('alice');
  });

  it('rejects whitespace-only messages', () => {
    expect(createMessageBodySchema.safeParse({ content: '   ' }).success).toBe(false);
  });
});
