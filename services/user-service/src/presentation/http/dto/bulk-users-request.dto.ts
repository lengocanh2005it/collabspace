import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';
import { toUniqueStringArray } from './transformers';

export class BulkUsersRequestDto {
  @ApiProperty({
    type: [String],
    example: ['user-1', 'user-2'],
    maxItems: 100,
  })
  @Transform(toUniqueStringArray)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  userIds!: string[];
}
