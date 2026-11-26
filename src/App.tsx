/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AchievementsModal } from './components/AchievementsModal';
import { AchievementToast } from './components/AchievementToast';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { GameHUD } from './components/GameHUD';
import { GameModals } from './components/GameModals';
import { IntroStoryboard } from './components/IntroStoryboard';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ShopModal } from './components/ShopModal';
import { TitleScreen } from './components/TitleScreen';
import { TutorialModal } from './components/TutorialModal';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { audio } from './game/audio';
import {
  AchievementProgressState,
  ALLOWED_BADGE_IDS,
  loadAchievementProgress,
  syncAchievementsWithProfile,
} from './game/badges';
import { DailyMissionsState, loadDailyMissionsState } from './game/dailyMissions';
import { ActionKey, BusBeatEmUpEngine } from './game/engine';
import { DEFAULT_INTRO_FRAMES, VICTORY_STORY_FRAMES } from './game/introFrames';
import { musicManager } from './game/music';
import {
  awardCoinsFromRun,
  InfiniteRecord,
  loadInfiniteRecord,
  loadShopState,
  saveBestHitChain,
  saveCampaignBestScore,
  saveInfiniteRecord,
  ShopCategory,
  ShopState,
} from './game/shop';
import { GameMode, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameMode: 'campaign',
  gameState: 'TITLE_MENU',
  lineNumber: 1,
  lineCode: '101',
  lineTitle: 'Linha 101 · Alphavella',
  hp: 105,
  maxHp: 105,
  score: 0,
  hitsLanded: 0,
  bestHitChain: 0,
  enemiesDefeated: 0,
  comboStreak: 0,
  comboMultiplier: 1,
  perfectHitActive: false,
  perfectHitSeq: 0,
  credits: 0,
  ticketCost: 2,
  ticketValidated: false,
  caneCharges: 0,
  deodorantCount: 0,
  makeupShieldTimer: 0,
  shieldHits: 0,
  bagSkillCooldown: 0,
  strengthBuffTimer: 0,
  rageTimer: 0,
  rageNotificationTimer: 0,
  specialEnergy: 0,
  speedBoostTimer: 0,
  stickySlowTimer: 0,
  fiscalChasing: false,
  nearValidator: false,
  nearStopButton: false,
  stopButtonReady: true,
  nearEmptySeat: false,
  seatRestProgress: 0,
  expressWindTimer: 0,
  turnstileCleared: false,
  goArrowActive: false,
  routeProgress: 0,
  turnstileProgress: 0.85,
  infiniteWave: 1,
  infiniteTimeLeft: 75,
  bosses: [],
  alertMessage: '',
  badges: [],
  activeAchievementToast: null,
  screenNotifications: [],
  combatLog: [],
  achievementStats: {
    unlockedCount: 0,
    totalCount: ALLOWED_BADGE_IDS.length,
    totalDefeated: 0,
  },
};

