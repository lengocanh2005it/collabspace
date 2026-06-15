#!/usr/bin/env bash
# Comprehensive prod API audit — outputs JSON bodies only to stdout for parsing.
set -euo pipefail
cd /opt/collabspace
source infrastructure/deploy/resolve-prod-api-base.sh
export BASE_URL=$(resolve_prod_api_base_url)
install_prod_api_curl_wrapper

PASS=0; FAIL=0; WARN=0
RESULTS_FILE="/tmp/audit-results-$$.txt"
: > "$RESULTS_FILE"

http_raw() {
  curl -sS -w '\n%{http_code}' "$@" 2>/dev/null || echo -e "\n000"
}

check() {
  local name="$1" want="$2"; shift 2
  local resp code body ok=0
  resp=$(http_raw "$@")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$want" == "2xx" && "$code" -ge 200 && "$code" -lt 300 ]]; then ok=1; fi
  if [[ "$want" == "$code" ]]; then ok=1; fi
  if [[ $ok -eq 1 ]]; then
    PASS=$((PASS+1))
    echo "[OK]   $name ($code)" | tee -a "$RESULTS_FILE" >&2
    printf '%s' "$body"
    return 0
  fi
  FAIL=$((FAIL+1))
  echo "[FAIL] $name — want $want got $code: ${body:0:250}" | tee -a "$RESULTS_FILE" >&2
  printf '%s' "$body"
  return 1
}

json_field() {
  local body="$1" py="$2"
  echo "$body" | python3 -c "$py" 2>/dev/null || echo ""
}

echo "[audit] BASE_URL=$BASE_URL" | tee -a "$RESULTS_FILE"

echo "=== HEALTH ===" | tee -a "$RESULTS_FILE"
for path in \
  auth/health auth/health/live auth/health/ready \
  users/health users/health/live users/health/ready \
  workspaces/health workspaces/health/live workspaces/health/ready \
  tasks/health/live tasks/health/ready \
  notifications/health/live notifications/health/ready; do
  check "GET /$path" 2xx -X GET "$BASE_URL/$path" >/dev/null || true
done

EMAIL="lengocanhpyne363@gmail.com"
PASSWD="CollabTest2026!"

