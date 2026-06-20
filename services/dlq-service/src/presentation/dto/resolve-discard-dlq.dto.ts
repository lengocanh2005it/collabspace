import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResolveDiscardDlqDto {
  @ApiProperty({
    description: 'Required note explaining the resolution decision',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  resolutionNote!: string;
}
