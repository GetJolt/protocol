// Federated identity. A user's home instance signs a short-lived certificate binding their address to a
// device key; any other instance can verify it against the home instance's published keys.

import * as ed from '@noble/ed25519';
import { z } from 'zod';
import { canonicalJson, fromBase64Url, randomBytes, toBase64Url, utf8 } from './encoding.js';

export const IDENTITY_CERT_VERSION = 1;
export const IDENTITY_CERT_TTL_SECONDS = 24 * 60 * 60;
/** Tolerated clock difference between instances. */
export const CLOCK_SKEW_SECONDS = 5 * 60;

export const identityCertPayloadSchema = z.object({
  v: z.literal(IDENTITY_CERT_VERSION),
  sub: z.string().max(300),
  uid: z.string(),
  instance: z.string().max(260),
  kid: z.string().max(64),
  devicePublicKey: z.string().max(64),
  iat: z.number().int(),
  exp: z.number().int(),
  serial: z.string().max(64),
});
export type IdentityCertPayload = z.infer<typeof identityCertPayloadSchema>;

export const identityCertSchema = z.object({
  payload: identityCertPayloadSchema,
  signature: z.string().max(128),
});
export type IdentityCert = z.infer<typeof identityCertSchema>;

export interface PublicInstanceKey {
  kid: string;
  publicKey: string;
  notAfter: number | null;
}

export interface KeyPair {
  secretKey: string;
  publicKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  return { secretKey: toBase64Url(secretKey), publicKey: toBase64Url(publicKey) };
}

export async function signBytes(message: Uint8Array, secretKey: string): Promise<string> {
  return toBase64Url(await ed.signAsync(message, fromBase64Url(secretKey)));
}

export async function verifyBytes(
  signature: string,
  message: Uint8Array,
  publicKey: string,
): Promise<boolean> {
  try {
    return await ed.verifyAsync(fromBase64Url(signature), message, fromBase64Url(publicKey));
  } catch {
    return false;
  }
}

export function newCertSerial(): string {
  return toBase64Url(randomBytes(16));
}

export async function issueIdentityCert(
  payload: Omit<IdentityCertPayload, 'v'>,
  instanceSecretKey: string,
): Promise<IdentityCert> {
  const full: IdentityCertPayload = { v: IDENTITY_CERT_VERSION, ...payload };
  return { payload: full, signature: await signBytes(utf8(canonicalJson(full)), instanceSecretKey) };
}

export type CertVerificationError =
  | 'malformed'
  | 'unknown_key'
  | 'key_expired'
  | 'bad_signature'
  | 'not_yet_valid'
  | 'expired'
  | 'instance_mismatch';

export async function verifyIdentityCert(
  cert: IdentityCert,
  instanceKeys: readonly PublicInstanceKey[],
  expectedInstance: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ ok: true } | { ok: false; error: CertVerificationError }> {
  const parsed = identityCertSchema.safeParse(cert);
  if (!parsed.success) return { ok: false, error: 'malformed' };
  const { payload, signature } = parsed.data;

  if (payload.instance !== expectedInstance || !payload.sub.endsWith(`@${expectedInstance}`)) {
    return { ok: false, error: 'instance_mismatch' };
  }

  const key = instanceKeys.find((k) => k.kid === payload.kid);
  if (!key) return { ok: false, error: 'unknown_key' };
  if (key.notAfter !== null && payload.iat > key.notAfter) return { ok: false, error: 'key_expired' };

  if (!(await verifyBytes(signature, utf8(canonicalJson(payload)), key.publicKey))) {
    return { ok: false, error: 'bad_signature' };
  }
  if (payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) return { ok: false, error: 'not_yet_valid' };
  if (payload.exp < nowSeconds - CLOCK_SKEW_SECONDS) return { ok: false, error: 'expired' };

  return { ok: true };
}

/**
 * The string a device signs to prove it holds the certified key. It names the target instance so a
 * malicious instance can't replay a signature it received against some other instance.
 */
export function federationChallengeMessage(targetInstance: string, nonce: string): Uint8Array {
  return utf8(`jolt-federation-auth:v1:${targetInstance}:${nonce}`);
}
