export type PlatformIdentity = {
  permissions?: string[];
  role?: string;
  roles?: string[];
  userId: string;
};

export function hasPlatformRole(
  identity: PlatformIdentity,
  role: string,
): boolean {
  const normalizedRole = role.trim().toLowerCase();
  return [identity.role, ...(identity.roles ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.trim().toLowerCase() === normalizedRole);
}

export function hasPlatformPermission(
  identity: PlatformIdentity,
  permission: string,
): boolean {
  const normalizedPermission = permission.trim().toLowerCase();
  return (identity.permissions ?? []).some(
    (value) => value.trim().toLowerCase() === normalizedPermission,
  );
}

export function isPlatformAdmin(identity: PlatformIdentity): boolean {
  return (
    hasPlatformRole(identity, "admin") ||
    hasPlatformPermission(identity, "auth.manage")
  );
}
