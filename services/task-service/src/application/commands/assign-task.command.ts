export class AssignTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly assignerId: string, // Chỉ cần ID từ req.user
    public readonly assigneeId: string | null,
  ) {}
}
