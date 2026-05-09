import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePendingUserProfileUseCase } from '../../application/use-cases/create-pending-user-profile.use-case';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';

type CreatePendingProfileBody = {
  fullName: string;
  userId: string;
};

@Controller('users')
export class UsersController {
  constructor(
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @Get('health')
  getHealth() {
    return {
      service: 'user-service',
      status: 'ok',
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.getUserProfileUseCase.execute(id);
  }
}

@Controller('internal/users')
export class InternalUsersController {
  constructor(
    private readonly createPendingUserProfileUseCase: CreatePendingUserProfileUseCase,
  ) {}

  @Post('profiles')
  async createPendingProfile(@Body() body: CreatePendingProfileBody) {
    return this.createPendingUserProfileUseCase.execute(body);
  }
}
