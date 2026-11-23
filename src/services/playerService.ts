import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { ALLOWED_BADGE_IDS } from '../game/badges';
import { AchievementBadgeId, GameMode } from '../game/types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  bestScore: number;
  highestLine: number;
  totalEnemiesDefeated: number;
  gamesPlayed: number;
  bestRushScore?: number;
  bestRushWave?: number;
  bestHitChain?: number;
  badges?: AchievementBadgeId[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LeaderboardRecord {
  uid: string;
  playerName: string;
  bestScore: number;
  highestLine: number;
  enemiesDefeated: number;
  bestHitChain?: number;
  badges?: AchievementBadgeId[];
  updatedAt?: Timestamp;
}

export interface RushLeaderboardRecord {
  uid: string;
  playerName: string;
  bestScore: number;
  bestWave: number;
  enemiesDefeated: number;
  bestHitChain?: number;
  badges?: AchievementBadgeId[];
  updatedAt?: Timestamp;
}

export interface GameRunRecord {
  id: string;
  uid: string;
  score: number;
  lineReached: number;
  enemiesDefeated: number;
  victory: boolean;
  gameMode?: GameMode;
  waveReached?: number;
  bestHitChain?: number;
  badges?: AchievementBadgeId[];
  createdAt?: Timestamp;
}

function sanitizePlayerName(rawName: string | null | undefined): string {
  const trimmed = (rawName || 'Estagiário').trim();
  if (!trimmed) return 'Estagiário';
  return trimmed.slice(0, 40);
}

function clampInt(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeBadges(raw?: AchievementBadgeId[]): AchievementBadgeId[] {
  if (!Array.isArray(raw)) return [];
  const allowSet = new Set<AchievementBadgeId>(ALLOWED_BADGE_IDS);
  const deduped: AchievementBadgeId[] = [];
  for (const item of raw) {
    if (allowSet.has(item) && !deduped.includes(item)) {
      deduped.push(item);
      if (deduped.length >= 10) break;
    }
  }
  return deduped;
}

function mergeBadges(
  existing?: AchievementBadgeId[],
  incoming?: AchievementBadgeId[]
): AchievementBadgeId[] {
  return sanitizeBadges([...(existing ?? []), ...(incoming ?? [])]);
}

export async function fetchUserProfile(uid: string): Promise<UserProfileRecord | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function fetchUserRuns(uid: string): Promise<GameRunRecord[]> {
  const path = `users/${uid}/runs`;
  try {
    const q = query(
      collection(db, 'users', uid, 'runs'),
      orderBy('createdAt', 'desc'),
      limit(8)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<GameRunRecord, 'id'>),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardRecord[]> {
  const path = 'leaderboard';
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('bestScore', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchRushLeaderboard(): Promise<RushLeaderboardRecord[]> {
  const path = 'rush_leaderboard';
  try {
    const q = query(collection(db, 'rush_leaderboard'), orderBy('bestScore', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as RushLeaderboardRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function recordGameRun(
  user: User,
  payload: {
    score: number;
    lineReached: number;
    enemiesDefeated: number;
    victory: boolean;
    gameMode: GameMode;
    waveReached: number;
    bestHitChain: number;
    badges: AchievementBadgeId[];
  }
): Promise<void> {
  const uid = user.uid;
  const safeName = sanitizePlayerName(user.displayName);
  const safeScore = clampInt(payload.score, 0, 9999999);
  const safeLine = clampInt(payload.lineReached, 1, 3);
  const safeEnemies = clampInt(payload.enemiesDefeated, 0, 999999);
  const safeMode: GameMode = payload.gameMode === 'infinite' ? 'infinite' : 'campaign';
  const safeWave = clampInt(payload.waveReached, 1, 9999);
  const safeBestHitChain = clampInt(payload.bestHitChain, 0, 99999);
  const victory = Boolean(payload.victory);
  const safeRunBadges = sanitizeBadges(payload.badges);

  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let existingProfile: UserProfileRecord | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingProfile = snap.data() as UserProfileRecord;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  const mergedProfileBadges = mergeBadges(existingProfile?.badges, safeRunBadges);
  const nextCampaignBest =
    safeMode === 'campaign'
      ? Math.max(existingProfile?.bestScore ?? 0, safeScore)
      : (existingProfile?.bestScore ?? 0);
  const nextCampaignLine =
    safeMode === 'campaign'
      ? Math.max(existingProfile?.highestLine ?? 1, safeLine)
      : (existingProfile?.highestLine ?? 1);
  const nextRushScore =
    safeMode === 'infinite'
      ? Math.max(existingProfile?.bestRushScore ?? 0, safeScore)
      : (existingProfile?.bestRushScore ?? 0);
  const nextRushWave =
    safeMode === 'infinite'
      ? Math.max(existingProfile?.bestRushWave ?? 1, safeWave)
      : (existingProfile?.bestRushWave ?? 1);
  const nextBestHitChain = Math.max(existingProfile?.bestHitChain ?? 0, safeBestHitChain);

  if (!existingProfile) {
    try {
      await setDoc(userRef, {
        uid,
        displayName: safeName,
        bestScore: nextCampaignBest,
        highestLine: nextCampaignLine,
        totalEnemiesDefeated: safeEnemies,
        gamesPlayed: 1,
        bestRushScore: nextRushScore,
        bestRushWave: nextRushWave,
        bestHitChain: nextBestHitChain,
        badges: safeRunBadges,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, userPath);
    }
  } else {
    try {
      await updateDoc(userRef, {
        displayName: safeName,
        bestScore: nextCampaignBest,
        highestLine: nextCampaignLine,
        totalEnemiesDefeated: clampInt(
          (existingProfile.totalEnemiesDefeated ?? 0) + safeEnemies,
          0,
          9999999
        ),
        gamesPlayed: clampInt((existingProfile.gamesPlayed ?? 0) + 1, 1, 999999),
        bestRushScore: nextRushScore,
        bestRushWave: nextRushWave,
        bestHitChain: nextBestHitChain,
        badges: mergedProfileBadges,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const runPath = `users/${uid}/runs/${runId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'runs', runId), {
      uid,
      score: safeScore,
      lineReached: safeLine,
      enemiesDefeated: safeEnemies,
      victory,
      gameMode: safeMode,
      waveReached: safeWave,
      bestHitChain: safeBestHitChain,
      badges: safeRunBadges,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, runPath);
  }

  if (safeMode === 'campaign') {
    const lbPath = `leaderboard/${uid}`;
    const lbRef = doc(db, 'leaderboard', uid);
    let existingLb: LeaderboardRecord | null = null;
    try {
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        existingLb = lbSnap.data() as LeaderboardRecord;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, lbPath);
    }

    if (!existingLb) {
      try {
        await setDoc(lbRef, {
          uid,
          playerName: safeName,
          bestScore: safeScore,
          highestLine: safeLine,
          enemiesDefeated: safeEnemies,
          bestHitChain: safeBestHitChain,
          badges: mergedProfileBadges,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, lbPath);
      }
    } else {
      const existingBest = existingLb.bestScore ?? 0;
      const existingLbHits = existingLb.bestHitChain ?? 0;
      const existingLbBadges = sanitizeBadges(existingLb.badges);
      const mergedLbBadges = mergeBadges(existingLbBadges, mergedProfileBadges);
      const hasNewScore = safeScore >= existingBest;
      const hasNewHitChain = safeBestHitChain > existingLbHits;
      const hasNewBadge = mergedLbBadges.length > existingLbBadges.length;

      if (hasNewScore || hasNewHitChain || hasNewBadge) {
        try {
          await updateDoc(lbRef, {
            playerName: safeName,
            bestScore: Math.max(existingBest, safeScore),
            highestLine: Math.max(existingLb.highestLine ?? 1, safeLine),
            enemiesDefeated: hasNewScore ? safeEnemies : (existingLb.enemiesDefeated ?? 0),
            bestHitChain: Math.max(existingLbHits, safeBestHitChain),
            badges: mergedLbBadges,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, lbPath);
        }
      }
    }
  } else {
    const rushPath = `rush_leaderboard/${uid}`;
    const rushRef = doc(db, 'rush_leaderboard', uid);
    let existingRush: RushLeaderboardRecord | null = null;
    try {
      const rushSnap = await getDoc(rushRef);
      if (rushSnap.exists()) {
        existingRush = rushSnap.data() as RushLeaderboardRecord;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, rushPath);
    }

    if (!existingRush) {
      try {
        await setDoc(rushRef, {
          uid,
          playerName: safeName,
          bestScore: safeScore,
          bestWave: safeWave,
          enemiesDefeated: safeEnemies,
          bestHitChain: safeBestHitChain,
          badges: mergedProfileBadges,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, rushPath);
      }
    } else {
      const existingBest = existingRush.bestScore ?? 0;
      const existingRushHits = existingRush.bestHitChain ?? 0;
      const existingRushBadges = sanitizeBadges(existingRush.badges);
      const mergedRushBadges = mergeBadges(existingRushBadges, mergedProfileBadges);
      const hasNewScore = safeScore >= existingBest;
      const hasNewWave = safeWave > (existingRush.bestWave ?? 1);
      const hasNewHitChain = safeBestHitChain > existingRushHits;
      const hasNewBadge = mergedRushBadges.length > existingRushBadges.length;

      if (hasNewScore || hasNewWave || hasNewHitChain || hasNewBadge) {
        try {
          await updateDoc(rushRef, {
            playerName: safeName,
            bestScore: Math.max(existingBest, safeScore),
            bestWave: Math.max(existingRush.bestWave ?? 1, safeWave),
            enemiesDefeated: hasNewScore ? safeEnemies : (existingRush.enemiesDefeated ?? 0),
            bestHitChain: Math.max(existingRushHits, safeBestHitChain),
            badges: mergedRushBadges,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, rushPath);
        }
      }
    }
  }
}
