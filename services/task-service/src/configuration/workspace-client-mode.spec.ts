import { assertWorkspaceClientModeForProduction } from "./workspace-client-mode";

describe("assertWorkspaceClientModeForProduction", () => {
  it("allows http mode in production", () => {
    expect(() => assertWorkspaceClientModeForProduction("production", "http")).not.toThrow();
  });

  it("rejects mock mode in production", () => {
    expect(() => assertWorkspaceClientModeForProduction("production", "mock")).toThrow(
      "FATAL: WORKSPACE_CLIENT_MODE must be http when NODE_ENV=production",
    );
  });

  it("allows mock mode outside production", () => {
    expect(() => assertWorkspaceClientModeForProduction("development", "mock")).not.toThrow();
  });
});
