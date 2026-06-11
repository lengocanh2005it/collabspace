import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toOptionalTrimmedString } from './transformers';

export class ListUsersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  offset?: number;

  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;
}
