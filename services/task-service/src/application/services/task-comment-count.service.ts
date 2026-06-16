import { Inject, Injectable } from "@nestjs/common";
import {
  COMMENT_REPOSITORY_TOKEN,
  type ICommentRepository,
} from "../../domain/repositories/comment.repository.interface";
import type { TaskResponseData } from "../../presentation/dtos/task.response";

@Injectable()
export class TaskCommentCountService {
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,
  ) {}

  async attachCommentCounts<T extends TaskResponseData>(tasks: T[]): Promise<T[]> {
    if (tasks.length === 0) {
      return tasks;
    }

    const counts = await this.commentRepository.countByTaskIdsAsync(tasks.map((task) => task.id));
    return tasks.map((task) => ({
      ...task,
      commentCount: counts.get(task.id) ?? 0,
    }));
  }
}
