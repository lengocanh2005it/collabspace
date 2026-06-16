import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminUserId, PlatformAdminGuard, RequirePlatformAdmin } from '@collabspace/nest-auth';
import {
  AssignPermissionDto,
  AssignRoleDto,
  CreateAdminPermissionDto,
  CreateAdminRoleDto,
  SetUserActiveStatusDto,
  UpdateAdminRoleDto,
} from '@/application/dto/auth-admin.dto';
import { ManageAuthAdminUseCase } from '@/application/use-cases/manage-auth-admin.use-case';

@ApiTags('auth-admin')
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller('auth/admin')
export class AuthAdminController {
  constructor(private readonly adminUseCase: ManageAuthAdminUseCase) {}

  @Post('roles')
  createRole(@Body() body: CreateAdminRoleDto) {
    return this.adminUseCase.createRole(body);
  }

  @Post('permissions')
  createPermission(@Body() body: CreateAdminPermissionDto) {
    return this.adminUseCase.createPermission(body);
  }

  @Post('roles/:roleId/permissions')
  assignPermission(@Param('roleId') roleId: string, @Body() body: AssignPermissionDto) {
    return this.adminUseCase.assignPermission(roleId, body.permissionId);
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  unassignPermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return this.adminUseCase.unassignPermission(roleId, permissionId);
  }

  @Post('users/:userId/roles')
  assignRole(
    @AdminUserId() actorId: string,
    @Param('userId') userId: string,
    @Body() body: AssignRoleDto,
  ) {
    return this.adminUseCase.assignRole(actorId, userId, body.roleId);
  }

  @Get('roles')
  listRoles() {
    return this.adminUseCase.listRoles();
  }

  @Get('permissions')
  listPermissions() {
    return this.adminUseCase.listPermissions();
  }

  @Get('users')
  listUsers() {
    return this.adminUseCase.listUsers();
  }

  @Patch('users/:id/active-status')
  setUserActive(
    @AdminUserId() actorId: string,
    @Param('id') userId: string,
    @Body() body: SetUserActiveStatusDto,
  ) {
    return this.adminUseCase.setUserActive(actorId, userId, body.isActive);
  }

  @Put('roles/:id')
  updateRole(@Param('id') roleId: string, @Body() body: UpdateAdminRoleDto) {
    return this.adminUseCase.updateRole(roleId, body);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(@Param('id') roleId: string): Promise<void> {
    await this.adminUseCase.deleteRole(roleId);
  }
}
