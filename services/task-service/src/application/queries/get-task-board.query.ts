export class GetTaskBoardQuery {
  constructor(
    public readonly workspaceId: string,
    public readonly projectId?: string,
  ) {}
}