function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BusBeatEmUpEngine | null>(null);
  const runSavedRef = useRef(false);

  const { profile, saveRun } = useFirebase();
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [gameMode, setGameMode] = useState<GameMode>('campaign');
  const [infiniteBest, setInfiniteBest] = useState<InfiniteRecord>(() => loadInfiniteRecord());
  const [muted, setMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(() => musicManager.getMusicVolume());
  const [sfxVolume, setSfxVolume] = useState(() => audio.getSfxVolume());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopInitialTab, setShopInitialTab] = useState<ShopCategory>('custom');
  const [showDailyMissions, setShowDailyMissions] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [shopState, setShopState] = useState<ShopState>(() => loadShopState());
  const [dailyMissionsState, setDailyMissionsState] = useState<DailyMissionsState>(() =>
    loadDailyMissionsState()
  );
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgressState>(() =>
    loadAchievementProgress()
  );
  const [edgeImpactSeq, setEdgeImpactSeq] = useState(0);
  const [edgeImpactActive, setEdgeImpactActive] = useState(false);
  const prevComboStreakRef = useRef(0);
  const prevBestHitChainRef = useRef(0);
  const edgeImpactTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    setAchievementProgress(
      syncAchievementsWithProfile(
        profile.badges,
        profile.totalEnemiesDefeated,
        profile.highestLine
      )
    );
    if ((profile.bestScore ?? 0) > 0) {
      saveCampaignBestScore(profile.bestScore);
    }
    if ((profile.bestRushScore ?? 0) > 0 || (profile.bestRushWave ?? 0) > 0) {
      setInfiniteBest(
        saveInfiniteRecord(profile.bestRushScore ?? 0, profile.bestRushWave ?? 1)
      );
    }
  }, [profile]);

  useEffect(() => {
    setAchievementProgress(loadAchievementProgress());
  }, [hud.achievementStats.unlockedCount, hud.achievementStats.totalDefeated]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BusBeatEmUpEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.startLoop();

    return () => {
      musicManager.stop();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Trigger screen-space edge flares & viewport shake when comboStreak or bestHitChain climbs above 10x
  useEffect(() => {
    if (hud.gameState !== 'PLAYING') {
      prevComboStreakRef.current = hud.comboStreak;
      prevBestHitChainRef.current = hud.bestHitChain;
      setEdgeImpactActive(false);
      if (edgeImpactTimeoutRef.current !== null) {
        window.clearTimeout(edgeImpactTimeoutRef.current);
        edgeImpactTimeoutRef.current = null;
      }
      return;
    }

    const streakClimbedOverTen =
      hud.comboStreak > 10 && hud.comboStreak > prevComboStreakRef.current;
    const bestChainClimbedOverTen =
      hud.bestHitChain > 10 && hud.bestHitChain > prevBestHitChainRef.current;

    prevComboStreakRef.current = hud.comboStreak;
    prevBestHitChainRef.current = hud.bestHitChain;

    if (streakClimbedOverTen || bestChainClimbedOverTen) {
      setEdgeImpactSeq((seq) => seq + 1);
      setEdgeImpactActive(true);
      if (edgeImpactTimeoutRef.current !== null) {
        window.clearTimeout(edgeImpactTimeoutRef.current);
      }
      edgeImpactTimeoutRef.current = window.setTimeout(() => {
        setEdgeImpactActive(false);
        edgeImpactTimeoutRef.current = null;
      }, 380);
    }
  }, [hud.gameState, hud.comboStreak, hud.bestHitChain]);

  useEffect(() => {
    return () => {
      if (edgeImpactTimeoutRef.current !== null) {
        window.clearTimeout(edgeImpactTimeoutRef.current);
      }
    };
  }, []);

  // Automatically trigger per-line generated music when active gameplay starts or changes lines
  useEffect(() => {
    if (hud.gameState === 'PLAYING') {
      void musicManager.playLineMusic(hud.lineNumber);
    } else if (hud.gameState === 'PAUSED') {
      musicManager.pause();
    } else if (
      hud.gameState === 'TITLE_MENU' ||
      hud.gameState === 'GAME_OVER' ||
      hud.gameState === 'VICTORY_SCENE' ||
      hud.gameState === 'VICTORY'
    ) {
      musicManager.stop();
    }
  }, [hud.gameState, hud.lineNumber]);

  // Persist run results to Firestore on GAME_OVER or VICTORY
  useEffect(() => {
    if (hud.gameState === 'PLAYING' || hud.gameState === 'INTRO_SCENE') {
      runSavedRef.current = false;
      return;
    }
    if (
      (hud.gameState === 'GAME_OVER' ||
        hud.gameState === 'VICTORY_SCENE' ||
        hud.gameState === 'VICTORY') &&
      !runSavedRef.current
    ) {
      runSavedRef.current = true;
      const isVictory = hud.gameState === 'VICTORY' || hud.gameState === 'VICTORY_SCENE';
      awardCoinsFromRun(
        hud.score,
        hud.enemiesDefeated,
        isVictory,
        hud.gameMode === 'infinite' ? hud.infiniteWave : 0
      );
      setShopState(loadShopState());
      setDailyMissionsState(loadDailyMissionsState());
      if (hud.gameMode === 'infinite') {
        setInfiniteBest(saveInfiniteRecord(hud.score, hud.infiniteWave));
      } else {
        saveCampaignBestScore(hud.score);
      }
      saveBestHitChain(hud.gameMode, hud.bestHitChain);
      void saveRun({
        score: hud.score,
        lineReached: hud.lineNumber,
        enemiesDefeated: hud.enemiesDefeated,
        bestHitChain: hud.bestHitChain,
        victory: isVictory,
        gameMode: hud.gameMode,
        waveReached: hud.infiniteWave,
        badges: hud.badges,
      });
    }
  }, [
    hud.gameState,
    hud.gameMode,
    hud.infiniteWave,
    hud.score,
    hud.lineNumber,
    hud.enemiesDefeated,
    hud.bestHitChain,
    hud.badges,
    saveRun,
  ]);

  const handleStart = useCallback(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      const orientation = screen.orientation as
        | { lock?: (orientation: string) => Promise<void> }
        | undefined;
      orientation?.lock?.('landscape')?.catch(() => {});
    }
    engineRef.current?.startNewGame(gameMode);
  }, [gameMode]);

  const handleSkipIntro = useCallback(() => {
    engineRef.current?.skipIntro();
  }, []);

  const handleCompleteVictoryScene = useCallback(() => {
    engineRef.current?.completeVictoryScene();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.setPaused(true);
  }, []);

  const handleNextLine = useCallback(() => {
    engineRef.current?.continueToNextLine();
  }, []);

  const handleBuyPerk = useCallback((perk: 'coffee' | 'deodorant' | 'shield') => {
    engineRef.current?.buyTransitPerk(perk);
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
    setShopState(loadShopState());
    setDailyMissionsState(loadDailyMissionsState());
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      audio.setMuted(next);
      musicManager.setMuted(next);
      return next;
    });
  }, []);

  const handleMusicVolumeChange = useCallback((vol: number) => {
    setMusicVolume(vol);
    musicManager.setMusicVolume(vol);
  }, []);

  const handleSfxVolumeChange = useCallback((vol: number) => {
    setSfxVolume(vol);
    audio.setSfxVolume(vol);
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    engineRef.current?.setVirtualMove(x, y);
  }, []);

  const handleTouchAction = useCallback((action: ActionKey) => {
    engineRef.current?.triggerAction(action);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090d16] flex items-center justify-center">
      {/* 2.5D Belt-Scroller Gameplay Viewport */}
      <div
        className={`relative w-full h-full flex items-center justify-center ${
          edgeImpactActive
            ? edgeImpactSeq % 2 === 0
              ? 'animate-viewport-combo-shake-a'
              : 'animate-viewport-combo-shake-b'
            : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated' }}
          className="w-full h-full object-contain bg-[#0b1120]"
        />
        {edgeImpactActive && (
          <div
            key={edgeImpactSeq}
            data-intense={hud.comboStreak >= 20 || hud.bestHitChain >= 20 ? 'true' : 'false'}
            className="viewport-combo-flare pointer-events-none absolute inset-0 z-10"
          />
        )}
      </div>

      {/* Title Screen */}
      {hud.gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20">
          <TitleScreen
            onStart={handleStart}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onOpenShop={() => {
              setShopState(loadShopState());
              setShopInitialTab('custom');
              setShowShop(true);
            }}
            onOpenDailyMissions={() => {
              setDailyMissionsState(loadDailyMissionsState());
              setShopState(loadShopState());
              setShowDailyMissions(true);
            }}
            onOpenAchievements={() => {
              setAchievementProgress(loadAchievementProgress());
              setShowAchievements(true);
            }}
            onOpenTutorial={() => setShowTutorial(true)}
            shopCoins={shopState.coins}
            equippedSkin={shopState.equippedSkin}
            garageConfig={shopState.garage}
            achievementCount={achievementProgress.unlockedIds.length}
            achievementTotal={ALLOWED_BADGE_IDS.length}
            dailyCompletedCount={dailyMissionsState.missions.filter((m) => m.completed).length}
            dailyTotalCount={dailyMissionsState.missions.length}
            selectedMode={gameMode}
            onSelectMode={setGameMode}
            infiniteBest={infiniteBest}
            modalOpen={
              showLeaderboard ||
              showShop ||
              showDailyMissions ||
              showAchievements ||
              showTutorial
            }
          />
        </div>
      )}

      {/* Static Comic Image Frames Intro Cutscene */}
      {hud.gameState === 'INTRO_SCENE' && (
        <div className="absolute inset-0 z-20 bg-[#090d16]">
          <IntroStoryboard
            key="intro-storyboard"
            frames={DEFAULT_INTRO_FRAMES}
            onComplete={handleSkipIntro}
          />
        </div>
      )}

      {/* Static Comic Image Frames Ending Cutscene (Elevator POV + Bruised Clock-In) */}
      {hud.gameState === 'VICTORY_SCENE' && (
        <div className="absolute inset-0 z-20 bg-[#090d16]">
          <IntroStoryboard
            key="victory-storyboard"
            frames={VICTORY_STORY_FRAMES}
            skipLabel="PULAR FINAL"
            autoAdvanceMs={2200}
            onComplete={handleCompleteVictoryScene}
          />
        </div>
      )}

      {/* Playing HUD */}
      {hud.gameState !== 'TITLE_MENU' &&
        hud.gameState !== 'INTRO_SCENE' &&
        hud.gameState !== 'VICTORY_SCENE' && (
          <GameHUD
            hud={hud}
            muted={muted}
            onToggleMute={handleToggleMute}
            onPause={handlePause}
            onTouchMove={handleTouchMove}
            onTouchAction={handleTouchAction}
          />
        )}

      {/* Pause, Mid-Scene Bus Stop, Victory Office Tablet, and Game Over Modals */}
      <GameModals
        hud={hud}
        musicVolume={musicVolume}
        sfxVolume={sfxVolume}
        onMusicVolumeChange={handleMusicVolumeChange}
        onSfxVolumeChange={handleSfxVolumeChange}
        onResume={handleResume}
        onNextLine={handleNextLine}
        onBuyPerk={handleBuyPerk}
        onRestart={handleStart}
        onReturnTitle={handleReturnTitle}
      />

      {/* Achievement Unlock Toast Card */}
      <AchievementToast notice={hud.activeAchievementToast} />

      {showLeaderboard && (
        <LeaderboardModal
          initialTab={gameMode}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showAchievements && (
        <AchievementsModal
          progress={achievementProgress}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {showDailyMissions && (
        <DailyMissionsModal
          missionsState={dailyMissionsState}
          onRefreshState={(next) => {
            setDailyMissionsState(next);
            setShopState(loadShopState());
          }}
          onClose={() => {
            setDailyMissionsState(loadDailyMissionsState());
            setShopState(loadShopState());
            setShowDailyMissions(false);
          }}
        />
      )}

      {showShop && (
        <ShopModal
          shopState={shopState}
          initialTab={shopInitialTab}
          onUpdateShop={(next) => {
            setShopState(next);
            engineRef.current?.refreshShopLoadout();
          }}
          onClose={() => {
            engineRef.current?.refreshShopLoadout();
            setShowShop(false);
          }}
        />
      )}

      {showTutorial && (
        <TutorialModal
          onClose={() => setShowTutorial(false)}
          onStartGame={handleStart}
        />
      )}

      {/* Landscape-only guard for Mobile & Tablet in Portrait */}
      <div className="portrait-lock-overlay fixed inset-0 z-50 bg-[#090d16]/96 flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1e293b] border-2 border-[#facc15] flex items-center justify-center shadow-[0_4px_0_#020617]">
          <RotateCw className="w-8 h-8 text-[#facc15] animate-spin" style={{ animationDuration: '4s' }} />
        </div>
        <h2 className="font-arcade-display text-sm sm:text-base text-[#facc15] tracking-wider">
          GIRE PARA PAISAGEM
        </h2>
        <p className="max-w-xs text-sm text-slate-300 leading-relaxed">
          Este jogo no celular e tablet funciona apenas na horizontal (paisagem).
        </p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <GameShell />
    </FirebaseProvider>
  );
}
