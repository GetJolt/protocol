import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const WELL_KNOWN_PATH = '/.well-known/jolt';
export const API_PREFIX = '/api/v1';
export const GATEWAY_PATH = '/gateway';

export const instanceInfoSchema = z.object({
  software: z.literal('jolt'),
  protocolVersion: z.number().int(),
  domain: z.string(),
  name: z.string(),
  description: z.string(),
  registration: z.enum(['open', 'invite', 'closed']),
  federation: z.enum(['open', 'allowlist', 'disabled']),
  keys: z.array(
    z.object({
      kid: z.string(),
      publicKey: z.string(),
      notAfter: z.number().nullable(),
    }),
  ),
});
export type InstanceInfo = z.infer<typeof instanceInfoSchema>;
