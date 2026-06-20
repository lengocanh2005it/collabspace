#!/usr/bin/env bash
# Broad prod API + RabbitMQ consumer audit via gateway HTTPS.
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DEPLOY_DIR="$ROOT_DIR/infrastructure/deploy"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
DOMAIN="${PROD_DOMAIN:-collabspace.ngocanh2005it.site}"

# shellcheck disable=SC1091
source "$DEPLOY_DIR/resolve-prod-api-base.sh"
export BASE_URL="$(resolve_prod_api_base_url)"
install_prod_api_curl_wrapper

PASS=0
FAIL=0
WARN=0
SKIP=0

log() { echo "[audit] $*"; }
ok()  { PASS=$((PASS + 1)); echo "[OK]   $*"; }
bad() { FAIL=$((FAIL + 1)); echo "[FAIL] $*" >&2; }
warn(){ WARN=$((WARN + 1)); echo "[WARN] $*"; }
skip(){ SKIP=$((SKIP + 1)); echo "[SKIP] $*"; }

http() {
  local method="$1" url="$2"
  shift 2
  curl -sS -w '\n%{http_code}' -X "$method" "$url" "$@" 2>/dev/null || echo -e "\n000"
}

expect_code() {
  local label="$1" want="$2"
  shift 2
  local resp code body
  resp=$(http "$@")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "$want" ]]; then
    ok "$label ($code)"
    echo "$body"
    return 0
  fi
  if [[ "$want" == "2xx" && "$code" -ge 200 && "$code" -lt 300 ]]; then
    ok "$label ($code)"
    echo "$body"
    return 0
  fi
  bad "$label — expected $want, got $code: ${body:0:200}"
  echo "$body"
  return 1
}

expect_2xx() {
  expect_code "$1" "2xx" "${@:2}" || true
}

log "BASE_URL=$BASE_URL"
log "=== Health endpoints (public) ==="
for path in \
  "$BASE_URL/auth/health" \
  "$BASE_URL/auth/health/live" \
  "$BASE_URL/auth/health/ready" \
  "$BASE_URL/users/health" \
  "$BASE_URL/users/health/live" \
  "$BASE_URL/users/health/ready" \
  "$BASE_URL/workspaces/health" \
  "$BASE_URL/workspaces/health/live" \
  "$BASE_URL/workspaces/health/ready" \
  "$BASE_URL/tasks/health/live" \
  "$BASE_URL/tasks/health/ready" \
  "$BASE_URL/notifications/health/live" \
  "$BASE_URL/notifications/health/ready"; do
  expect_2xx "GET $path" GET "$path" || true
done

log "=== Auth flow (register → verify → login) ==="
TS=$(date +%s)
EMAIL="audit-${TS}@example.com"
PASSWD="Demo@12345"
FULL="Audit User $TS"

reg_body=$(expect_2xx "POST /auth/register" POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\",\"fullName\":\"$FULL\"}")

USER_ID=$(echo "$reg_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('userId',''))" 2>/dev/null || echo "")
if [[ -z "$USER_ID" ]]; then
  bad "register missing userId"
else
  export DEMO_E2E_OTP_SCRIPT="${DEMO_E2E_OTP_SCRIPT:-$DEPLOY_DIR/read-auth-otp-from-outbox.sh}"
  sleep 2
  OTP=$("$DEMO_E2E_OTP_SCRIPT" "$EMAIL" 2>/dev/null || true)
  if [[ -z "$OTP" ]]; then
    bad "OTP not found for $EMAIL"
  else
    expect_2xx "POST /auth/verify-email" POST "$BASE_URL/auth/verify-email" \
      -H "Content-Type: application/json" \
      -d "{\"userId\":\"$USER_ID\",\"otp\":\"$OTP\"}" >/dev/null || true
  fi
fi

