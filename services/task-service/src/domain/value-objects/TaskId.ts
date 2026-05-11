import { validate as isUuid, v4 as uuidv4 } from 'uuid';
import { BusinessRuleException } from '../exceptions/BusinessRuleException';

export class TaskId {
  private readonly value: string;

  constructor(value: string) {
    // 1. Kiểm tra rỗng
    if (!value || value.trim() === '') {
      throw new BusinessRuleException('Task ID không được để trống', 'TASK_ID_EMPTY');
    }
    
    // 2. Kiểm tra định dạng UUID
    if (!isUuid(value)) {
      throw new BusinessRuleException(
        `Định dạng UUID không hợp lệ: ${value}`, 
        'INVALID_UUID_FORMAT'
      );
    }

    this.value = value;
  }

  // Static method để tạo ID mới một cách tiện lợi
  public static create(): TaskId {
    return new TaskId(uuidv4());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: TaskId | null | undefined): boolean {
    if (!other) return false;
    return this.value === other.getValue();
  }
}