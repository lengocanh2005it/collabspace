import { BusinessRuleException } from "../exceptions/BusinessRuleException";

export type PriorityEnum = "LOW" | "MEDIUM" | "HIGH";

export class TaskPriority {
  private readonly value: PriorityEnum;

  constructor(value: string) {
    const upperValue = value.toUpperCase();
    if (!["LOW", "MEDIUM", "HIGH"].includes(upperValue)) {
      throw new BusinessRuleException(`Invalid priority: ${value}. Must be LOW, MEDIUM, or HIGH.`);
    }
    this.value = upperValue as PriorityEnum;
  }

  public getValue(): PriorityEnum {
    return this.value;
  }
}
