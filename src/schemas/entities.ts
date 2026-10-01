import { z } from 'zod';

export const snowflakeSchema = z.string().regex(/^\d{1,20}$/, 'Invalid id');
export const permissionsSchema = z.string().regex(/^\d{1,20}$/, 'Invalid permission bitfield');

export const userSchema = z.object({
  id: snowflakeSchema,
  handle: z.string(),
  instance: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string(),
  /** True if this account lives on the instance that served the object. */
  local: z.boolean(),
});
export type User = z.infer<typeof userSchema>;

export const presenceStatusSchema = z.enum(['online', 'idle', 'dnd', 'offline']);
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;

export const guildSchema = z.object({
  id: snowflakeSchema,
  name: z.string(),
  description: z.string(),
  iconUrl: z.string().nullable(),
  ownerId: snowflakeSchema,
  createdAt: z.number(),
});
export type Guild = z.infer<typeof guildSchema>;

export const overwriteSchema = z.object({
  id: snowflakeSchema,
  type: z.enum(['role', 'member']),
  allow: permissionsSchema,
  deny: permissionsSchema,
});
export type Overwrite = z.infer<typeof overwriteSchema>;

export const channelTypeSchema = z.enum(['text', 'category']);
export type ChannelType = z.infer<typeof channelTypeSchema>;

export const channelSchema = z.object({
  id: snowflakeSchema,
  guildId: snowflakeSchema,
  type: channelTypeSchema,
  name: z.string(),
  topic: z.string(),
  position: z.number().int(),
  parentId: snowflakeSchema.nullable(),
  overwrites: z.array(overwriteSchema),
  lastMessageId: snowflakeSchema.nullable(),
  /** Reserved for MLS end-to-end encrypted channels. Always false until that ships. */
  e2ee: z.boolean(),
});
export type Channel = z.infer<typeof channelSchema>;

export const roleSchema = z.object({
  id: snowflakeSchema,
  guildId: snowflakeSchema,
  name: z.string(),
  color: z.number().int().nullable(),
  position: z.number().int(),
  permissions: permissionsSchema,
  hoist: z.boolean(),
  mentionable: z.boolean(),
});
export type Role = z.infer<typeof roleSchema>;

export const memberSchema = z.object({
  guildId: snowflakeSchema,
  user: userSchema,
  nickname: z.string().nullable(),
  roleIds: z.array(snowflakeSchema),
  joinedAt: z.number(),
});
export type Member = z.infer<typeof memberSchema>;

export const messageReferenceSchema = z.object({
  id: snowflakeSchema,
  author: userSchema.nullable(),
  content: z.string(),
  deleted: z.boolean(),
});
export type MessageReference = z.infer<typeof messageReferenceSchema>;

export const messageSchema = z.object({
  id: snowflakeSchema,
  channelId: snowflakeSchema,
  guildId: snowflakeSchema,
  author: userSchema,
  content: z.string(),
  createdAt: z.number(),
  editedAt: z.number().nullable(),
  replyTo: messageReferenceSchema.nullable(),
  mentionIds: z.array(snowflakeSchema),
  mentionEveryone: z.boolean(),
  /** Echoes the client nonce on create so optimistic sends can be reconciled. */
  nonce: z.string().nullable().optional(),
  /** Reserved for MLS ciphertext envelopes. Always null until E2EE ships. */
  encryption: z.null(),
});
export type Message = z.infer<typeof messageSchema>;

export const readStateSchema = z.object({
  channelId: snowflakeSchema,
  lastReadMessageId: snowflakeSchema.nullable(),
  mentionCount: z.number().int(),
});
export type ReadState = z.infer<typeof readStateSchema>;

export const inviteSchema = z.object({
  code: z.string(),
  instance: z.string(),
  guild: z.object({
    id: snowflakeSchema,
    name: z.string(),
    iconUrl: z.string().nullable(),
    description: z.string(),
    memberCount: z.number().int(),
  }),
  channelId: snowflakeSchema,
  inviterId: snowflakeSchema.nullable(),
  uses: z.number().int(),
  maxUses: z.number().int().nullable(),
  expiresAt: z.number().nullable(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const banSchema = z.object({
  user: userSchema,
  reason: z.string(),
  createdAt: z.number(),
});
export type Ban = z.infer<typeof banSchema>;

export const sessionInfoSchema = z.object({
  id: z.string(),
  deviceName: z.string(),
  createdAt: z.number(),
  lastUsedAt: z.number(),
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof sessionInfoSchema>;

/** Everything a client needs to render one guild, sent in READY and GUILD_CREATE. */
export const guildSnapshotSchema = z.object({
  guild: guildSchema,
  channels: z.array(channelSchema),
  roles: z.array(roleSchema),
  members: z.array(memberSchema),
  presences: z.record(z.string(), presenceStatusSchema),
});
export type GuildSnapshot = z.infer<typeof guildSnapshotSchema>;

/** A guild the user has joined on any instance; kept on their home instance so devices stay in sync. */
export const guildIndexEntrySchema = z.object({
  instance: z.string(),
  guildId: snowflakeSchema,
  position: z.number().int(),
});
export type GuildIndexEntry = z.infer<typeof guildIndexEntrySchema>;
