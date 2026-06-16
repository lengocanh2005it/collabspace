import { ForbiddenException } from '@nestjs/common';
import type { Invitation } from '../../../domain/entities/invitation.entity';

export function assertInvitationRecipient(
  invitation: Invitation,
  userId: string,
  email: string,
): void {
  const normalizedEmail = email.trim().toLowerCase();
  const inviteeEmail = invitation.inviteeEmail.trim().toLowerCase();
  const matchesEmail = inviteeEmail === normalizedEmail;
  const matchesUser = invitation.inviteeUserId != null && invitation.inviteeUserId === userId;

  if (!matchesEmail && !matchesUser) {
    throw new ForbiddenException('This invitation was sent to a different user');
  }
}
