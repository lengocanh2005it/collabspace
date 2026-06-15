export interface NotificationMetadata {
  actorName?: string;
  actorAvatarUrl?: string;
  [key: string]: unknown;
}

export function getMetadataString(metadata: NotificationMetadata, key: string): string | undefined {
  const value = metadata[key];

  return typeof value === "string" ? value : undefined;
}
