import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthSessionResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'member@collabspace.dev' })
  email: string;

  @ApiProperty({ example: '15m' })
  expiresIn: string;

  @ApiProperty({ example: 'refresh-token-uuid' })
  refreshToken: string;

  @ApiPropertyOptional({ example: 'user' })
  role?: string;

  @ApiProperty({ example: ['user'], type: [String] })
  roles: string[];

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ nullable: true, example: 'workspace-uuid' })
  workspaceId?: string | null;
}
