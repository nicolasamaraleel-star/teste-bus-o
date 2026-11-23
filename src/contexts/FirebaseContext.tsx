import { onAuthStateChanged, User } from 'firebase/auth';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { auth, signInWithGoogle, signOutUser } from '../lib/firebase';
import { AchievementBadgeId, GameMode } from '../game/types';
import {
  fetchLeaderboard,
  fetchRushLeaderboard,
  fetchUserProfile,
  fetchUserRuns,
  GameRunRecord,
  LeaderboardRecord,
  recordGameRun,
  RushLeaderboardRecord,
  UserProfileRecord,
} from '../services/playerService';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  profile: UserProfileRecord | null;
  runs: GameRunRecord[];
  leaderboard: LeaderboardRecord[];
  rushLeaderboard: RushLeaderboardRecord[];
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  refreshData: () => Promise<void>;
  saveRun: (payload: {
    score: number;
    lineReached: number;
    enemiesDefeated: number;
    victory: boolean;
    gameMode: GameMode;
    waveReached: number;
    bestHitChain: number;
    badges: AchievementBadgeId[];
  }) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [runs, setRuns] = useState<GameRunRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [rushLeaderboard, setRushLeaderboard] = useState<RushLeaderboardRecord[]>([]);

  const loadUserAndLeaderboard = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setRuns([]);
      setLeaderboard([]);
      setRushLeaderboard([]);
      return;
    }
    try {
      const [userProf, userRuns, lb, rushLb] = await Promise.all([
        fetchUserProfile(currentUser.uid),
        fetchUserRuns(currentUser.uid),
        fetchLeaderboard(),
        fetchRushLeaderboard(),
      ]);
      setProfile(userProf);
      setRuns(userRuns);
      setLeaderboard(lb);
      setRushLeaderboard(rushLb);
    } catch (err) {
      console.error('Erro ao carregar dados do jogador:', err);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      void loadUserAndLeaderboard(nextUser);
    });
    return unsub;
  }, [loadUserAndLeaderboard]);

  const signIn = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao entrar com Google.';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const logOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOutUser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao sair.';
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadUserAndLeaderboard(user);
  }, [loadUserAndLeaderboard, user]);

  const saveRun = useCallback(
    async (payload: {
      score: number;
      lineReached: number;
      enemiesDefeated: number;
      victory: boolean;
      gameMode: GameMode;
      waveReached: number;
      bestHitChain: number;
      badges: AchievementBadgeId[];
    }) => {
      if (!user) return;
      try {
        await recordGameRun(user, payload);
        await loadUserAndLeaderboard(user);
      } catch (err) {
        console.error('Erro ao salvar partida:', err);
      }
    },
    [loadUserAndLeaderboard, user]
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authBusy,
        authError,
        profile,
        runs,
        leaderboard,
        rushLeaderboard,
        signIn,
        logOut,
        refreshData,
        saveRun,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase deve ser usado dentro de FirebaseProvider');
  }
  return ctx;
}
