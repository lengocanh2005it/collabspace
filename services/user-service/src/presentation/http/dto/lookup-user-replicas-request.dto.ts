import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class LookupUserReplicasRequestDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;
}
