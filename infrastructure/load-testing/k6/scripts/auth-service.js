import http from "k6/http";
import { sleep, check, group } from "k6";

export let options = {
  vus: 50,
  duration: "30s",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000/api/v1";

export default function () {
  group("Auth Service Health", function () {
    let res = http.get(`${BASE_URL}/auth/health`);
    check(res, { "health status 200": (r) => r.status === 200 });
  });

  group("Auth Login", function () {
    let payload = JSON.stringify({
      email: "test@example.com",
      password: "testpassword",
    });
    let res = http.post(`${BASE_URL}/auth/login`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    check(res, {
      "login status 200 or 401": (r) => r.status === 200 || r.status === 401,
    });
  });

  group("Auth Register", function () {
    let payload = JSON.stringify({
      email: `user_${Math.random().toString(36).substring(7)}@test.com`,
      fullName: "Load Test User",
      password: "testpassword123",
    });
    let res = http.post(`${BASE_URL}/auth/register`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    check(res, {
      "register status 201 or 409": (r) => r.status === 201 || r.status === 409,
    });
  });

  sleep(1);
}
