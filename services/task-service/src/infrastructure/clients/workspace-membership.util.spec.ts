import { meetsWorkspaceRole } from "./workspace-membership.util";

describe("meetsWorkspaceRole", () => {
  it("returns true when role meets required level", () => {
    expect(meetsWorkspaceRole("admin", "member")).toBe(true);
  });

  it("returns false when role is null", () => {
    expect(meetsWorkspaceRole(null, "member")).toBe(false);
  });
});
