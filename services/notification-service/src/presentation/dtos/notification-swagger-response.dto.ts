import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Swagger-only schema classes (not used at runtime). */
export class NotificationActorSchemaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() avatarUrl?: string;
}

export class NotificationResponseSchemaDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) recipientId!: string;
  @ApiProperty({ type: NotificationActorSchemaDto })
  actor!: NotificationActorSchemaDto;
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() message!: string;
  @ApiProperty() targetId!: string;
  @ApiProperty() targetType!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: "object", additionalProperties: true })
  metadata!: Record<string, unknown>;
  @ApiProperty({ format: "date-time" }) createdAt!: Date;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
}

export class GetNotificationsResponseSchemaDto {
  @ApiProperty({ type: [NotificationResponseSchemaDto] })
  notifications!: NotificationResponseSchemaDto[];
  @ApiProperty() total!: number;
  @ApiProperty() skip!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() unreadCount!: number;
}

export class MarkAllNotificationsReadResponseSchemaDto {
  @ApiProperty() updatedCount!: number;
}

export class MessageResponseSchemaDto {
  @ApiProperty() message!: string;
}
