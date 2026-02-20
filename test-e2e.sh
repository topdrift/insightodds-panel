#!/bin/bash

BASE="http://localhost:4000/api"
TODAY=$(date -u +%Y-%m-%dT00:00:00Z)
TOMORROW=$(date -u -d '+1 day' +%Y-%m-%dT23:59:59Z 2>/dev/null || date -u -v+1d +%Y-%m-%dT23:59:59Z)
YESTERDAY=$(date -u -d '-7 day' +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -v-7d +%Y-%m-%dT00:00:00Z)

# Login all roles
SA_TOKEN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"superadmin","password":"Admin@123"}' | jq -r ".accessToken")
AG_TOKEN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"agent1","password":"Admin@123"}' | jq -r ".accessToken")
CL_TOKEN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"client1","password":"Admin@123"}' | jq -r ".accessToken")

echo "Tokens obtained: SA=$(echo $SA_TOKEN | cut -c1-10)... AG=$(echo $AG_TOKEN | cut -c1-10)... CL=$(echo $CL_TOKEN | cut -c1-10)..."
echo "Date range: $YESTERDAY to $TOMORROW"

# Get client1 ID
CL_ID=$(docker exec insightodds-postgres psql -U insightodds -d insightodds -t -c "SELECT id FROM \"User\" WHERE username = 'client1';" | xargs)

echo ""
echo "===== STEP 9: AGENT WITHDRAWAL FROM CLIENT ====="
echo "Client1 ID: $CL_ID"
WITHDRAW_RESP=$(curl -s -X PUT "$BASE/admin/children/$CL_ID/deposit-withdraw" \
  -H "Authorization: Bearer $AG_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"balance\":10000,\"transactionType\":\"WITHDRAW\",\"remarks\":\"Weekly collection\",\"transactionPassword\":\"Admin@123\"}")
echo "Withdraw response: $(echo $WITHDRAW_RESP | jq -c '.')"

CL_ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $CL_TOKEN")
echo "Client1 Balance: $(echo $CL_ME | jq .balance)"
AG_ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $AG_TOKEN")
echo "Agent1 Balance: $(echo $AG_ME | jq .balance)"

echo ""
echo "===== STEP 10: CLIENT CHANGES PASSWORD ====="
PW_RESP=$(curl -s -X POST "$BASE/auth/change-password" \
  -H "Authorization: Bearer $CL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"Admin@123","newPassword":"NewPass456"}')
echo "Change password: $(echo $PW_RESP | jq -c '.')"

# Login with new password
NEW_LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"client1","password":"NewPass456"}')
NEW_CL_TOKEN=$(echo $NEW_LOGIN | jq -r ".accessToken")
echo "New password login: $(echo $NEW_LOGIN | jq -r '.user.username // .error // "FAILED"')"

# Login with old password (should fail)
OLD_LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"client1","password":"Admin@123"}')
echo "Old password login (should fail): $(echo $OLD_LOGIN | jq -r '.error // "unexpectedly succeeded"')"

# Change back
PW_BACK=$(curl -s -X POST "$BASE/auth/change-password" \
  -H "Authorization: Bearer $NEW_CL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"NewPass456","newPassword":"Admin@123"}')
echo "Revert password: $(echo $PW_BACK | jq -c '.')"

# Verify original works again
ORIG_LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"client1","password":"Admin@123"}')
echo "Original password works: $(echo $ORIG_LOGIN | jq -r '.user.username // "FAILED"')"
CL_TOKEN=$(echo $ORIG_LOGIN | jq -r ".accessToken")

echo ""
echo "===== STEP 11: ACTIVITY LOG ====="
ACTIVITY=$(curl -s -X POST "$BASE/user/activity-log" \
  -H "Authorization: Bearer $CL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$YESTERDAY\",\"to\":\"$TOMORROW\"}")
