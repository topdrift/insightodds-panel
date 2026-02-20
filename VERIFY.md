# Shakti11 Panel — Production Verification Prompt

Copy-paste this prompt to Claude Code to run a full end-to-end verification of the panel before going live.

---

## The Prompt

```
You are verifying the Shakti11 betting panel at https://signalpulses.in for production readiness. The project is at /Users/ajay/Desktop/shakti11-panel/ with backend (Express+Prisma+Socket.IO) and frontend (Next.js 14).

VPS: 31.57.228.137, root, password: p7q4S9LtTHs375gF824TT2
All account passwords: Admin@123

Run ALL of the following checks. For each check, mark it PASS or FAIL with details. At the end, provide a summary of all failures that need fixing.

---

### SECTION 1: INFRASTRUCTURE HEALTH

1.1 SSH into VPS, run `pm2 status` — both `shakti11-backend` and `shakti11-frontend` must be online with 0 restarts
1.2 Run `free -m` — available RAM must be >500MB
1.3 Run `docker ps` — postgres and redis containers must be running
1.4 Run `pm2 env <backend-id> | grep NODE_OPTIONS` — must show `--max-old-space-size=1024`
1.5 Run `nginx -t` — must pass
1.6 Curl `https://signalpulses.in/` — must return 200 with HTML containing CSS/JS links
1.7 Curl a CSS file from the HTML — must return 200 (not 404)
1.8 Curl `https://signalpulses.in/api/health` — must return 200 `{"status":"ok"}`
1.9 Check SSL: `curl -sI https://signalpulses.in | grep -i strict-transport` — must have HSTS header

---

### SECTION 2: AUTHENTICATION FLOW

2.1 Login each account (superadmin, admin1, agent1, client1) via `POST /api/auth/login` with `{"username":"<user>","password":"Admin@123"}` — all must return `accessToken` and `user` object
2.2 Call `GET /api/auth/me` with the token — must return user profile
2.3 Call `POST /api/auth/refresh` with `refreshToken` — must return new tokens
2.4 Call any protected endpoint without token — must return 401 `{"error":"Access token required"}`
2.5 Call any protected endpoint with invalid token — must return 401/403

---

### SECTION 3: USER HIERARCHY & MANAGEMENT

3.1 As superadmin, call `POST /api/admin/signup` to create a test user under admin1:
    `{"username":"verifytest","password":"Test@1234","name":"Verify Test","role":"CLIENT","parentId":"<admin1_id>","creditReference":100000}`
    Must succeed with 201
3.2 As superadmin, deposit 10000 to the new user via `POST /api/admin/deposit-withdraw`:
    `{"userId":"<new_user_id>","balance":10000,"transactionType":"DEPOSIT","transactionPassword":"Admin@123"}`
    Must succeed
3.3 Verify user's balance is 10000 via `GET /api/auth/me` (login as verifytest)
3.4 As superadmin, withdraw 5000 from the user — balance must become 5000
3.5 As admin1, verify they can see the test user in their children list via `GET /api/admin/children`
3.6 Clean up: delete or deactivate the test user

---

### SECTION 4: CRICKET BETTING — END TO END

4.1 `GET /api/cricket/all-matches-dashboard` — must return array of matches with cricketId, eventName
4.2 Pick an active match (isActive=true, isBetLocked=false). Get its event data via `GET /api/cricket/event-data/<cricketId>`
4.3 Place a BACK bet as client1 on the match:
    ```json
    POST /api/bet/place
    {
      "eventId": <cricketId>,
      "marketId": "<marketId from event data>",
      "selectionId": 1,
      "runnerName": "<team1 name>",
      "marketName": "Match Odds",
      "amount": 100,
      "back": 1.5,
      "backRate": 1.5,
      "profit": 50,
      "loss": 100
    }
    ```
    Must return `{"status":"success","data":{...}}` with betType=BACK
4.4 Place a LAY bet as client1:
    Same as above but with `"lay": 2.0, "layRate": 2.0, "profit": 100, "loss": 100` (remove back/backRate)
    Must return betType=LAY
4.5 Get user's bets: `GET /api/bet/my-bet/<cricketId>` — must show both bets
4.6 Verify client1's balance decreased and exposure increased
4.7 As admin/superadmin, check `GET /api/bet/admin/client-bets/<cricketId>` — must show bets
4.8 Check that the frontend BetSlip.tsx sends the correct fields (amount not stake, includes runnerName/marketName/profit/loss/back or lay)
4.9 Check that FancyBetSlip.tsx sends correct fields (amount not stake, includes marketName/runnerName/oddsBack or oddsLay/backRate or layRate/profit/loss)

---

### SECTION 5: CASINO — AVIATOR

5.1 `GET /api/casino/games` — must return 2 games (Aviator + Blackjack) with proper min/max bet
5.2 `GET /api/casino/aviator/state` — must return valid state with phase (BETTING/FLYING/CRASHED), roundNumber, hashChain
5.3 Wait for BETTING phase, then place bet:
    `POST /api/casino/aviator/bet {"amount": 100}` — must succeed with betId
