// src/domain/value-objects/UserSnapshot.ts
import { BusinessRuleException } from '../exceptions/BusinessRuleException';

export class UserSnapshot {
  private constructor(
    private readonly userId: string,
    private readonly name: string,
    private readonly avatarUrl?: string // Avatar có thể không bắt buộc
  ) {}

  public static create(userId: string, name: string, avatarUrl?: string): UserSnapshot {
    if (!userId || userId.trim() === '') {
      throw new BusinessRuleException('User ID của Snapshot không được để trống', 'SNAPSHOT_USER_ID_EMPTY');
    }
    if (!name || name.trim() === '') {
      throw new BusinessRuleException('Tên User không được để trống', 'SNAPSHOT_NAME_EMPTY');
    }

    return new UserSnapshot(userId, name, avatarUrl);
  }

  // Chỉ có Getter, tuyệt đối KHÔNG có Setter (để đảm bảo tính bất biến)
  public getUserId(): string { return this.userId; }
  public getName(): string { return this.name; }
  public getAvatarUrl(): string | undefined { return this.avatarUrl; }

  // So sánh 2 Snapshot: Nếu cùng ID và Name thì coi như là một
  public equals(other: UserSnapshot | null | undefined): boolean {
    if (!other) return false;
    return this.userId === other.getUserId() && this.name === other.getName();
  }
}