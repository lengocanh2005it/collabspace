import { Controller, Delete, Get, Headers, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminUserId, PlatformAdminGuard, RequirePlatformAdmin } from '@collabspace/nest-auth';
import { ManageUsersAdminUseCase } from '../../application/use-cases/manage-users-admin.use-case';

@ApiTags('users-admin')
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller('users/admin')
export class UsersAdminController {
  constructor(private readonly useCase: ManageUsersAdminUseCase) {}

  @Get('all')
  @ApiOperation({ summary: 'List all accounts with profile data' })
  async list(@Headers('authorization') authorization?: string) {
    return this.useCase.list(authorization!);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Anonymize profile and deactivate auth account' })
  async anonymize(
    @AdminUserId() actorId: string,
    @Param('id') userId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.useCase.anonymize(actorId, userId, authorization!);
  }
}
