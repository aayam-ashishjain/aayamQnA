# Slido Clone (Turso + Express + Socket.IO + Angular 18) — v2

Real-time audience Q&A, live polls (multiple choice, word cloud, rating, open text), full Quiz Studio (timed auto-lock questions, correct-answer reveal, speed-scored leaderboard), host moderation, JWT authentication, and a projector-ready Present Mode with scannable QR overlay.

## What Changed in v2

- Fixed Angular `NG5002` template alias errors in `present-view.component.ts`
- Added inline Angular form validation in `host-login.component.ts` and field-specific validation in `server/server.js`
- Added `QuizBuilderComponent` (`quiz-builder.component.ts`) and wired it into `host-console.component.ts`
- Added server-side countdown timers, auto-lock + answer reveal, question deletion, score reset, and remote projector leaderboard toggle

## Quick Upgrade (Keep Your Existing `server/.env` & `node_modules`)

Copy these 7 files from the unzipped folder into your existing workspace, then restart `server`:
1. `server/server.js`
2. `client/src/app/services/slido-socket.service.ts`
3. `client/src/app/components/host-login.component.ts`
4. `client/src/app/components/host-dashboard.component.ts`
5. `client/src/app/components/host-console.component.ts`
6. `client/src/app/components/quiz-builder.component.ts` (new file)
7. `client/src/app/components/present-view.component.ts`
8. `client/src/app/components/participant-room.component.ts`
