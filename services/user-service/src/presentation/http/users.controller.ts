import { Controller, Get, Param } from '@nestjs/common';
import { GetUserProfileUseCase } from '../../application/use-cases/get-user-profile.use-case';

@Controller()
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

  @Get('users/:id')
  async getById(@Param('id') id: string) {
    return this.getUserProfileUseCase.execute(id);
  }
}
