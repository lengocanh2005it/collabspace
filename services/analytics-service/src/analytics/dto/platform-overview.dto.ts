import { ApiProperty } from '@nestjs/swagger';

export class UserMetricsDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() banned!: number;
  @ApiProperty() withoutWorkspace!: number;
  @ApiProperty() activeLast30d!: number;
}

export class WorkspaceMetricsDto {
  @ApiProperty() total!: number;
  @ApiProperty() totalMembers!: number;
  @ApiProperty() avgMembersPerWorkspace!: number;
}

export class ProjectMetricsDto {
  @ApiProperty() total!: number;
}

export class TaskByStatusDto {
  @ApiProperty() TODO!: number;
  @ApiProperty() DOING!: number;
  @ApiProperty() DONE!: number;
}

export class TaskMetricsDto {
  @ApiProperty() total!: number;
  @ApiProperty({ type: TaskByStatusDto }) byStatus!: TaskByStatusDto;
}

export class PlatformOverviewResponseDto {
  @ApiProperty({ type: UserMetricsDto }) users!: UserMetricsDto;
  @ApiProperty({ type: WorkspaceMetricsDto }) workspaces!: WorkspaceMetricsDto;
  @ApiProperty({ type: ProjectMetricsDto }) projects!: ProjectMetricsDto;
  @ApiProperty({ type: TaskMetricsDto }) tasks!: TaskMetricsDto;
  @ApiProperty() updatedAt!: string;
}
