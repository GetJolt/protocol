import { describe, expect, it } from 'vitest';
import {
  federationChallengeMessage,
  generateKeyPair,
  issueIdentityCert,
  newCertSerial,
  signBytes,
  verifyBytes,
  verifyIdentityCert,
  type IdentityCert,
  type KeyPair,
} from '../src/identity.js';

const INSTANCE = 'a.example';
const now = 1_800_000_000;

async function setup() {
  const instanceKey = await generateKeyPair();
  const device = await generateKeyPair();
  const keys = [{ kid: 'k1', publicKey: instanceKey.publicKey, notAfter: null }];
  const cert = await issueIdentityCert(
    {
      sub: `alice@${INSTANCE}`,
      uid: '42',
      instance: INSTANCE,
      kid: 'k1',
      devicePublicKey: device.publicKey,
      iat: now,
      exp: now + 3600,
      serial: newCertSerial(),
    },
    instanceKey.secretKey,
  );
  return { instanceKey, device, keys, cert };
}

describe('identity certificates', () => {
  it('verifies a freshly issued cert', async () => {
    const { cert, keys } = await setup();
    expect(await verifyIdentityCert(cert, keys, INSTANCE, now)).toEqual({ ok: true });
  });

  it('rejects a tampered payload', async () => {
    const { cert, keys } = await setup();
    const forged: IdentityCert = { ...cert, payload: { ...cert.payload, sub: `mallory@${INSTANCE}` } };
    expect(await verifyIdentityCert(forged, keys, INSTANCE, now)).toEqual({
      ok: false,
      error: 'bad_signature',
    });
  });

  it('rejects a cert signed by a different key under the same kid', async () => {
    const { cert } = await setup();
    const other: KeyPair = await generateKeyPair();
    const keys = [{ kid: 'k1', publicKey: other.publicKey, notAfter: null }];
    expect(await verifyIdentityCert(cert, keys, INSTANCE, now)).toEqual({
      ok: false,
      error: 'bad_signature',
    });
  });

  it('rejects expired and future certs', async () => {
    const { cert, keys } = await setup();
    expect(await verifyIdentityCert(cert, keys, INSTANCE, now + 7200)).toEqual({
      ok: false,
      error: 'expired',
    });
    expect(await verifyIdentityCert(cert, keys, INSTANCE, now - 3600)).toEqual({
      ok: false,
      error: 'not_yet_valid',
    });
  });

  it('rejects a cert presented as coming from another instance', async () => {
    const { cert, keys } = await setup();
    expect(await verifyIdentityCert(cert, keys, 'evil.example', now)).toEqual({
      ok: false,
      error: 'instance_mismatch',
    });
  });

  it('rejects unknown and retired keys', async () => {
    const { cert, instanceKey } = await setup();
    expect(await verifyIdentityCert(cert, [], INSTANCE, now)).toEqual({ ok: false, error: 'unknown_key' });
    const retired = [{ kid: 'k1', publicKey: instanceKey.publicKey, notAfter: now - 1 }];
    expect(await verifyIdentityCert(cert, retired, INSTANCE, now)).toEqual({
      ok: false,
      error: 'key_expired',
    });
  });

  it('binds challenge signatures to the target instance', async () => {
    const { device } = await setup();
    const signature = await signBytes(federationChallengeMessage('b.example', 'nonce'), device.secretKey);
    expect(
      await verifyBytes(signature, federationChallengeMessage('b.example', 'nonce'), device.publicKey),
    ).toBe(true);
    expect(
      await verifyBytes(signature, federationChallengeMessage('c.example', 'nonce'), device.publicKey),
    ).toBe(false);
  });
});
