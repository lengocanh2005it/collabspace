// src/domain/value-objects/UserSnapshot.ts
import { BusinessRuleException } from "../exceptions/BusinessRuleException";

export class UserSnapshot {
  private constructor(
    private readonly userId: string,
    private readonly email: string, // Bổ sung Email
    private readonly fullName: string, // Tên thật
    private readonly displayName: string, // Tên hiển thị (Nickname)
    private readonly avatarUrl?: string | null,
  ) {}

  public static create(
    userId: string,
    email: string,
    fullName: string,
    displayName?: string | null,
    avatarUrl?: string | null,
  ): UserSnapshot {
    if (!userId || userId.trim() === "") {
      throw new BusinessRuleException(
        "User ID của Snapshot không được để trống",
        "SNAPSHOT_USER_ID_EMPTY",
      );
    }
    if (!fullName || fullName.trim() === "") {
      throw new BusinessRuleException(
        "Tên User không được để trống",
        "SNAPSHOT_FULLNAME_EMPTY",
      );
    }

    // Nếu không có displayName, tự động fallback về fullName cho đồng bộ
    const resolvedDisplayName = displayName?.trim() ? displayName : fullName;

    return new UserSnapshot(
      userId,
      email,
      fullName,
      resolvedDisplayName,
      avatarUrl,
    );
  }

  // ========================================================
  // GETTERS (Tuyệt đối KHÔNG có Setter)
  // ========================================================
  public getUserId(): string {
    return this.userId;
  }
  public getEmail(): string {
    return this.email;
  }
  public getFullName(): string {
    return this.fullName;
  }
  public getDisplayName(): string {
    return this.displayName;
  }
  public getAvatarUrl(): string | null | undefined {
    return this.avatarUrl;
  }

  // ========================================================
  // HÀM SO SÁNH (Structural Equality của Value Object)
  // ========================================================
  public equals(other: UserSnapshot | null | undefined): boolean {
    if (!other) return false;

    // Phải so sánh TOÀN BỘ property, lệch 1 ly là tính ra VO mới ngay
    return (
      this.userId === other.getUserId() &&
      this.email === other.getEmail() &&
      this.fullName === other.getFullName() &&
      this.displayName === other.getDisplayName() &&
      this.avatarUrl === other.getAvatarUrl()
    );
  }

  // ========================================================
  // HÀM TIỆN ÍCH CHO MONGOOSE (Serialization)
  // ========================================================
  // Vì Mongoose cần object thuần (Plain Object) để lưu DB
  public toPlainObject(): Record<string, any> {
    return {
      userId: this.userId,
      email: this.email,
      fullName: this.fullName,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl || null,
    };
  }
}
