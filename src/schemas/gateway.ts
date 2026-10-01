// Gateway frames are JSON objects with an `op`. Server events arrive as `dispatch` frames with a
// monotonically increasing `s` so a dropped connection can resume without missing anything.

import { z } from 'zod';
import type {
  Channel,
  Guild,
  GuildSnapshot,
  Member,
  Message,
  PresenceStatus,
  ReadState,
  Role,
  User,
} from './entities.js';
import { presenceStatusSchema } from './entities.js';

export const HEARTBEAT_INTERVAL_MS = 30_000;

export const GatewayCloseCode = {
  Normal: 1000,
  UnknownError: 4000,
  InvalidPayload: 4001,
  NotAuthenticated: 4003,
  AuthenticationFailed: 4004,
  AlreadyAuthenticated: 4005,
  SessionTimedOut: 4009,
  RateLimited: 4008,
} as const;

export const clientFrameSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('identify'), d: z.object({ token: z.string().max(256) }) }),
  z.object({
    op: z.literal('resume'),
    d: z.object({ token: z.string().max(256), sessionId: z.string().max(64), seq: z.number().int().min(0) }),
  }),
  z.object({ op: z.literal('heartbeat'), d: z.object({ seq: z.number().int().nullable() }) }),
  z.object({ op: z.literal('presence_update'), d: z.object({ status: presenceStatusSchema }) }),
]);
export type ClientFrame = z.infer<typeof clientFrameSchema>;

export interface ReadyPayload {
  sessionId: string;
  user: User;
  guilds: GuildSnapshot[];
  readStates: ReadState[];
}

export interface GatewayEvents {
  READY: ReadyPayload;
  RESUMED: Record<string, never>;
  GUILD_CREATE: GuildSnapshot;
  GUILD_UPDATE: Guild;
  GUILD_DELETE: { id: string };
  CHANNEL_CREATE: Channel;
  CHANNEL_UPDATE: Channel;
  CHANNEL_DELETE: { id: string; guildId: string };
  GUILD_ROLE_CREATE: Role;
  GUILD_ROLE_UPDATE: Role;
  GUILD_ROLE_DELETE: { id: string; guildId: string };
  GUILD_MEMBER_ADD: Member;
  GUILD_MEMBER_UPDATE: Member;
  GUILD_MEMBER_REMOVE: { guildId: string; userId: string };
  MESSAGE_CREATE: Message;
  MESSAGE_UPDATE: Message;
  MESSAGE_DELETE: { id: string; channelId: string; guildId: string };
  TYPING_START: { guildId: string; channelId: string; userId: string; timestamp: number };
  PRESENCE_UPDATE: { userId: string; status: PresenceStatus };
  USER_UPDATE: User;
  READ_STATE_UPDATE: ReadState;
}
export type GatewayEventName = keyof GatewayEvents;

export type DispatchFrame = {
  [K in GatewayEventName]: { op: 'dispatch'; t: K; s: number; d: GatewayEvents[K] };
}[GatewayEventName];

export type ServerFrame =
  | { op: 'hello'; d: { heartbeatInterval: number } }
  | { op: 'heartbeat_ack' }
  | { op: 'invalid_session'; d: { resumable: boolean } }
  | { op: 'reconnect' }
  | DispatchFrame;
