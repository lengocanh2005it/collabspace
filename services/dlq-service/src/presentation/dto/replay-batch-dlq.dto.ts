import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { DlqErrorCategory } from '../../domain/dlq-record.schema';

const DLQ_ERROR_CATEGORY_VALUES: DlqErrorCategory[] = ['transient', 'logic', 'schema', 'unknown'];

export class ReplayBatchDlqDto {
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
