import type { INestApplication } from "@nestjs/common";
import { requestIdMiddleware } from "./request-id.middleware";

export function registerRequestIdMiddleware(app: INestApplication): void {
  app.use(requestIdMiddleware);
}