echo "=== AUTH (verified user) ===" | tee -a "$RESULTS_FILE"
login=$(check "POST /auth/login" 2xx -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}" || true)
TOKEN=$(json_field "$login" "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
REFRESH=$(json_field "$login" "import sys,json; print(json.load(sys.stdin).get('refreshToken',''))")
USER_ID=$(json_field "$login" "import sys,json; print(json.load(sys.stdin).get('userId',''))")
AUTH="Authorization: Bearer $TOKEN"
echo "[audit] USER_ID=$USER_ID token=${TOKEN:0:24}..." | tee -a "$RESULTS_FILE"

if [[ -n "$TOKEN" ]]; then
  check "GET /auth/me" 2xx -X GET "$BASE_URL/auth/me" -H "$AUTH" >/dev/null || true
  check "GET /auth/sessions" 2xx -X GET "$BASE_URL/auth/sessions" -H "$AUTH" >/dev/null || true
  check "GET /auth/verify" 2xx -X GET "$BASE_URL/auth/verify" -H "$AUTH" >/dev/null || true
  refresh=$(check "POST /auth/refresh" 2xx -X POST "$BASE_URL/auth/refresh" \
    -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}" || true)
  TOKEN=$(json_field "$refresh" "import sys,json; print(json.load(sys.stdin).get('accessToken','$TOKEN'))")
  AUTH="Authorization: Bearer $TOKEN"
fi

echo "=== USER ===" | tee -a "$RESULTS_FILE"
if [[ -n "$TOKEN" ]]; then
  check "GET /users/me" 2xx -X GET "$BASE_URL/users/me" -H "$AUTH" >/dev/null || true
  check "PATCH /users/me" 2xx -X PATCH "$BASE_URL/users/me" -H "$AUTH" -H "Content-Type: application/json" -d '{"bio":"prod audit"}' >/dev/null || true
  check "GET /users/me/preferences" 2xx -X GET "$BASE_URL/users/me/preferences" -H "$AUTH" >/dev/null || true
  check "PATCH /users/me/preferences" 2xx -X PATCH "$BASE_URL/users/me/preferences" -H "$AUTH" -H "Content-Type: application/json" -d '{"theme":"dark"}' >/dev/null || true
  check "GET /users/me/status" 2xx -X GET "$BASE_URL/users/me/status" -H "$AUTH" >/dev/null || true
  check "PATCH /users/me/status" 2xx -X PATCH "$BASE_URL/users/me/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"online"}' >/dev/null || true
  check "GET /users?limit=5" 2xx -X GET "$BASE_URL/users?limit=5" -H "$AUTH" >/dev/null || true
  check "GET /users/search" 2xx -X GET "$BASE_URL/users/search?q=ngoc&limit=5" -H "$AUTH" >/dev/null || true
  check "POST /users/bulk" 2xx -X POST "$BASE_URL/users/bulk" -H "$AUTH" -H "Content-Type: application/json" -d "{\"userIds\":[\"$USER_ID\"]}" >/dev/null || true
  check "GET /users/:id" 2xx -X GET "$BASE_URL/users/$USER_ID" -H "$AUTH" >/dev/null || true
  check "GET /users/:id/summary" 2xx -X GET "$BASE_URL/users/$USER_ID/summary" -H "$AUTH" >/dev/null || true
else
  echo "[SKIP] user APIs (no token)" | tee -a "$RESULTS_FILE"
fi

echo "=== WORKSPACE + PROJECT ===" | tee -a "$RESULTS_FILE"
WS_ID="" PROJ_ID="" TASK_ID=""
TS=$(date +%s)
if [[ -n "$TOKEN" ]]; then
  ws=$(check "POST /workspaces" 2xx -X POST "$BASE_URL/workspaces" -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"name\":\"Prod Audit $TS\",\"description\":\"audit\"}" || true)
  WS_ID=$(json_field "$ws" "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
  echo "[audit] WS_ID=$WS_ID" | tee -a "$RESULTS_FILE"
  if [[ -n "$WS_ID" ]]; then
    check "GET /workspaces" 2xx -X GET "$BASE_URL/workspaces" -H "$AUTH" >/dev/null || true
    check "GET /workspaces/:id" 2xx -X GET "$BASE_URL/workspaces/$WS_ID" -H "$AUTH" >/dev/null || true
    check "PATCH /workspaces/:id" 2xx -X PATCH "$BASE_URL/workspaces/$WS_ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"description":"updated"}' >/dev/null || true
    check "GET /workspaces/:id/members" 2xx -X GET "$BASE_URL/workspaces/$WS_ID/members" -H "$AUTH" >/dev/null || true
    check "GET /workspaces/:id/activity" 2xx -X GET "$BASE_URL/workspaces/$WS_ID/activity?limit=10" -H "$AUTH" >/dev/null || true
    check "GET /workspaces/:id/invitations" 2xx -X GET "$BASE_URL/workspaces/$WS_ID/invitations" -H "$AUTH" >/dev/null || true
    proj=$(check "POST /projects" 2xx -X POST "$BASE_URL/workspaces/$WS_ID/projects" -H "$AUTH" -H "Content-Type: application/json" \
      -d "{\"name\":\"Audit Proj $TS\"}" || true)
    PROJ_ID=$(json_field "$proj" "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
    check "GET /projects list" 2xx -X GET "$BASE_URL/workspaces/$WS_ID/projects" -H "$AUTH" >/dev/null || true
    if [[ -n "$PROJ_ID" ]]; then
      check "PATCH /projects/:id" 2xx -X PATCH "$BASE_URL/projects/$PROJ_ID" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Renamed"}' >/dev/null || true
    fi
  fi
fi

echo "=== TASK + COMMENTS (RabbitMQ publish) ===" | tee -a "$RESULTS_FILE"
if [[ -n "$TOKEN" && -n "$WS_ID" && -n "$PROJ_ID" ]]; then
  task=$(check "POST /tasks" 2xx -X POST "$BASE_URL/tasks" -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"title\":\"Audit Task $TS\",\"workspaceId\":\"$WS_ID\",\"projectId\":\"$PROJ_ID\"}" || true)
  TASK_ID=$(json_field "$task" "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))")
  echo "[audit] TASK_ID=$TASK_ID" | tee -a "$RESULTS_FILE"
  if [[ -n "$TASK_ID" ]]; then
    check "GET /tasks" 2xx -X GET "$BASE_URL/tasks?workspaceId=$WS_ID" -H "$AUTH" >/dev/null || true
    check "GET /tasks/board" 2xx -X GET "$BASE_URL/tasks/board?workspaceId=$WS_ID" -H "$AUTH" >/dev/null || true
    check "GET /tasks/:id" 2xx -X GET "$BASE_URL/tasks/$TASK_ID" -H "$AUTH" >/dev/null || true
    check "GET /tasks/:id/activity" 2xx -X GET "$BASE_URL/tasks/$TASK_ID/activity?limit=10" -H "$AUTH" >/dev/null || true
    check "PATCH /tasks/:id/details" 2xx -X PATCH "$BASE_URL/tasks/$TASK_ID/details" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Updated"}' >/dev/null || true
    check "PATCH /tasks/:id/status" 2xx -X PATCH "$BASE_URL/tasks/$TASK_ID/status" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"DOING"}' >/dev/null || true
    check "POST /tasks/:id/comments" 2xx -X POST "$BASE_URL/tasks/$TASK_ID/comments" -H "$AUTH" -H "Content-Type: application/json" -d '{"content":"audit comment triggers comment_created"}' >/dev/null || true
    check "GET /tasks/:id/comments" 2xx -X GET "$BASE_URL/tasks/$TASK_ID/comments" -H "$AUTH" >/dev/null || true
    check "PATCH /tasks/:id/assignee" 2xx -X PATCH "$BASE_URL/tasks/$TASK_ID/assignee" -H "$AUTH" -H "Content-Type: application/json" -d "{\"assigneeId\":\"$USER_ID\"}" >/dev/null || true
  fi
fi

echo "=== NOTIFICATIONS (RabbitMQ consumer) ===" | tee -a "$RESULTS_FILE"
sleep 5
if [[ -n "$TOKEN" ]]; then
  notifs=$(check "GET /notifications" 2xx -X GET "$BASE_URL/notifications?limit=50" -H "$AUTH" || true)
  COUNT=$(json_field "$notifs" "import sys,json; d=json.load(sys.stdin); n=d.get('notifications', d.get('data', d)); print(len(n) if isinstance(n,list) else 0)")
  echo "[audit] notification count=$COUNT" | tee -a "$RESULTS_FILE"
  if [[ "${COUNT:-0}" -gt 0 ]]; then
    NID=$(json_field "$notifs" "import sys,json; d=json.load(sys.stdin); n=d.get('notifications',[]); print(n[0]['id'] if n else '')")
    check "PATCH /notifications/:id/read" 2xx -X PATCH "$BASE_URL/notifications/$NID/read" -H "$AUTH" >/dev/null || true
    check "PATCH /notifications/read-all" 2xx -X PATCH "$BASE_URL/notifications/read-all" -H "$AUTH" >/dev/null || true
  else
    WARN=$((WARN+1))
    echo "[WARN] no notifications after assign/comment" | tee -a "$RESULTS_FILE"
  fi
fi

echo "=== REGISTER + VERIFY (new user) ===" | tee -a "$RESULTS_FILE"
TS2=$(date +%s)
NEW_EMAIL="audit-${TS2}@example.com"
reg=$(check "POST /auth/register" 2xx -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"Demo@12345\",\"fullName\":\"Audit New\"}" || true)
NEW_UID=$(json_field "$reg" "import sys,json; print(json.load(sys.stdin).get('userId',''))")
if [[ -n "$NEW_UID" ]]; then
  sleep 2
  OTP=$(DEMO_E2E_OTP_SCRIPT=/opt/collabspace/infrastructure/deploy/read-auth-otp-from-outbox.sh \
    /opt/collabspace/infrastructure/deploy/read-auth-otp-from-outbox.sh "$NEW_EMAIL" 2>/dev/null || true)
  if [[ -n "$OTP" ]]; then
    check "POST /auth/verify-email" 2xx -X POST "$BASE_URL/auth/verify-email" -H "Content-Type: application/json" \
      -d "{\"userId\":\"$NEW_UID\",\"otp\":\"$OTP\"}" >/dev/null || true
  else
    WARN=$((WARN+1)); echo "[WARN] OTP not found for $NEW_EMAIL" | tee -a "$RESULTS_FILE"
  fi
fi

echo "=== NEGATIVE ===" | tee -a "$RESULTS_FILE"
check "GET /users/me no token" 401 -X GET "$BASE_URL/users/me" >/dev/null || true
check "POST /auth/login wrong pwd" 401 -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpass123\"}" >/dev/null || true

echo "=== RABBITMQ ===" | tee -a "$RESULTS_FILE"
while read -r q msgs cons; do
  [[ -z "${q:-}" ]] && continue
  cons_int="${cons:-0}"; cons_int="${cons_int%%.*}"
  msgs_int="${msgs:-0}"; msgs_int="${msgs_int%%.*}"
  if [[ "$cons_int" -gt 0 ]]; then
    echo "[OK]   queue $q — messages=$msgs_int consumers=$cons_int" | tee -a "$RESULTS_FILE" >&2
  elif [[ "$msgs_int" -gt 0 ]]; then
    WARN=$((WARN+1))
    echo "[WARN] queue $q — messages=$msgs_int consumers=0" | tee -a "$RESULTS_FILE" >&2
  else
    echo "[audit] queue $q — idle" | tee -a "$RESULTS_FILE" >&2
  fi
done < <(kubectl exec -n collabspace rabbitmq-0 -- rabbitmqctl list_queues name messages consumers -p collabspace -q 2>/dev/null || true)

echo "--- notification-service event logs (last 15) ---" | tee -a "$RESULTS_FILE"
kubectl logs -n collabspace deploy/notification-service --tail=50 2>/dev/null | grep -iE 'RABBITMQ|task_assigned|comment|workspace_invited|error' | tail -15 | tee -a "$RESULTS_FILE" || true

echo "" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "  PASS=$PASS  FAIL=$FAIL  WARN=$WARN" | tee -a "$RESULTS_FILE"
echo "  WS=$WS_ID  TASK=$TASK_ID" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
