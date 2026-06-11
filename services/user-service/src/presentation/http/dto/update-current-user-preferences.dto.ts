import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  toNullableTrimmedString,
  toOptionalTrimmedString,
} from './transformers';

export class UpdateCurrentUserPreferencesDto {
  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  dateFormat?: string;

  @IsBoolean()
  @IsOptional()
  desktopNotificationsEnabled?: boolean;

  @IsIn(['immediate', 'daily', 'weekly', 'never'])
  @IsOptional()
  digestFrequency?: string;

  @IsBoolean()
  @IsOptional()
  emailNotificationsEnabled?: boolean;

  @Transform(toOptionalTrimmedString)
  @IsString()
  @MaxLength(20)
  @IsOptional()
  language?: string;

  @IsBoolean()
  @IsOptional()
  pushNotificationsEnabled?: boolean;

  @IsIn(['system', 'light', 'dark'])
  @IsOptional()
  theme?: string;

  @IsIn(['12h', '24h'])
  @IsOptional()
  timeFormat?: string;

  @Transform(toNullableTrimmedString)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  timezone?: string | null;

  @IsIn(['monday', 'sunday', 'saturday'])
  @IsOptional()
  weekStartsOn?: string;
}
