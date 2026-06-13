import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { annotateEnd, annotateStart } from '../lib/grafana-annotation.js';

const SCENARIO = 'slo-baseline';

export const options = {
  vus: Number(__ENV.K6_VUS || 10),
  duration: __ENV.K6_DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{group:::auth login}': ['p(95)<800'],
    'http_req_duration{group:::list workspaces}': ['p(95)<500'],
    'http_req_duration{group:::task board}': ['p(95)<600'],
    'http_req_duration{group:::list tasks}': ['p(95)<600'],
    'http_req_duration{group:::list notifications}': ['p(95)<500'],
    'http_req_duration{group:::user profile}': ['p(95)<400'],
    'http_req_duration{group:::task activity}': ['p(95)<700'],
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
  let workspaceId;
  let taskId;

  group('auth login', () => {
    const email = __VU % 2 === 0 ? USER_A_EMAIL : USER_B_EMAIL;
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password: USER_PASSWORD }),
      { headers: jsonHeaders() },
    );
    check(res, { 'auth login 200': (r) => r.status === 200 });
  });

  group('list workspaces', () => {
    const res = http.get(`${BASE_URL}/workspaces`, { headers: jsonHeaders(token) });
    check(res, { 'workspaces 200': (r) => r.status === 200 });
    if (res.status !== 200) {
      return;
    }
    const workspaces = res.json();
    const list = Array.isArray(workspaces) ? workspaces : workspaces.data || [];
    if (list.length > 0) {
      workspaceId = list[0].id || list[0].workspaceId;
    }
  });

  if (!workspaceId) {
    sleep(0.5);
    return;
  }

  group('task board', () => {
    const res = http.get(`${BASE_URL}/tasks/board?workspaceId=${workspaceId}`, {
      headers: jsonHeaders(token),
    });
    check(res, { 'task board 200': (r) => r.status === 200 });
    if (res.status === 200) {
      const body = res.json();
      const payload = body.data || body;
      const columns = payload.columns || [];
      const firstTask = columns
        .flatMap((column) => column.tasks || [])
        .find((task) => task?.id);
      if (firstTask) {
        taskId = firstTask.id;
      }
    }
  });

  group('list tasks', () => {
    const res = http.get(`${BASE_URL}/tasks?workspaceId=${workspaceId}&limit=50`, {
      headers: jsonHeaders(token),
    });
    check(res, { 'tasks list 200': (r) => r.status === 200 });
    if (!taskId && res.status === 200) {
      const body = res.json();
      const payload = body.data || body;
      const tasks = payload.tasks || [];
      if (tasks.length > 0) {
        taskId = tasks[0].id;
      }
    }
  });

  group('list notifications', () => {
    const res = http.get(`${BASE_URL}/notifications?limit=20`, {
      headers: jsonHeaders(token),
    });
    check(res, { 'notifications 200': (r) => r.status === 200 });
  });

  group('user profile', () => {
    const res = http.get(`${BASE_URL}/users/me`, { headers: jsonHeaders(token) });
    check(res, { 'users/me 200': (r) => r.status === 200 });
  });

  if (taskId) {
    group('task activity', () => {
      const res = http.get(`${BASE_URL}/tasks/${taskId}/activity?limit=20`, {
        headers: jsonHeaders(token),
      });
      check(res, { 'task activity 200': (r) => r.status === 200 });
    });
  }

  sleep(0.3 + Math.random() * 0.4);
}

export function teardown(data) {
  annotateEnd(SCENARIO, Boolean(data?.startedAt));
}
