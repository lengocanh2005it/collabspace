import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { annotateEnd, annotateStart } from '../lib/grafana-annotation.js';

const SCENARIO = 'demo-flow';

export const options = {
  stages: __ENV.K6_STAGES
    ? JSON.parse(__ENV.K6_STAGES)
    : [
        { duration: '30s', target: Number(__ENV.K6_VUS || 10) },
        { duration: '2m', target: Number(__ENV.K6_VUS || 10) },
        { duration: '30s', target: 0 },
      ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.90'],
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost/api/v1').replace(/\/$/, '');
const USER_A_EMAIL = __ENV.K6_USER_A_EMAIL || 'ngocanh@collabspace.dev';
const USER_B_EMAIL = __ENV.K6_USER_B_EMAIL || 'quangtien@collabspace.dev';
const USER_PASSWORD = __ENV.K6_USER_PASSWORD || 'collabspace123';

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function login(email) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password: USER_PASSWORD }),
    { headers: jsonHeaders() },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  if (res.status !== 200) {
    return null;
  }
  const body = res.json();
  return body.accessToken || body.data?.accessToken || null;
}

export function setup() {
  annotateStart(SCENARIO);
  const tokenA = login(USER_A_EMAIL);
  const tokenB = login(USER_B_EMAIL);
  if (!tokenA || !tokenB) {
    throw new Error('Demo users missing — run seed first (ngocanh/quangtien @ collabspace.dev)');
  }
  return { tokenA, tokenB, startedAt: Date.now() };
}

export default function (data) {
  const token = __VU % 2 === 0 ? data.tokenA : data.tokenB;

  group('read workspaces', () => {
    const res = http.get(`${BASE_URL}/workspaces`, { headers: jsonHeaders(token) });
    check(res, { 'workspaces 200': (r) => r.status === 200 });
  });

  group('read tasks board', () => {
    const wsRes = http.get(`${BASE_URL}/workspaces`, { headers: jsonHeaders(token) });
    if (wsRes.status !== 200) {
      return;
    }
    const workspaces = wsRes.json();
    const list = Array.isArray(workspaces) ? workspaces : workspaces.data || [];
    if (list.length === 0) {
      return;
    }
    const workspaceId = list[0].id || list[0].workspaceId;
    const res = http.get(`${BASE_URL}/tasks/board?workspaceId=${workspaceId}`, {
      headers: jsonHeaders(token),
    });
    check(res, { 'task board 200': (r) => r.status === 200 });
  });

  group('read notifications', () => {
    const res = http.get(`${BASE_URL}/notifications`, { headers: jsonHeaders(token) });
    check(res, { 'notifications 200': (r) => r.status === 200 });
  });

  group('read profile', () => {
    const res = http.get(`${BASE_URL}/users/me`, { headers: jsonHeaders(token) });
    check(res, { 'users/me 200': (r) => r.status === 200 });
  });

  sleep(0.5 + Math.random());
}

export function teardown(data) {
  annotateEnd(SCENARIO, Boolean(data?.startedAt));
}
