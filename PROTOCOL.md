# Jolt protocol (v1)

Jolt instances are independent servers. Each one hosts its own accounts and its own servers ("guilds"). A user's account lives on one **home instance** and is addressed as `handle@instance`, e.g. `alice@joltapp.org`. Clients connect directly to whichever instance hosts a guild. Instances never replicate messages to each other.

Every type and schema mentioned here is exported from this package, so the code in `src/` is the source of truth if this document and the code ever disagree.

## Discovery

`GET /.well-known/jolt` returns the instance's name, registration and federation policy, and its public signing keys:

```json
{
  "software": "jolt",
  "protocolVersion": 1,
  "domain": "joltapp.org",
  "name": "Jolt",
  "registration": "open",
  "federation": "open",
  "keys": [{ "kid": "k1", "publicKey": "<ed25519, base64url>", "notAfter": null }]
}
```

Keys are listed rather than single so an instance can rotate keys. Old keys stay listed with `notAfter` set.

## Identity certificates

A signed-in client registers a per-device Ed25519 key with its home instance: `POST /api/v1/identity/certs { devicePublicKey }`. The home instance returns a certificate:

```json
{
  "payload": {
    "v": 1,
    "sub": "alice@joltapp.org",
    "uid": "…",
    "instance": "joltapp.org",
    "kid": "k1",
    "devicePublicKey": "…",
    "iat": 1790000000,
    "exp": 1790086400,
    "serial": "…"
  },
  "signature": "<ed25519 over canonical JSON of payload>"
}
```

Canonical JSON means sorted keys, no whitespace, and `undefined` gets dropped. Certificates are live for 24 hours.

## Signing in to another instance

1. `GET https://other.example/api/v1/federation/challenge` returns `{ nonce, expiresAt }`. Nonces are single-use and expire after 2 minutes.
2. The client signs the UTF-8 string `jolt-federation-auth:v1:<target instance>:<nonce>` with its device key. Naming the target stops a malicious instance from replaying the signature elsewhere.
3. `POST /api/v1/federation/auth { cert, nonce, signature }`.
4. The target checks its federation policy for the cert's instance. It then fetches that instance's `/.well-known/jolt` (cached, refetched on unknown `kid`) and verifies the certificate signature, validity window and the challenge signature. It creates or updates a local record for the remote user and returns a session token that expires with the certificate.

The target also checks revocation: `GET <home>/api/v1/federation/certs/<serial>` returns `{ revoked }` on gateway connect, at most every 5 minutes. Signing a device out at home revokes its certificates. An unreachable home instance is tolerated, because certificates are short-lived.

Profile data comes from `GET <home>/api/v1/users/<handle>/profile`. Clients call `POST /api/v1/users/@me/sync` on foreign instances after a profile edit.

Avatars are always hosted by the user's home instance. Uploading one is `PUT /api/v1/users/@me/avatar` with the image as the raw body and its type as the `Content-Type`, and `DELETE` on the same path removes it. Instances accept PNG, JPEG, WebP and GIF up to `Limits.avatarBytes` and `Limits.avatarPixels` on each side, and check the bytes rather than trusting the header. Images are served without authentication from `GET /api/v1/avatars/<sha256>`, named by their content so they can be cached forever. Other instances only accept a remote user's `avatarUrl` if it points at that user's home instance, which keeps profiles from loading images from arbitrary hosts.

## REST

Everything is under `/api/v1`, uses JSON, and authenticates with `Authorization: Bearer <token>`. Errors look like `{ "error": { "code", "message", "fields?" } }`. Every request body is defined in `src/schemas/rest.ts`, and the [SDK](https://github.com/GetJolt/sdk) has a typed method for every route.

## Gateway

Clients open a WebSocket to `/gateway`, and frames are JSON:

| Direction       | `op`              | Payload                                        |
| --------------- | ----------------- | ---------------------------------------------- |
| server → client | `hello`           | `{ heartbeatInterval }`                        |
| client → server | `identify`        | `{ token }`                                    |
| client → server | `resume`          | `{ token, sessionId, seq }`                    |
| client → server | `heartbeat`       | `{ seq }`; the server answers `heartbeat_ack`  |
| client → server | `presence_update` | `{ status }`                                   |
| server → client | `dispatch`        | `{ t, s, d }`: an event with a sequence number |
| server → client | `invalid_session` | `{ resumable }`                                |

The first dispatch is `READY`, with the user, every guild snapshot and read states. Sessions buffer events for 60 seconds after a disconnect, so `resume` replays anything missed. Event names and payloads are in `src/schemas/gateway.ts`. Channel-scoped events are only delivered to members who can view the channel.

## Permissions

Bitfields are sent as decimal strings. They resolve the same way Discord's do: the guild owner gets everything; otherwise the `@everyone` role (which shares the guild's id), then each of the member's roles, then channel overwrites in order: `@everyone`, all role overwrites merged, then the member's own. `ADMINISTRATOR` grants everything. `computeChannelPermissions` in `@getjolt/protocol` is the reference implementation, and clients and servers share it.

## Reserved for later

`message.encryption` and `channel.e2ee` are reserved for MLS end-to-end encryption. Voice and video will be added as new channel types.
