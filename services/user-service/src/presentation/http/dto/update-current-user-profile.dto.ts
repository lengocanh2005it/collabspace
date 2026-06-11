import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  toNullableTrimmedString,
  toOptionalTrimmedString,
} from './transformers';

export class UpdateCurrentUserProfileDto {
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

  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  fullName?: string;

  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9._-]+$/)
  @IsOptional()
  username?: string | null;
}
