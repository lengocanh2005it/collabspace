import { parseMentionUsernames } from "./mention-parser";

describe("parseMentionUsernames", () => {
  it("extracts unique usernames from content", () => {
    expect(
      parseMentionUsernames("Hello @alice and @bob, ping @alice again"),
    ).toEqual(["alice", "bob"]);
  });

  it("returns empty array when no mentions", () => {
    expect(parseMentionUsernames("No mentions here")).toEqual([]);
  });

  it("supports dotted demo usernames", () => {
    expect(parseMentionUsernames("Ping @ngo.quang.tien please")).toEqual([
      "ngo.quang.tien",
    ]);
  });
});
