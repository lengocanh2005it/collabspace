import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { toNullableTrimmedString, toOptionalTrimmedString } from './transformers';

export class UpdateCurrentUserProfileDto {
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  bio?: string | null;

  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  displayName?: string | null;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    pattern: '^[a-z0-9._-]+$',
    nullable: true,
    example: 'jane.doe',
  })
  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/)
  @IsOptional()
  username?: string | null;

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Alias for language preference; updates preferences when set',
  })
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(20)
  @IsOptional()
  preferredLanguage?: string;
}