login_body=$(expect_2xx "POST /auth/login" POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}")
TOKEN=$(echo "$login_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null || echo "")
REFRESH=$(echo "$login_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('refreshToken',''))" 2>/dev/null || echo "")

if [[ -n "$TOKEN" ]]; then
  expect_2xx "GET /auth/me" GET "$BASE_URL/auth/me" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "GET /auth/sessions" GET "$BASE_URL/auth/sessions" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "GET /auth/verify" GET "$BASE_URL/auth/verify" -H "Authorization: Bearer $TOKEN" >/dev/null || true
fi

if [[ -n "$REFRESH" ]]; then
  refresh_body=$(expect_2xx "POST /auth/refresh" POST "$BASE_URL/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH\"}" || true)
  TOKEN=$(echo "$refresh_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','$TOKEN'))" 2>/dev/null || echo "$TOKEN")
fi

log "=== User profile APIs ==="
if [[ -n "$TOKEN" ]]; then
  expect_2xx "GET /users/me" GET "$BASE_URL/users/me" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "PATCH /users/me" PATCH "$BASE_URL/users/me" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"bio":"audit bio"}' >/dev/null || true
  expect_2xx "GET /users/me/preferences" GET "$BASE_URL/users/me/preferences" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "PATCH /users/me/preferences" PATCH "$BASE_URL/users/me/preferences" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"theme":"dark"}' >/dev/null || true
  expect_2xx "GET /users/me/status" GET "$BASE_URL/users/me/status" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "PATCH /users/me/status" PATCH "$BASE_URL/users/me/status" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"status":"online"}' >/dev/null || true
  expect_2xx "GET /users?limit=5" GET "$BASE_URL/users?limit=5" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "GET /users/search?q=audit&limit=5" GET "$BASE_URL/users/search?q=audit&limit=5" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "POST /users/bulk" POST "$BASE_URL/users/bulk" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"userIds\":[\"$USER_ID\"]}" >/dev/null || true
  expect_2xx "GET /users/$USER_ID" GET "$BASE_URL/users/$USER_ID" -H "Authorization: Bearer $TOKEN" >/dev/null || true
  expect_2xx "GET /users/$USER_ID/summary" GET "$BASE_URL/users/$USER_ID/summary" -H "Authorization: Bearer $TOKEN" >/dev/null || true
else
  skip "user APIs (no token)"
fi

log "=== Workspace + project + invite ==="
WS_ID="" PROJ_ID="" TASK_ID="" INV_ID=""
if [[ -n "$TOKEN" ]]; then
  ws_body=$(expect_2xx "POST /workspaces" POST "$BASE_URL/workspaces" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"name\":\"Audit WS $TS\",\"description\":\"audit\"}")
  WS_ID=$(echo "$ws_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))" 2>/dev/null || echo "")
  if [[ -n "$WS_ID" ]]; then
    expect_2xx "GET /workspaces" GET "$BASE_URL/workspaces" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /workspaces/$WS_ID" GET "$BASE_URL/workspaces/$WS_ID" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "PATCH /workspaces/$WS_ID" PATCH "$BASE_URL/workspaces/$WS_ID" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"description":"updated"}' >/dev/null || true
    expect_2xx "GET /workspaces/$WS_ID/members" GET "$BASE_URL/workspaces/$WS_ID/members" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /workspaces/$WS_ID/activity" GET "$BASE_URL/workspaces/$WS_ID/activity?limit=10" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /workspaces/$WS_ID/invitations" GET "$BASE_URL/workspaces/$WS_ID/invitations" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    proj_body=$(expect_2xx "POST /workspaces/.../projects" POST "$BASE_URL/workspaces/$WS_ID/projects" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "{\"name\":\"Audit Project $TS\"}")
    PROJ_ID=$(echo "$proj_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))" 2>/dev/null || echo "")
    if [[ -n "$PROJ_ID" ]]; then
      expect_2xx "GET /workspaces/$WS_ID/projects" GET "$BASE_URL/workspaces/$WS_ID/projects" -H "Authorization: Bearer $TOKEN" >/dev/null || true
      expect_2xx "PATCH /projects/$PROJ_ID" PATCH "$BASE_URL/projects/$PROJ_ID" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"name":"Audit Project Renamed"}' >/dev/null || true
    fi
  fi
else
  skip "workspace APIs (no token)"
fi

