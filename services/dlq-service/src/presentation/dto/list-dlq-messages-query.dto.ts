import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { DlqErrorCategory, DlqStatus } from '../../domain/dlq-record.schema';

const DLQ_STATUS_VALUES: DlqStatus[] = [
  'pending',
  'replaying',
  'requires_manual_review',
  'resolved',
  'discarded',
];

const DLQ_ERROR_CATEGORY_VALUES: DlqErrorCategory[] = ['transient', 'logic', 'schema', 'unknown'];

function parseCsv(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return value;
}

export class ListDlqMessagesQueryDto {
  @ApiPropertyOptional({ enum: DLQ_STATUS_VALUES, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseCsv(value))
  @IsIn(DLQ_STATUS_VALUES, { each: true })
  status?: DlqStatus[];

  @ApiPropertyOptional({ enum: DLQ_ERROR_CATEGORY_VALUES })
  @IsOptional()
  @IsIn(DLQ_ERROR_CATEGORY_VALUES)
  errorCategory?: DlqErrorCategory;

  @ApiPropertyOptional({ description: 'Filter by source Kafka topic' })
  @IsOptional()
  @IsString()
  sourceTopic?: string;

  @ApiPropertyOptional({ description: 'createdAt lower bound (ISO date)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? new Date(value) : undefined,
  )
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'createdAt upper bound (ISO date)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? new Date(value) : undefined,
  )
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ description: 'Opaque cursor for next page (base64 ObjectId)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
