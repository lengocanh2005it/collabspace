import { meetsWorkspaceRole } from "./workspace-membership.util";

describe("meetsWorkspaceRole", () => {
  it("returns true when role meets required level", () => {
    expect(meetsWorkspaceRole("owner", "member")).toBe(true);
    expect(meetsWorkspaceRole("manager", "member")).toBe(true);
    expect(meetsWorkspaceRole("owner", "manager")).toBe(true);
  });

  it("returns false when role is below required level", () => {
    expect(meetsWorkspaceRole("member", "manager")).toBe(false);
    expect(meetsWorkspaceRole("manager", "owner")).toBe(false);
  });

  it("returns false when role is null", () => {
    expect(meetsWorkspaceRole(null, "member")).toBe(false);
  });
});
