import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@collabspace.dev' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
