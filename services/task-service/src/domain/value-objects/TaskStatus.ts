// src/domain/value-objects/TaskStatus.ts
import { BusinessRuleException } from '../exceptions/BusinessRuleException';

export type StatusEnum = 'TODO' | 'DOING' | 'DONE';

export class TaskStatus {
  private readonly value: StatusEnum;

  constructor(value: string) {
    const upperValue = value.toUpperCase();
    if (!['TODO', 'DOING', 'DONE'].includes(upperValue)) {
      throw new BusinessRuleException(`Invalid status: ${value}. Must be TODO, DOING, or DONE.`);
    }
    this.value = upperValue as StatusEnum;
  }

  public getValue(): StatusEnum {
    return this.value;
  }

  // Đóng gói Business Rule: Không cho lùi từ DONE về TODO
  public canTransitionTo(newStatus: TaskStatus): boolean {
    if (this.value === 'DONE' && newStatus.getValue() === 'TODO') {
      return false;
    }
    return true;
  }
}