import http from 'k6/http';
import { check, sleep } from 'k6';
import { annotateEnd, annotateStart } from '../lib/grafana-annotation.js';

const SCENARIO = 'smoke';

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost/api/v1').replace(/\/$/, '');

const HEALTH_PATHS = [
  { name: 'auth', path: '/auth/health' },
  { name: 'users', path: '/users/health' },
  { name: 'workspaces', path: '/workspaces/health' },
  { name: 'tasks', path: '/tasks/health' },
  { name: 'notifications', path: '/notifications/health' },
];

export function setup() {
  annotateStart(SCENARIO);
  return { startedAt: Date.now() };
}

export default function () {
  for (const route of HEALTH_PATHS) {
    const res = http.get(`${BASE_URL}${route.path}`);
    check(res, {
      [`${route.name} health 200`]: (r) => r.status === 200,
    });
  }
  sleep(1);
}

export function teardown(data) {
  const passed = data && data.startedAt > 0;
  annotateEnd(SCENARIO, passed);
}
