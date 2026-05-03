// Lỗi luật nghiệp vụ bị vi phạm
import { DomainException } from "./DomainException";

export class BusinessRuleException extends DomainException {
  constructor(message: string, private readonly code: string = 'BUSINESS_RULE_VIOLATION') {
    super(message);
  }
  getErrorCode() { return this.code; }
}