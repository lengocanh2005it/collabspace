import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { DlqErrorCategory, DlqStatus } from '../../domain/dlq-record.schema';

const DLQ_ERROR_CATEGORY_VALUES: DlqErrorCategory[] = ['transient', 'logic', 'schema', 'unknown'];
const DLQ_STATUS_VALUES: DlqStatus[] = ['pending', 'requires_manual_review'];

function parseCsv(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return value;
}

export class ReplayBatchDlqDto {
  @ApiPropertyOptional({ description: 'Explicit DLQ record ids to replay', isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ids?: string[];

  @ApiPropertyOptional({ enum: DLQ_STATUS_VALUES, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseCsv(value))
  @IsIn(DLQ_STATUS_VALUES, { each: true })
  status?: DlqStatus[];

  @ApiPropertyOptional({ description: 'Filter by source Kafka topic' })
  @IsOptional()
  @IsString()
  sourceTopic?: string;

  @ApiPropertyOptional({ enum: DLQ_ERROR_CATEGORY_VALUES })
  @IsOptional()
  @IsIn(DLQ_ERROR_CATEGORY_VALUES)
  errorCategory?: DlqErrorCategory;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
