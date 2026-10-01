// Permission bitfields travel as decimal strings so they survive JSON once we pass 53 bits.

export const Permission = {
  VIEW_CHANNEL: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  READ_MESSAGE_HISTORY: 1n << 2n,
  MANAGE_MESSAGES: 1n << 3n,
  MENTION_EVERYONE: 1n << 4n,
  CREATE_INVITE: 1n << 5n,
  CHANGE_NICKNAME: 1n << 6n,
  MANAGE_NICKNAMES: 1n << 7n,
  MANAGE_CHANNELS: 1n << 8n,
  MANAGE_ROLES: 1n << 9n,
  MANAGE_GUILD: 1n << 10n,
  KICK_MEMBERS: 1n << 11n,
  BAN_MEMBERS: 1n << 12n,
  ADMINISTRATOR: 1n << 13n,
} as const;

export type PermissionName = keyof typeof Permission;

export const ALL_PERMISSIONS = Object.values(Permission).reduce((acc, bit) => acc | bit, 0n);

export const DEFAULT_EVERYONE_PERMISSIONS =
  Permission.VIEW_CHANNEL |
  Permission.SEND_MESSAGES |
  Permission.READ_MESSAGE_HISTORY |
  Permission.CREATE_INVITE |
  Permission.CHANGE_NICKNAME;

export const PERMISSION_INFO: Record<PermissionName, { label: string; description: string }> = {
  VIEW_CHANNEL: { label: 'View channels', description: 'See channels and read new messages in them.' },
  SEND_MESSAGES: { label: 'Send messages', description: 'Post messages in text channels.' },
  READ_MESSAGE_HISTORY: {
    label: 'Read message history',
    description: 'Scroll back through earlier messages.',
  },
  MANAGE_MESSAGES: { label: 'Manage messages', description: "Delete other members' messages." },
  MENTION_EVERYONE: { label: 'Mention @everyone', description: 'Notify every member of a channel at once.' },
  CREATE_INVITE: { label: 'Create invites', description: 'Invite new people to this server.' },
  CHANGE_NICKNAME: { label: 'Change nickname', description: 'Change their own nickname in this server.' },
  MANAGE_NICKNAMES: { label: 'Manage nicknames', description: "Change other members' nicknames." },
  MANAGE_CHANNELS: { label: 'Manage channels', description: 'Create, edit and delete channels.' },
  MANAGE_ROLES: { label: 'Manage roles', description: 'Create and edit roles below their highest role.' },
  MANAGE_GUILD: { label: 'Manage server', description: 'Change the server name, icon and description.' },
  KICK_MEMBERS: { label: 'Kick members', description: 'Remove members, who can rejoin with an invite.' },
  BAN_MEMBERS: { label: 'Ban members', description: 'Remove members and stop them rejoining.' },
  ADMINISTRATOR: {
    label: 'Administrator',
    description: 'Every permission, and channel overrides no longer apply. Grant with care.',
  },
};

export function parsePermissions(value: string | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export function serializePermissions(value: bigint): string {
  return value.toString();
}

export function hasPermission(permissions: bigint, required: bigint): boolean {
  if ((permissions & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (permissions & required) === required;
}

export interface PermissionRole {
  id: string;
  permissions: string;
  position: number;
}

export interface PermissionOverwrite {
  id: string;
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

export interface PermissionContext {
  guildId: string;
  ownerId: string;
  userId: string;
  memberRoleIds: readonly string[];
  roles: readonly PermissionRole[];
}

// The @everyone role shares its id with the guild, same convention as Discord.
export function computeBasePermissions(ctx: PermissionContext): bigint {
  if (ctx.userId === ctx.ownerId) return ALL_PERMISSIONS;

  const byId = new Map(ctx.roles.map((role) => [role.id, role]));
  let permissions = parsePermissions(byId.get(ctx.guildId)?.permissions ?? '0');
  for (const roleId of ctx.memberRoleIds) {
    const role = byId.get(roleId);
    if (role) permissions |= parsePermissions(role.permissions);
  }

  return permissions & Permission.ADMINISTRATOR ? ALL_PERMISSIONS : permissions;
}

export function computeChannelPermissions(
  ctx: PermissionContext,
  overwrites: readonly PermissionOverwrite[],
): bigint {
  let permissions = computeBasePermissions(ctx);
  if (permissions & Permission.ADMINISTRATOR) return ALL_PERMISSIONS;

  const everyone = overwrites.find((o) => o.type === 'role' && o.id === ctx.guildId);
  if (everyone) {
    permissions &= ~parsePermissions(everyone.deny);
    permissions |= parsePermissions(everyone.allow);
  }

  // Role overwrites are merged before applying, so one role's allow beats another role's deny.
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const overwrite of overwrites) {
    if (
      overwrite.type === 'role' &&
      overwrite.id !== ctx.guildId &&
      ctx.memberRoleIds.includes(overwrite.id)
    ) {
      roleAllow |= parsePermissions(overwrite.allow);
      roleDeny |= parsePermissions(overwrite.deny);
    }
  }
  permissions &= ~roleDeny;
  permissions |= roleAllow;

  const member = overwrites.find((o) => o.type === 'member' && o.id === ctx.userId);
  if (member) {
    permissions &= ~parsePermissions(member.deny);
    permissions |= parsePermissions(member.allow);
  }

  return permissions & Permission.VIEW_CHANNEL ? permissions : 0n;
}

export function highestRolePosition(ctx: Pick<PermissionContext, 'memberRoleIds' | 'roles'>): number {
  let highest = 0;
  for (const role of ctx.roles) {
    if (ctx.memberRoleIds.includes(role.id) && role.position > highest) highest = role.position;
  }
  return highest;
}

/** Whether `actor` outranks `target` in the role hierarchy (the owner outranks everyone). */
export function outranks(
  ctx: Omit<PermissionContext, 'userId' | 'memberRoleIds'>,
  actor: { userId: string; roleIds: readonly string[] },
  target: { userId: string; roleIds: readonly string[] },
): boolean {
  if (actor.userId === target.userId) return false;
  if (actor.userId === ctx.ownerId) return true;
  if (target.userId === ctx.ownerId) return false;
  return (
    highestRolePosition({ memberRoleIds: actor.roleIds, roles: ctx.roles }) >
    highestRolePosition({ memberRoleIds: target.roleIds, roles: ctx.roles })
  );
}
