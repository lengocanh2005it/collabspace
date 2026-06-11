export class Project {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdBy: string,
    public readonly isDeleted: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
