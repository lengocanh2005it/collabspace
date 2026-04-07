import http from "k6/http";
import { sleep, check, group } from "k6";

export let options = {
  vus: 50,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost";

export default function () {
  group("User Service Health", function () {
    let res = http.get(`${BASE_URL}/users/health`);
    check(res, { "health status 200": (r) => r.status === 200 });
  });

  group("Get User Profile", function () {
    // Uses a test user ID — replace with actual seeded user ID in real tests
    let res = http.get(`${BASE_URL}/users/1`, {
      headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN || ''}` },
    });
    check(res, {
      "profile status 200 or 401": (r) => r.status === 200 || r.status === 401,
    });
  });

  sleep(1);
}