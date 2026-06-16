import type { WorkspaceRole } from "@collabspace/shared";
import { Expose } from "class-transformer";

export class WorkspaceMemberDto {
  @Expose()
  userId!: string;

  @Expose()
  name!: string;

  @Expose()
  email!: string;

  @Expose()
  role!: WorkspaceRole;

  @Expose()
  avatarUrl?: string;

  @Expose()
  joinedAt!: Date;
}

export class WorkspaceDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  description!: string;

  @Expose()
  ownerId!: string;

  @Expose()
  members!: WorkspaceMemberDto[];

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

export class WorkspaceListResponseDto {
  @Expose()
  workspaces!: WorkspaceDto[];

  @Expose()
  total!: number;
}
