// Trong file ports/IUserReplicaRepository.ts
export const IUserReplicaRepository = Symbol('IUserReplicaRepository');

export interface IUserReplicaRepository {
  upsertAsync(userId: string, name: string, avatarUrl?: string): Promise<void>;
  findByIdAsync(userId: string): Promise<any>; 
}