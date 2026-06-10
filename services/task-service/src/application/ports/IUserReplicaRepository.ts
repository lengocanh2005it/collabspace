import { UserReplica } from "../../infrastructure/persistence/user-replica.schema";

export const USER_REPLICA_REPOSITORY_TOKEN = Symbol("IUserReplicaRepository");

export interface IUserReplicaRepository {
  findByIdAsync(userId: string): Promise<UserReplica | null>;
  findByUsernameAsync(username: string): Promise<UserReplica | null>;

  // Dùng Partial để linh hoạt truyền data
  upsertAsync(data: Partial<UserReplica>): Promise<void>;

  // Thêm hàm updateFieldsAsync dành riêng cho luồng Update Profile
  updateFieldsAsync(userId: string, data: Partial<UserReplica>): Promise<void>;
}
