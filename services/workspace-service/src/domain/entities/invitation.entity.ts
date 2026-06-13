import { InvitationInvalidStateError } from '../exceptions/invitation.exceptions';

export class Invitation {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly inviterId: string,
    public readonly inviteeEmail: string,
    public readonly inviteeUserId: string | null,
    public readonly status: string,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
  ) {}

  /** Rich domain: validate accept preconditions */
  assertCanAccept(): void {
    this.assertPending();
    this.assertNotExpired();
  }

  /** Rich domain: validate reject preconditions */
  assertCanReject(): void {
    this.assertPending();
  }

  private assertPending(): void {
    if (this.status !== 'pending') {
      throw new InvitationInvalidStateError('Invitation is not pending');
    }
  }

  private assertNotExpired(): void {
    if (this.expiresAt < new Date()) {
      throw new InvitationInvalidStateError('Invitation expired');
    }
  }
}
