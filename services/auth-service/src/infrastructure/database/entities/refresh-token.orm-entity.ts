import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'refresh_tokens' })
@Index('IDX_refresh_tokens_family_id', ['familyId'])
@Index('IDX_refresh_tokens_user_id', ['userId'])
@Index('UQ_refresh_tokens_token_hash', ['tokenHash'], { unique: true })
export class RefreshTokenOrmEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'last_used_at', nullable: true, type: 'timestamptz' })
  lastUsedAt!: Date | null;

  @Column({ name: 'parent_token_id', nullable: true, type: 'uuid' })
  parentTokenId!: string | null;

  @Column({ name: 'replaced_by_token_id', nullable: true, type: 'uuid' })
  replacedByTokenId!: string | null;

  @Column({ name: 'revoke_reason', nullable: true, type: 'varchar' })
  revokeReason!: string | null;

  @Column({ name: 'revoked_at', nullable: true, type: 'timestamptz' })
  revokedAt!: Date | null;

  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'workspace_id', nullable: true, type: 'uuid' })
  workspaceId!: string | null;
}
