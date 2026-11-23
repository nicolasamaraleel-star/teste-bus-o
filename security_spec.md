# Security Specification — Horário de Pico: Briga no Busão

## Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read, created, or updated by the authenticated owner whose `request.auth.uid == userId` and `email_verified == true`.
2. A `GameRun` document at `/users/{userId}/runs/{runId}` requires its parent `/users/{userId}` document to exist (`exists(...)`), is strictly immutable once created, and can only be read or created by the owner.
3. A `LeaderboardEntry` at `/leaderboard/{userId}` can only be written by the owner (`request.auth.uid == userId`, `email_verified == true`) with bounded numeric scores and server timestamps (`request.time`).
4. Every document ID (`userId`, `runId`) must pass `isValidId()` (`^[a-zA-Z0-9_\-]+$`, length <= 128).
5. All writes enforce exact key allowlists (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update) and immutable `uid` / `createdAt`.
6. Every `badges` array on `UserProfile`, `GameRun`, and `LeaderboardEntry` must be a `list` of size `<= 6` whose elements strictly belong to `['rage_10x', 'all_validated', 'zero_damage_line', 'boss_rage_ko', 'ninja_mochila', 'acrobata_busao']`.

## Dirty Dozen Adversarial Payloads
1. **Identity Spoofing on Profile**: Create `/users/victim_uid` with `{ "uid": "attacker_uid", ... }` -> DENIED (`uid != request.auth.uid` and `userId != request.auth.uid`).
2. **Shadow Field Injection (Profile)**: Create `/users/uid1` with extra `{ "isAdmin": true }` -> DENIED (`keys().hasOnly(...)` fails).
3. **Unverified Email Write**: Authenticated user with `email_verified: false` writing `/users/uid1` -> DENIED (`request.auth.token.email_verified == true` fails).
4. **Cross-User Profile Read**: User `uid2` reading `/users/uid1` -> DENIED (`isOwner(userId)` fails).
5. **Cross-User List Scraping**: User `uid2` listing `/users` -> DENIED (no `list` allowed on `/users`).
6. **ID Poisoning**: Document ID `"a".repeat(200)` or `"bad/id$"` -> DENIED (`isValidId()` fails).
7. **Timestamp Spoofing**: Client sends `updatedAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` -> DENIED (`incoming().updatedAt == request.time` fails).
8. **Immutable Field Tampering**: Update `/users/uid1` changing `createdAt` or `uid` -> DENIED (`affectedKeys().hasOnly(...)` and immutability checks fail).
9. **Score Overflow / Negative Score**: Create `/leaderboard/uid1` with `bestScore: -50` or `bestScore: 999999999` -> DENIED (range guard `>= 0 && <= 9999999` fails).
10. **Line Out of Bounds**: Create `/leaderboard/uid1` with `highestLine: 99` -> DENIED (`highestLine >= 1 && highestLine <= 3` fails).
11. **Orphaned Run Creation**: Create `/users/uid1/runs/run1` before `/users/uid1` exists -> DENIED (`exists(/databases/.../users/$(userId))` fails).
12. **Run Mutation / Deletion**: Attempt to `update` or `delete` `/users/uid1/runs/run1` -> DENIED (`allow update, delete: if false`).
13. **Badge List Poisoning**: Create or update `/leaderboard/uid1` with `badges: ["fake_admin_badge"]` or 10 elements -> DENIED (`isValidBadgesList()` rejects size > 6 and non-allowlisted IDs).
