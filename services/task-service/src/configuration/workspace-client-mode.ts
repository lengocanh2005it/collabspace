export function assertWorkspaceClientModeForProduction(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  workspaceClientMode: string | undefined = process.env.WORKSPACE_CLIENT_MODE,
): void {
  if (nodeEnv === "production" && workspaceClientMode !== "http") {
    throw new Error("FATAL: WORKSPACE_CLIENT_MODE must be http when NODE_ENV=production");
  }
}
