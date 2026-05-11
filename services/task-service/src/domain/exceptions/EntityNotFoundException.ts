// Lỗi thực thể không tồn tại
import { DomainException } from "./DomainException";

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName} với ID ${id} không tồn tại.`);
  }
  getErrorCode() { return 'ENTITY_NOT_FOUND'; }
}