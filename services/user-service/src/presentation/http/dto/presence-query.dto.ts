import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';
import { toCsvArray, toUniqueStringArray } from './transformers';

export class PresenceQueryDto {
  @Transform(toCsvArray)
  @Transform(toUniqueStringArray)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  userIds!: string[];
}
