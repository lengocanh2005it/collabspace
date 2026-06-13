import { Invitation } from "./invitation.entity";
import { InvitationInvalidStateError } from "../exceptions/invitation.exceptions";

describe("Invitation (rich domain)", () => {
  const base = () =>
    new Invitation(
      "inv-1",
      "ws-1",
      "u-1",
      "a@b.com",
      null,
      "pending",
      new Date(),
      new Date(Date.now() + 60_000),
    );

  it("assertCanReject passes for pending invitation", () => {
    expect(() => base().assertCanReject()).not.toThrow();
  });

  it("assertCanReject fails when not pending", () => {
    const inv = new Invitation(
      "inv-1",
      "ws-1",
      "u-1",
      "a@b.com",
      null,
      "accepted",
      new Date(),
      new Date(),
    );
    expect(() => inv.assertCanReject()).toThrow(InvitationInvalidStateError);
  });

  it("assertCanAccept fails when expired", () => {
    const inv = new Invitation(
      "inv-1",
      "ws-1",
      "u-1",
      "a@b.com",
      null,
      "pending",
      new Date(),
      new Date(Date.now() - 1),
    );
    expect(() => inv.assertCanAccept()).toThrow(InvitationInvalidStateError);
  });
});
