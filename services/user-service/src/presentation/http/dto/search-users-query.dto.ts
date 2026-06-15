import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { toOptionalTrimmedString } from './transformers';

export class SearchUsersQueryDto {
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
  @IsNotEmpty()
  @MaxLength(100)
  q!: string;
}
