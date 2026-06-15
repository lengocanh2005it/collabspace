import type { UserReplica } from "../../infrastructure/database/schemas/user-replica.schema";

export const USER_REPLICA_REPOSITORY_TOKEN = Symbol("IUserReplicaRepository");

export interface IUserReplicaRepository {
  listActiveUserIdsAsync(skip: number, limit: number): Promise<string[]>;
  findByIdAsync(userId: string): Promise<UserReplica | null>;
  findByUsernameAsync(username: string): Promise<UserReplica | null>;
  findManyByIdsAsync(userIds: string[]): Promise<UserReplica[]>;
  upsertAsync(data: Partial<UserReplica>): Promise<void>;
  updateFieldsAsync(userId: string, data: Partial<UserReplica>): Promise<void>;
}
