import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import type { Request } from 'express';
import { LookupAccountByEmailUseCase } from '@/application/use-cases/lookup-account-by-email.use-case';
import { assertInternalServiceAccess } from './internal-service-access';

class LookupAccountByEmailRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

@ApiTags('auth-internal')
@ApiSecurity('service-jwt')
@Controller('auth/internal')
export class InternalAuthController {
  constructor(private readonly lookupAccountByEmailUseCase: LookupAccountByEmailUseCase) {}

  @Post('account-lookup')
  @ApiOperation({
    summary: 'Resolve registered account by email (S2S)',
    description:
      'Requires Service JWT (auth.accounts.read, aud=auth-service). Used by workspace-service before creating invitations.',
  })
  async lookupAccount(@Req() request: Request, @Body() body: LookupAccountByEmailRequestDto) {
    assertInternalServiceAccess(request);
    const account = await this.lookupAccountByEmailUseCase.execute(body.email);
    return account ?? null;
  }
}
