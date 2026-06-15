// src/domain/exceptions/ConcurrencyException.ts
import { DomainException } from "./DomainException";

export class ConcurrencyException extends DomainException {
  constructor(message = "Optimistic concurrency conflict: task was modified by another request") {
    super(message);
  }

  getErrorCode(): string {
    return "CONCURRENCY_CONFLICT";
  }
}
