# @getjolt/protocol

This is the shared language of Jolt. Servers and clients both depend on it, so it's where we define what a message looks like, how permissions are calculated, how IDs are generated and how one instance proves who you are to another.

If you're building a Jolt client you probably want [`@getjolt/sdk`](https://github.com/GetJolt/sdk) instead, which uses this package under the hood. Reach for the protocol directly when you're writing a server, a bot that speaks raw REST, or tooling that needs to validate Jolt data.

## Install

```sh
npm install @getjolt/protocol
```

It's ESM only and needs Web Crypto, so Node 20 or newer, any modern browser, Deno and Bun all work. The only dependencies are [zod](https://zod.dev) and [@noble/ed25519](https://github.com/paulmillr/noble-ed25519).

## What's inside

Every request and event has a zod schema and a matching TypeScript type, so you can validate untrusted input and get types from the same place:

```ts
import { createMessageBodySchema, type Message } from '@getjolt/protocol';

const body = createMessageBodySchema.parse(await request.json());
```

Permissions work like they do in Discord: the server owner can do anything, then the `@everyone` role, then the member's roles, then channel overrides. `computeChannelPermissions` is the reference implementation, and the server and the clients both call it so they can never disagree about who can do what.

```ts
import { computeChannelPermissions, hasPermission, Permission } from '@getjolt/protocol';

const ctx = { guildId, ownerId, userId, memberRoleIds, roles };
const bits = computeChannelPermissions(ctx, channel.overwrites);
if (hasPermission(bits, Permission.SEND_MESSAGES)) showComposer();
```

IDs are 64-bit snowflakes sent as strings. They sort by creation time, which is what message pagination relies on, and `snowflakeTime(id)` gets the timestamp back out.

Federation runs on short-lived Ed25519 identity certificates. Your home instance signs one for each of your devices, and any other instance can check it against the home instance's published keys. `issueIdentityCert`, `verifyIdentityCert` and `federationChallengeMessage` cover both sides of that handshake.

The full wire format, including the gateway frames and the federation flow step by step, is written up in [PROTOCOL.md](PROTOCOL.md).

## Development

```sh
npm install
npm test
npm run build
```

The tests cover the permission rules, identity certificates (including tampered, expired and replayed ones), snowflakes and address parsing. Please add one when you change any of those.

## License

MIT. See [LICENSE](LICENSE).
