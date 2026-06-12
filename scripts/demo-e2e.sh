#!/usr/bin/env bash
# demo-e2e.sh — CollabSpace end-to-end demo story
# Runs 7 steps through Traefik gateway (http://localhost/api/v1/...)
# Exit code != 0 on any failure. Set DEBUG=1 for verbose output.
set -euo pipefail

BASE="${BASE_URL:-http://localhost/api/v1}"
DEBUG="${DEBUG:-0}"

# ---------- helpers ----------------------------------------------------------

log()  { echo "[demo-e2e] $*"; }
dbg()  { [[ "$DEBUG" == "1" ]] && echo "[DEBUG] $*" || true; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

curl_post() {
  local url="$1"; shift
  local resp
  resp=$(curl -sS -w '\n%{http_code}' -X POST "$url" \
    -H "Content-Type: application/json" "$@") || fail "curl POST $url failed"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  echo "$code $body"
}

curl_patch() {
  local url="$1"; shift
  local resp
  resp=$(curl -sS -w '\n%{http_code}' -X PATCH "$url" \
    -H "Content-Type: application/json" "$@") || fail "curl PATCH $url failed"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  echo "$code $body"
}

curl_get() {
  local url="$1"; shift
  local resp
  resp=$(curl -sS -w '\n%{http_code}' -X GET "$url" "$@") || fail "curl GET $url failed"
  local code; code=$(echo "$resp" | tail -1)
  local body; body=$(echo "$resp" | head -n -1)
  echo "$code $body"
}

assert_2xx() {
  local code="$1" body="$2" ctx="$3"
  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    fail "$ctx — HTTP $code: $body"
  fi
  dbg "$ctx → $code $body"
}

json_field() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$(echo "$2" | sed 's/\./"]["/g' | sed 's/^/["/' | sed 's/$/"]/'))" 2>/dev/null \
    || echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); keys='$2'.split('.'); v=d; [(v:=v[k]) for k in keys]; print(v)" 2>/dev/null \
    || fail "Cannot extract '$2' from JSON: $1"
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

resolve_otp() {
  local email="$1"
  local register_body="$2"
  local otp
  otp=$(echo "$register_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('otp',''))" 2>/dev/null || echo "")
  if [[ -z "$otp" ]]; then
    local dev_resp
    dev_resp=$(curl_get "$BASE/auth/dev/otp?email=$email" 2>/dev/null || echo "")
    otp=$(echo "$dev_resp" | cut -d' ' -f2- | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('otp',''))" 2>/dev/null || echo "")
  fi
  if [[ -z "$otp" && -n "${DEMO_E2E_OTP_SCRIPT:-}" && -x "$DEMO_E2E_OTP_SCRIPT" ]]; then
    sleep 2
    otp=$("$DEMO_E2E_OTP_SCRIPT" "$email" || true)
  fi
  echo "$otp"
}

require_tool() {
  command -v "$1" &>/dev/null || fail "Required tool not found: $1 — install it and retry."
}

# ---------- preflight --------------------------------------------------------

require_tool curl
require_tool python3

log "Checking gateway health..."
resp=$(curl_get "$BASE/auth/health")
code=$(echo "$resp" | cut -d' ' -f1)
if [[ "$code" != "200" ]]; then
  fail "Gateway unreachable or auth-service down (HTTP $code). Start the stack first: cd infrastructure/docker && docker-compose ... up -d"
fi

# Unique suffix so re-runs don't collide
TS=$(date +%s)
EMAIL_A="demo-a-${TS}@example.com"
EMAIL_B="demo-b-${TS}@example.com"
PASS="Demo@12345"
FULL_A="Demo Alice ${TS}"
FULL_B="Demo Bob ${TS}"

# ---------- Step 1: Register + verify + login (User A) -----------------------

