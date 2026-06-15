import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ format: 'uuid' }) ownerId: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}

export class WorkspaceMemberResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ enum: ['owner', 'admin', 'member'] }) role: string;
  @ApiProperty({ format: 'date-time' }) joinedAt: Date;
}

export class WorkspaceActivityResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty({ format: 'uuid' }) actorId: string;
  @ApiProperty() actorName: string;
  @ApiProperty() type: string;
  @ApiProperty() summary: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) meta: Record<
    string,
    unknown
  >;
  @ApiProperty({ format: 'date-time' }) occurredAt: Date;
}

export class PaginatedWorkspaceActivityResponseSchemaDto {
  @ApiProperty({ type: [WorkspaceActivityResponseSchemaDto] })
  items: WorkspaceActivityResponseSchemaDto[];
  @ApiProperty() total: number;
}

export class ProjectResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ format: 'uuid' }) createdBy: string;
  @ApiProperty() isDeleted: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}

export class DeleteProjectResponseSchemaDto {
  @ApiProperty({ enum: ['deleted'] }) status: 'deleted';
}

export class InvitationResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty({ format: 'uuid' }) inviterId: string;
  @ApiProperty() inviteeEmail: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) inviteeUserId:
    | string
    | null;
  @ApiProperty() status: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
}

export class AcceptInvitationResponseSchemaDto {
  @ApiProperty({ enum: ['accepted'] }) status: 'accepted';
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
}

export class RejectInvitationResponseSchemaDto {
  @ApiProperty({ enum: ['rejected'] }) status: 'rejected';
}

export class WorkspaceMembershipResponseSchemaDto {
  @ApiProperty({ format: 'uuid' }) workspaceId: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() isMember: boolean;
  @ApiPropertyOptional({ nullable: true }) role: string | null;
}
