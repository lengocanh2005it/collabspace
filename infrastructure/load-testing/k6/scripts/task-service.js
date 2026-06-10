import http from "k6/http";
import { sleep, check, group } from "k6";

export let options = {
  vus: 50,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3003/api";

export default function () {
  group("Task Service List", function () {
    let res = http.get(`${BASE_URL}/v1/tasks`, {
      headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN || ""}` },
    });
    check(res, {
      "list status 200 or 401": (r) => r.status === 200 || r.status === 401,
    });
  });

  sleep(1);
}
