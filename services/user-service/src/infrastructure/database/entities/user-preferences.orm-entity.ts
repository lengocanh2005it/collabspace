import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_preferences' })
@Index('UQ_user_preferences_user_id', ['userId'], { unique: true })
export class UserPreferencesOrmEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'date_format', type: 'varchar', default: 'YYYY-MM-DD' })
  dateFormat!: string;

  @Column({
    name: 'desktop_notifications_enabled',
    type: 'boolean',
    default: true,
  })
  desktopNotificationsEnabled!: boolean;

  @Column({ name: 'digest_frequency', type: 'varchar', default: 'daily' })
  digestFrequency!: string;

  @Column({
    name: 'email_notifications_enabled',
    type: 'boolean',
    default: true,
  })
  emailNotificationsEnabled!: boolean;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', default: 'en' })
  language!: string;

  @Column({
    name: 'push_notifications_enabled',
    type: 'boolean',
    default: true,
  })
  pushNotificationsEnabled!: boolean;

  @Column({ type: 'varchar', default: 'system' })
  theme!: string;

  @Column({ name: 'time_format', type: 'varchar', default: '24h' })
  timeFormat!: string;

  @Column({ nullable: true, type: 'varchar' })
  timezone!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'week_starts_on', type: 'varchar', default: 'monday' })
  weekStartsOn!: string;
}
