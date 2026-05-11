import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserReplicaRepository } from '../../application/ports/IUserReplicaRepository';
import { UserReplica } from '../persistence/user-replica.schema';

@Injectable()
export class UserReplicaRepository implements IUserReplicaRepository {
  constructor(
    @InjectModel(UserReplica.name) private readonly userReplicaModel: Model<UserReplica>,
  ) {}

  async upsertAsync(userId: string, fullName: string, avatarUrl?: string): Promise<void> {
    await this.userReplicaModel.findOneAndUpdate(
      { userId: userId }, // Điều kiện tìm kiếm
      { 
        $set: { 
          fullName: fullName,
          ...(avatarUrl && { avatarUrl: avatarUrl }), // Chỉ update avatar nếu có gửi qua
          isActive: true
        }
      },
      { upsert: true, new: true } // Bí kíp võ công là chữ upsert: true này
    ).exec();
  }

  async findByIdAsync(userId: string): Promise<any> {
    return this.userReplicaModel.findOne({ userId }).exec();
  }
}