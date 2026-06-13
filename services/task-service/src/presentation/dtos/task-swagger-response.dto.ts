import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Swagger-only schema classes (not used at runtime). */
export class ApiSuccessMetaSchemaDto {
  @ApiPropertyOptional() requestId?: string;
}

export class MessageDataSchemaDto {
  @ApiProperty({ example: "Task updated successfully" }) message!: string;
}

export class TaskUserResponseSchemaDto {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl?: string | null;
}

export class TaskResponseSchemaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ format: "uuid" }) workspaceId!: string;
  @ApiPropertyOptional({ nullable: true, format: "uuid" }) projectId!: string | null;
  @ApiProperty() priority!: string;
  @ApiPropertyOptional({ nullable: true, format: "date-time" }) dueDate!: Date | null;
  @ApiProperty({ type: [String] }) labels!: string[];
  @ApiPropertyOptional({ nullable: true, format: "uuid" }) assigneeId!: string | null;
  @ApiProperty({ type: TaskUserResponseSchemaDto }) createdBy!: TaskUserResponseSchemaDto;
  @ApiPropertyOptional({ nullable: true, type: TaskUserResponseSchemaDto }) assignedTo!: TaskUserResponseSchemaDto | null;
  @ApiProperty({ type: [String] }) attachments!: string[];
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
}

export class CreateTaskResponseSchemaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
}

export class GetTasksResponseSchemaDto {
  @ApiProperty({ type: [TaskResponseSchemaDto] }) tasks!: TaskResponseSchemaDto[];
  @ApiProperty() total!: number;
}

export class TaskBoardColumnSchemaDto {
  @ApiProperty() status!: string;
  @ApiProperty({ type: [TaskResponseSchemaDto] }) tasks!: TaskResponseSchemaDto[];
}

export class GetTaskBoardResponseSchemaDto {
  @ApiProperty({ format: "uuid" }) workspaceId!: string;
  @ApiProperty({ type: [TaskBoardColumnSchemaDto] }) columns!: TaskBoardColumnSchemaDto[];
  @ApiProperty() total!: number;
}

export class TaskActivityItemSchemaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional({ nullable: true, format: "uuid" }) actorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) actorName!: string | null;
  @ApiPropertyOptional({ nullable: true }) actorAvatarUrl!: string | null;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) meta!: Record<string, unknown>;
  @ApiProperty({ format: "date-time" }) occurredAt!: string;
}

export class TaskActivityResponseSchemaDto {
  @ApiProperty({ type: [TaskActivityItemSchemaDto] }) items!: TaskActivityItemSchemaDto[];
  @ApiProperty() total!: number;
}

export class ApiSuccessTaskResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: TaskResponseSchemaDto }) data!: TaskResponseSchemaDto;
  @ApiPropertyOptional({ type: ApiSuccessMetaSchemaDto }) meta?: ApiSuccessMetaSchemaDto;
}

export class ApiSuccessCreateTaskResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: CreateTaskResponseSchemaDto }) data!: CreateTaskResponseSchemaDto;
}

export class ApiSuccessGetTasksResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: GetTasksResponseSchemaDto }) data!: GetTasksResponseSchemaDto;
}

export class ApiSuccessTaskBoardResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: GetTaskBoardResponseSchemaDto }) data!: GetTaskBoardResponseSchemaDto;
}

export class ApiSuccessTaskActivityResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: TaskActivityResponseSchemaDto }) data!: TaskActivityResponseSchemaDto;
}

export class ApiSuccessMessageResponseSchemaDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty({ type: MessageDataSchemaDto }) data!: MessageDataSchemaDto;
}
