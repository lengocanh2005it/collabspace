import http from "k6/http";
import { sleep, check, group } from "k6";

export let options = {
  vus: 50,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost";

export default function () {
  group("Notification Service Health", function () {
    let res = http.get(`${BASE_URL}/notifications/health`);
    check(res, { "health status 200": (r) => r.status === 200 });
  });

  sleep(1);
}
