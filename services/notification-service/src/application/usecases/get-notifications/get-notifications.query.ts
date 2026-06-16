// src/application/usecases/get-notifications/get-notifications.query.ts

export class GetNotificationsQuery {
  constructor(
    public readonly recipientId: string,
    public readonly skip: number = 0,
    public readonly limit: number = 20,
    public readonly status: "active" | "archived" = "active",
  ) {}
}