log "=== Task + comments (publishes RabbitMQ events) ==="
if [[ -n "$TOKEN" && -n "$WS_ID" && -n "$PROJ_ID" ]]; then
  task_body=$(expect_2xx "POST /tasks" POST "$BASE_URL/tasks" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"title\":\"Audit Task $TS\",\"workspaceId\":\"$WS_ID\",\"projectId\":\"$PROJ_ID\"}")
  TASK_ID=$(echo "$task_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))" 2>/dev/null || echo "")
  if [[ -n "$TASK_ID" ]]; then
    expect_2xx "GET /tasks?workspaceId=$WS_ID" GET "$BASE_URL/tasks?workspaceId=$WS_ID" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /tasks/board?workspaceId=$WS_ID" GET "$BASE_URL/tasks/board?workspaceId=$WS_ID" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /tasks/$TASK_ID" GET "$BASE_URL/tasks/$TASK_ID" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "GET /tasks/$TASK_ID/activity" GET "$BASE_URL/tasks/$TASK_ID/activity?limit=10" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    expect_2xx "PATCH /tasks/$TASK_ID/details" PATCH "$BASE_URL/tasks/$TASK_ID/details" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"title":"Audit Task Updated"}' >/dev/null || true
    expect_2xx "PATCH /tasks/$TASK_ID/status" PATCH "$BASE_URL/tasks/$TASK_ID/status" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"status":"DOING"}' >/dev/null || true
    expect_2xx "POST /tasks/$TASK_ID/comments" POST "$BASE_URL/tasks/$TASK_ID/comments" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"content":"audit comment"}' >/dev/null || true
    expect_2xx "GET /tasks/$TASK_ID/comments" GET "$BASE_URL/tasks/$TASK_ID/comments" -H "Authorization: Bearer $TOKEN" >/dev/null || true
    # self-assign triggers task_assigned event
    expect_2xx "PATCH /tasks/$TASK_ID/assignee" PATCH "$BASE_URL/tasks/$TASK_ID/assignee" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "{\"assigneeId\":\"$USER_ID\"}" >/dev/null || true
  fi
else
  skip "task APIs (missing workspace/project/token)"
fi

log "=== Notifications (consumer of RabbitMQ events) ==="
NOTIF_BEFORE=0 NOTIF_AFTER=0
if [[ -n "$TOKEN" ]]; then
  sleep 3
  nb=$(expect_2xx "GET /notifications (before)" GET "$BASE_URL/notifications?limit=50" -H "Authorization: Bearer $TOKEN" || echo "[]")
  NOTIF_BEFORE=$(echo "$nb" | python3 -c "import sys,json; d=json.load(sys.stdin); n=d.get('notifications', d.get('data', d)); print(len(n) if isinstance(n,list) else 0)" 2>/dev/null || echo 0)
  if [[ "$NOTIF_BEFORE" -gt 0 ]]; then
    ok "notifications list has $NOTIF_BEFORE item(s)"
    nid=$(echo "$nb" | python3 -c "import sys,json; d=json.load(sys.stdin); n=d.get('notifications',[]); print(n[0]['id'] if n else '')" 2>/dev/null || echo "")
    if [[ -n "$nid" ]]; then
      expect_2xx "PATCH /notifications/$nid/read" PATCH "$BASE_URL/notifications/$nid/read" \
        -H "Authorization: Bearer $TOKEN" >/dev/null || true
    fi
    expect_2xx "PATCH /notifications/read-all" PATCH "$BASE_URL/notifications/read-all" \
      -H "Authorization: Bearer $TOKEN" >/dev/null || true
  else
    warn "no notifications yet after task assign (Kafka lag or consumer issue)"
  fi
else
  skip "notifications (no token)"
fi

log "=== Auth negative / edge cases ==="
expect_code "POST /auth/login wrong password" "401" POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}" >/dev/null || true
expect_code "GET /users/me without token" "401" GET "$BASE_URL/users/me" >/dev/null || true

log "=== Kafka / event consumer hints (kubectl) ==="
if kubectl get deploy notification-service -n "$APP_NS" >/dev/null 2>&1; then
  recent=$(kubectl logs -n "$APP_NS" deploy/notification-service --tail=30 2>/dev/null | grep -iE 'via kafka|task_assigned|workspace_invited|comment|notification|error' | tail -5 || true)
  if [[ -n "$recent" ]]; then
    log "notification-service recent event lines:"
    echo "$recent"
  else
    warn "no recent Kafka event keywords in notification-service logs (last 30 lines)"
  fi
else
  skip "notification-service deployment not found"
fi

echo ""
echo "=========================================="
echo "  API Audit Summary"
echo "=========================================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  WARN: $WARN"
echo "  SKIP: $SKIP"
echo "  Test user: $EMAIL"
echo "  Workspace: ${WS_ID:-n/a}  Task: ${TASK_ID:-n/a}"
echo "=========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
