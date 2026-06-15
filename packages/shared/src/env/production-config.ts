export function isNodeProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function assertRequiredInProduction(envName: string, value: string | undefined): void {
  if (!isNodeProduction()) {
    return;
  }

  if (!value?.trim()) {
    throw new Error(`FATAL: ${envName} is required when NODE_ENV=production`);
  }
}
