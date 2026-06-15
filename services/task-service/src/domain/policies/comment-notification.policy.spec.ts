import { CommentNotificationPolicy } from "./comment-notification.policy";

describe("CommentNotificationPolicy", () => {
  describe("shouldNotifyAssignee", () => {
    it("returns false when assignee is null", () => {
      expect(CommentNotificationPolicy.shouldNotifyAssignee(null, "author")).toBe(false);
    });

    it("returns false when author is assignee", () => {
      expect(CommentNotificationPolicy.shouldNotifyAssignee("author", "author")).toBe(false);
    });

    it("returns true when assignee differs from author", () => {
      expect(CommentNotificationPolicy.shouldNotifyAssignee("assignee", "author")).toBe(true);
    });
  });

  describe("mentionRecipients", () => {
    it("excludes assignee from mention list", () => {
      expect(
        CommentNotificationPolicy.mentionRecipients(["u1", "u2", "assignee"], "assignee"),
      ).toEqual(["u1", "u2"]);
    });
  });
});