echo "Activity log entries: $(echo $ACTIVITY | jq '.data | length // 0')"
echo "$ACTIVITY" | jq -c '.data[]? | {activityType, ip, createdAt}' 2>/dev/null | head -10

echo ""
echo "===== STEP 12: BET HISTORY REPORT ====="
BET_HIST=$(curl -s -X POST "$BASE/user/bet-history" \
  -H "Authorization: Bearer $CL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$YESTERDAY\",\"to\":\"$TOMORROW\"}")
echo "Regular bets: $(echo $BET_HIST | jq '.betsTotal // 0')"
echo "Fancy bets: $(echo $BET_HIST | jq '.fancyTotal // 0')"
echo "$BET_HIST" | jq -c '.bets[]? | {runnerName, betType, amount, profitLoss, result}' 2>/dev/null | head -5
echo "$BET_HIST" | jq -c '.fancyBets[]? | {runnerName, amount, profitLoss, result}' 2>/dev/null | head -5

echo ""
echo "===== STEP 13: PROFIT/LOSS REPORT ====="
PL_REPORT=$(curl -s -X POST "$BASE/user/profit-loss-report" \
  -H "Authorization: Bearer $CL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$YESTERDAY\",\"to\":\"$TOMORROW\"}")
echo "P&L report: $(echo $PL_REPORT | jq -c '.' | head -c 500)"

echo ""
echo "===== STEP 14: COIN HISTORY ====="
COINS=$(curl -s "$BASE/user/coin-history?startDate=$YESTERDAY&endDate=$TOMORROW" \
  -H "Authorization: Bearer $CL_TOKEN")
echo "Coin history count: $(echo $COINS | jq '.transactions | length // .data | length // 0')"
echo "$COINS" | jq -c '.transactions[]? | {type, amount, remarks}' 2>/dev/null | head -8
echo "$COINS" | jq -c '.data[]? | {type, amount, remarks}' 2>/dev/null | head -8

echo ""
echo "===== STEP 15: COMPLETED GAMES ====="
COMPLETED=$(curl -s "$BASE/user/completed-games" \
  -H "Authorization: Bearer $CL_TOKEN")
echo "Completed games: $(echo $COMPLETED | jq -c '.' | head -c 500)"

