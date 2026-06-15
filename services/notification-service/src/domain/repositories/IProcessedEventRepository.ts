export const PROCESSED_EVENT_REPOSITORY_TOKEN = Symbol("PROCESSED_EVENT_REPOSITORY_TOKEN");

export interface IProcessedEventRepository {
  tryClaim(eventId: string): Promise<boolean>;
}
