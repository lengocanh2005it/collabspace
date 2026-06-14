import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { IUserReplicaRepository } from "../../../application/ports/IUserReplicaRepository";
import { UserReplica } from "../schemas/user-replica.schema";

@Injectable()
export class UserReplicaRepository implements IUserReplicaRepository {
  constructor(
    @InjectModel(UserReplica.name)
    private readonly userReplicaModel: Model<UserReplica>,
  ) {}

  async listActiveUserIdsAsync(skip: number, limit: number): Promise<string[]> {
    const users = await this.userReplicaModel
      .find({ isActive: true })
      .select({ userId: 1, _id: 0 })
      .sort({ userId: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    return users.map((user) => user.userId);
  }

  async findByIdAsync(userId: string): Promise<UserReplica | null> {
    return this.userReplicaModel.findOne({ userId }).lean().exec();
  }

  async findByUsernameAsync(username: string): Promise<UserReplica | null> {
    return this.userReplicaModel
      .findOne({ username: username.toLowerCase(), isActive: true })
      .lean()
      .exec();
  }

  async findManyByIdsAsync(userIds: string[]): Promise<UserReplica[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.userReplicaModel
      .find({ userId: { $in: userIds } })
      .lean()
      .exec();
  }

  async upsertAsync(data: Partial<UserReplica>): Promise<void> {
    await this.userReplicaModel
      .findOneAndUpdate(
        { userId: data.userId },
        { $set: data },
        { upsert: true, new: true },
      )
      .exec();
  }

  async updateFieldsAsync(
    userId: string,
    data: Partial<UserReplica>,
  ): Promise<void> {
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length > 0) {
      await this.userReplicaModel
        .findOneAndUpdate({ userId }, { $set: updateData })
        .exec();
    }
  }
}
