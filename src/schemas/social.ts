// The social side of Jolt: posts, follows, notifications and linked Bluesky/Mastodon accounts. All of it is
// served by the user's home instance, which federates with everyone else over ActivityPub.

import { z } from 'zod';
import { Limits } from '../limits.js';
import type { Facet } from '../richtext.js';
import { snowflakeSchema, type User } from './entities.js';

export const postVisibilitySchema = z.enum(['public', 'unlisted', 'followers']);
export type PostVisibility = z.infer<typeof postVisibilitySchema>;

/** Where a post came from: written here, federated in over ActivityPub, or read through a linked account. */
export type PostSource = 'jolt' | 'activitypub' | 'bluesky' | 'mastodon';

export const linkProviderSchema = z.enum(['bluesky', 'mastodon']);
export type LinkProvider = z.infer<typeof linkProviderSchema>;

export interface PostMedia {
  url: string;
  mediaType: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface PostCounts {
  replies: number;
  reposts: number;
  likes: number;
}

export interface Post {
  /** A snowflake for Jolt and ActivityPub posts; an opaque provider reference for linked-account posts. */
  id: string;
  source: PostSource;
  author: User;
  text: string;
  facets: Facet[];
  media: PostMedia[];
  /** Content warning. When set, clients collapse the post behind it. */
  cw: string | null;
  visibility: PostVisibility;
  /** Where the post can be opened in a browser. */
  url: string | null;
  createdAt: number;
  editedAt: number | null;
  replyToId: string | null;
  rootId: string | null;
  /** Who the post replies to, for the "Replying to" line. */
  replyToAuthor: User | null;
  /** One level of quoting; a quoted post's own quote is not included. */
  quote: Post | null;
  counts: PostCounts;
  viewer: { liked: boolean; reposted: boolean };
  /** Echoes the client nonce on create so optimistic posts can be reconciled. */
  nonce?: string | null;
}

/** One row of a timeline: a post, or someone's repost of it. `id` is the cursor for paging. */
export interface TimelineItem {
  id: string;
  post: Post;
  repostedBy: User | null;
}

export interface TimelinePage {
  items: TimelineItem[];
  /** Pass as `before` for the next page, or null when there's nothing older. */
  cursor: string | null;
}

export interface Thread {
  ancestors: Post[];
  post: Post;
  replies: Post[];
}

export type FollowState = 'none' | 'pending' | 'following';

export interface Relationship {
  userId: string;
  following: FollowState;
  followedBy: boolean;
}

export interface PublicLink {
  provider: LinkProvider;
  handle: string;
  url: string;
  verified: boolean;
}

export interface LinkedAccount extends PublicLink {
  id: string;
  crosspostDefault: boolean;
  showTimeline: boolean;
  createdAt: number;
}

export interface Profile {
  user: User;
  counts: { followers: number; following: number; posts: number };
  links: PublicLink[];
  /** Null when viewing yourself. */
  relationship: Relationship | null;
  /** The profile page in a browser. */
  url: string | null;
}

export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'quote';

export interface Notification {
  id: string;
  type: NotificationType;
  actor: User;
  post: Post | null;
  createdAt: number;
  read: boolean;
}

export interface NotificationPage {
  items: Notification[];
  cursor: string | null;
  unread: number;
}

/** A person found through a linked account who can be followed from Jolt. */
export interface FriendSuggestion {
  name: string;
  handle: string;
  avatarUrl: string | null;
  /** The address to follow from Jolt, e.g. `alice@mastodon.social` or a Bridgy Fed address. */
  address: string | null;
  /** Set when they're already on Jolt, so the client can show a profile. */
  user: User | null;
  via: 'jolt' | 'activitypub' | 'bridge';
}

export const createPostBodySchema = z
  .object({
    text: z.string().max(Limits.postLength * 4),
    media: z
      .array(z.object({ id: snowflakeSchema, alt: z.string().max(Limits.altText).default('') }))
      .max(Limits.postImages)
      .default([]),
    replyToId: snowflakeSchema.optional(),
    quoteId: snowflakeSchema.optional(),
    visibility: postVisibilitySchema.default('public'),
    cw: z.string().trim().max(Limits.contentWarning).nullable().optional(),
    /** Linked account ids to cross-post to. */
    crosspost: z.array(z.string().max(64)).max(4).default([]),
    nonce: z.string().max(64).optional(),
  })
  .refine((body) => [...body.text.trim()].length <= Limits.postLength, {
    message: `Posts can be up to ${Limits.postLength} characters`,
    path: ['text'],
  })
  .refine((body) => body.text.trim().length > 0 || body.media.length > 0, {
    message: 'Write something or add an image',
    path: ['text'],
  });
export type CreatePostBody = z.input<typeof createPostBodySchema>;

export const pageQuerySchema = z.object({
  before: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(Limits.postsPerPage).optional(),
});
export type PageQuery = z.input<typeof pageQuerySchema>;

export const lookupQuerySchema = z.object({ address: z.string().trim().min(1).max(320) });

export const startLinkBodySchema = z.object({
  provider: linkProviderSchema,
  /** A Bluesky handle, or the Mastodon server to sign in on. */
  identifier: z.string().trim().min(1).max(253),
});
export type StartLinkBody = z.infer<typeof startLinkBodySchema>;

export const updateLinkBodySchema = z.object({
  crosspostDefault: z.boolean().optional(),
  showTimeline: z.boolean().optional(),
});
export type UpdateLinkBody = z.infer<typeof updateLinkBodySchema>;

/** Act on a post from a linked account's timeline, as that account. */
export const linkActionBodySchema = z
  .object({
    postId: z.string().max(600),
    action: z.enum(['like', 'unlike', 'repost', 'unrepost', 'reply']),
    text: z
      .string()
      .trim()
      .max(Limits.postLength * 4)
      .optional(),
  })
  .refine((b) => b.action !== 'reply' || (b.text?.length ?? 0) > 0, {
    message: 'Write a reply',
    path: ['text'],
  });
export type LinkActionBody = z.infer<typeof linkActionBodySchema>;
