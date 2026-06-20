import http from 'k6/http';
import encoding from 'k6/encoding';

const DEFAULT_BASE = '/grafana/api/annotations';

function apiBase() {
  const root = (__ENV.GRAFANA_URL || '').replace(/\/$/, '');
  if (!root) {
    return null;
  }
  return `${root}${DEFAULT_BASE}`;
}

function authHeaders() {
  const user = __ENV.GRAFANA_USER || 'admin';
  const pass = __ENV.GRAFANA_PASSWORD || '';
  if (!pass) {
    return { 'Content-Type': 'application/json' };
  }
  const token = `${user}:${pass}`;
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoding.b64encode(token)}`,
  };
}

export function annotateLoadTest(text, tags = []) {
  const url = apiBase();
  if (!url) {
    return;
  }

  const payload = JSON.stringify({
    text,
    tags: ['k6', 'load-test', ...tags],
    time: Date.now(),
    dashboardUID: 'collabspace-load-test',
  });

  const res = http.post(url, payload, {
    headers: authHeaders(),
    timeout: '5s',
  });

  if (res.status < 200 || res.status >= 300) {
    console.warn(`Grafana annotation skipped (${res.status}): ${text}`);
  }
}

export function annotateStart(scenario) {
  annotateLoadTest(`k6 ${scenario} started`, [scenario]);
}

export function annotateEnd(scenario, passed) {
  annotateLoadTest(`k6 ${scenario} ${passed ? 'passed' : 'failed'}`, [scenario]);
}
