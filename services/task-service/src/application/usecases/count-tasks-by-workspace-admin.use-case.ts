import { Inject, Injectable } from "@nestjs/common";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";

@Injectable()
export class CountTasksByWorkspaceAdminUseCase {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  execute() {
    return this.taskRepository.countByWorkspaceGrouped();
  }
}
