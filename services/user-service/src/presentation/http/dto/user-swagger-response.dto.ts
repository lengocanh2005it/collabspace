import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseSchemaDto {
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) bio: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiPropertyOptional({ nullable: true }) displayName: string | null;
  @ApiProperty() fullName: string;
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'online', description: 'Presence: online | away | dnd | offline' })
  status: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiPropertyOptional({ nullable: true }) username: string | null;
}

export class UserSummaryResponseSchemaDto {
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) displayName: string | null;
  @ApiProperty() fullName: string;
  @ApiProperty({ example: 'offline' }) status: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiPropertyOptional({ nullable: true }) username: string | null;
}

export class PaginatedUserSummaryResponseSchemaDto {
  @ApiProperty({ type: [UserSummaryResponseSchemaDto] })
  items: UserSummaryResponseSchemaDto[];
  @ApiProperty() limit: number;
  @ApiProperty() offset: number;
  @ApiProperty() total: number;
}

export class UserPreferencesResponseSchemaDto {
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty() dateFormat: string;
  @ApiProperty() desktopNotificationsEnabled: boolean;
  @ApiProperty() digestFrequency: string;
  @ApiProperty() emailNotificationsEnabled: boolean;
  @ApiProperty() language: string;
  @ApiProperty() pushNotificationsEnabled: boolean;
  @ApiProperty() theme: string;
  @ApiProperty() timeFormat: string;
  @ApiPropertyOptional({ nullable: true }) timezone: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() weekStartsOn: string;
}

export class UserStatusResponseSchemaDto {
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) clearAt: string | null;
  @ApiPropertyOptional({ nullable: true }) emoji: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) lastSeenAt: string | null;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) statusText: string | null;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
}

export class UserPresenceListResponseSchemaDto {
  @ApiProperty({ type: [UserStatusResponseSchemaDto] })
  items: UserStatusResponseSchemaDto[];
}

export class BulkUserProfilesResponseSchemaDto {
  @ApiProperty({ type: [UserProfileResponseSchemaDto] })
  items: UserProfileResponseSchemaDto[];
}
