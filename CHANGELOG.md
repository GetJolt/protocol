# Changelog

## 0.2.0

Adds the social side of Jolt: posts, timelines, profiles, follows, notifications and linked Bluesky and Mastodon accounts, with their request schemas and gateway events. Post text comes with facets for links, mentions and hashtags, and `detectFacets` and `segmentRichText` find and split them. PROTOCOL.md now describes the timeline and how instances speak ActivityPub to each other and to Mastodon.

## 0.1.0

The first public release. It covers everything text chat needs: users, servers, channels, roles, members, messages, invites, read states and avatar uploads, plus the gateway events, the permission model and federated identity certificates.
