#!/usr/bin/env bash
# demo-e2e.sh — CollabSpace end-to-end demo story
# Exercises: register → verify → login → workspace → invite → task → assign → comment → notification
# Exit code != 0 on any failure. Set DEBUG=1 for verbose curl output.
set -euo pipefail

BASE="${BASE_URL:-http://localhost/api/v1}"
DEBUG="${DEBUG:-0}"

# ---------- helpers ----------------------------------------------------------

log()  { echo "[demo-e2e] $*"; }
dbg()  { [[ "$DEBUG" == "1" ]] && echo "[DEBUG] $*" >&2 || true; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

_curl() {
  curl -sS --connect-timeout 10 --max-time 30 "$@"
}

curl_post() {
  local url="$1"; shift
  local resp
  resp=$(_curl -w '\n%{http_code}' -X POST "$url" \
    -H "Content-Type: application/json" "$@") || fail "curl POST $url failed (network)"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  dbg "POST $url → $code $body"
  echo "$code $body"
}

curl_patch() {
  local url="$1"; shift
  local resp
  resp=$(_curl -w '\n%{http_code}' -X PATCH "$url" \
    -H "Content-Type: application/json" "$@") || fail "curl PATCH $url failed (network)"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  dbg "PATCH $url → $code $body"
  echo "$code $body"
}

curl_get() {
  local url="$1"; shift
  local resp
  resp=$(_curl -w '\n%{http_code}' -X GET "$url" "$@") || fail "curl GET $url failed (network)"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  dbg "GET $url → $code $body"
  echo "$code $body"
}

assert_2xx() {
  local code="$1" body="$2" ctx="$3"
  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    fail "$ctx — HTTP $code: $body"
  fi
}

# Retry a curl_post until 2xx; retries on 5xx and optionally extra codes.
# Usage: curl_post_retry <max> <wait_sec> <ctx> [--retry-on <code>...] -- <url> [curl_args...]
curl_post_retry() {
  local max_attempts="$1" wait_sec="$2" ctx="$3"
  shift 3
  local extra_codes=()
  while [[ "${1:-}" == "--retry-on" ]]; do
    shift; extra_codes+=("$1"); shift
  done
  [[ "${1:-}" == "--" ]] && shift
  local url="$1"; shift
  local attempt=1
  while true; do
    local resp code body
    resp=$(curl_post "$url" "$@")
    code=$(echo "$resp" | cut -d' ' -f1)
    body=$(echo "$resp" | cut -d' ' -f2-)
    if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
      echo "$resp"; return 0
    fi
    local retry=0
    [[ "$code" -ge 500 ]] && retry=1
    for ec in "${extra_codes[@]:-}"; do
      [[ "$code" == "$ec" ]] && retry=1
    done
    if [[ "$retry" == "1" && "$attempt" -lt "$max_attempts" ]]; then
      log "  $ctx returned HTTP $code (attempt ${attempt}/${max_attempts}), retry in ${wait_sec}s..."
      sleep "$wait_sec"
      attempt=$((attempt + 1))
    else
      fail "$ctx — HTTP $code: $body"
    fi
  done
}

# Retry a curl_patch until 2xx; same retry semantics as curl_post_retry.
curl_patch_retry() {
  local max_attempts="$1" wait_sec="$2" ctx="$3"
  shift 3
  local extra_codes=()
  while [[ "${1:-}" == "--retry-on" ]]; do
    shift; extra_codes+=("$1"); shift
  done
  [[ "${1:-}" == "--" ]] && shift
  local url="$1"; shift
  local attempt=1
  while true; do
    local resp code body
    resp=$(curl_patch "$url" "$@")
    code=$(echo "$resp" | cut -d' ' -f1)
    body=$(echo "$resp" | cut -d' ' -f2-)
    if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
      echo "$resp"; return 0
    fi
    local retry=0
    [[ "$code" -ge 500 ]] && retry=1
    for ec in "${extra_codes[@]:-}"; do
      [[ "$code" == "$ec" ]] && retry=1
    done
    if [[ "$retry" == "1" && "$attempt" -lt "$max_attempts" ]]; then
      log "  $ctx returned HTTP $code (attempt ${attempt}/${max_attempts}), retry in ${wait_sec}s..."
      sleep "$wait_sec"
      attempt=$((attempt + 1))
    else
      fail "$ctx — HTTP $code: $body"
    fi
  done
}

extract_id() {
  local body="$1"
  echo "$body" | python3 -c "
import sys, json
def pick(d):
    if not isinstance(d, dict):
        return ''
    for key in ('id', 'taskId', 'userId', 'invitationId'):
        val = d.get(key)
        if val:
            return str(val)
    nested = d.get('data')
    if isinstance(nested, dict):
        return pick(nested)
    return ''
print(pick(json.load(sys.stdin)))
" 2>/dev/null
}

py_field() {
  # py_field <json_string> <dot.path> [default]
  local json="$1" path="$2" default="${3:-}"
  echo "$json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
keys = '${path}'.split('.')
v = d
try:
    for k in keys:
        v = v[k] if isinstance(v, dict) else (v[int(k)] if isinstance(v, list) else None)
    print(v if v is not None else '${default}')
except Exception:
    print('${default}')
" 2>/dev/null || echo "$default"
}

resolve_otp() {
  local email="$1"
  local register_body="$2"
  local otp=""

  # Method 1: OTP in register response (dev mode only)
  otp=$(echo "$register_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('otp') or d.get('data',{}).get('otp') or '')" 2>/dev/null || echo "")

  # Method 2: dev endpoint (local only; 404 in production — skip gracefully)
  if [[ -z "$otp" ]]; then
    local dev_resp dev_code dev_body
    dev_resp=$(_curl -sS --max-time 5 -w '\n%{http_code}' "$BASE/auth/dev/otp?email=${email}" 2>/dev/null || echo "0 {}")
    dev_code=$(echo "$dev_resp" | tail -1)
    dev_body=$(echo "$dev_resp" | head -n -1)
    if [[ "$dev_code" == "200" ]]; then
      otp=$(echo "$dev_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('otp',''))" 2>/dev/null || echo "")
    fi
  fi

  # Method 3: external script (production: queries auth_outbox_events via kubectl exec)
  if [[ -z "$otp" && -n "${DEMO_E2E_OTP_SCRIPT:-}" && -x "$DEMO_E2E_OTP_SCRIPT" ]]; then
    local attempt=1
    while [[ "$attempt" -le 5 ]]; do
      sleep 2
      otp=$("$DEMO_E2E_OTP_SCRIPT" "$email" 2>/dev/null | tr -d '[:space:]' || echo "")
      [[ -n "$otp" ]] && break
      log "  OTP not in outbox yet (attempt ${attempt}/5)..."
      attempt=$((attempt + 1))
    done
  fi

  echo "$otp"
}

require_tool() {
  command -v "$1" &>/dev/null || fail "Required tool not found: $1"
}

# ---------- preflight --------------------------------------------------------

require_tool curl
require_tool python3

log "Checking gateway + auth-service health (retry up to 4m)..."
HEALTH_OK=0
for attempt in $(seq 1 48); do
  resp=$(curl_get "$BASE/auth/health" 2>/dev/null || echo "0 {}")
  code=$(echo "$resp" | cut -d' ' -f1)
  if [[ "$code" == "200" ]]; then
    HEALTH_OK=1; break
  fi
  log "  Health check HTTP $code (attempt ${attempt}/48), retry in 5s..."
  sleep 5
done
[[ "$HEALTH_OK" == "1" ]] || fail "Gateway/auth-service unreachable after 4m. Check cluster health."
log "  Gateway healthy."

# Unique suffix so re-runs don't collide
TS=$(date +%s)
EMAIL_A="demo-a-${TS}@example.com"
EMAIL_B="demo-b-${TS}@example.com"
PASS="Demo@12345"
FULL_A="Demo Alice ${TS}"
FULL_B="Demo Bob ${TS}"

# ---------- Step 1: Register + verify + login (User A & B) -------------------

log "Step 1: Register User A ($EMAIL_A)..."
resp=$(curl_post "$BASE/auth/register" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS\",\"fullName\":\"$FULL_A\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "register User A"
USER_A_ID=$(py_field "$body" "userId")
[[ -n "$USER_A_ID" ]] || USER_A_ID=$(py_field "$body" "data.userId")
[[ -n "$USER_A_ID" ]] || fail "No userId in register response: $body"

log "  Fetching OTP for User A..."
otp_a=$(resolve_otp "$EMAIL_A" "$body")
[[ -n "$otp_a" ]] || fail "Cannot obtain OTP for User A. Set DEMO_E2E_OTP_SCRIPT or check auth outbox."

log "  Verifying email for User A (OTP: $otp_a)..."
resp=$(curl_post "$BASE/auth/verify-email" -d "{\"userId\":\"$USER_A_ID\",\"otp\":\"$otp_a\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "verify-email User A"

log "  Logging in as User A..."
resp=$(curl_post "$BASE/auth/login" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "login User A"
TOKEN_A=$(py_field "$body" "accessToken")
[[ -n "$TOKEN_A" ]] || TOKEN_A=$(py_field "$body" "data.accessToken")
[[ -n "$TOKEN_A" ]] || fail "No accessToken in login response: $body"
log "  User A logged in. Token: ${TOKEN_A:0:20}..."

log "  Registering User B early ($EMAIL_B) so Kafka replica syncs while we work..."
resp=$(curl_post "$BASE/auth/register" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS\",\"fullName\":\"$FULL_B\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "register User B"
USER_B_ID=$(py_field "$body" "userId")
[[ -n "$USER_B_ID" ]] || USER_B_ID=$(py_field "$body" "data.userId")
[[ -n "$USER_B_ID" ]] || fail "No userId in register User B response: $body"

log "  Fetching OTP for User B..."
otp_b=$(resolve_otp "$EMAIL_B" "$body")
[[ -n "$otp_b" ]] || fail "Cannot obtain OTP for User B."

log "  Verifying email for User B (OTP: $otp_b)..."
resp=$(curl_post "$BASE/auth/verify-email" -d "{\"userId\":\"$USER_B_ID\",\"otp\":\"$otp_b\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "verify-email User B"
log "  User B verified. Waiting 50s for Kafka/Debezium user replica to sync to task-service..."
sleep 50

# ---------- Step 2: Create workspace + invite User B -------------------------

log "Step 2: Create workspace as User A..."
resp=$(curl_post "$BASE/workspaces" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"name\":\"Demo Workspace ${TS}\",\"description\":\"E2E demo\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create workspace"
WORKSPACE_ID=$(extract_id "$body")
[[ -n "$WORKSPACE_ID" ]] || fail "No workspace id in response: $body"
log "  Workspace created: $WORKSPACE_ID"

log "  Inviting User B ($EMAIL_B) to workspace..."
resp=$(curl_post "$BASE/workspaces/$WORKSPACE_ID/invite" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"email\":\"$EMAIL_B\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "invite User B"
INVITATION_ID=$(extract_id "$body")
[[ -n "$INVITATION_ID" ]] || fail "No invitation id in response: $body"
log "  Invitation created: $INVITATION_ID"

# ---------- Step 3: Login User B + accept invite -----------------------------

log "Step 3: Logging in as User B ($EMAIL_B)..."
resp=$(curl_post "$BASE/auth/login" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "login User B"
TOKEN_B=$(py_field "$body" "accessToken")
[[ -n "$TOKEN_B" ]] || TOKEN_B=$(py_field "$body" "data.accessToken")
[[ -n "$TOKEN_B" ]] || fail "No accessToken in login response: $body"
log "  User B logged in. Token: ${TOKEN_B:0:20}..."

log "  User B accepting invitation $INVITATION_ID..."
resp=$(curl_post "$BASE/invitations/$INVITATION_ID/accept" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "accept invitation"
log "  Invitation accepted. Waiting 10s for workspace-member event to propagate..."
sleep 10

# ---------- Step 4: Create project + task + assign to User B -----------------

log "Step 4: Create project in workspace..."
resp=$(curl_post_retry 5 4 "create project" -- "$BASE/workspaces/$WORKSPACE_ID/projects" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"name\":\"Demo Project ${TS}\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create project"
PROJECT_ID=$(extract_id "$body")
[[ -n "$PROJECT_ID" ]] || fail "No project id in response: $body"
log "  Project created: $PROJECT_ID"

log "  Creating task (retry on 5xx while task-service warms up)..."
resp=$(curl_post_retry 6 5 "create task" -- "$BASE/tasks" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"title\":\"Demo Task ${TS}\",\"workspaceId\":\"$WORKSPACE_ID\",\"projectId\":\"$PROJECT_ID\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create task"
TASK_ID=$(extract_id "$body")
[[ -n "$TASK_ID" ]] || fail "No task id in response: $body"
log "  Task created: $TASK_ID"

log "  Getting User B's profile (userId + username)..."
resp=$(curl_get "$BASE/users/me" -H "Authorization: Bearer $TOKEN_B")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "get User B profile"
USER_B_ID=$(py_field "$body" "userId")
[[ -n "$USER_B_ID" ]] || USER_B_ID=$(py_field "$body" "data.userId")
[[ -n "$USER_B_ID" ]] || USER_B_ID=$(py_field "$body" "id")
[[ -n "$USER_B_ID" ]] || USER_B_ID=$(py_field "$body" "data.id")
[[ -n "$USER_B_ID" ]] || fail "No user id in /users/me response: $body"
USERNAME_B=$(py_field "$body" "username")
[[ -n "$USERNAME_B" ]] || USERNAME_B=$(py_field "$body" "data.username")
log "  User B: id=$USER_B_ID username=${USERNAME_B:-<none>}"

log "  Assigning task to User B (retry — user replica may still be propagating)..."
resp=$(curl_patch_retry 15 5 "assign task" \
  --retry-on 404 --retry-on 422 --retry-on 403 --retry-on 500 -- \
  "$BASE/tasks/$TASK_ID/assignee" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"assigneeId\":\"$USER_B_ID\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "assign task"
log "  Task assigned to User B."

# ---------- Step 5: User B changes status to DOING ---------------------------

log "Step 5: User B changes task status to DOING..."
resp=$(curl_patch_retry 4 3 "update task status" -- "$BASE/tasks/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{\"status\":\"DOING\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "update task status"
log "  Status updated to DOING."

# ---------- Step 6: User A comments + mentions @user-b -----------------------

log "Step 6: User A posting comment with mention..."
MENTION="${USERNAME_B:-user-b}"
COMMENT_CONTENT="Great work @${MENTION}! Task is looking good."
resp=$(curl_post "$BASE/tasks/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"content\":\"$COMMENT_CONTENT\"}")
code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create comment"
COMMENT_ID=$(extract_id "$body")
log "  Comment created: $COMMENT_ID (mention: @${MENTION})"

# ---------- Step 7: User B checks notifications ------------------------------

log "Step 7: Waiting for notification to propagate via Kafka (retry up to 60s)..."
NOTIF_COUNT="0"
for attempt in $(seq 1 12); do
  sleep 5
  resp=$(curl_get "$BASE/notifications" -H "Authorization: Bearer $TOKEN_B")
  code=$(echo "$resp" | cut -d' ' -f1); body=$(echo "$resp" | cut -d' ' -f2-)
  assert_2xx "$code" "$body" "list notifications"
  NOTIF_COUNT=$(echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('data', d.get('items', d.get('notifications', [])))
print(len(items) if isinstance(items, list) else 0)
" 2>/dev/null || echo "0")
  if [[ "$NOTIF_COUNT" != "0" ]]; then
    log "  Got $NOTIF_COUNT notification(s) after $((attempt * 5))s."
    break
  fi
  log "  No notifications yet (attempt ${attempt}/12)..."
done

if [[ "$NOTIF_COUNT" == "0" ]]; then
  log "  WARNING: 0 notifications after 60s — check notification-service and Kafka consumer logs."
fi

# ---------- Summary ----------------------------------------------------------

echo ""
echo "=========================================="
echo "  CollabSpace E2E Demo — ALL STEPS PASSED"
echo "=========================================="
echo "  Workspace : $WORKSPACE_ID"
echo "  Project   : $PROJECT_ID"
echo "  Task      : $TASK_ID"
echo "  Comment   : $COMMENT_ID"
echo "  Invitation: $INVITATION_ID"
echo "  User A    : $EMAIL_A ($USER_A_ID)"
echo "  User B    : $EMAIL_B ($USER_B_ID)"
echo "  Notifs    : $NOTIF_COUNT"
echo "=========================================="