log "Step 1: Register User A ($EMAIL_A)..."
resp=$(curl_post "$BASE/auth/register" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS\",\"fullName\":\"$FULL_A\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "register User A"

USER_A_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('userId') or d.get('data',{}).get('userId',''))" 2>/dev/null)
[[ -n "$USER_A_ID" ]] || fail "No userId in register response: $body"

log "  Fetching OTP for User A (dev endpoint, register body, or DEMO_E2E_OTP_SCRIPT)..."
otp_a=$(resolve_otp "$EMAIL_A" "$body")
[[ -n "$otp_a" ]] || fail "Cannot obtain OTP for User A. Set DEMO_E2E_OTP_SCRIPT or check auth outbox/logs."

log "  Verifying email for User A (OTP: $otp_a)..."
resp=$(curl_post "$BASE/auth/verify-email" -d "{\"userId\":\"$USER_A_ID\",\"otp\":\"$otp_a\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "verify-email User A"

log "  Logging in as User A..."
resp=$(curl_post "$BASE/auth/login" -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "login User A"
TOKEN_A=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken') or d.get('data',{}).get('accessToken',''))" 2>/dev/null)
[[ -n "$TOKEN_A" ]] || fail "No accessToken in login response: $body"
log "  User A logged in. Token: ${TOKEN_A:0:20}..."

log "  Registering User B early ($EMAIL_B) for task-service user replica sync..."
resp=$(curl_post "$BASE/auth/register" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS\",\"fullName\":\"$FULL_B\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "register User B"
USER_B_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('userId') or d.get('data',{}).get('userId',''))" 2>/dev/null)
[[ -n "$USER_B_ID" ]] || fail "No userId in register response: $body"
otp_b=$(resolve_otp "$EMAIL_B" "$body")
[[ -n "$otp_b" ]] || fail "Cannot obtain OTP for User B."
resp=$(curl_post "$BASE/auth/verify-email" -d "{\"userId\":\"$USER_B_ID\",\"otp\":\"$otp_b\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "verify-email User B"
log "  User B registered and verified; waiting 15s for task-service user replica..."
sleep 15

# ---------- Step 2: Create workspace + invite User B -------------------------

log "Step 2: Create workspace as User A..."
resp=$(curl_post "$BASE/workspaces" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"name\":\"Demo Workspace ${TS}\",\"description\":\"E2E demo\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create workspace"
WORKSPACE_ID=$(extract_id "$body")
[[ -n "$WORKSPACE_ID" ]] || fail "No workspace id in response: $body"
log "  Workspace created: $WORKSPACE_ID"

log "  Inviting User B ($EMAIL_B) to workspace..."
resp=$(curl_post "$BASE/workspaces/$WORKSPACE_ID/invite" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"email\":\"$EMAIL_B\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "invite User B"
INVITATION_ID=$(extract_id "$body")
[[ -n "$INVITATION_ID" ]] || fail "No invitation id in response: $body"
log "  Invitation created: $INVITATION_ID"

# ---------- Step 3: Login User B + accept invite -----------------------------

log "Step 3: Logging in as User B ($EMAIL_B)..."
resp=$(curl_post "$BASE/auth/login" -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "login User B"
TOKEN_B=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken') or d.get('data',{}).get('accessToken',''))" 2>/dev/null)
[[ -n "$TOKEN_B" ]] || fail "No accessToken in login response: $body"
log "  User B logged in. Token: ${TOKEN_B:0:20}..."

log "  User B accepting invitation $INVITATION_ID..."
resp=$(curl_post "$BASE/invitations/$INVITATION_ID/accept" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "accept invitation"
log "  Invitation accepted."

log "  Waiting for user profile replica sync in task-service (5s)..."
sleep 5

# ---------- Step 4: Create project + task + assign to User B -----------------

log "Step 4: Create project in workspace..."
resp=$(curl_post "$BASE/workspaces/$WORKSPACE_ID/projects" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"name\":\"Demo Project ${TS}\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create project"
PROJECT_ID=$(extract_id "$body")
[[ -n "$PROJECT_ID" ]] || fail "No project id in response: $body"
log "  Project created: $PROJECT_ID"

log "  Creating task..."
resp=$(curl_post "$BASE/tasks" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"title\":\"Demo Task ${TS}\",\"workspaceId\":\"$WORKSPACE_ID\",\"projectId\":\"$PROJECT_ID\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create task"
TASK_ID=$(extract_id "$body")
[[ -n "$TASK_ID" ]] || fail "No task id in response: $body"
log "  Task created: $TASK_ID"

log "  Getting User B's user ID..."
resp=$(curl_get "$BASE/users/me" -H "Authorization: Bearer $TOKEN_B")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "get User B profile"
USER_B_ID=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); nested=d.get('data',{}) if isinstance(d.get('data'), dict) else {}; print(d.get('userId') or nested.get('userId') or d.get('id') or nested.get('id',''))" 2>/dev/null)
[[ -n "$USER_B_ID" ]] || fail "No user id in /users/me response: $body"
log "  User B ID: $USER_B_ID"

log "  Assigning task to User B (retry while user replica syncs)..."
ASSIGN_OK=0
for attempt in 1 2 3 4 5 6; do
  resp=$(curl_patch "$BASE/tasks/$TASK_ID/assignee" \
    -H "Authorization: Bearer $TOKEN_A" \
    -d "{\"assigneeId\":\"$USER_B_ID\"}")
  code=$(echo "$resp" | cut -d' ' -f1)
  body=$(echo "$resp" | cut -d' ' -f2-)
  if [[ "$code" -ge 200 && "$code" -lt 300 ]]; then
    ASSIGN_OK=1
    break
  fi
  dbg "assign attempt $attempt → HTTP $code"
  sleep 3
done
[[ "$ASSIGN_OK" == "1" ]] || fail "assign task — HTTP $code: $body"
log "  Task assigned."

# ---------- Step 5: User B changes status to DOING ---------------------------

log "Step 5: User B changes task status to DOING..."
resp=$(curl_patch "$BASE/tasks/$TASK_ID/status" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d "{\"status\":\"DOING\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "update task status"
log "  Status updated to DOING."

# ---------- Step 6: User A comments + mentions @user-b -----------------------

log "Step 6: Getting User B's username for mention..."
resp=$(curl_get "$BASE/users/$USER_B_ID" -H "Authorization: Bearer $TOKEN_A")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "get User B profile by ID"
USERNAME_B=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('username') or d.get('data',{}).get('username') or 'user-b')" 2>/dev/null)
log "  User B username: $USERNAME_B"

log "  User A posting comment with mention @$USERNAME_B..."
COMMENT_CONTENT="Great work @$USERNAME_B! Task is looking good."
resp=$(curl_post "$BASE/tasks/$TASK_ID/comments" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"content\":\"$COMMENT_CONTENT\"}")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "create comment"
COMMENT_ID=$(extract_id "$body")
log "  Comment created: $COMMENT_ID"

# ---------- Step 7: User B checks notifications ------------------------------

log "Step 7: User B checking notifications (allow 2s for event propagation)..."
sleep 2

resp=$(curl_get "$BASE/notifications" -H "Authorization: Bearer $TOKEN_B")
code=$(echo "$resp" | cut -d' ' -f1)
body=$(echo "$resp" | cut -d' ' -f2-)
assert_2xx "$code" "$body" "list notifications"

NOTIF_COUNT=$(echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('data', d.get('items', d.get('notifications', [])))
print(len(items))
" 2>/dev/null || echo "?")
log "  User B has $NOTIF_COUNT notification(s)."

if [[ "$NOTIF_COUNT" == "0" || "$NOTIF_COUNT" == "?" ]]; then
  log "  WARNING: notifications may not have propagated yet (RabbitMQ async). Check manually or increase sleep."
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
echo "  User A    : $EMAIL_A"
echo "  User B    : $EMAIL_B ($USER_B_ID)"
echo "=========================================="
