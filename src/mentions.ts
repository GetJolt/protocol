// Mentions are stored inline in message content as `<@userId>` and `<#channelId>`; clients render them.

const USER_MENTION = /<@(\d{1,20})>/g;
const EVERYONE_MENTION = /(^|[^\w`])@(everyone|here)\b/;

export function extractUserMentions(content: string): string[] {
  return [...new Set(Array.from(content.matchAll(USER_MENTION), (m) => m[1]!))];
}

export function mentionsEveryone(content: string): boolean {
  return EVERYONE_MENTION.test(content);
}

export function userMention(userId: string): string {
  return `<@${userId}>`;
}

export function channelMention(channelId: string): string {
  return `<#${channelId}>`;
}
