export type UserReplicaLookupDto = {
  userId: string;
  email: string;
  username: string | null;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

export type LookupUserReplicasInput = {
  userIds?: string[];
  username?: string;
};
