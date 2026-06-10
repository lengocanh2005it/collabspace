import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { toNullableTrimmedString } from './transformers';

export class UpdateCurrentUserStatusDto {
  @Transform(toNullableTrimmedString)
  @IsISO8601()
  @IsOptional()
  clearAt?: string | null;

  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(32)
  @IsOptional()
  emoji?: string | null;

  @Transform(toNullableTrimmedString)
  @IsISO8601()
  @IsOptional()
  lastSeenAt?: string | null;

  @IsIn(['online', 'away', 'dnd', 'offline'])
  @IsOptional()
  status?: string;

  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  statusText?: string | null;
}
