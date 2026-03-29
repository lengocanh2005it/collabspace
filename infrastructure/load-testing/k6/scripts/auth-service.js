import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  vus: 50, // số virtual users
  duration: "30s",
};

export default function () {
  let res = http.get("http://localhost/auth/health");
  check(res, { "status was 200": (r) => r.status === 200 });
  sleep(1);
}
