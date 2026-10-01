import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  computeBasePermissions,
  computeChannelPermissions,
  DEFAULT_EVERYONE_PERMISSIONS,
  hasPermission,
  outranks,
  Permission,
  type PermissionContext,
  type PermissionOverwrite,
} from '../src/permissions.js';

const GUILD = '100';
const OWNER = '1';
const ALICE = '2';
const MOD_ROLE = '200';
const MUTED_ROLE = '201';

const s = (bits: bigint) => bits.toString();

function ctx(overrides: Partial<PermissionContext> = {}): PermissionContext {
  return {
    guildId: GUILD,
    ownerId: OWNER,
    userId: ALICE,
    memberRoleIds: [],
    roles: [
      { id: GUILD, permissions: s(DEFAULT_EVERYONE_PERMISSIONS), position: 0 },
      { id: MOD_ROLE, permissions: s(Permission.MANAGE_MESSAGES | Permission.KICK_MEMBERS), position: 2 },
      { id: MUTED_ROLE, permissions: '0', position: 1 },
    ],
    ...overrides,
  };
}

describe('computeBasePermissions', () => {
  it('gives the owner everything', () => {
    expect(computeBasePermissions(ctx({ userId: OWNER }))).toBe(ALL_PERMISSIONS);
  });

  it('starts from @everyone and ORs in member roles', () => {
    expect(computeBasePermissions(ctx())).toBe(DEFAULT_EVERYONE_PERMISSIONS);
    const perms = computeBasePermissions(ctx({ memberRoleIds: [MOD_ROLE] }));
    expect(hasPermission(perms, Permission.MANAGE_MESSAGES)).toBe(true);
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(true);
    expect(hasPermission(perms, Permission.BAN_MEMBERS)).toBe(false);
  });

  it('expands administrator to all permissions', () => {
    const c = ctx({ memberRoleIds: ['300'] });
    c.roles = [...c.roles, { id: '300', permissions: s(Permission.ADMINISTRATOR), position: 3 }];
    expect(computeBasePermissions(c)).toBe(ALL_PERMISSIONS);
  });

  it('ignores role ids that do not exist', () => {
    expect(computeBasePermissions(ctx({ memberRoleIds: ['999'] }))).toBe(DEFAULT_EVERYONE_PERMISSIONS);
  });
});

describe('computeChannelPermissions', () => {
  const ow = (id: string, type: 'role' | 'member', allow = 0n, deny = 0n): PermissionOverwrite => ({
    id,
    type,
    allow: s(allow),
    deny: s(deny),
  });

  it('applies the @everyone overwrite', () => {
    const perms = computeChannelPermissions(ctx(), [ow(GUILD, 'role', 0n, Permission.SEND_MESSAGES)]);
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(false);
    expect(hasPermission(perms, Permission.VIEW_CHANNEL)).toBe(true);
  });

  it('lets a role allow beat another role deny', () => {
    const perms = computeChannelPermissions(ctx({ memberRoleIds: [MOD_ROLE, MUTED_ROLE] }), [
      ow(MUTED_ROLE, 'role', 0n, Permission.SEND_MESSAGES),
      ow(MOD_ROLE, 'role', Permission.SEND_MESSAGES),
    ]);
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(true);
  });

  it('applies member overwrites last', () => {
    const perms = computeChannelPermissions(ctx({ memberRoleIds: [MOD_ROLE] }), [
      ow(MOD_ROLE, 'role', Permission.SEND_MESSAGES),
      ow(ALICE, 'member', 0n, Permission.SEND_MESSAGES),
    ]);
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(false);
  });

  it('ignores overwrites for roles the member does not have', () => {
    const perms = computeChannelPermissions(ctx(), [ow(MUTED_ROLE, 'role', 0n, Permission.SEND_MESSAGES)]);
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(true);
  });

  it('removes everything when the channel is hidden', () => {
    const perms = computeChannelPermissions(ctx(), [ow(GUILD, 'role', 0n, Permission.VIEW_CHANNEL)]);
    expect(perms).toBe(0n);
  });

  it('cannot hide a channel from the owner or an administrator', () => {
    const hidden = [ow(GUILD, 'role', 0n, Permission.VIEW_CHANNEL)];
    expect(computeChannelPermissions(ctx({ userId: OWNER }), hidden)).toBe(ALL_PERMISSIONS);
  });
});

describe('outranks', () => {
  const c = ctx();
  it('owner outranks everyone and nobody outranks the owner', () => {
    expect(outranks(c, { userId: OWNER, roleIds: [] }, { userId: ALICE, roleIds: [MOD_ROLE] })).toBe(true);
    expect(outranks(c, { userId: ALICE, roleIds: [MOD_ROLE] }, { userId: OWNER, roleIds: [] })).toBe(false);
  });

  it('compares highest role positions', () => {
    expect(outranks(c, { userId: ALICE, roleIds: [MOD_ROLE] }, { userId: '3', roleIds: [MUTED_ROLE] })).toBe(
      true,
    );
    expect(
      outranks(c, { userId: ALICE, roleIds: [MUTED_ROLE] }, { userId: '3', roleIds: [MUTED_ROLE] }),
    ).toBe(false);
  });

  it('never lets a member act on themselves', () => {
    expect(outranks(c, { userId: ALICE, roleIds: [MOD_ROLE] }, { userId: ALICE, roleIds: [] })).toBe(false);
  });
});
