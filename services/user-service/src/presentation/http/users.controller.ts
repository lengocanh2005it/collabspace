import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePendingUserProfileUseCase } from '../../application/use-cases/create-pending-user-profile.use-case';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';

type CreatePendingProfileBody = {
  fullName: string;
  userId: string;
};

@Controller()
export class UsersController {
  constructor(
    private readonly createPendingUserProfileUseCase: CreatePendingUserProfileUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @Get('health')
  getHealth() {
    return {
      service: 'user-service',
      status: 'ok',
    };
  }

  @Get('users/:id')
  async getById(@Param('id') id: string) {
    return this.getUserProfileUseCase.execute(id);
  }

  @Post('internal/users/profiles')
  async createPendingProfile(@Body() body: CreatePendingProfileBody) {
    return this.createPendingUserProfileUseCase.execute(body);
  }
}
