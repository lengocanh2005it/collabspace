import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { IUserReplicaRepository } from "../../application/ports/IUserReplicaRepository";
import { UserReplica } from "../persistence/user-replica.schema";

@Injectable()
export class UserReplicaRepository implements IUserReplicaRepository {
  constructor(
    @InjectModel(UserReplica.name)
    private readonly userReplicaModel: Model<UserReplica>,
  ) {}

  // 1. TÌM KIẾM THEO ID (Nên dùng thêm .lean() để tối ưu hiệu suất đọc Mongoose)
  async findByIdAsync(userId: string): Promise<UserReplica | null> {
    return this.userReplicaModel.findOne({ userId }).lean().exec();
  }

  // 2. DÙNG CHO LUỒNG ĐĂNG KÝ (USER_REGISTERED_EVENT)
  async upsertAsync(data: Partial<UserReplica>): Promise<void> {
    await this.userReplicaModel
      .findOneAndUpdate(
        { userId: data.userId },
        {
          $set: data, // Ném nguyên cái object data vào đây, Mongoose tự map
        },
        { upsert: true, new: true }, // Bí kíp võ công vẫn giữ nguyên!
      )
      .exec();
  }

  // 3. DÙNG CHO LUỒNG UPDATE (USER_PROFILE_UPDATED_EVENT)
  async updateFieldsAsync(
    userId: string,
    data: Partial<UserReplica>,
  ): Promise<void> {
    // Lọc bỏ các giá trị undefined.
    // Ví dụ gửi { fullName: 'Tin', displayName: undefined } => Chỉ giữ lại { fullName: 'Tin' }
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(updateData).length > 0) {
      await this.userReplicaModel
        .findOneAndUpdate({ userId: userId }, { $set: updateData })
        .exec();
    }
  }
}
