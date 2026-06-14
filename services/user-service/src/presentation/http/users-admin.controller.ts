import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isPlatformAdmin } from '@collabspace/shared';
import { ManageUsersAdminUseCase } from '../../application/use-cases/manage-users-admin.use-case';
import { AuthGrpcService } from '../../integrations/auth/auth-grpc.service';

@ApiTags('users-admin')
@ApiBearerAuth()
@Controller('users/admin')
export class UsersAdminController {
  constructor(
    private readonly authGrpcService: AuthGrpcService,
    private readonly useCase: ManageUsersAdminUseCase,
  ) {}

  @Get('all')
  @ApiOperation({ summary: 'List all accounts with profile data' })
  async list(@Headers('authorization') authorization?: string) {
    const identity = await this.requireAdmin(authorization);
    return this.useCase.list(authorization!);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Anonymize profile and deactivate auth account' })
  async anonymize(
    @Param('id') userId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    const identity = await this.requireAdmin(authorization);
    await this.useCase.anonymize(identity.userId, userId, authorization!);
  }

  private async requireAdmin(authorization?: string) {
    const identity = await this.authGrpcService.verifyAccessToken(authorization);
    if (!isPlatformAdmin(identity)) {
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Platform administrator role is required',
      });
    }
    return identity;
  }
}
