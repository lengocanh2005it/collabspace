// Idempotent rs0 initiate for local Docker (host: mongo:27017).
(function () {
  try {
    const status = rs.status();
    if (status.ok === 1) {
      const primary = status.members.some((m) => m.stateStr === "PRIMARY");
      if (primary) {
        print("Replica set rs0 already PRIMARY");
        quit(0);
      }
    }
  } catch (e) {
    const msg = String(e);
    if (
      e.codeName !== "NotYetInitialized" &&
      !msg.includes("no replset config") &&
      !msg.includes("Replication has not yet been configured")
    ) {
      throw e;
    }
  }

  const cfg = { _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] };
  const result = rs.initiate(cfg);
  printjson(result);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const status = rs.status();
      if (status.ok === 1 && status.members.some((m) => m.stateStr === "PRIMARY")) {
        print("Replica set rs0 PRIMARY ready");
        quit(0);
      }
    } catch (_) {
      // not ready yet
    }
    sleep(1000);
  }

  print("Timed out waiting for PRIMARY");
  quit(1);
})();
