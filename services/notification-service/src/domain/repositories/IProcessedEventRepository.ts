export const PROCESSED_EVENT_REPOSITORY_TOKEN = Symbol("PROCESSED_EVENT_REPOSITORY_TOKEN");

export interface IProcessedEventRepository {
  tryClaim(eventId: string): Promise<boolean>;
  /**
   * Remove a previously claimed eventId so the next retry can reprocess it.
   * Called when notification persistence fails after a successful claim.
   */
  releaseClaim(eventId: string): Promise<void>;
}
