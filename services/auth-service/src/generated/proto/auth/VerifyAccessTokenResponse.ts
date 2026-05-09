// Original file: E:/collabspace/services/auth-service/proto/auth.proto

export interface VerifyAccessTokenResponse {
  authenticated?: boolean;
  userId?: string;
  role?: string;
  workspaceId?: string;
}

export interface VerifyAccessTokenResponse__Output {
  authenticated?: boolean;
  userId?: string;
  role?: string;
  workspaceId?: string;
}
