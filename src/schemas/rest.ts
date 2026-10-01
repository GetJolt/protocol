import { z } from 'zod';
import { HANDLE_PATTERN } from '../address.js';
import { identityCertSchema } from '../identity.js';
import { Limits } from '../limits.js';
import {
  channelTypeSchema,
  guildIndexEntrySchema,
  overwriteSchema,
  permissionsSchema,
  presenceStatusSchema,
  snowflakeSchema,
  userSchema,
} from './entities.js';

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_PATTERN, 'Use 2–32 lowercase letters, numbers, dots, dashes or underscores');

export const passwordSchema = z.string().min(Limits.password.min).max(Limits.password.max);

export const registerBodySchema = z.object({
  handle: handleSchema,
  password: passwordSchema,
  displayName: trimmed(Limits.displayName.min, Limits.displayName.max).optional(),
  deviceName: z.string().max(64).optional(),
  inviteCode: z.string().max(64).optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  handle: handleSchema,
  password: z.string().max(Limits.password.max),
  deviceName: z.string().max(64).optional(),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const updateProfileBodySchema = z.object({
  displayName: trimmed(Limits.displayName.min, Limits.displayName.max).optional(),
  bio: z.string().max(Limits.bio).optional(),
  avatarUrl: z.url().max(512).nullable().optional(),
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const updatePresenceBodySchema = z.object({ status: presenceStatusSchema });

export const issueCertBodySchema = z.object({
  devicePublicKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Expected a base64url Ed25519 public key'),
});
export type IssueCertBody = z.infer<typeof issueCertBodySchema>;

export const federationChallengeResponseSchema = z.object({
  nonce: z.string(),
  expiresAt: z.number(),
});

export const federationAuthBodySchema = z.object({
  cert: identityCertSchema,
  nonce: z.string().max(128),
  signature: z.string().max(128),
  deviceName: z.string().max(64).optional(),
});
export type FederationAuthBody = z.infer<typeof federationAuthBodySchema>;

export const guildIndexBodySchema = z.object({
  entries: z.array(guildIndexEntrySchema).max(Limits.guildsPerUser),
});

export const createGuildBodySchema = z.object({
  name: trimmed(Limits.guildName.min, Limits.guildName.max),
  description: z.string().max(Limits.guildDescription).optional(),
});
export type CreateGuildBody = z.infer<typeof createGuildBodySchema>;

export const updateGuildBodySchema = z.object({
  name: trimmed(Limits.guildName.min, Limits.guildName.max).optional(),
  description: z.string().max(Limits.guildDescription).optional(),
  iconUrl: z.url().max(512).nullable().optional(),
});
export type UpdateGuildBody = z.infer<typeof updateGuildBodySchema>;

const channelName = z.string().trim().min(Limits.channelName.min).max(Limits.channelName.max);

export const createChannelBodySchema = z.object({
  name: channelName,
  type: channelTypeSchema.default('text'),
  topic: z.string().max(Limits.channelTopic).optional(),
  parentId: snowflakeSchema.nullable().optional(),
});
export type CreateChannelBody = z.input<typeof createChannelBodySchema>;

export const updateChannelBodySchema = z.object({
  name: channelName.optional(),
  topic: z.string().max(Limits.channelTopic).optional(),
  parentId: snowflakeSchema.nullable().optional(),
  overwrites: z.array(overwriteSchema).max(100).optional(),
});
export type UpdateChannelBody = z.infer<typeof updateChannelBodySchema>;

export const reorderBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: snowflakeSchema,
        position: z.number().int().min(0),
        parentId: snowflakeSchema.nullable().optional(),
      }),
    )
    .max(500),
});
export type ReorderBody = z.infer<typeof reorderBodySchema>;

export const createRoleBodySchema = z.object({
  name: trimmed(Limits.roleName.min, Limits.roleName.max).default('new role'),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  permissions: permissionsSchema.optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});
export type CreateRoleBody = z.input<typeof createRoleBodySchema>;

export const updateRoleBodySchema = createRoleBodySchema.partial().extend({
  name: trimmed(Limits.roleName.min, Limits.roleName.max).optional(),
});
export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;

export const updateMemberBodySchema = z.object({
  nickname: z.string().trim().max(Limits.nickname).nullable().optional(),
  roleIds: z.array(snowflakeSchema).max(Limits.rolesPerGuild).optional(),
});
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;

export const banBodySchema = z.object({
  reason: z.string().max(512).optional(),
});

export const createMessageBodySchema = z.object({
  content: z
    .string()
    .max(Limits.messageLength)
    .refine((s) => s.trim().length > 0, 'Message cannot be empty'),
  nonce: z.string().max(64).optional(),
  replyToId: snowflakeSchema.optional(),
});
export type CreateMessageBody = z.infer<typeof createMessageBodySchema>;

export const updateMessageBodySchema = z.object({
  content: z
    .string()
    .max(Limits.messageLength)
    .refine((s) => s.trim().length > 0, 'Message cannot be empty'),
});
export type UpdateMessageBody = z.infer<typeof updateMessageBodySchema>;

export const listMessagesQuerySchema = z.object({
  before: snowflakeSchema.optional(),
  after: snowflakeSchema.optional(),
  around: snowflakeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(Limits.maxMessagesPerPage).default(Limits.messagesPerPage),
});
export type ListMessagesQuery = z.input<typeof listMessagesQuerySchema>;

export const createInviteBodySchema = z.object({
  maxUses: z.number().int().min(1).max(10_000).nullable().optional(),
  maxAgeSeconds: z
    .number()
    .int()
    .min(60)
    .max(60 * 60 * 24 * 30)
    .nullable()
    .optional(),
});
export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    retryAfterMs: z.number().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const ErrorCode = {
  BadRequest: 'bad_request',
  Validation: 'validation_failed',
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  Conflict: 'conflict',
  RateLimited: 'rate_limited',
  RegistrationClosed: 'registration_closed',
  InvalidCredentials: 'invalid_credentials',
  FederationDenied: 'federation_denied',
  InvalidCert: 'invalid_cert',
  Banned: 'banned',
  InviteInvalid: 'invite_invalid',
  Internal: 'internal_error',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
