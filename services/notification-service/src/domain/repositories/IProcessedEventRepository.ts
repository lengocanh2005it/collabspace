export const PROCESSED_EVENT_REPOSITORY_TOKEN = Symbol("PROCESSED_EVENT_REPOSITORY_TOKEN");

export interface IProcessedEventRepository {
  /**
   * Mark a claimed event as durably processed. Only called after the side effect succeeds.
   */
  markProcessed(eventId: string): Promise<void>;
  tryClaim(eventId: string): Promise<boolean>;
  /**
   * Remove a previously claimed eventId so the next retry can reprocess it.
   * Called when notification persistence fails after a successful claim.
   */
  releaseClaim(eventId: string): Promise<void>;
}