echo ""
echo "===== STEP 16: ADMIN MATCH CONTROLS ====="
# Test match bet lock via query params
LOCK_RESP=$(curl -s -X PUT "$BASE/cricket/match-bet-lock?matchId=2148&flag=true" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Lock bets: $(echo $LOCK_RESP | jq -c '.')"

# Verify
EVENT_DATA=$(curl -s "$BASE/cricket/event-data/2148" -H "Authorization: Bearer $SA_TOKEN")
echo "Event isBetLocked after lock: $(echo $EVENT_DATA | jq '.isBetLocked // .data.isBetLocked')"

# Unlock
UNLOCK_RESP=$(curl -s -X PUT "$BASE/cricket/match-bet-lock?matchId=2148&flag=false" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Unlock bets: $(echo $UNLOCK_RESP | jq -c '.')"

# Test enable/disable
DISABLE_RESP=$(curl -s -X PUT "$BASE/cricket/match-enable-disable?matchId=2148&flag=false" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Disable match: $(echo $DISABLE_RESP | jq -c '.')"

ENABLE_RESP=$(curl -s -X PUT "$BASE/cricket/match-enable-disable?matchId=2148&flag=true" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Enable match: $(echo $ENABLE_RESP | jq -c '.')"

# Test odds difference
ODDS_DIFF=$(curl -s -X PUT "$BASE/cricket/odds-difference" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cricketId":2148,"oddsDifference":0.5}')
echo "Set odds difference: $(echo $ODDS_DIFF | jq -c '.')"

echo ""
echo "===== STEP 17: ANNOUNCEMENTS CRUD ====="
# Create (singular endpoint)
ANN_CREATE=$(curl -s -X POST "$BASE/admin/announcement" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"announcement":"Welcome to InsightOdds Panel! Test announcement.","priority":1,"isActive":true}')
echo "Create announcement: $(echo $ANN_CREATE | jq -c '{message, id: .data.id}')"
ANN_ID=$(echo $ANN_CREATE | jq -r '.data.id')

# List (plural)
ANN_LIST=$(curl -s "$BASE/admin/announcements" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "List announcements: $(echo $ANN_LIST | jq '.data | length // 0') items"

# Delete
if [ "$ANN_ID" != "null" ] && [ -n "$ANN_ID" ]; then
  ANN_DEL=$(curl -s -X DELETE "$BASE/admin/announcement/$ANN_ID" \
    -H "Authorization: Bearer $SA_TOKEN")
  echo "Delete announcement: $(echo $ANN_DEL | jq -c '.')"
fi

echo ""
echo "===== STEP 18: BANNERS CRUD ====="
BAN_CREATE=$(curl -s -X POST "$BASE/admin/banner" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Welcome Banner","imageUrl":"https://example.com/banner.jpg","link":"https://signalpulses.in","priority":1,"isActive":true}')
echo "Create banner: $(echo $BAN_CREATE | jq -c '{message, id: .data.id}')"
BAN_ID=$(echo $BAN_CREATE | jq -r '.data.id')

BAN_LIST=$(curl -s "$BASE/admin/banners" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "List banners: $(echo $BAN_LIST | jq '.data | length // 0') items"

if [ "$BAN_ID" != "null" ] && [ -n "$BAN_ID" ]; then
  BAN_DEL=$(curl -s -X DELETE "$BASE/admin/banner/$BAN_ID" \
    -H "Authorization: Bearer $SA_TOKEN")
  echo "Delete banner: $(echo $BAN_DEL | jq -c '.')"
fi

echo ""
echo "===== STEP 19: ADMIN REPORTS ====="
# Account log
ACC_LOG=$(curl -s -X POST "$BASE/admin/account-log" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\":\"$YESTERDAY\",\"endDate\":\"$TOMORROW\"}")
echo "Account log: $(echo $ACC_LOG | jq '.total // (.transactions | length) // 0') entries"

# General report
GEN_REP=$(curl -s "$BASE/admin/general-report" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "General report: $(echo $GEN_REP | jq -c '.' | head -c 300)"

# Activity log (admin)
ADM_ACT=$(curl -s -X POST "$BASE/admin/activity-log" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"startDate\":\"$YESTERDAY\",\"endDate\":\"$TOMORROW\"}")
echo "Admin activity log: $(echo $ADM_ACT | jq '.total // (.data | length) // 0') entries"

echo ""
echo "===== STEP 20: CREATE CLIENT VIA AGENT (HIERARCHY TEST) ====="
# Suggest username
UNAME=$(curl -s "$BASE/admin/username?userType=CLIENT" \
  -H "Authorization: Bearer $AG_TOKEN")
echo "Suggested username: $(echo $UNAME | jq -r '.')"

# Create new client
CREATE_CL=$(curl -s -X POST "$BASE/admin/children" \
  -H "Authorization: Bearer $AG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"client3","password":"Client123","name":"Test Client 3","role":"CLIENT","myPartnership":50,"matchCommission":2,"sessionCommission":2,"transactionPassword":"Client123"}')
echo "Create client3: $(echo $CREATE_CL | jq -c '{status: .status, username: .data.username, message}' 2>/dev/null || echo $CREATE_CL | head -c 300)"

# List agent's children
CHILDREN=$(curl -s "$BASE/admin/list-children" \
  -H "Authorization: Bearer $AG_TOKEN")
echo "Agent1 children: $(echo $CHILDREN | jq '.data | length // 0') clients"
echo "$CHILDREN" | jq -c '.data[]? | {username, role, balance}' 2>/dev/null | head -5

echo ""
echo "========================================="
echo "  END-TO-END TESTING COMPLETE"
echo "========================================="
