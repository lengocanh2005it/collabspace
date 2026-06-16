import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateMemberRoleUseCase } from './update-member-role.use-case';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';
import type { UpdateMemberRoleDto } from '../../dto/update-member-role.dto';

describe('UpdateMemberRoleUseCase', () => {
  let useCase: UpdateMemberRoleUseCase;

  const mockMemberRepo = {
    findByWorkspaceAndUser: jest.fn(),
    updateRoleByWorkspaceAndUser: jest.fn(),
  };

  const mockActivityRepo = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const dto = { role: 'manager' } satisfies UpdateMemberRoleDto;

  beforeEach(async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockReset();
    mockMemberRepo.updateRoleByWorkspaceAndUser.mockReset();
    mockActivityRepo.record.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateMemberRoleUseCase,
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
      ],
    }).compile();
    useCase = module.get(UpdateMemberRoleUseCase);
  });

  it('throws ForbiddenException when actor is not owner', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockImplementation(async (_wsId, userId) => {
      if (userId === 'user-actor') {
        return new WorkspaceMember('m-actor', 'ws-1', 'user-actor', 'member', new Date());
      }

      return new WorkspaceMember('m-target', 'ws-1', 'user-target', 'member', new Date());
    });

    await expect(useCase.execute('user-actor', 'ws-1', 'user-target', dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when target member does not exist', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockImplementation(async (_wsId, userId) => {
      if (userId === 'user-actor') {
        return new WorkspaceMember('m-actor', 'ws-1', 'user-actor', 'owner', new Date());
      }

      return null;
    });

    await expect(useCase.execute('user-actor', 'ws-1', 'user-target', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('blocks changing workspace owner role', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockImplementation(async (_wsId, userId) => {
      if (userId === 'user-actor') {
        return new WorkspaceMember('m-actor', 'ws-1', 'user-actor', 'owner', new Date());
      }

      return new WorkspaceMember('m-target', 'ws-1', 'user-target', 'owner', new Date());
    });

    await expect(useCase.execute('user-actor', 'ws-1', 'user-target', dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('is idempotent when target role equals requested role', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockImplementation(async (_wsId, userId) => {
      if (userId === 'user-actor') {
        return new WorkspaceMember('m-actor', 'ws-1', 'user-actor', 'owner', new Date());
      }

      return new WorkspaceMember('m-target', 'ws-1', 'user-target', 'manager', new Date());
    });

    await useCase.execute('user-actor', 'ws-1', 'user-target', {
      role: 'manager',
    } as UpdateMemberRoleDto);

    expect(mockMemberRepo.updateRoleByWorkspaceAndUser).not.toHaveBeenCalled();
    expect(mockActivityRepo.record).not.toHaveBeenCalled();
  });

  it('updates role and records workspace activity', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockImplementation(async (_wsId, userId) => {
      if (userId === 'user-actor') {
        return new WorkspaceMember('m-actor', 'ws-1', 'user-actor', 'owner', new Date());
      }

      return new WorkspaceMember('m-target', 'ws-1', 'user-target', 'member', new Date());
    });

    await useCase.execute('user-actor', 'ws-1', 'user-target', dto);

    expect(mockMemberRepo.updateRoleByWorkspaceAndUser).toHaveBeenCalledWith(
      'ws-1',
      'user-target',
      'manager',
    );
    expect(mockActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-actor',
        type: 'member_role_changed',
      }),
    );
  });
});
