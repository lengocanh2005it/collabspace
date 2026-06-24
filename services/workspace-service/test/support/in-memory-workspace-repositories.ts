import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Invitation } from '../../src/domain/entities/invitation.entity';
import { Workspace } from '../../src/domain/entities/workspace.entity';
import { WorkspaceMember } from '../../src/domain/entities/workspace-member.entity';
import type { IInvitationRepository } from '../../src/domain/repositories/invitation.repository';
import type { IWorkspaceRepository } from '../../src/domain/repositories/workspace.repository';
import type { IWorkspaceMemberRepository } from '../../src/domain/repositories/workspace-member.repository';
import type { IWorkspaceActivityRepository } from '../../src/domain/repositories/workspace-activity.repository';

export type InMemoryWorkspaceRepositories = {
  workspaceRepo: IWorkspaceRepository;
  memberRepo: IWorkspaceMemberRepository;
  invitationRepo: IInvitationRepository;
  activityRepo: IWorkspaceActivityRepository;
};

export function createInMemoryWorkspaceRepositories(): InMemoryWorkspaceRepositories {
  const workspaces = new Map<string, Workspace>();
  const members: WorkspaceMember[] = [];
  const invitations: Invitation[] = [];

  const workspaceRepo: IWorkspaceRepository = {
    async adminForceDelete() {
      return undefined;
    },
    async adminForceJoin(workspaceId, userId, role) {
      members.push(new WorkspaceMember(randomUUID(), workspaceId, userId, role, new Date()));
    },
    async adminListAll() {
      return [];
    },
    async createWithOwner(data) {
      const now = new Date();
      const workspace = new Workspace(
        randomUUID(),
        data.name,
        data.description ?? null,
        data.ownerId,
        now,
        now,
      );
      workspaces.set(workspace.id, workspace);
      members.push(new WorkspaceMember(randomUUID(), workspace.id, data.userId, 'owner', now));
      return workspace;
    },
    async deleteByOwner() {
      return undefined;
    },
    async findById(id) {
      return workspaces.get(id) ?? null;
    },
    async findByMember(userId) {
      const workspaceIds = new Set(
        members.filter((member) => member.userId === userId).map((member) => member.workspaceId),
      );
      return [...workspaceIds]
        .map((id) => workspaces.get(id))
        .filter((workspace): workspace is Workspace => workspace != null);
    },
    async update(id, data) {
      const existing = workspaces.get(id);
      if (!existing) {
        throw new NotFoundException('Workspace not found');
      }
      const updated = new Workspace(
        existing.id,
        data.name ?? existing.name,
        data.description ?? existing.description,
        existing.ownerId,
        existing.createdAt,
        new Date(),
      );
      workspaces.set(id, updated);
      return updated;
    },
  };

  const memberRepo: IWorkspaceMemberRepository = {
    async findByWorkspace(workspaceId) {
      return members.filter((member) => member.workspaceId === workspaceId);
    },
    async findByWorkspaceAndUser(workspaceId, userId) {
      return (
        members.find((member) => member.workspaceId === workspaceId && member.userId === userId) ??
        null
      );
    },
    async updateRoleByWorkspaceAndUser(workspaceId, userId, role) {
      const index = members.findIndex((m) => m.workspaceId === workspaceId && m.userId === userId);
      if (index < 0) {
        throw new NotFoundException('Workspace member not found');
      }

      const existing = members[index];
      members[index] = new WorkspaceMember(
        existing.id,
        existing.workspaceId,
        existing.userId,
        role,
        existing.joinedAt,
      );
    },
    async removeByWorkspaceAndUser(workspaceId, userId) {
      const index = members.findIndex(
        (member) => member.workspaceId === workspaceId && member.userId === userId,
      );
      if (index < 0) {
        throw new NotFoundException('Workspace member not found');
      }
      members.splice(index, 1);
    },
    async countByWorkspaceAndRole(workspaceId, role) {
      return members.filter((member) => member.workspaceId === workspaceId && member.role === role)
        .length;
    },
  };

  const invitationRepo: IInvitationRepository = {
    async acceptAndJoinWorkspace(invitationId, userId) {
      const invitation = invitations.find((item) => item.id === invitationId);
      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }
      const alreadyMember = members.some(
        (member) => member.workspaceId === invitation.workspaceId && member.userId === userId,
      );

      if (invitation.status === 'accepted' && invitation.inviteeUserId === userId) {
        return {
          memberJoined: false,
          status: 'accepted',
          workspaceId: invitation.workspaceId,
        };
      }

      try {
        invitation.assertCanAccept();
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invitation cannot be accepted',
        );
      }

      const index = invitations.findIndex((item) => item.id === invitationId);
      invitations[index] = new Invitation(
        invitation.id,
        invitation.workspaceId,
        invitation.inviterId,
        invitation.inviteeEmail,
        userId,
        'accepted',
        invitation.createdAt,
        invitation.expiresAt,
      );

      if (!alreadyMember) {
        members.push(
          new WorkspaceMember(randomUUID(), invitation.workspaceId, userId, 'member', new Date()),
        );
      }

      return {
        memberJoined: !alreadyMember,
        status: 'accepted',
        workspaceId: invitation.workspaceId,
      };
    },
    async createAndPublishInvited(data) {
      const now = new Date();
      const invitation = new Invitation(
        randomUUID(),
        data.workspaceId,
        data.inviterId,
        data.inviteeEmail,
        null,
        'pending',
        now,
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      );
      invitations.push(invitation);
      return invitation;
    },
    async findById(id) {
      return invitations.find((invitation) => invitation.id === id) ?? null;
    },
    async findPendingByWorkspace(workspaceId) {
      return invitations.filter(
        (invitation) => invitation.workspaceId === workspaceId && invitation.status === 'pending',
      );
    },
    async findPendingByWorkspaceAndEmail(workspaceId, email) {
      const normalizedEmail = email.trim().toLowerCase();
      return (
        invitations.find(
          (invitation) =>
            invitation.workspaceId === workspaceId &&
            invitation.status === 'pending' &&
            invitation.inviteeEmail.trim().toLowerCase() === normalizedEmail,
        ) ?? null
      );
    },
    async findPendingForInvitee(email, userId) {
      const normalizedEmail = email.trim().toLowerCase();
      return invitations.filter(
        (invitation) =>
          invitation.status === 'pending' &&
          (invitation.inviteeEmail.trim().toLowerCase() === normalizedEmail ||
            invitation.inviteeUserId === userId),
      );
    },
    async updateStatus(id, status, userId) {
      const invitation = invitations.find((item) => item.id === id);
      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }
      const updated = new Invitation(
        invitation.id,
        invitation.workspaceId,
        invitation.inviterId,
        invitation.inviteeEmail,
        userId ?? invitation.inviteeUserId,
        status,
        invitation.createdAt,
        invitation.expiresAt,
      );
      const index = invitations.findIndex((item) => item.id === id);
      invitations[index] = updated;
      return updated;
    },
  };

  const activityRepo: IWorkspaceActivityRepository = {
    async record() {
      return undefined;
    },
    async findByWorkspace() {
      return { items: [], total: 0 };
    },
  };

  return { workspaceRepo, memberRepo, invitationRepo, activityRepo };
}
