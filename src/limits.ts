export const Limits = {
  messageLength: 4000,
  messagesPerPage: 50,
  maxMessagesPerPage: 100,
  guildName: { min: 2, max: 100 },
  guildDescription: 500,
  channelName: { min: 1, max: 100 },
  channelTopic: 1024,
  roleName: { min: 1, max: 100 },
  rolesPerGuild: 250,
  channelsPerGuild: 500,
  guildsPerUser: 200,
  displayName: { min: 1, max: 32 },
  nickname: 32,
  bio: 190,
  password: { min: 8, max: 256 },
  typingIndicatorMs: 8000,
  avatarBytes: 1024 * 1024,
  avatarPixels: 1024,
  postLength: 500,
  postImages: 4,
  postsPerPage: 30,
  altText: 1500,
  contentWarning: 200,
  mediaBytes: 8 * 1024 * 1024,
  mediaPixels: 4096,
} as const;

/** Image formats an instance accepts for avatars. Anything else, SVG in particular, is refused. */
export const AVATAR_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];
