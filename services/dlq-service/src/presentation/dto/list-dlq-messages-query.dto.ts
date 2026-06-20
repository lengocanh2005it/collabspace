import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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

export class ListDlqMessagesQueryDto {
  @ApiPropertyOptional({ enum: DLQ_STATUS_VALUES })
  @IsOptional()
  @IsIn(DLQ_STATUS_VALUES)
  status?: DlqStatus;

  @ApiPropertyOptional({ enum: DLQ_ERROR_CATEGORY_VALUES })
  @IsOptional()
  @IsIn(DLQ_ERROR_CATEGORY_VALUES)
  errorCategory?: DlqErrorCategory;

  @ApiPropertyOptional({ description: 'Filter by source Kafka topic' })
  @IsOptional()
  @IsString()
  sourceTopic?: string;

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
