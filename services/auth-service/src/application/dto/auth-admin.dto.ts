import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAdminRoleDto {
  @ApiProperty({ example: 'support' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'Customer support operators' })
  @IsString()
  @MaxLength(255)
  description!: string;
}

export class UpdateAdminRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class CreateAdminPermissionDto {
  @ApiProperty({ example: 'notifications.broadcast' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  description!: string;
}

export class AssignPermissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  permissionId!: string;
}

export class AssignRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId!: string;
}

export class SetUserActiveStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
