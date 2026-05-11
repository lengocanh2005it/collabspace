#!/bin/bash
# Task Service API Test Script
# Usage: bash test-api.sh [BASE_URL]
# Default: http://localhost:3000/api

BASE_URL="${1:-http://localhost:3000/api}"
echo "🧪 Testing Task Service API at: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test data
WORKSPACE_ID="507f1f77bcf86cd799439011"
USER_ID="user-123"
USER_NAME="Test User"

# Generate UUID for testing
TASK_ID=""

echo -e "${BLUE}========== 1. CREATE TASK ==========${NC}"
echo "POST $BASE_URL/v1/tasks"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Task $(date +%s)\",
    \"description\": \"This is a test task\",
    \"workspaceId\": \"$WORKSPACE_ID\"
  }")

echo "$CREATE_RESPONSE" | jq '.'
TASK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.data.taskId' 2>/dev/null)

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
  echo -e "${YELLOW}⚠️  Failed to extract task ID. Exiting tests.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Task created with ID: $TASK_ID${NC}"
echo ""

echo -e "${BLUE}========== 2. GET TASK BY ID ==========${NC}"
echo "GET $BASE_URL/v1/tasks/$TASK_ID"
curl -s -X GET "$BASE_URL/v1/tasks/$TASK_ID" | jq '.'
echo ""

echo -e "${BLUE}========== 3. GET ALL TASKS ==========${NC}"
echo "GET $BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID"
curl -s -X GET "$BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID" | jq '.'
echo ""

echo -e "${BLUE}========== 4. UPDATE TASK DETAILS ==========${NC}"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/details"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/details" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Updated Task Title\",
    \"description\": \"Updated description with more details\"
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 5. CHANGE STATUS TO DOING ==========${NC}"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/status"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"DOING\"
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 6. ASSIGN TASK ==========${NC}"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/assignee"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/assignee" \
  -H "Content-Type: application/json" \
  -d "{
    \"assigneeId\": \"$USER_ID\",
    \"assigneeName\": \"$USER_NAME\",
    \"assigneeAvatarUrl\": \"https://example.com/avatar.jpg\"
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 7. CHANGE STATUS TO DONE ==========${NC}"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/status"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"DONE\"
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 8. TEST INVALID STATUS TRANSITION ==========${NC}"
echo "Trying to go from DONE to TODO (should fail)"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/status"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"TODO\"
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 9. FILTER BY STATUS ==========${NC}"
echo "GET $BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID&status=DONE"
curl -s -X GET "$BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID&status=DONE" | jq '.'
echo ""

echo -e "${BLUE}========== 10. FILTER BY ASSIGNEE ==========${NC}"
echo "GET $BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID&assigneeId=$USER_ID"
curl -s -X GET "$BASE_URL/v1/tasks?workspaceId=$WORKSPACE_ID&assigneeId=$USER_ID" | jq '.'
echo ""

echo -e "${BLUE}========== 11. UNASSIGN TASK ==========${NC}"
echo "PATCH $BASE_URL/v1/tasks/$TASK_ID/assignee"
curl -s -X PATCH "$BASE_URL/v1/tasks/$TASK_ID/assignee" \
  -H "Content-Type: application/json" \
  -d "{
    \"assigneeId\": null
  }" | jq '.'
echo ""

echo -e "${BLUE}========== 12. DELETE TASK ==========${NC}"
echo "DELETE $BASE_URL/v1/tasks/$TASK_ID"
curl -s -X DELETE "$BASE_URL/v1/tasks/$TASK_ID" | jq '.'
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "📚 API Documentation: $BASE_URL/../docs"