5.4 Wait for FLYING phase, then cash out:
    `POST /api/casino/aviator/cashout {"betId": "<betId>"}` — must succeed with multiplier and payout
5.5 Verify balance increased by payout amount
5.6 `GET /api/casino/aviator/history` — must return recent completed rounds with crash points
5.7 `GET /api/casino/aviator/my-bets` — must show the bet with CASHED_OUT status
5.8 Verify crash points vary (not all 1.00x) — check at least 5 recent rounds

---

### SECTION 6: CASINO — BLACKJACK

6.1 Deal a hand: `POST /api/casino/blackjack/deal {"amount": 100}` — must return playerCards (2), dealerCards (2, second hidden), playerScore
6.2 Hit: `POST /api/casino/blackjack/hit {"betId": "<betId>"}` — must return updated hand
6.3 If not bust, stand: `POST /api/casino/blackjack/stand {"betId": "<betId>"}` — must return complete hand with result and dealerCards revealed
6.4 Start a new hand and test double down: `POST /api/casino/blackjack/double {"betId": "<betId>"}` — must draw 1 card and auto-resolve
6.5 `GET /api/casino/blackjack/history` — must show bet history
6.6 Verify balance changes correctly for wins/losses

---

### SECTION 7: SOCKET.IO

7.1 Check nginx config has WebSocket upgrade headers for `/socket.io/` location
7.2 Check backend socket.ts has `casino:join` and `casino:leave` handlers
7.3 Check frontend socket.ts NEXT_PUBLIC_WS_URL points to production domain (not localhost)
7.4 Check the baked-in JS chunks don't contain `localhost:4000` — search in `.next/standalone/.next/static/chunks/`

---

### SECTION 8: COMMISSION & PARTNERSHIP CASCADE

8.1 Read `backend/src/services/commission.ts` — verify it walks up user hierarchy applying commission percentages
8.2 Read `backend/src/services/partnership.ts` — verify it distributes P&L through hierarchy
8.3 After placing a casino bet that settles (lost aviator bet), check that commission records are created:
    `SELECT * FROM "CommissionRecord" ORDER BY "createdAt" DESC LIMIT 5;` (via docker exec postgres)
8.4 Check parent balances increased by commission amounts

---

### SECTION 9: FRONTEND PAGES

9.1 Curl each page and verify 200 response:
    - `/` (root/landing)
    - `/login`
    - `/dashboard`
    - `/casino`
    - `/casino/aviator`
    - `/casino/blackjack`
    - `/matches`
    - `/in-play`
    - `/children`
    - `/settings`
    - `/reports/profit-loss`
    - `/reports/account-log`
9.2 Verify CSS returns 200 (check first stylesheet link in HTML)
9.3 Check sidebar component doesn't have Matka link (should be Casino with Gamepad2 icon)

---

### SECTION 10: DATA INTEGRITY

10.1 Query all user balances — none should be negative: `SELECT username, balance FROM "User" WHERE balance < 0;`
10.2 Check for orphaned exposure: `SELECT username, balance, exposure FROM "User" WHERE exposure > balance;`
10.3 Check for unsettled casino bets with PENDING status older than 1 hour:
    `SELECT COUNT(*) FROM "CasinoBet" WHERE status = 'PENDING' AND "createdAt" < NOW() - INTERVAL '1 hour';`
10.4 Verify WhitelabelConfig features: `SELECT features FROM "WhitelabelConfig";` — must have `{"cricket": true, "casino": true, "matka": false}`

---

### SECTION 11: ERROR HANDLING

11.1 Place bet with amount 0 — must return 400 error
11.2 Place bet with amount exceeding balance — must return "Insufficient balance"
11.3 Place aviator bet during FLYING phase — must return "Betting phase is over"
11.4 Cash out with invalid betId — must return error
11.5 Access admin endpoint as client — must return 403
11.6 Check backend has `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers

---

### SECTION 12: SECURITY

12.1 Check CORS config in backend index.ts — origin must be `process.env.FRONTEND_URL` (not `*`)
12.2 Check nginx has security headers: X-Frame-Options, X-Content-Type-Options, HSTS
12.3 Check passwords are bcrypt hashed: `SELECT substring(password, 1, 7) FROM "User" LIMIT 1;` — must start with `$2b$`
12.4 Check JWT secrets in .env are at least 32 chars
12.5 No .env files committed to git

---

## OUTPUT FORMAT

For each check, output:
```
[PASS] 1.1 PM2 status — both online, 0 restarts
[FAIL] 3.2 Deposit — returned 400 "Invalid transactionType". Fix: field should be "transactionType" not "type"
```

At the end, output:
```
## SUMMARY
Total: X/Y passed
Critical failures: [list]
Non-critical: [list]
Recommended fixes: [numbered list with file paths and line numbers]
```
```
