const MENTION_PATTERN = /@([a-zA-Z0-9_.]{2,64})/g;

export function parseMentionUsernames(content: string): string[] {
  const matches = content.matchAll(MENTION_PATTERN);
  const usernames = new Set<string>();

  for (const match of matches) {
    const username = match[1]?.toLowerCase();
    if (username) {
      usernames.add(username);
    }
  }

  return [...usernames];
}
