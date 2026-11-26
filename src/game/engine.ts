import { audio } from './audio';
import { vibrateDamage, vibrateGameOver, vibrateHit, vibrateSpecial } from './haptics';
import {
  ALLOWED_BADGE_IDS,
  BADGE_META,
  loadAchievementProgress,
  recordDefeatedEnemyMilestone,
  recordHighestLineMilestone,
  recordRushWaveMilestone,
  unlockPersistentAchievement,
} from './badges';
import { DailyMissionEventType, recordDailyMissionEvent } from './dailyMissions';
import {
  AISLE_MAX_Y,
  AISLE_MIN_Y,
  BUS_LINES,
  GRAVITY,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  LINE_DIFFICULTY,
  RENDER_SCALE,
} from './levels';
import { DitherPostProcessor } from './postProcessShader';
import { findBusSeatAtX, SeatSlotInfo } from './seats';
import { getActiveShopLoadout } from './shop';
import {
  drawBossFinisherEffect,
  drawFullScreenKoAnimation,
  drawGroundShockwave,
  drawImpactFlash,
  drawPixelParticle,
  drawVectorBusInterior,
  drawVectorDropItem,
  drawVectorEnemy,
  drawVectorForegroundLayer,
  drawVectorPlayer,
} from './vectorArt';
import {
  AchievementBadgeId,
  AchievementUnlockNotice,
  BossFinisherKind,
  BossHudInfo,
  DropItem,
  EnemyEntity,
  EnemyType,
  FloatingText,
  GameMode,
  GameState,
  GroundHazard,
  HudSnapshot,
  ImpactFlashKind,
  ItemType,
  LineDefinition,
  Particle,
  PlayerAnimState,
  PlayerEntity,
  Projectile,
  WaveZone,
} from './types';

export type ActionKey = 'punch' | 'kick' | 'jump' | 'special' | 'use' | 'bagGuard';

interface BossFinisherEffect {
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  style: 'turnstile' | 'armor' | 'tickets';
}

interface ImpactFlash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  strong: boolean;
  kind?: ImpactFlashKind;
  dir?: 1 | -1;
}

interface GroundShockwave {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  strong: boolean;
}

export class BusBeatEmUpEngine {
  private canvas: HTMLCanvasElement;
  private postProcessor: DitherPostProcessor;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private rafId: number | null = null;
  private lastTime = 0;
  private simTime = 0;

  private gameMode: GameMode = 'campaign';
  private gameState: GameState = 'TITLE_MENU';
  private introTimer = 0;

  private infiniteWave = 1;
  private infiniteTimeLeft = 75;
  private infiniteThemeLineIdx = 0;

  private currentLineIdx = 0;
  private line: LineDefinition = BUS_LINES[0];

  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private drops: DropItem[] = [];
  private projectiles: Projectile[] = [];
  private soundRingHits = new Map<number, Set<number>>();
  private hazards: GroundHazard[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private waves: WaveZone[] = [];

  private nextId = 1;
  private camX = 0;
  private shakeTimer = 0;
  private shakeMag = 0;
  private comboTintTimer = 0;
  private comboFlickerTimer = 0;
  private comboFlickerIntensity = 0;
  private comboEdgeFlashTimer = 0;
  private comboEdgeFlashMax = 0.38;
  private comboEdgeFlashStrength = 0;
  private comboEdgeParticles: Array<{
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
  }> = [];
  private specialReadyParticles: Array<{
    ox: number;
    oz: number;
    vx: number;
    vz: number;
    life: number;
    maxLife: number;
    kind: 'spark' | 'arc';
    seed: number;
    front: boolean;
    color: string;
  }> = [];
  private specialReadySpawnAcc = 0;
  private hitstopTimer = 0;
  private hitstopFrames = 0;
  private comboFinisherSlowTimer = 0;
  private comboFinisherSlowMax = 0.085;
  private comboFinisherSlowMinScale = 0.52;
  private bossBulletTimeTimer = 0;
  private bossKoFlashTimer = 0;
  private bossKoTrailTimer = 0;
  private specialLightTimer = 0;
  private specialLightMax = 0.48;
  private specialLightColor = '#facc15';
  private runElapsedSeconds = 0;
  private caneHintTimer = 0;
  private shieldBreakHintTimer = 0;
  private bossFinisherEffects: BossFinisherEffect[] = [];
  private impactFlashes: ImpactFlash[] = [];
  private groundShockwaves: GroundShockwave[] = [];
  private bossKoOverlay: {
    life: number;
    maxLife: number;
    primaryColor: string;
    secondaryColor: string;
    style: 'turnstile' | 'armor' | 'tickets';
  } | null = null;

  private ticketValidated = false;
  private fiscalChasing = false;
  private turnstileCleared = false;
  private turnstileCrossed = false;
  private turnstileSpinTimer = 0;
  private stopButtonCooldown = 0;
  private shortCircuitTimer = 0;
  private graffitiSeed = 1;
  private shopLoadout = getActiveShopLoadout();
  private alertMessage = '';
  private alertTimer = 0;
  private deodorantBackupTimer = 0;
  private hudSyncTimer = 0;
  private bufferedAction: ActionKey | null = null;
  private bufferTimer = 0;
  private airAttackUsed = false;
  private victoryPoseCycle = 0;
  private lastComboAttackAnim: PlayerAnimState = 'idle';
  private activeAttackPrevAnim: PlayerAnimState = 'idle';
  private caneSpinVisual = false;
  private attackActiveTicks = 0;
  private perfectHitTimer = 0;
  private perfectHitSeq = 0;
  private levelClearTransition: { timer: number; pose: PlayerAnimState } | null = null;
  private hitChainTimer = 0;
  private staticRenderedState: GameState | null = null;
  private pendingBossSpawns: Array<{
    waveId: number;
    type: EnemyType;
    x: number;
    y: number;
    delayRemaining: number;
    guaranteedDrop?: ItemType;
  }> = [];
  private bossFinisherState: {
    victimId: number;
    kind: BossFinisherKind;
    elapsed: number;
    duration: number;
    anchorX: number;
    anchorY: number;
    facing: 1 | -1;
    didGrabFx: boolean;
    swingWhooshCount: number;
    poundHitCount: number;
    kneeHitDone: boolean;
    slamImpactDone: boolean;
  } | null = null;
  private lastBossFinisherKind: BossFinisherKind | null = null;

  private busEventCooldown = 14;
  private busEventState:
    | 'none'
    | 'brake_warn'
    | 'bump_warn'
    | 'curve_warn'
    | 'window_vendor_warn'
    | 'express_surge_warn'
    | 'door_crowd_warn'
    | 'short_circuit_warn' = 'none';
  private busEventWarnTimer = 0;
  private busEventStep = 0;
  private busSlideVx = 0;
  private busCurveVy = 0;
  private expressWindTimer = 0;

  private usedSeatSlots = new Set<number>();
  private seatRestHoldTimer = 0;
  private transitionPerksBought = new Set<string>();

  private runBadges = new Set<AchievementBadgeId>();
  private achievementQueue: AchievementUnlockNotice[] = [];
  private activeAchievementToast: AchievementUnlockNotice | null = null;
  private achievementToastTimer = 0;
  private achievementToastSeq = 1;
  private bagParryCount = 0;
  private railSpinKoCount = 0;
  private damageTakenThisLine = false;
  private skippedValidationAnyLine = false;
  private dailyRunCounted = false;

  private heldKeys = new Set<string>();
  private virtualMove = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.canvas = canvas;
    this.postProcessor = new DitherPostProcessor(
      canvas,
      INTERNAL_WIDTH,
      INTERNAL_HEIGHT,
      RENDER_SCALE
    );
    this.ctx = this.postProcessor.getSceneContext();
    this.onHudUpdate = onHudUpdate;

    this.resetPlayer();
    this.loadLine(0, true);
    this.bindEvents();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    if (this.gameState === 'INTRO_SCENE') {
      if (code === 'Enter' || code === 'Escape') {
        this.skipIntro();
      }
      return;
    }

    if (this.gameState === 'VICTORY_SCENE') {
      if (code === 'Enter' || code === 'Escape') {
        this.completeVictoryScene();
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.gameState === 'PLAYING') {
        this.setPaused(true);
      } else if (this.gameState === 'PAUSED') {
        this.setPaused(false);
      }
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    const wasHeld = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasHeld && !e.repeat) {
      if (code === 'KeyJ' || code === 'KeyZ') this.triggerAction('punch');
      else if (code === 'KeyK' || code === 'KeyX') this.triggerAction('kick');
      else if (code === 'Space') this.triggerAction('jump');
      else if (code === 'KeyL' || code === 'KeyC') this.triggerAction('special');
      else if (code === 'KeyE' || code === 'KeyU') this.triggerAction('use');
      else if (code === 'KeyQ' || code === 'ShiftLeft' || code === 'ShiftRight') {
        this.triggerAction('bagGuard');
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.virtualMove = { x: 0, y: 0 };
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.postProcessor.destroy();
  }

  public startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      if (typeof document !== 'undefined' && document.hidden) {
        this.lastTime = now;
        return;
      }
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private resetPlayer() {
    this.shopLoadout = getActiveShopLoadout();
    const maxHp = 105 + this.shopLoadout.maxHpBonus;
    this.player = {
      x: 85,
      y: 190,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: 1,
      hp: maxHp,
      maxHp,
      anim: 'idle',
      animTimer: 0,
      comboStep: 0,
      comboResetTimer: 0,
      attackHasHit: false,
      invulnTimer: 0,
      hitFlashTimer: 0,
      stickySlowTimer: 0,
      caneCharges: this.shopLoadout.startingCane,
      deodorantCount: this.shopLoadout.startingDeodorant,
      credits: this.shopLoadout.startingCredits,
      makeupShieldTimer: 0,
      shieldHits: 0,
      bagSkillCooldown: 0,
      strengthBuffTimer: 0,
      rageTimer: 0,
      rageNotificationTimer: 0,
      specialEnergy: this.shopLoadout.startingEnergy,
      speedBoostTimer: this.shopLoadout.startingSpeedBonus,
      score: 0,
      hitsLanded: 0,
      bestHitChain: 0,
      enemiesDefeated: 0,
      comboStreak: 0,
      comboMultiplier: 1,
      headphoneWhipUsed: false,
    };
  }

  public refreshShopLoadout() {
    this.shopLoadout = getActiveShopLoadout();
    this.pushHudSnapshot();
  }

  private loadLine(idx: number, fullReset: boolean) {
    this.staticRenderedState = null;
    this.currentLineIdx = idx;
    this.line = BUS_LINES[idx];
    this.enemies = [];
    this.drops = [];
    this.projectiles = [];
    this.soundRingHits.clear();
    this.hazards = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bossFinisherEffects = [];
    this.impactFlashes = [];
    this.groundShockwaves = [];
    this.bossKoOverlay = null;
    this.pendingBossSpawns = [];
    this.bossFinisherState = null;
    this.camX = 0;
    this.comboTintTimer = 0;
    this.comboFlickerTimer = 0;
    this.comboFlickerIntensity = 0;
    this.comboEdgeFlashTimer = 0;
    this.comboEdgeFlashStrength = 0;
    this.comboEdgeParticles = [];
    this.specialReadyParticles = [];
    this.specialReadySpawnAcc = 0;
    this.hitstopTimer = 0;
    this.hitstopFrames = 0;
    this.comboFinisherSlowTimer = 0;
    this.comboFinisherSlowMax = 0.085;
    this.comboFinisherSlowMinScale = 0.52;
    this.bossBulletTimeTimer = 0;
    this.bossKoFlashTimer = 0;
    this.bossKoTrailTimer = 0;
    this.specialLightTimer = 0;
    if (fullReset) {
      this.runElapsedSeconds = 0;
      this.caneHintTimer = 0;
      this.shieldBreakHintTimer = 0;
      this.player.headphoneWhipUsed = false;
      this.lastBossFinisherKind = null;
    }
    this.player.hitsLanded = 0;
    this.hitChainTimer = 0;
    this.ticketValidated = false;
    this.turnstileCleared = false;
    this.turnstileCrossed = false;
    this.turnstileSpinTimer = 0;
    this.stopButtonCooldown = 0;
    this.shortCircuitTimer = 0;
    this.graffitiSeed = Math.floor(Math.random() * 900000) + 1000;
    this.deodorantBackupTimer = 0;
    this.busEventCooldown = 12;
    this.busEventState = 'none';
    this.busEventWarnTimer = 0;
    this.busEventStep = 0;
    this.busSlideVx = 0;
    this.busCurveVy = 0;
    this.expressWindTimer = 0;
    this.usedSeatSlots.clear();
    this.seatRestHoldTimer = 0;
    this.damageTakenThisLine = false;

    this.waves =
      this.gameMode === 'infinite'
        ? []
        : this.line.waves.map((w) => ({
            ...w,
            triggered: false,
            cleared: false,
          }));

    this.player.x = this.fiscalChasing ? 128 : 85;
    this.player.y = 190;
    this.player.z = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.facing = 1;
    this.setPlayerAnim('idle', 0);
    this.lastComboAttackAnim = 'idle';
    this.activeAttackPrevAnim = 'idle';
    this.caneSpinVisual = false;
    this.attackActiveTicks = 0;
    this.perfectHitTimer = 0;
    this.airAttackUsed = false;
    this.levelClearTransition = null;
    this.clearBufferedComboInput();
    this.player.stickySlowTimer = 0;
    this.player.bagSkillCooldown = 0;

    if (fullReset) {
      this.fiscalChasing = false;
      this.player.x = 85;
      this.player.rageTimer = 0;
      this.player.rageNotificationTimer = 0;
      this.runBadges.clear();
      this.achievementQueue = [];
      this.activeAchievementToast = null;
      this.achievementToastTimer = 0;
      this.bagParryCount = 0;
      this.railSpinKoCount = 0;
      this.transitionPerksBought.clear();
      this.skippedValidationAnyLine = false;
    } else {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    }

    recordHighestLineMilestone(this.line.lineNumber);
    if (this.line.lineNumber >= 3) {
      this.unlockAchievement('chegar_linha_3');
    }

    if (this.gameMode === 'infinite') {
      this.showAlert(`HORA DO RUSH · ONDA 1`, 2.2);
    } else if (this.fiscalChasing) {
      this.showAlert('FISCAL ATRÁS DE VOCÊ!', 2.8);
      audio.playWhistle();
      const fiscal = this.spawnEnemy('fiscal', 24, 192, true);
      fiscal.facing = 1;
      fiscal.speechText = 'CADÊ O BILHETE?!';
      fiscal.speechTimer = 2.6;
    }

    this.pushHudSnapshot();
  }

  public startNewGame(mode: GameMode = 'campaign') {
    this.gameMode = mode;
    this.infiniteWave = 1;
    this.infiniteTimeLeft = 75;
    this.infiniteThemeLineIdx = 0;
    this.hitChainTimer = 0;
    this.victoryPoseCycle = 0;
    this.dailyRunCounted = false;
    this.heldKeys.clear();
    this.resetPlayer();
    this.loadLine(0, true);
    this.introTimer = 0;
    if (mode === 'infinite') {
      this.gameState = 'PLAYING';
      this.spawnInfiniteWave(1);
    } else {
      this.gameState = 'INTRO_SCENE';
    }
    this.pushHudSnapshot();
  }

  public skipIntro() {
    if (this.gameState !== 'INTRO_SCENE') return;
    this.heldKeys.clear();
    this.gameState = 'PLAYING';
    this.showAlert(this.line.title.toUpperCase(), 2.2);
    this.pushHudSnapshot();
  }

  public completeVictoryScene() {
    if (this.gameState !== 'VICTORY_SCENE') return;
    this.heldKeys.clear();
    this.gameState = 'VICTORY';
    this.pushHudSnapshot();
  }

  public continueToNextLine() {
    if (this.currentLineIdx < BUS_LINES.length - 1) {
      this.loadLine(this.currentLineIdx + 1, false);
      this.gameState = 'PLAYING';
      this.pushHudSnapshot();
    }
  }

  public buyTransitPerk(perk: 'coffee' | 'deodorant' | 'shield') {
    if (this.gameState !== 'LINE_TRANSITION') return;
    if (this.transitionPerksBought.has(perk)) return;

    const p = this.player;
    const cost = perk === 'coffee' ? 1 : 2;
    if (p.credits < cost) return;

    if (perk === 'coffee') {
      p.credits -= cost;
      p.hp = Math.min(p.maxHp, p.hp + 30);
      audio.playHeal();
    } else if (perk === 'deodorant') {
      if (p.deodorantCount >= 4) return;
      p.credits -= cost;
      p.deodorantCount = Math.min(4, p.deodorantCount + 1);
      audio.playPickup();
    } else if (perk === 'shield') {
      p.credits -= cost;
      p.makeupShieldTimer = Math.max(p.makeupShieldTimer, 15 + this.shopLoadout.buffDurationBonus);
      p.shieldHits = 5;
      audio.playMakeup();
    }

    this.transitionPerksBought.add(perk);
    this.pushHudSnapshot();
  }

  public setPaused(paused: boolean) {
    if (paused && this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.heldKeys.clear();
      this.pushHudSnapshot();
    } else if (!paused && this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.pushHudSnapshot();
    }
  }

  public returnToTitle() {
    this.heldKeys.clear();
    this.gameMode = 'campaign';
    this.infiniteWave = 1;
    this.infiniteTimeLeft = 75;
    this.achievementQueue = [];
    this.activeAchievementToast = null;
    this.achievementToastTimer = 0;
    this.resetPlayer();
    this.loadLine(0, true);
    this.gameState = 'TITLE_MENU';
    this.pushHudSnapshot();
  }

  public setVirtualMove(x: number, y: number) {
    this.virtualMove = { x, y };
  }

  public triggerAction(action: ActionKey) {
    if (this.gameState !== 'PLAYING' || this.bossFinisherState || this.levelClearTransition) return;

    const p = this.player;
    const isAttacking =
      p.anim === 'punch1' ||
      p.anim === 'punch2' ||
      p.anim === 'punch3' ||
      p.anim === 'heavyPunch' ||
      p.anim === 'cane' ||
      p.anim === 'kick' ||
      p.anim === 'kickFinisher' ||
      p.anim === 'jumpPunch' ||
      p.anim === 'jumpKick' ||
      p.anim === 'railSpin' ||
      p.anim === 'railSlam' ||
      p.anim === 'bagSpin' ||
      p.anim === 'special' ||
      p.anim === 'soundSpecial' ||
      p.anim === 'headphoneWhip' ||
      p.anim === 'spray';

    if (p.anim === 'hurt' || p.anim === 'knockdown') {
      this.clearBufferedComboInput();
      return;
    }
    if (this.isVictoryAnim(p.anim)) {
      if (p.animTimer > 0.6) return;
      this.setPlayerAnim('idle', 0);
    }

    const standingOnSeat = Boolean(
      this.getEmptySeatUnderPlayer(156) && Math.abs(p.z - 24) <= 2
    );
    const isGrounded = p.z === 0 || standingOnSeat;

    if (action === 'bagGuard') {
      if (p.anim === 'bagGuard') {
        this.triggerBagCounterSpin(false);
        return;
      }
      if (p.bagSkillCooldown > 0) {
        return;
      }
      if (isAttacking) {
        const canBufferFromGround =
          isGrounded &&
          p.anim !== 'special' &&
          p.anim !== 'soundSpecial' &&
          p.anim !== 'railSlam' &&
          p.anim !== 'jumpKick' &&
          p.anim !== 'jumpPunch';
        if (canBufferFromGround) {
          this.bufferedAction = 'bagGuard';
          this.bufferTimer = Math.max(0.28, p.animTimer + 0.16);
        }
        return;
      }
      this.setPlayerAnim('bagGuard', 0.52);
      p.bagSkillCooldown = 2.0;
      p.attackHasHit = false;
      this.clearBufferedComboInput();
      audio.playBagGuard();
      this.spawnParticles(p.x + p.facing * 10, p.y, p.z + 18, '#38bdf8', 8);
      this.pushHudSnapshot();
      return;
    }

    if (action === 'use') {
      if (this.tryValidateTicket()) return;
      if (this.tryActivateStopButton()) return;
      if (p.deodorantCount > 0 && !isAttacking) {
        this.performSpray();
        return;
      }
      return;
    }

    if (action === 'jump') {
      if (isGrounded && !isAttacking) {
        this.clearBufferedComboInput();
        p.vz = 265;
        this.airAttackUsed = false;
        this.setPlayerAnim('jump', 0);
        this.seatRestHoldTimer = 0;
        audio.playJump();
      } else if (p.z > 10 && p.anim !== 'railGrab' && p.anim !== 'railSpin' && !isAttacking) {
        // Grab onto the yellow strap hanging from the horizontal overhead bar!
        this.clearBufferedComboInput();
        this.airAttackUsed = false;
        this.setPlayerAnim('railGrab', 0.7);
        p.z = Math.max(p.z, Math.min(62, Math.max(36, p.y - 138)));
        p.vz = 0;
        p.invulnTimer = Math.max(p.invulnTimer, 0.35);
        audio.playRailGrab();
        this.spawnParticles(p.x, p.y, p.z + 24, '#facc15', 8);
      }
      return;
    }

    const hasPowerBuff = p.strengthBuffTimer > 0 || p.rageTimer > 0;
    if (
      hasPowerBuff &&
      !isAttacking &&
      ((p.anim === 'railGrab' &&
        (action === 'kick' ||
          action === 'special' ||
          (action === 'punch' &&
            (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown'))))) ||
        (p.z > 12 && p.anim !== 'railGrab' && action === 'special'))
    ) {
      this.triggerRailSlam();
      return;
    }

    if (action === 'special') {
      if (p.specialEnergy >= 100 && !isAttacking) {
        this.clearBufferedComboInput();
        p.specialEnergy = 0;
        this.setPlayerAnim('soundSpecial', 0.42);
        p.attackHasHit = false;
        p.invulnTimer = 0.48;
        this.hitstopTimer = 0.052;
        this.specialLightMax = 0.52;
        this.specialLightTimer = 0.52;
        this.specialLightColor = '#38bdf8';
        audio.playSoundWave();
        vibrateSpecial('sound');
        this.triggerShake(0.36, 7);
        this.spawnParticles(p.x, p.y, p.z + 18, '#38bdf8', 24);
        this.spawnParticles(p.x, p.y, p.z + 18, '#facc15', 16);
        this.spawnGroundShockwave(p.x, p.y, 44, '#38bdf8', true);
        const ringRadius = Math.round(36 * (1 + this.shopLoadout.specialReachBonus));
        for (const dir of [-1, 1] as const) {
          this.projectiles.push({
            id: this.nextId++,
            kind: 'sound_ring',
            fromPlayer: true,
            x: p.x + dir * 16,
            y: p.y,
            z: p.z + 18,
            vx: dir * 210,
            vy: 0,
            vz: 0,
            damage: Math.round(20 * (1 + this.shopLoadout.damageMultBonus)),
            life: 0.72,
            radius: ringRadius,
          });
        }
        this.pushHudSnapshot();
        this.trackDailyMission('use_special', 1);
      } else if (p.hp > 10 && !isAttacking) {
        this.clearBufferedComboInput();
        p.hp = Math.max(1, p.hp - 8);
        this.resetComboStreak();
        this.setPlayerAnim('special', 0.46);
        p.attackHasHit = false;
        p.invulnTimer = 0.48;
        this.specialLightMax = 0.48;
        this.specialLightTimer = 0.48;
        this.specialLightColor = '#facc15';
        if (p.z === 0) {
          p.z = 6;
          p.vz = 155;
        } else {
          p.vz = Math.max(p.vz, 65);
        }
        audio.playSpecial();
        vibrateSpecial('health');
        this.triggerShake(0.28, 5.5);
        this.spawnParticles(p.x, p.y, p.z + 16, '#facc15', 18);
        this.spawnParticles(p.x, p.y, p.z + 16, '#22c55e', 10);
        this.pushHudSnapshot();
        this.trackDailyMission('use_special', 1);
      }
      return;
    }

    if (p.anim === 'bagGuard' && (action === 'kick' || action === 'punch')) {
      this.triggerBagCounterSpin(false);
      return;
    }

    if (p.anim === 'railGrab' && (action === 'kick' || action === 'punch')) {
      this.clearBufferedComboInput();
      this.setPlayerAnim('railSpin', 0.38);
      p.attackHasHit = false;
      p.invulnTimer = Math.max(p.invulnTimer, 0.35);
      audio.playKick();
      vibrateSpecial('bagSpin');
      this.spawnParticles(p.x, p.y, p.z + 12, '#38bdf8', 12);
      this.trackDailyMission('rail_spins', 1);
      return;
    }

    if (p.z > 0 && !standingOnSeat && (action === 'kick' || action === 'punch')) {
      if (
        !this.airAttackUsed &&
        p.anim !== 'jumpKick' &&
        p.anim !== 'jumpPunch' &&
        p.anim !== 'railSpin' &&
        !isAttacking
      ) {
        this.airAttackUsed = true;
        this.clearBufferedComboInput();
        if (action === 'punch') {
          this.setPlayerAnim('jumpPunch', 0.30);
          p.vz = Math.max(p.vz, 175);
          p.attackHasHit = false;
          audio.playPunch();
        } else {
          this.setPlayerAnim('jumpKick', 0.36);
          p.attackHasHit = false;
          audio.playKick();
          if (this.hasNearbyActiveBoss(195)) {
            this.bossBulletTimeTimer = Math.max(this.bossBulletTimeTimer, 0.56);
            p.vz = Math.max(p.vz, 58);
          }
        }
      }
      return;
    }

    if (isAttacking) {
      const canBufferCombo =
        isGrounded &&
        (action === 'punch' || action === 'kick') &&
        p.anim !== 'special' &&
        p.anim !== 'soundSpecial' &&
        p.anim !== 'railSlam' &&
        p.anim !== 'jumpKick' &&
        p.anim !== 'jumpPunch' &&
        p.anim !== 'railSpin' &&
        p.anim !== 'bagSpin' &&
        p.anim !== 'spray' &&
        p.anim !== 'headphoneWhip';
      if (canBufferCombo) {
        this.bufferedAction = action;
        this.bufferTimer = Math.max(0.28, p.animTimer + 0.16);
      }
      return;
    }

    this.executeGroundAttack(action);
  }

  private triggerBagCounterSpin(fromParry: boolean) {
    const p = this.player;
    this.setPlayerAnim('bagSpin', 0.36);
    p.attackHasHit = false;
    p.invulnTimer = Math.max(p.invulnTimer, 0.44);
    if (fromParry) {
      p.bagSkillCooldown = Math.min(p.bagSkillCooldown, 0.9);
      this.addSpecialEnergy(16);
      p.score += 100;
      this.bagParryCount++;
      this.trackDailyMission('bag_parries', 1);
      audio.playBlock();
      this.impactFlashes.push({
        x: p.x + p.facing * 10,
        y: p.y - p.z - 20,
        life: 0.14,
        maxLife: 0.14,
        strong: true,
        kind: 'blocked',
        dir: p.facing,
      });
      this.spawnHitSparks(p.x + p.facing * 10, p.y, p.z + 20, p.facing, {
        target: 'barrier',
        strong: true,
        blocked: true,
        attackType: 'blocked',
      });
      if (this.bagParryCount >= 3) {
        this.unlockAchievement('ninja_mochila');
      }
    }
    audio.playBagSpin();
    vibrateSpecial('bagSpin');
    this.spawnParticles(p.x, p.y, p.z + 16, '#38bdf8', 14);
    this.pushHudSnapshot();
  }

  private triggerRailSlam() {
    const p = this.player;
    this.setPlayerAnim('railSlam', 0.55);
    p.z = Math.max(p.z, 46);
    p.vz = -430;
    p.attackHasHit = false;
    p.invulnTimer = Math.max(p.invulnTimer, 0.55);
    this.clearBufferedComboInput();
    audio.playSpecial();
    vibrateSpecial('slam');
    this.spawnParticles(p.x, p.y, p.z + 18, p.rageTimer > 0 ? '#ef4444' : '#facc15', 10);
    this.trackDailyMission('rail_spins', 1);
  }

  private resolveRailSlamImpact() {
    const p = this.player;
    p.attackHasHit = true;

    const strMult = p.strengthBuffTimer > 0 ? 2 : 1;
    const rageMult = p.rageTimer > 0 ? 1.5 : 1;
    const shopDamageMult = 1 + this.shopLoadout.damageMultBonus;
    const damage = Math.round(28 * strMult * rageMult * shopDamageMult);
    const reachX = 96;
    const laneTol = 46;

    audio.playBusBump();
    audio.playHeavyHit();
    audio.playMetallicImpact(true);
    vibrateSpecial('slam');
    this.hitstopTimer = 0.065;
    this.triggerShake(0.26, 6);

    this.impactFlashes.push({
      x: p.x,
      y: p.y - 6,
      life: 0.22,
      maxLife: 0.22,
      strong: true,
      kind: 'finisher',
      dir: p.facing,
    });
    this.spawnGroundShockwave(p.x, p.y, 48, p.rageTimer > 0 ? '#ef4444' : '#facc15', true);
    this.spawnParticles(p.x, p.y, 6, '#fde047', 12);
    this.spawnParticles(p.x, p.y, 8, p.rageTimer > 0 ? '#ef4444' : '#f97316', 10);
    this.spawnHitSparks(p.x, p.y, 6, p.facing, {
      target: 'turnstile_boss',
      strong: true,
      finisher: true,
      attackType: 'finisher',
    });

    let hitCount = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = Math.abs(e.y - p.y);
      if (Math.abs(dx) > reachX || dy > laneTol) continue;

      if (e.type === 'industria' && e.stinkActive) {
        e.stinkActive = false;
      }

      e.hp -= damage;
      e.hitFlashTimer = 0.18;
      e.aiState = 'hurt';
      e.stateTimer = 0.52;
      const kbDir = dx >= 0 ? 1 : -1;
      e.vx = kbDir * 185;
      e.vz = e.isBoss ? 110 : 165;
      e.z = Math.max(e.z, 2);
      hitCount++;

      this.impactFlashes.push({
        x: e.x - kbDir * 5,
        y: e.y - e.z - 22,
        life: 0.16,
        maxLife: 0.16,
        strong: true,
        kind: 'finisher',
        dir: kbDir as 1 | -1,
      });
      this.spawnHitSparks(e.x - kbDir * 5, e.y, e.z + 20, kbDir, {
        target: e.isBoss ? 'turnstile_boss' : 'passenger',
        bossType: e.type,
        strong: true,
        finisher: true,
        attackType: 'finisher',
      });
      this.addFloatingText(`-${damage}`, e.x, e.y, e.z + 36, '#fde047');
      p.score += damage * 3;

      if (e.hp <= 0) {
        this.handleEnemyDefeated(e);
      } else {
        this.checkBossHalfHpTaunt(e);
      }
    }

    if (hitCount > 0) {
      this.registerHitChain(hitCount);
      this.addSpecialEnergy(14);
      this.comboFlickerIntensity = 1;
      this.comboFlickerTimer = Math.max(this.comboFlickerTimer, 1.0);
    }
    this.pushHudSnapshot();
  }

  private executeGroundAttack(action: ActionKey) {
    const p = this.player;
    if (p.anim === 'hurt' || p.anim === 'knockdown') return;
    const standingOnSeat = Boolean(
      this.getEmptySeatUnderPlayer(156) && Math.abs(p.z - 24) <= 2
    );
    if (p.z > 0 && !standingOnSeat) return;

    if (action === 'punch') {
      if (p.comboMultiplier >= 7 && !p.headphoneWhipUsed) {
        p.headphoneWhipUsed = true;
        this.setPlayerAnim('headphoneWhip', 0.38);
        p.attackHasHit = false;
        audio.playRockWhip();
        this.spawnParticles(p.x + p.facing * 24, p.y, p.z + 24, '#fde047', 4);
        this.pushHudSnapshot();
      } else if (p.caneCharges > 0) {
        this.setPlayerAnim('cane', 0.28);
        p.attackHasHit = false;
        audio.playCaneHit();
      } else {
        if (p.comboResetTimer > 0) {
          p.comboStep = ((p.comboStep + 1) % 3) as 0 | 1 | 2;
        } else {
          p.comboStep = 0;
        }
        if (p.comboStep === 2) {
          this.setPlayerAnim('heavyPunch', 0.44);
          p.comboResetTimer = 0;
          p.comboStep = 0;
          p.attackHasHit = false;
        } else {
          this.setPlayerAnim(p.comboStep === 0 ? 'punch1' : 'punch2', p.comboStep === 0 ? 0.22 : 0.24);
          p.comboResetTimer = 0.54;
          p.attackHasHit = false;
          audio.playPunch();
        }
      }
    } else if (action === 'kick') {
      if (p.comboResetTimer > 0) {
        this.setPlayerAnim('kickFinisher', 0.38);
        p.comboResetTimer = 0;
        p.comboStep = 0;
        p.attackHasHit = false;
        audio.playKick();
      } else {
        this.setPlayerAnim('kick', 0.28);
        p.comboStep = 0;
        p.comboResetTimer = 0.54;
        p.attackHasHit = false;
        audio.playKick();
      }
    }
  }

  private getEffectiveTicketCost(): number {
    return Math.max(1, this.line.ticketCost - this.shopLoadout.ticketDiscount);
  }

  private isNearValidator(): boolean {
    return (
      !this.ticketValidated &&
      Math.abs(this.player.x - this.line.validatorX) < 44
    );
  }

  private tryValidateTicket(): boolean {
    if (!this.isNearValidator()) return false;
    const p = this.player;
    const cost = this.getEffectiveTicketCost();
    if (p.credits >= cost) {
      p.credits -= cost;
      this.ticketValidated = true;
      p.score += 300;
      this.addSpecialEnergy(18);
      audio.playValidate();
      this.spawnParticles(this.line.validatorX, 155, 25, '#10b981', 16);
      if (!this.damageTakenThisLine) {
        this.unlockAchievement('validar_sem_dano');
      }
      this.trackDailyMission('validate_tickets', 1);
      this.pushHudSnapshot();
      return true;
    } else {
      audio.playBlock();
      return true;
    }
  }

  private isNearStopButton(): boolean {
    return this.stopButtonCooldown <= 0 && Math.abs(this.player.x - this.line.stopCordX) < 40;
  }

  private tryActivateStopButton(): boolean {
    if (!this.isNearStopButton()) return false;
    const p = this.player;
    this.stopButtonCooldown = 16;
    audio.playStopBell();
    audio.playBusBrake();
    this.triggerShake(0.38, 6);
    this.spawnParticles(this.line.stopCordX, 150, 26, '#ef4444', 14);
    let hit = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (Math.abs(e.x - this.line.stopCordX) < 200) {
        e.hp -= 12;
        e.hitFlashTimer = 0.18;
        e.aiState = 'hurt';
        e.stateTimer = 0.72;
        e.vx = -170;
        hit++;
        this.spawnHitSparks(e.x, e.y, e.z + 18, -1, {
          target: e.isBoss ? 'turnstile_boss' : 'passenger',
          strong: true,
        });
        this.addFloatingText('-12', e.x, e.y, e.z + 36, '#fde047');
        p.score += 40;
        if (e.hp <= 0) {
          this.handleEnemyDefeated(e);
        } else {
          this.checkBossHalfHpTaunt(e);
        }
      }
    }
    if (hit > 0) {
      this.registerHitChain(hit);
      this.addSpecialEnergy(12);
      audio.playMetallicImpact(true);
    }
    this.pushHudSnapshot();
    return true;
  }

  private performSpray() {
    const p = this.player;
    p.deodorantCount = Math.max(0, p.deodorantCount - 1);
    this.setPlayerAnim('spray', 0.28);
    p.attackHasHit = false;
    audio.playSpray();

    this.projectiles.push({
      id: this.nextId++,
      kind: 'spray_cloud',
      fromPlayer: true,
      x: p.x + p.facing * 20,
      y: p.y,
      z: p.z + 18,
      vx: p.facing * 120,
      vy: 0,
      vz: 0,
      damage: 8,
      life: 0.45,
      radius: 36,
    });

    for (const e of this.enemies) {
      if (
        e.type === 'industria' &&
        e.stinkActive &&
        Math.abs(e.x - p.x) < 88 &&
        Math.abs(e.y - p.y) < 36
      ) {
        e.stinkActive = false;
        e.hitFlashTimer = 0.2;
        e.aiState = 'hurt';
        e.stateTimer = 0.45;
        p.score += 150;
        this.registerHitChain(1);
        this.spawnParticles(e.x, e.y, e.z + 20, '#38bdf8', 18);
      }
    }
    this.pushHudSnapshot();
  }

  private registerHitChain(count: number) {
    if (count <= 0) return;
    this.player.hitsLanded += count;
    if (this.player.hitsLanded > this.player.bestHitChain) {
      this.player.bestHitChain = this.player.hitsLanded;
    }
    this.hitChainTimer = 3.2;
    this.trackDailyMission('reach_combo', this.player.comboStreak);
  }

  private isReducedMotionPreferred(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private triggerComboImpact(multiplier: number) {
    const overTen = Math.max(1, multiplier - 10);
    this.comboEdgeFlashMax = 0.38;
    this.comboEdgeFlashTimer = this.comboEdgeFlashMax;
    this.comboEdgeFlashStrength = Math.min(1.4, 0.85 + overTen * 0.09);

    if (this.isReducedMotionPreferred()) {
      return;
    }

    const palette = ['#facc15', '#38bdf8', '#fb7185', '#f97316', '#fef08a'];
    const burstCount = Math.min(36, 22 + overTen * 2);

    for (let i = 0; i < burstCount; i++) {
      const edge = i % 4;
      const color = palette[(i + multiplier) % palette.length];
      const maxLife = 0.34 + Math.random() * 0.28;
      const size = 1.4 + Math.random() * 1.7;
      let x = 0;
      let y = 0;
      let vx = 0;
      let vy = 0;

      if (edge === 0) {
        // Top border -> burst inward & diagonally
        x = 8 + Math.random() * (INTERNAL_WIDTH - 16);
        y = 1 + Math.random() * 3;
        vx = (Math.random() - 0.5) * 95;
        vy = 45 + Math.random() * 95;
      } else if (edge === 1) {
        // Bottom border -> burst inward & diagonally
        x = 8 + Math.random() * (INTERNAL_WIDTH - 16);
        y = INTERNAL_HEIGHT - 1 - Math.random() * 3;
        vx = (Math.random() - 0.5) * 95;
        vy = -(45 + Math.random() * 95);
      } else if (edge === 2) {
        // Left border -> burst inward
        x = 1 + Math.random() * 3;
        y = 8 + Math.random() * (INTERNAL_HEIGHT - 16);
        vx = 55 + Math.random() * 115;
        vy = (Math.random() - 0.5) * 75;
      } else {
        // Right border -> burst inward
        x = INTERNAL_WIDTH - 1 - Math.random() * 3;
        y = 8 + Math.random() * (INTERNAL_HEIGHT - 16);
        vx = -(55 + Math.random() * 115);
        vy = (Math.random() - 0.5) * 75;
      }

      this.comboEdgeParticles.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx,
        vy,
        life: maxLife,
        maxLife,
        size,
        color,
      });
    }

    if (this.comboEdgeParticles.length > 96) {
      this.comboEdgeParticles.splice(0, this.comboEdgeParticles.length - 96);
    }
  }

  private updatePlayerSpecialElectricParticles(dt: number) {
    const p = this.player;
    const isSpecialReady =
      this.gameState === 'PLAYING' &&
      p.specialEnergy >= 100 &&
      !this.isVictoryAnim(p.anim) &&
      !this.levelClearTransition;
    const reduced = this.isReducedMotionPreferred();

    if (isSpecialReady) {
      const spawnRate = reduced ? 4.5 : 16;
      const maxPool = reduced ? 4 : 9;
      this.specialReadySpawnAcc += dt * spawnRate;
      const palette = ['#38bdf8', '#67e8f9', '#7dd3fc', '#fef08a'];

      while (this.specialReadySpawnAcc >= 1) {
        this.specialReadySpawnAcc -= 1;
        if (this.specialReadyParticles.length >= maxPool) {
          this.specialReadyParticles.shift();
        }
        const side = Math.random() < 0.5 ? -1 : 1;
        const ox = side * (8 + Math.random() * 10);
        const oz = 5 + Math.random() * 29;
        const kind: 'spark' | 'arc' =
          !reduced && Math.random() < 0.44 ? 'arc' : 'spark';
        const maxLife = reduced
          ? 0.45 + Math.random() * 0.25
          : 0.2 + Math.random() * 0.16;

        this.specialReadyParticles.push({
          ox,
          oz,
          vx: side * (4 + Math.random() * 10),
          vz: 14 + Math.random() * 22,
          life: maxLife,
          maxLife,
          kind,
          seed: Math.random() * Math.PI * 2,
          front: Math.random() < 0.55,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    } else {
      this.specialReadySpawnAcc = 0;
    }

    for (let i = this.specialReadyParticles.length - 1; i >= 0; i--) {
      const sp = this.specialReadyParticles[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.specialReadyParticles.splice(i, 1);
        continue;
      }
      if (!reduced) {
        sp.ox += sp.vx * dt;
        sp.oz += sp.vz * dt;
        sp.vx *= Math.exp(-3.4 * dt);
      }
    }
  }

  private drawPlayerSpecialElectricParticles(ctx: CanvasRenderingContext2D, front: boolean) {
    if (this.specialReadyParticles.length === 0) return;

    const pxBase = this.player.x - this.camX;
    const pyBase = this.player.y - this.player.z;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const sp of this.specialReadyParticles) {
      if (sp.front !== front) continue;
      const lifeRatio = Math.max(0, Math.min(1, sp.life / sp.maxLife));
      const alpha = Math.sin(lifeRatio * Math.PI) * 0.88;
      if (alpha <= 0.03) continue;

      const sx = pxBase + sp.ox;
      const sy = pyBase - sp.oz;

      if (sp.kind === 'arc') {
        const ang = sp.seed + (1 - lifeRatio) * 1.4;
        const len = 3.2 + Math.sin(sp.seed * 3) * 1.1;
        const midJitter = ((Math.floor(this.simTime * 28 + sp.seed * 5) % 2) * 2 - 1) * 1.8;
        const x1 = sx + Math.cos(ang) * len;
        const y1 = sy + Math.sin(ang) * len + midJitter;
        const x2 = x1 + Math.cos(ang + 0.85) * (len * 0.9);
        const y2 = y1 + Math.sin(ang + 0.85) * (len * 0.9) - midJitter * 0.6;

        // Subtle dark-cyan contrast edge so electric arcs read cleanly over any background
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.94;
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = 1.35;
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha * 0.34;
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha * 0.96;
        ctx.fillStyle = sp.color;
        ctx.fillRect(sx - 0.8, sy - 0.8, 1.6, 1.6);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 0.45, sy - 0.45, 0.9, 0.9);
      }
    }

    ctx.restore();
  }

  private trackDailyMission(type: DailyMissionEventType, value = 1) {
    const res = recordDailyMissionEvent(type, value);
    if (res.newlyCompleted.length > 0) {
      audio.playValidate();
    }
  }

  private showAlert(msg: string, duration = 2.4) {
    this.alertMessage = msg;
    this.alertTimer = duration;
  }

  private unlockAchievement(id: AchievementBadgeId) {
    this.runBadges.add(id);
    const { unlockedNow } = unlockPersistentAchievement(id);
    if (!unlockedNow) return;
    const meta = BADGE_META[id];
    const notice: AchievementUnlockNotice = {
      uid: this.achievementToastSeq++,
      id,
      label: meta.label,
      description: meta.description,
    };
    this.achievementQueue.push(notice);
    if (!this.activeAchievementToast) {
      this.activeAchievementToast = this.achievementQueue.shift() ?? null;
      this.achievementToastTimer = 3.5;
    }
    audio.playPickup();
    this.pushHudSnapshot();
  }

  private updateAchievementToast(dt: number) {
    if (
      this.gameState === 'TITLE_MENU' ||
      this.gameState === 'INTRO_SCENE' ||
      this.gameState === 'PAUSED'
    ) {
      return;
    }
    if (this.activeAchievementToast) {
      this.achievementToastTimer -= dt;
      if (this.achievementToastTimer <= 0) {
        const next = this.achievementQueue.shift() ?? null;
        this.activeAchievementToast = next;
        this.achievementToastTimer = next ? 3.5 : 0;
        this.pushHudSnapshot();
      }
    } else if (this.achievementQueue.length > 0) {
      this.activeAchievementToast = this.achievementQueue.shift() ?? null;
      this.achievementToastTimer = 3.5;
      this.pushHudSnapshot();
    }
  }

  private spawnEnemy(
    type: EnemyType,
    x: number,
    y: number,
    isChaser = false,
    guaranteedDrop?: ItemType
  ): EnemyEntity {
    const diff = LINE_DIFFICULTY[this.line.lineNumber];
    const infScale = this.gameMode === 'infinite' ? 1 + (this.infiniteWave - 1) * 0.08 : 1;
    const hpMult = diff.hpMult * infScale;
    const bossHpMult = diff.bossHpMult * infScale;
    const stats: Record<
      EnemyType,
      { name: string; hp: number; barrier: boolean; guardMax: number; stink: boolean; boss: boolean }
    > = {
      idosa: { name: 'Idosa Chata', hp: Math.max(20, Math.round(44 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      vendedor: { name: 'Vendedor Ambulante', hp: Math.max(22, Math.round(48 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      estudante: { name: 'Estudante Mochilão', hp: Math.max(28, Math.round(62 * hpMult)), barrier: true, guardMax: 3, stink: false, boss: false },
      patricinha: { name: 'Patricinha', hp: Math.max(26, Math.round(54 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      industria: { name: 'Operário Indústria', hp: Math.max(40, Math.round(80 * hpMult)), barrier: false, guardMax: 2, stink: true, boss: false },
      fiscal: { name: 'Fiscal', hp: Math.max(50, Math.round(95 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      tio_audio: { name: 'Tio do Áudio Alto', hp: Math.max(24, Math.round(52 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      skatista: { name: 'Skatista Apressado', hp: Math.max(26, Math.round(56 * hpMult)), barrier: false, guardMax: 0, stink: false, boss: false },
      boss_cobrador: { name: 'Cobrador da Catraca', hp: Math.round((this.currentLineIdx === 0 ? 200 : 250) * bossHpMult), barrier: false, guardMax: 0, stink: false, boss: true },
      boss_motorista: { name: 'Motorista Furioso', hp: Math.round(210 * bossHpMult), barrier: false, guardMax: 0, stink: false, boss: true },
      boss_cobrador_blindado: { name: 'Cobrador Blindado', hp: Math.round(320 * bossHpMult), barrier: false, guardMax: 6, stink: false, boss: true },
      boss_fiscal_chefe: { name: 'Fiscal Chefe', hp: Math.round(230 * 0.88 * bossHpMult), barrier: false, guardMax: 0, stink: false, boss: true },
    };

    const initialSpeech: Partial<Record<EnemyType, string>> = {
      idosa: 'Eu quero ir pra Lapa!',
      vendedor: 'Cuidado com o rapa!',
      estudante: 'Olha o SENAI!',
      tio_audio: 'AUMENTA O SOM AÍ!',
      skatista: 'SAI DA FRENTE!',
      boss_motorista: 'DESCE PELA TRASEIRA!!',
    };
    const spawnSpeech = !isChaser ? initialSpeech[type] ?? '' : '';

    const st = stats[type];
    const enemy: EnemyEntity = {
      id: this.nextId++,
      type,
      name: st.name,
      x,
      y: Math.max(AISLE_MIN_Y, Math.min(AISLE_MAX_Y, y)),
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: -1, // always faces left toward the approaching player
      hp: st.hp,
      maxHp: st.hp,
      aiState: 'approach',
      stateTimer: 0,
      attackCooldown: (0.7 + Math.random() * 0.6) * diff.cooldownMult,
      hitFlashTimer: 0,
      hasFrontBarrier: st.barrier,
      guardHp: st.guardMax,
      guardMax: st.guardMax,
      guardBrokenTimer: 0,
      stinkActive: st.stink,
      stinkTickTimer: 0.4,
      isBoss: st.boss,
      isChaser,
      spinTickTimer: 0,
      speechText: spawnSpeech,
      speechTimer: spawnSpeech ? 2.6 : 0,
      halfHpTauntTriggered: false,
      walkPhase: Math.random() * 6,
      guaranteedDrop,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  private spawnDrop(type: ItemType, x: number, y: number) {
    this.drops.push({
      id: this.nextId++,
      type,
      x,
      y: Math.max(AISLE_MIN_Y + 4, Math.min(AISLE_MAX_Y - 4, y)),
      z: 18,
      vz: 110,
      bobPhase: Math.random() * 4,
      life: 24,
    });
  }

  private pushParticle(pt: Particle) {
    if (this.particles.length >= 240) {
      this.particles.splice(0, this.particles.length - 239);
    }
    this.particles.push(pt);
  }

  private spawnParticles(x: number, y: number, z: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 90;
      this.pushParticle({
        x,
        y,
        z,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.35,
        vz: 40 + Math.random() * 110,
        color,
        size: Math.random() > 0.5 ? 3.5 : 2.5,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        kind: 'pixel',
      });
    }
  }

  private spawnGroundShockwave(
    x: number,
    y: number,
    radius: number,
    color: string,
    strong = false
  ) {
    if (this.groundShockwaves.length >= 10) {
      this.groundShockwaves.shift();
    }
    const maxLife = strong ? 0.24 : 0.19;
    this.groundShockwaves.push({
      x,
      y,
      life: maxLife,
      maxLife,
      radius,
      color,
      strong,
    });
  }

  private spawnHitSparks(
    x: number,
    y: number,
    z: number,
    dir: number,
    options: {
      target: 'passenger' | 'turnstile_boss' | 'barrier' | 'player';
      bossType?: EnemyType;
      strong?: boolean;
      finisher?: boolean;
      blocked?: boolean;
      attackType?: ImpactFlashKind | 'cane' | 'special';
      kickTrail?: boolean;
    }
  ) {
    const isBoss = options.target === 'turnstile_boss';
    const isBarrier = options.target === 'barrier';
    const isPlayer = options.target === 'player';
    const isBlocked = Boolean(options.blocked || options.attackType === 'blocked');
    const atk = options.attackType ?? (options.finisher ? 'finisher' : options.strong ? 'heavy' : 'jab');
    const reduced = this.isReducedMotionPreferred();
    const baseDir = dir >= 0 ? 1 : -1;

    const rawCount = isBlocked
      ? 6
      : isBoss
        ? options.finisher
          ? 16
          : options.strong
            ? 12
            : 9
        : isBarrier
          ? 8
          : isPlayer
            ? 7
            : options.finisher
              ? 13
              : options.strong
                ? 9
                : 6;
    const sparkCount = reduced ? Math.max(3, Math.round(rawCount * 0.55)) : rawCount;

    const blockedPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#e0f2fe', cool: '#0284c7' },
      { primary: '#7dd3fc', cool: '#334155' },
      { primary: '#cbd5e1', cool: '#475569' },
    ];

    const uppercutPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#fef08a', cool: '#0284c7' },
      { primary: '#38bdf8', cool: '#f97316' },
      { primary: '#fde047', cool: '#ea580c' },
    ];

    const kickPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#fde047', cool: '#f97316' },
      { primary: '#bae6fd', cool: '#0284c7' },
      { primary: '#fb923c', cool: '#dc2626' },
    ];

    const bossPalette: Array<{ primary: string; cool: string }> =
      options.bossType === 'boss_fiscal_chefe'
        ? [
            { primary: '#fde047', cool: '#ea580c' },
            { primary: '#e2e8f0', cool: '#64748b' },
            { primary: '#7dd3fc', cool: '#0284c7' },
          ]
        : [
            { primary: '#f8fafc', cool: '#64748b' },
            { primary: '#fde047', cool: '#f97316' },
            { primary: '#cbd5e1', cool: '#475569' },
            { primary: '#fb923c', cool: '#b45309' },
          ];

    const passengerPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#fde047', cool: '#ea580c' },
      { primary: '#e2e8f0', cool: '#64748b' },
      { primary: '#fb923c', cool: '#c2410c' },
    ];

    const barrierPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#e0f2fe', cool: '#0284c7' },
      { primary: '#38bdf8', cool: '#1d4ed8' },
      { primary: '#cbd5e1', cool: '#475569' },
    ];

    const playerPalette: Array<{ primary: string; cool: string }> = [
      { primary: '#fde047', cool: '#ef4444' },
      { primary: '#e2e8f0', cool: '#64748b' },
      { primary: '#fb7185', cool: '#be123c' },
    ];

    const palette = isBlocked
      ? blockedPalette
      : atk === 'uppercut'
        ? uppercutPalette
        : atk === 'kick'
          ? kickPalette
          : isBoss
            ? bossPalette
            : isBarrier
              ? barrierPalette
              : isPlayer
                ? playerPalette
                : passengerPalette;

    for (let i = 0; i < sparkCount; i++) {
      let vx = 0;
      let vy = 0;
      let vz = 0;

      if (isBlocked) {
        // Guard deflection bounces backward/outward off shield
        const spread = (Math.random() - 0.5) * 1.9;
        const angle = -baseDir > 0 ? spread : Math.PI + spread;
        const speed = 70 + Math.random() * 75;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed * 0.3;
        vz = 40 + Math.random() * 65;
      } else if (atk === 'uppercut') {
        // Rising Shoryuken dragon trajectory (strongly upward + forward tilt)
        const forward = baseDir * (28 + Math.random() * 68);
        vx = forward;
        vy = (Math.random() - 0.5) * 32;
        vz = 145 + Math.random() * 115;
      } else if (atk === 'jab') {
        // Tight directional horizontal punch cone
        const spread = (Math.random() - 0.5) * 0.95;
        const angle = baseDir > 0 ? spread : Math.PI + spread;
        const speed = 95 + Math.random() * 85;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed * 0.24;
        vz = 38 + Math.random() * 62;
      } else {
        // Heavy, kick, finisher, cane, special: strong forward blast + subtle back-ricochet
        const ricochet = isBoss || isBarrier ? Math.random() < 0.28 : Math.random() < 0.16;
        const aimDir = ricochet ? -baseDir : baseDir;
        const coneWidth = atk === 'finisher' ? 1.5 : 1.15;
        const spread = (Math.random() - 0.5) * coneWidth;
        const angle = aimDir > 0 ? spread : Math.PI + spread;
        const speed =
          (isBoss ? 115 : 92) +
          Math.random() * (options.finisher || options.strong ? 130 : 88);
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed * 0.28;
        vz = (isBoss ? 72 : 54) + Math.random() * (options.strong || isBoss ? 120 : 82);
      }

      const swatch = palette[i % palette.length];
      const maxLife =
        isBlocked
          ? 0.18 + Math.random() * 0.1
          : (isBoss ? 0.30 : 0.22) + Math.random() * (options.finisher ? 0.16 : 0.12);

      this.pushParticle({
        x: x + (Math.random() - 0.5) * 3,
        y: y + (Math.random() - 0.5) * 3,
        z: Math.max(4, z + (Math.random() - 0.5) * 5),
        vx,
        vy,
        vz,
        color: swatch.primary,
        coolColor: swatch.cool,
        size: isBoss || options.finisher || atk === 'heavy' ? (Math.random() > 0.35 ? 3 : 2.5) : 2.4,
        life: maxLife,
        maxLife,
        kind: 'spark',
        bounce: isBoss ? 0.46 : 0.36,
        drag: atk === 'uppercut' ? 1.8 : 2.3,
        gravityScale: atk === 'uppercut' ? 0.72 : 0.85,
        prevX: x,
        prevY: y,
        prevZ: z,
      });
    }

    // Short, stylized kinetic trails on ground kicks
    if (options.kickTrail && !isBlocked && !reduced) {
      const trailCount = options.finisher ? 4 : 3;
      for (let i = 0; i < trailCount; i++) {
        const arcRatio = i / Math.max(1, trailCount - 1);
        const startZ = Math.max(8, z - 6 + arcRatio * 14);
        const maxLife = 0.14 + i * 0.02;
        this.pushParticle({
          x: x - baseDir * (6 - arcRatio * 6),
          y: y + (arcRatio - 0.5) * 3,
          z: startZ,
          vx: baseDir * (145 + arcRatio * 55),
          vy: (arcRatio - 0.5) * 18,
          vz: 55 + arcRatio * 80,
          color: options.finisher ? '#fde047' : '#fef08a',
          coolColor: options.finisher ? '#f97316' : '#38bdf8',
          size: options.finisher ? 3 : 2.5,
          life: maxLife,
          maxLife,
          kind: 'kickTrail',
          drag: 3.4,
          gravityScale: 0.25,
          prevX: x - baseDir * 12,
          prevY: y,
          prevZ: Math.max(6, startZ - 4),
        });
      }
    }

    // Crisp metallic pixel shards (turnstile steel, badge/buckle chips, armor flecks)
    const rawShardCount = isBlocked
      ? 0
      : isBoss
        ? options.finisher
          ? 5
          : options.strong
            ? 3
            : 2
        : isBarrier
          ? 2
          : options.finisher || options.strong
            ? 2
            : 0;
    const shardCount = reduced ? Math.min(1, rawShardCount) : rawShardCount;

    for (let i = 0; i < shardCount; i++) {
      const aimDir = Math.random() < 0.25 ? -baseDir : baseDir;
      const spread = (Math.random() - 0.5) * 1.3;
      const angle = aimDir > 0 ? spread : Math.PI + spread;
      const speed = 78 + Math.random() * 110;
      const swatch = palette[(i + 1) % palette.length];
      const maxLife = 0.36 + Math.random() * 0.2;

      this.pushParticle({
        x,
        y,
        z: Math.max(4, z),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.3,
        vz: 85 + Math.random() * 95,
        color: isBoss && i % 2 === 0 ? '#e2e8f0' : swatch.primary,
        coolColor: '#475569',
        size: isBoss ? 3 : 2.5,
        life: maxLife,
        maxLife,
        kind: 'shard',
        bounce: 0.45,
        drag: 1.5,
        gravityScale: 0.95,
        prevX: x,
        prevY: y,
        prevZ: z,
      });
    }
  }

  private clearBufferedComboInput() {
    this.bufferedAction = null;
    this.bufferTimer = 0;
  }

  private addSpecialEnergy(amount: number) {
    if (amount <= 0) return;
    // +15% longer special charge time
    const scaled = Math.round((amount / 1.15) * 10) / 10;
    this.player.specialEnergy = Math.min(100, this.player.specialEnergy + scaled);
  }

  private isVictoryAnim(anim: PlayerAnimState): boolean {
    return (
      anim === 'victory' ||
      anim === 'victoryTie' ||
      anim === 'victoryBadge' ||
      anim === 'victoryCoffee'
    );
  }

  private pickUniqueVictoryPose(): PlayerAnimState {
    const poses: PlayerAnimState[] = ['victory', 'victoryTie', 'victoryBadge', 'victoryCoffee'];
    const pose = poses[(this.currentLineIdx + this.victoryPoseCycle) % poses.length];
    this.victoryPoseCycle++;
    return pose;
  }

  private setPlayerAnim(anim: PlayerAnimState, duration = 0) {
    const isComboMove =
      anim === 'punch1' ||
      anim === 'punch2' ||
      anim === 'heavyPunch' ||
      anim === 'kick' ||
      anim === 'kickFinisher';
    if (isComboMove) {
      const hasActiveChain =
        this.player.comboResetTimer > 0 ||
        this.player.anim === 'punch1' ||
        this.player.anim === 'punch2' ||
        this.player.anim === 'kick';
      this.activeAttackPrevAnim = hasActiveChain ? this.lastComboAttackAnim : this.player.anim;
      this.lastComboAttackAnim = anim;
    } else if (anim !== 'idle' || this.player.comboResetTimer <= 0) {
      this.activeAttackPrevAnim = this.player.anim;
      if (anim !== 'idle') {
        this.lastComboAttackAnim = 'idle';
      }
    }
    this.caneSpinVisual = anim === 'cane' && this.player.caneCharges === 1;
    this.attackActiveTicks = 0;
    this.player.anim = anim;
    this.player.animTimer = duration;
    this.player.animDuration = duration > 0 ? duration : undefined;
  }

  private isBossType(type: EnemyType): boolean {
    return type.startsWith('boss_');
  }

  private getBossStrengthScore(type: EnemyType): number {
    if (type === 'boss_cobrador_blindado') return 320 + 6 * 30;
    if (type === 'boss_cobrador') return this.currentLineIdx === 0 ? 200 : 250;
    if (type === 'boss_motorista') return 210;
    if (type === 'boss_fiscal_chefe') return Math.round(230 * 0.88);
    return 100;
  }

  private hasRemainingBosses(exclude?: EnemyEntity): boolean {
    const aliveBoss = this.enemies.some(
      (other) => other !== exclude && other.isBoss && other.hp > 0
    );
    if (aliveBoss) return true;
    return this.pendingBossSpawns.some((pb) => this.isBossType(pb.type));
  }

  private addFloatingText(text: string, x: number, y: number, z: number, color: string) {
    this.floatingTexts.push({
      text,
      x,
      y,
      z,
      color,
      life: 0.95,
      maxLife: 0.95,
    });
  }

  private update(dt: number) {
    this.simTime += dt;
    this.updateAchievementToast(dt);

    if (this.gameState === 'INTRO_SCENE' || this.gameState === 'VICTORY_SCENE') {
      return;
    }

    if (this.gameState === 'VICTORY') {
      this.updateParticles(dt);
      return;
    }

    if (this.gameState !== 'PLAYING') {
      return;
    }

    if (this.levelClearTransition) {
      this.updateParticles(dt);
      this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.25);
      this.player.animTimer = Math.max(0, this.player.animTimer - dt);
      this.levelClearTransition.timer -= dt;
      if (this.levelClearTransition.timer <= 0) {
        const pose = this.levelClearTransition.pose;
        this.levelClearTransition = null;
        this.finishReachExitDoor(pose);
      }
      return;
    }

    if (this.hitChainTimer > 0) {
      this.hitChainTimer = Math.max(0, this.hitChainTimer - dt);
      if (this.hitChainTimer === 0 && this.player.hitsLanded > 0) {
        this.player.hitsLanded = 0;
        this.pushHudSnapshot();
      }
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) {
        this.shakeMag = 0;
      }
    }
    this.runElapsedSeconds += dt;
    if (this.caneHintTimer > 0) {
      this.caneHintTimer = Math.max(0, this.caneHintTimer - dt);
    }
    if (this.shieldBreakHintTimer > 0) {
      this.shieldBreakHintTimer = Math.max(0, this.shieldBreakHintTimer - dt);
    }
    if (this.comboTintTimer > 0) {
      this.comboTintTimer = Math.max(0, this.comboTintTimer - dt);
    }
    if (this.comboEdgeFlashTimer > 0) {
      this.comboEdgeFlashTimer = Math.max(0, this.comboEdgeFlashTimer - dt);
      if (this.comboEdgeFlashTimer === 0) {
        this.comboEdgeFlashStrength = 0;
      }
    }
    if (this.comboEdgeParticles.length > 0) {
      const edgeDrag = Math.exp(-5.2 * dt);
      for (let i = this.comboEdgeParticles.length - 1; i >= 0; i--) {
        const cp = this.comboEdgeParticles[i];
        cp.life -= dt;
        cp.prevX = cp.x;
        cp.prevY = cp.y;
        cp.vx *= edgeDrag;
        cp.vy *= edgeDrag;
        cp.x += cp.vx * dt;
        cp.y += cp.vy * dt;
        if (cp.life <= 0) {
          this.comboEdgeParticles.splice(i, 1);
        }
      }
    }
    this.updatePlayerSpecialElectricParticles(dt);
    if (this.comboFlickerTimer > 0) {
      this.comboFlickerTimer = Math.max(0, this.comboFlickerTimer - dt);
      if (this.comboFlickerTimer === 0) {
        this.comboFlickerIntensity = 0;
      }
    }
    if (this.bossKoFlashTimer > 0) {
      this.bossKoFlashTimer = Math.max(0, this.bossKoFlashTimer - dt);
    }
    if (this.specialLightTimer > 0) {
      this.specialLightTimer = Math.max(0, this.specialLightTimer - dt);
    }
    if (this.expressWindTimer > 0) {
      this.expressWindTimer = Math.max(0, this.expressWindTimer - dt);
    }
    if (this.turnstileSpinTimer > 0) {
      this.turnstileSpinTimer = Math.max(0, this.turnstileSpinTimer - dt);
    }
    if (this.stopButtonCooldown > 0) {
      this.stopButtonCooldown = Math.max(0, this.stopButtonCooldown - dt);
    }
    if (this.shortCircuitTimer > 0) {
      this.shortCircuitTimer = Math.max(0, this.shortCircuitTimer - dt);
      if (Math.random() < dt * 16) {
        this.spawnParticles(this.camX + 60 + Math.random() * 360, 128, 38, '#38bdf8', 2);
      }
    }
    if (this.gameMode === 'infinite') {
      this.infiniteTimeLeft = Math.max(0, this.infiniteTimeLeft - dt);
      if (this.infiniteTimeLeft <= 0) {
        if (!this.dailyRunCounted) {
          this.dailyRunCounted = true;
          this.trackDailyMission('complete_runs', 1);
        }
        this.gameState = 'GAME_OVER';
        audio.playGameOver();
        this.pushHudSnapshot();
        return;
      }
    }
    for (let i = this.bossFinisherEffects.length - 1; i >= 0; i--) {
      this.bossFinisherEffects[i].life -= dt;
      if (this.bossFinisherEffects[i].life <= 0) {
        this.bossFinisherEffects.splice(i, 1);
      }
    }
    for (let i = this.impactFlashes.length - 1; i >= 0; i--) {
      this.impactFlashes[i].life -= dt;
      if (this.impactFlashes[i].life <= 0) {
        this.impactFlashes.splice(i, 1);
      }
    }
    for (let i = this.groundShockwaves.length - 1; i >= 0; i--) {
      this.groundShockwaves[i].life -= dt;
      if (this.groundShockwaves[i].life <= 0) {
        this.groundShockwaves.splice(i, 1);
      }
    }
    if (this.perfectHitTimer > 0) {
      this.perfectHitTimer = Math.max(0, this.perfectHitTimer - dt);
      if (this.perfectHitTimer === 0) {
        this.pushHudSnapshot();
      }
    }
    if (this.bossKoOverlay) {
      this.bossKoOverlay.life -= dt;
      if (this.bossKoOverlay.life <= 0) {
        this.bossKoOverlay = null;
      }
    }
    if (this.alertTimer > 0) {
      this.alertTimer = Math.max(0, this.alertTimer - dt);
      if (this.alertTimer === 0) {
        this.alertMessage = '';
      }
    }

    if (this.hitstopFrames > 0) {
      this.hitstopFrames--;
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    let worldDt = dt;
    let timeScale = 1;
    if (this.bossBulletTimeTimer > 0) {
      const decayRate = this.player.anim === 'jumpKick' || this.player.z > 4 ? 1 : 2.2;
      this.bossBulletTimeTimer = Math.max(0, this.bossBulletTimeTimer - dt * decayRate);
      const easeOut = this.bossBulletTimeTimer < 0.14 ? 1 - this.bossBulletTimeTimer / 0.14 : 0;
      timeScale = Math.min(timeScale, 0.28 + easeOut * 0.72);
    }
    if (this.comboFinisherSlowTimer > 0) {
      const finisherSlowMax = Math.max(0.01, this.comboFinisherSlowMax);
      this.comboFinisherSlowTimer = Math.max(0, this.comboFinisherSlowTimer - dt);
      const easeOut = 1 - Math.min(1, this.comboFinisherSlowTimer / finisherSlowMax);
      timeScale = Math.min(
        timeScale,
        this.comboFinisherSlowMinScale + easeOut * (1 - this.comboFinisherSlowMinScale)
      );
      if (this.comboFinisherSlowTimer === 0) {
        this.comboFinisherSlowMax = 0.085;
        this.comboFinisherSlowMinScale = 0.52;
      }
    }
    worldDt = dt * timeScale;

    if (this.bossFinisherState) {
      this.updateBossFinisher(worldDt);
    } else {
      this.updatePendingBossSpawns(worldDt);
      this.updateWaves();
      this.updateBusEvents(worldDt);
    }
    this.updatePlayer(worldDt);
    this.updateEnemies(worldDt);
    this.updateProjectiles(worldDt);
    this.updateHazards(worldDt);
    this.updateDrops(worldDt);
    this.updateParticles(worldDt);
    this.updateCamera(worldDt);

    const hasStinkyWorker = this.enemies.some((e) => e.type === 'industria' && e.stinkActive);
    const hasDeodorantOnFloor = this.drops.some((d) => d.type === 'desodorante');
    if (hasStinkyWorker && this.player.deodorantCount === 0 && !hasDeodorantOnFloor) {
      this.deodorantBackupTimer += dt;
      if (this.deodorantBackupTimer > 7.5) {
        this.deodorantBackupTimer = 0;
        const dropX = Math.max(this.camX + 60, Math.min(this.camX + INTERNAL_WIDTH - 60, this.player.x + 80));
        this.spawnDrop('desodorante', dropX, 188);
      }
    } else {
      this.deodorantBackupTimer = 0;
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.pushHudSnapshot();
    }
  }

  private updatePendingBossSpawns(dt: number) {
    if (this.pendingBossSpawns.length === 0) return;
    const bounds = this.getActiveWaveBounds();
    let spawnedAny = false;

    for (let i = this.pendingBossSpawns.length - 1; i >= 0; i--) {
      const item = this.pendingBossSpawns[i];
      item.delayRemaining -= dt;
      if (item.delayRemaining <= 0) {
        this.pendingBossSpawns.splice(i, 1);
        const spawnX = Math.min(
          bounds.maxX - 24,
          Math.max(bounds.minX + 40, Math.max(this.player.x + 150, item.x))
        );
        const boss = this.spawnEnemy(item.type, spawnX, item.y, false, item.guaranteedDrop);
        audio.playBossAlert();
        this.showAlert(`${boss.name.toUpperCase()} ENTROU!`, 2.6);
        this.spawnParticles(boss.x, boss.y, 24, '#ef4444', 14);
        spawnedAny = true;
      }
    }

    if (spawnedAny) {
      this.pushHudSnapshot();
    }
  }

  private spawnInfiniteWave(wave: number) {
    const p = this.player;
    const isBossWave = wave % 3 === 0;
    const pool: EnemyType[] = [
      'idosa',
      'vendedor',
      'estudante',
      'patricinha',
      'tio_audio',
      'skatista',
      ...(wave >= 2 ? (['industria'] as EnemyType[]) : []),
    ];
    const count = Math.min(6, 3 + Math.floor(wave / 2));
    const maxRight = this.line.turnstileX - 30;
    const minLeft = 40;

    for (let i = 0; i < count; i++) {
      const eType = pool[(wave * 3 + i * 2) % pool.length];
      const spawnFromRight = i % 2 === 0 || p.x < 220;
      const offsetX = spawnFromRight
        ? Math.min(maxRight, Math.max(minLeft + 80, p.x + 150 + i * 28))
        : Math.max(minLeft, Math.min(maxRight - 80, p.x - 140 - i * 24));
      const y = 168 + ((i * 23) % 52);
      const drop: ItemType | undefined =
        i === count - 1 && wave % 4 === 0 ? 'cafezinho' : undefined;
      this.spawnEnemy(eType, offsetX, y, false, drop);
    }

    if (isBossWave) {
      const bossPool: EnemyType[] = [
        'boss_cobrador',
        'boss_motorista',
        'boss_cobrador_blindado',
        'boss_fiscal_chefe',
      ];
      const bossType = bossPool[Math.floor(wave / 3 - 1) % bossPool.length];
      const bx = Math.min(maxRight, Math.max(minLeft + 120, p.x + 175));
      this.spawnEnemy(bossType, bx, 192, false, 'bilhete_dourado');
      this.showAlert(`HORA DO RUSH · ONDA ${wave} (CHEFE!)`, 3.0);
      audio.playBossAlert();
    } else {
      this.showAlert(`HORA DO RUSH · ONDA ${wave}!`, 2.2);
    }

    recordRushWaveMilestone(wave);
    if (wave >= 5) {
      this.unlockAchievement('rush_onda_5');
    }
  }

  private updateWaves() {
    if (this.gameMode === 'infinite') {
      const remaining = this.enemies.filter((e) => !e.isChaser);
      if (remaining.length === 0) {
        const wasBossWave = this.infiniteWave % 3 === 0;
        const timeBonus = wasBossWave ? 22 : 12;
        this.infiniteTimeLeft = Math.min(99, this.infiniteTimeLeft + timeBonus);
        this.infiniteWave += 1;

        const nextThemeIdx = Math.floor((this.infiniteWave - 1) / 2) % BUS_LINES.length;
        if (nextThemeIdx !== this.infiniteThemeLineIdx) {
          this.infiniteThemeLineIdx = nextThemeIdx;
          this.currentLineIdx = nextThemeIdx;
          this.line = BUS_LINES[nextThemeIdx];
          this.stopButtonCooldown = 0;
          this.usedSeatSlots.clear();
        }

        audio.playValidate();
        this.spawnInfiniteWave(this.infiniteWave);
        this.pushHudSnapshot();
      }
      return;
    }

    for (const wave of this.waves) {
      if (!wave.triggered && this.player.x >= wave.triggerX) {
        wave.triggered = true;
        if (wave.isBossWave && wave.bossBanner) {
          this.showAlert(wave.bossBanner, 3.2);
          audio.playBossAlert();
        }
        const bossSpawns: typeof wave.spawns = [];
        const regularSpawns: typeof wave.spawns = [];
        for (const s of wave.spawns) {
          if (this.isBossType(s.type)) bossSpawns.push(s);
          else regularSpawns.push(s);
        }

        // Strictly enforce all enemies spawn ahead of the player (from the front!)
        for (const s of regularSpawns) {
          const spawnX = Math.min(
            wave.lockMaxX - 24,
            Math.max(this.player.x + 150, s.offsetX)
          );
          this.spawnEnemy(s.type, spawnX, s.y, false, s.guaranteedDrop);

          // Double regular enemies (idosa & patricinha) while RAGE buff is active
          if (
            this.player.rageTimer > 0 &&
            (s.type === 'idosa' || s.type === 'patricinha')
          ) {
            const cloneX = Math.min(wave.lockMaxX - 18, spawnX + 26);
            const cloneY = s.y > 190 ? s.y - 22 : s.y + 22;
            const clone = this.spawnEnemy(s.type, cloneX, cloneY, false);
            clone.isRageClone = true;
          }
        }

        // Multi-boss staggered spawn: weakest first immediately, strongest 13s later
        bossSpawns.sort(
          (a, b) => this.getBossStrengthScore(a.type) - this.getBossStrengthScore(b.type)
        );
        bossSpawns.forEach((s, idx) => {
          const spawnX = Math.min(
            wave.lockMaxX - 24,
            Math.max(this.player.x + 150, s.offsetX)
          );
          if (idx === 0) {
            this.spawnEnemy(s.type, spawnX, s.y, false, s.guaranteedDrop);
          } else {
            this.pendingBossSpawns.push({
              waveId: wave.id,
              type: s.type,
              x: spawnX,
              y: s.y,
              delayRemaining: 13.0 * idx,
              guaranteedDrop: s.guaranteedDrop,
            });
          }
        });

        this.pushHudSnapshot();
      }
      if (wave.triggered && !wave.cleared) {
        const remainingWaveEnemies = this.enemies.filter((e) => !e.isChaser);
        const pendingInWave = this.pendingBossSpawns.some((pb) => pb.waveId === wave.id);
        if (remainingWaveEnemies.length === 0 && !pendingInWave) {
          wave.cleared = true;
          if (wave.isBossWave) {
            this.turnstileCleared = true;
            audio.playValidate();
          }
          this.pushHudSnapshot();
        }
      }
    }
  }

  private getActiveWaveBounds(): { minX: number; maxX: number } {
    if (this.gameMode === 'infinite') {
      return {
        minX: 0,
        maxX: this.line.turnstileX - 18,
      };
    }
    const activeWave = this.waves.find((w) => w.triggered && !w.cleared);
    if (activeWave) {
      return { minX: activeWave.lockMinX, maxX: activeWave.lockMaxX };
    }
    return {
      minX: 0,
      maxX: this.turnstileCleared ? this.line.busLength : this.line.turnstileX - 18,
    };
  }

  private hasNearbyActiveBoss(maxDist = 195): boolean {
    return this.enemies.some(
      (e) => e.isBoss && e.hp > 0 && e.aiState !== 'knockdown' && Math.abs(e.x - this.player.x) <= maxDist
    );
  }

  private getEmptySeatUnderPlayer(maxY = 158): SeatSlotInfo | null {
    if (this.player.y > maxY) return null;
    const seat = findBusSeatAtX(this.line.lineNumber, this.player.x, this.line.turnstileX);
    if (seat && !seat.occupied) return seat;
    return null;
  }

  private updatePlayer(dt: number) {
    const p = this.player;

    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    if (p.stickySlowTimer > 0) p.stickySlowTimer = Math.max(0, p.stickySlowTimer - dt);
    if (p.makeupShieldTimer > 0) {
      p.makeupShieldTimer = Math.max(0, p.makeupShieldTimer - dt);
      if (p.makeupShieldTimer === 0) {
        p.shieldHits = 0;
      }
    }
    if (p.strengthBuffTimer > 0) p.strengthBuffTimer = Math.max(0, p.strengthBuffTimer - dt);
    if (p.speedBoostTimer > 0) p.speedBoostTimer = Math.max(0, p.speedBoostTimer - dt);
    if (p.bagSkillCooldown > 0) p.bagSkillCooldown = Math.max(0, p.bagSkillCooldown - dt);
    if (p.rageTimer > 0) p.rageTimer = Math.max(0, p.rageTimer - dt);
    if (p.rageNotificationTimer > 0) {
      p.rageNotificationTimer = Math.max(0, p.rageNotificationTimer - dt);
    }
    const isAttacking =
      p.anim === 'punch1' ||
      p.anim === 'punch2' ||
      p.anim === 'punch3' ||
      p.anim === 'heavyPunch' ||
      p.anim === 'cane' ||
      p.anim === 'kick' ||
      p.anim === 'kickFinisher' ||
      p.anim === 'jumpPunch' ||
      p.anim === 'jumpKick' ||
      p.anim === 'railSpin' ||
      p.anim === 'railSlam' ||
      p.anim === 'bagSpin' ||
      p.anim === 'special' ||
      p.anim === 'soundSpecial' ||
      p.anim === 'headphoneWhip' ||
      p.anim === 'spray';

    if (!isAttacking && p.comboResetTimer > 0) {
      p.comboResetTimer = Math.max(0, p.comboResetTimer - dt);
      if (p.comboResetTimer === 0) {
        this.lastComboAttackAnim = 'idle';
      }
    }

    if (this.bufferTimer > 0) {
      if (isAttacking && p.animTimer > 0 && this.bufferedAction) {
        // Keep valid buffered command alive until the active attack animation reaches recovery
        this.bufferTimer = Math.max(0.08, this.bufferTimer - dt);
      } else {
        this.bufferTimer -= dt;
        if (this.bufferTimer <= 0) this.clearBufferedComboInput();
      }
    }

    let ix = this.virtualMove.x;
    let iy = this.virtualMove.y;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) ix -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) ix += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) iy -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) iy += 1;

    if (ix !== 0 && iy !== 0) {
      const norm = 1 / Math.SQRT2;
      ix *= norm;
      iy *= norm;
    }

    if (this.bossFinisherState) {
      p.invulnTimer = Math.max(p.invulnTimer, 0.25);
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      return;
    }

    if (p.anim === 'hurt' || p.anim === 'knockdown') {
      p.animTimer -= dt;
      p.x += p.vx * dt;
      p.vx *= Math.pow(0.05, dt);
      this.seatRestHoldTimer = 0;
      if (p.animTimer <= 0) {
        this.setPlayerAnim('idle', 0);
      }
    } else if (this.isVictoryAnim(p.anim)) {
      p.animTimer -= dt;
      p.invulnTimer = Math.max(p.invulnTimer, 0.12);
      p.vx *= Math.pow(0.02, dt);
      p.vy *= Math.pow(0.02, dt);
      this.seatRestHoldTimer = 0;
      if (Math.random() < dt * 8) {
        this.spawnParticles(p.x + (Math.random() - 0.5) * 18, p.y, 26, '#fde047', 1);
      }
      if (p.animTimer <= 0 || (p.animTimer <= 0.6 && (Math.abs(ix) > 0.2 || Math.abs(iy) > 0.2))) {
        this.setPlayerAnim('idle', 0);
      }
    } else if (p.anim === 'bagGuard') {
      p.animTimer -= dt;
      p.x += ix * 42 * dt;
      p.y += iy * 28 * dt;
      this.seatRestHoldTimer = 0;
      if (ix > 0.1) p.facing = 1;
      else if (ix < -0.1) p.facing = -1;
      if (p.animTimer <= 0) {
        this.setPlayerAnim(p.z > 0 ? 'jump' : 'idle', 0);
      }
    } else if (p.anim === 'railGrab') {
      p.animTimer -= dt;
      p.x += ix * 78 * dt;
      p.vz = 0;
      this.seatRestHoldTimer = 0;
      if (p.animTimer <= 0) {
        this.setPlayerAnim('jump', 0);
        p.vz = -45;
      }
    } else if (isAttacking) {
      this.seatRestHoldTimer = 0;
      if (p.anim === 'railSlam') {
        p.x += ix * 65 * dt;
      } else {
        p.animTimer -= dt;
        if (p.anim === 'jumpKick' || p.anim === 'jumpPunch' || p.anim === 'railSpin') {
          p.x += ix * 95 * dt;
        } else if (p.anim === 'heavyPunch') {
          if (p.animTimer <= 0.3 && p.animTimer + dt > 0.3) {
            p.x += p.facing * 5;
            audio.playPunch();
          } else if (p.animTimer <= 0.14 && p.animTimer > 0 && Math.random() < dt * 26) {
            this.spawnParticles(p.x + p.facing * 16, p.y, p.z + 24, '#fde047', 1);
          }
        } else if (p.anim === 'special') {
          if (p.animTimer > 0.22 && p.z >= 14) {
            // Brief suspended hover during the Special Kick coil pose
            p.vz = Math.max(p.vz, 24);
          } else if (p.animTimer <= 0.22 && p.animTimer + dt > 0.22) {
            p.x += p.facing * 6;
            audio.playKick();
            this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
          }
        }
        const canHitNow =
          (p.anim !== 'punch1' || p.animTimer <= 0.17) &&
          (p.anim !== 'punch2' || p.animTimer <= 0.19) &&
          (p.anim !== 'heavyPunch' || p.animTimer <= 0.3) &&
          (p.anim !== 'kick' || p.animTimer <= 0.21) &&
          (p.anim !== 'kickFinisher' || p.animTimer <= 0.28) &&
          (p.anim !== 'jumpPunch' || p.animTimer <= 0.22) &&
          (p.anim !== 'jumpKick' || p.animTimer <= 0.28) &&
          (p.anim !== 'cane' || p.animTimer <= 0.21) &&
          (p.anim !== 'special' || p.animTimer <= 0.22);
        if (canHitNow) {
          this.attackActiveTicks++;
        }
        if (!p.attackHasHit && canHitNow) {
          this.resolvePlayerAttack(this.attackActiveTicks === 1);
        }
        if (p.animTimer <= 0) {
          const prevAnim = p.anim;
          const onSeatNow = Boolean(
            this.getEmptySeatUnderPlayer(156) && Math.abs(p.z - 24) <= 2
          );
          const onGroundNow = p.z === 0 || onSeatNow;
          this.setPlayerAnim(p.z > 0 && !onSeatNow ? 'jump' : 'idle', 0);

          if (prevAnim === 'heavyPunch' || prevAnim === 'kickFinisher') {
            p.comboStep = 0;
            p.comboResetTimer = 0;
          }

          if (this.bufferedAction) {
            const nextAct = this.bufferedAction;
            this.clearBufferedComboInput();
            if (onGroundNow) {
              if (nextAct === 'bagGuard') {
                this.triggerAction('bagGuard');
              } else {
                this.executeGroundAttack(nextAct);
              }
            }
          } else if (
            (prevAnim === 'punch1' || prevAnim === 'punch2') &&
            (this.heldKeys.has('KeyJ') || this.heldKeys.has('KeyZ')) &&
            onGroundNow
          ) {
            p.comboResetTimer = Math.max(p.comboResetTimer, 0.25);
            this.executeGroundAttack('punch');
          }
        }
      }
    } else {
      const nearUnusedSeat = this.getEmptySeatUnderPlayer(156);
      const isRestingOnSeat = Boolean(
        p.z === 0 &&
          nearUnusedSeat &&
          !this.usedSeatSlots.has(nearUnusedSeat.slot) &&
          iy < -0.5 &&
          Math.abs(ix) < 0.45 &&
          Math.abs(this.busCurveVy) < 10
      );

      if (isRestingOnSeat && nearUnusedSeat) {
        p.anim = 'seatRest';
        p.animDuration = undefined;
        p.animTimer += dt;
        p.vx = 0;
        p.vy = 0;
        this.seatRestHoldTimer += dt;
        if (this.seatRestHoldTimer >= 1.1) {
          p.hp = Math.min(p.maxHp, p.hp + 18);
          p.score += 50;
          this.usedSeatSlots.add(nearUnusedSeat.slot);
          this.seatRestHoldTimer = 0;
          this.setPlayerAnim('idle', 0);
          audio.playHeal();
          this.spawnParticles(p.x, p.y, 18, '#34d399', 12);
          this.pushHudSnapshot();
        }
      } else {
        this.seatRestHoldTimer = 0;

        const slowMult = p.stickySlowTimer > 0 ? 0.52 : 1;
        const rageSpeedMult = p.rageTimer > 0 ? 1.25 : 1;
        const coffeeSpeedMult = p.speedBoostTimer > 0 ? 1.22 : 1;
        const speedX = 128 * slowMult * rageSpeedMult * coffeeSpeedMult;
        const speedY = 86 * slowMult * rageSpeedMult * coffeeSpeedMult;
        p.vx = ix * speedX + this.busSlideVx;
        p.vy = iy * speedY + this.busCurveVy;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.busSlideVx *= Math.pow(0.03, dt);
        if (Math.abs(this.busSlideVx) < 1) this.busSlideVx = 0;
        this.busCurveVy *= Math.pow(0.03, dt);
        if (Math.abs(this.busCurveVy) < 1) this.busCurveVy = 0;

        if (ix > 0.1) p.facing = 1;
        else if (ix < -0.1) p.facing = -1;

        const onSeatElevated = Boolean(this.getEmptySeatUnderPlayer(156) && Math.abs(p.z - 24) <= 2);
        p.animDuration = undefined;
        if (p.z > 0 && !onSeatElevated) {
          p.anim = 'jump';
        } else if (Math.abs(ix) > 0.05 || Math.abs(iy) > 0.05) {
          p.anim = 'walk';
          p.animTimer += dt;
        } else {
          p.anim = 'idle';
          p.animTimer += dt;
        }
      }
    }

    const seatSupport = this.getEmptySeatUnderPlayer(156);
    const standingOnSeat = Boolean(
      seatSupport && p.anim !== 'railSlam' && Math.abs(p.z - 24) <= 2 && p.vz <= 0
    );
    if (p.anim !== 'railGrab' && p.anim !== 'railSpin') {
      if (standingOnSeat) {
        p.z = 24;
        p.vz = 0;
        this.airAttackUsed = false;
        if (p.anim === 'jump' || p.anim === 'jumpKick' || p.anim === 'jumpPunch') {
          p.animDuration = undefined;
          p.anim = Math.abs(ix) > 0.05 || Math.abs(iy) > 0.05 ? 'walk' : 'idle';
        }
      } else if (p.z > 0 || p.vz !== 0) {
        p.z += p.vz * dt;
        p.vz -= GRAVITY * dt;
        if (seatSupport && p.anim !== 'railSlam' && p.vz <= 0 && p.z <= 26 && p.z >= 16) {
          p.z = 24;
          p.vz = 0;
          this.airAttackUsed = false;
          if (p.anim === 'jump' || p.anim === 'jumpKick' || p.anim === 'jumpPunch') {
            p.animDuration = undefined;
            p.anim = 'idle';
          }
        } else if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
          this.airAttackUsed = false;
          if (p.anim === 'railSlam') {
            this.resolveRailSlamImpact();
            this.setPlayerAnim('idle', 0);
          } else if (p.anim === 'jump' || p.anim === 'jumpKick' || p.anim === 'jumpPunch') {
            p.animDuration = undefined;
            p.anim = 'idle';
          }
        }
      }
    } else if (p.anim === 'railSpin') {
      p.vz = 0;
    }

    const bounds = this.getActiveWaveBounds();
    const minPlayX = Math.max(24, bounds.minX + 18);
    const maxPlayX = Math.min(this.line.busLength - 32, bounds.maxX - 18);
    p.x = Math.max(minPlayX, Math.min(maxPlayX, p.x));
    p.y = Math.max(AISLE_MIN_Y, Math.min(AISLE_MAX_Y, p.y));

    if (this.turnstileCleared && !this.turnstileCrossed && p.x >= this.line.turnstileX - 8) {
      this.turnstileCrossed = true;
      this.turnstileSpinTimer = 0.72;
      audio.playTurnstileSpin();
      this.spawnParticles(this.line.turnstileX, p.y, 24, '#34d399', 10);
      this.spawnHitSparks(this.line.turnstileX, p.y, 24, 1, {
        target: 'turnstile_boss',
        strong: true,
      });
    }

    if (this.turnstileCleared && p.x >= this.line.exitDoorX - 18) {
      this.handleReachExitDoor();
    }
  }

  private resolvePlayerAttack(isExactStartFrame = false) {
    const p = this.player;
    const isRailSpin = p.anim === 'railSpin';
    const isBagSpin = p.anim === 'bagSpin';
    const isSpecial = p.anim === 'special';
    const isSoundSpecial = p.anim === 'soundSpecial';
    const isHeadphoneWhip = p.anim === 'headphoneWhip';
    const isCane = p.anim === 'cane';
    const isKickFinisher = p.anim === 'kickFinisher';
    const isHeavyPunch = p.anim === 'heavyPunch';
    const isUppercutFinisher = p.anim === 'punch3';
    const isJumpPunch = p.anim === 'jumpPunch';
    const isKick = p.anim === 'kick' || p.anim === 'jumpKick' || isKickFinisher;
    const isGroundKick = p.anim === 'kick' || isKickFinisher;
    const isFinisher = isUppercutFinisher || isKickFinisher;

    if (p.anim === 'spray' || p.anim === 'railSlam') {
      p.attackHasHit = true;
      return;
    }

    const reachX = isHeadphoneWhip
      ? 148
      : isSoundSpecial
        ? Math.round(92 * (1 + this.shopLoadout.specialReachBonus))
        : isRailSpin
          ? 62
          : isBagSpin
            ? 58
            : isSpecial
              ? 54
              : isKickFinisher
                ? 50
                : isCane
                  ? 48
                  : isHeavyPunch
                    ? 42
                    : isKick
                      ? 40
                      : isJumpPunch
                        ? 34
                        : 34;
    const laneTol = isSoundSpecial
      ? 46
      : isRailSpin
        ? 34
        : isBagSpin || isSpecial
          ? 32
          : isHeadphoneWhip || isKickFinisher
            ? 28
            : isHeavyPunch
              ? 24
              : 20;
    // Cane damage reduced by 20% (19 -> 15); Headphone Whip does low ranged rock damage (9)
    const baseDamage = isSoundSpecial
      ? 28
      : isSpecial
        ? 24
        : isKickFinisher || isHeavyPunch
          ? 21
          : isUppercutFinisher
            ? 19
            : isCane
              ? 15
              : isRailSpin
                ? 20
                : isBagSpin
                  ? 16
                  : isKick
                    ? 15
                    : isHeadphoneWhip
                      ? 9
                      : isJumpPunch
                        ? 10
                        : 10;
    const strMult = p.strengthBuffTimer > 0 ? 2 : 1;
    const rageMult = p.rageTimer > 0 ? 1.5 : 1;
    const windMult =
      this.expressWindTimer > 0 && (isRailSpin || p.anim === 'jumpKick' || isSpecial || isSoundSpecial) ? 1.35 : 1;
    const shopDamageMult = 1 + this.shopLoadout.damageMultBonus;
    const damage = Math.round(baseDamage * strMult * rageMult * windMult * shopDamageMult);

    let hitCount = 0;
    let cleanHitCount = 0;
    let landedStrongHit = false;
    let landedMetallicHit = false;
    let landedGuardBreak = false;
    let usedCane = false;
    let counterHit = false;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dy = Math.abs(e.y - p.y);
      if (dy > laneTol) continue;

      const dx = e.x - p.x;
      const inRange =
        isSpecial || isSoundSpecial || isRailSpin || isBagSpin
          ? Math.abs(dx) <= reachX
          : dx * p.facing >= -8 && dx * p.facing <= reachX;

      if (!inRange) continue;

      if (e.type === 'industria' && e.stinkActive && !isSpecial && !isSoundSpecial) {
        audio.playBlock();
        const blockDir: 1 | -1 = dx >= 0 ? 1 : -1;
        this.impactFlashes.push({
          x: e.x - blockDir * 8,
          y: e.y - e.z - 22,
          life: 0.12,
          maxLife: 0.12,
          strong: false,
          kind: 'blocked',
          dir: blockDir,
        });
        this.spawnHitSparks(e.x - blockDir * 8, e.y, e.z + 20, blockDir, {
          target: 'barrier',
          blocked: true,
          attackType: 'blocked',
        });
        e.hp = Math.max(1, e.hp - 1);
        hitCount++;
        cleanHitCount++;
        continue;
      }

      if (e.type === 'industria' && e.stinkActive && isSoundSpecial) {
        e.stinkActive = false;
      }

      const playerInFrontOfStudent =
        e.hasFrontBarrier && Math.sign(p.x - e.x) === e.facing;
      const breaksBarrier =
        isKick ||
        isCane ||
        isSpecial ||
        isSoundSpecial ||
        isRailSpin ||
        isBagSpin ||
        isFinisher ||
        isHeadphoneWhip ||
        p.anim === 'jumpKick';

      if (playerInFrontOfStudent && !breaksBarrier) {
        audio.playBlock();
        this.shieldBreakHintTimer = 4.5;
        const shieldX = e.x + e.facing * 10;
        const blockDir: 1 | -1 = p.facing;
        this.impactFlashes.push({
          x: shieldX,
          y: e.y - e.z - 20,
          life: 0.13,
          maxLife: 0.13,
          strong: false,
          kind: 'blocked',
          dir: blockDir,
        });
        this.spawnHitSparks(shieldX, e.y, e.z + 18, -p.facing, {
          target: 'barrier',
          blocked: true,
          attackType: 'blocked',
        });
        if (e.guardMax > 0 && e.guardHp > 0) {
          e.guardHp = Math.max(0, e.guardHp - 1);
          if (e.guardHp === 0) {
            e.hasFrontBarrier = false;
            e.guardBrokenTimer = 4.5;
            e.aiState = 'hurt';
            e.stateTimer = 1.4;
            const kbDir = dx >= 0 ? 1 : -1;
            e.vx = kbDir * 95;
            e.hitFlashTimer = 0.16;
            e.hp -= Math.max(4, Math.round(damage * 0.8));
            hitCount++;
            cleanHitCount++;
            landedStrongHit = true;
            landedGuardBreak = true;
            landedMetallicHit = true;
            audio.playMetallicImpact(true);
            this.triggerShake(0.16, 3.2);
            if (e.hp <= 0) {
              this.handleEnemyDefeated(e);
            }
            continue;
          }
        }
        p.vx = -p.facing * 170;
        this.setPlayerAnim('hurt', 0.22);
        this.damagePlayer(5);
        hitCount++;
        continue;
      }

      if (
        e.aiState === 'windup' &&
        (isFinisher || isKick || isCane || isSpecial || isSoundSpecial || isBagSpin)
      ) {
        void counterHit;
        counterHit = true;
      }

      let effectiveDamage = damage;
      if (e.guardMax > 0) {
        if (e.guardBrokenTimer > 0) {
          effectiveDamage = Math.round(damage * (e.isBoss ? 1.35 : 1.15));
        } else if (e.guardHp > 0 && !breaksBarrier && (e.isBoss || Math.sign(p.x - e.x) === e.facing)) {
          effectiveDamage = Math.max(1, Math.round(damage * (e.isBoss ? 0.7 : 0.85)));
        }
      }

      let guardBrokenNow = false;
      const isArmoredOrTurnstileTarget =
        e.type === 'boss_cobrador_blindado' ||
        e.type === 'boss_cobrador' ||
        e.hasFrontBarrier;
      if (e.guardMax > 0 && e.guardHp > 0 && e.guardBrokenTimer <= 0) {
        const guardDamage = breaksBarrier ? (e.isBoss ? 2 : 3) : 1;
        e.guardHp = Math.max(0, e.guardHp - guardDamage);
        if (e.guardHp === 0) {
          guardBrokenNow = true;
          landedGuardBreak = true;
          e.guardBrokenTimer = e.isBoss ? 5.0 : 4.5;
          e.hasFrontBarrier = false;
          this.spawnHitSparks(e.x, e.y, e.z + 22, dx >= 0 ? 1 : -1, {
            target: 'barrier',
            strong: true,
          });
        }
      }
      if (isArmoredOrTurnstileTarget || guardBrokenNow || isRailSpin) {
        landedMetallicHit = true;
      }

      e.hp -= effectiveDamage;
      e.hitFlashTimer = isHeavyPunch ? 0.18 : 0.14;
      e.aiState = 'hurt';
      e.heavyHurtTimer =
        isHeavyPunch || isFinisher || isSpecial || isSoundSpecial ? 0.5 : 0;
      e.stateTimer = guardBrokenNow
        ? e.isBoss
          ? 1.6
          : 1.35
        : isHeavyPunch
          ? 0.52
          : isFinisher || isKick || isSpecial || isSoundSpecial || isRailSpin || isBagSpin || isHeadphoneWhip
            ? 0.42
            : 0.28;
      const kbDir = dx >= 0 ? 1 : -1;
      const windKbMult = this.expressWindTimer > 0 ? 1.35 : 1;
      e.vx =
        kbDir *
        (isSoundSpecial
          ? 220
          : isKickFinisher
            ? 205
            : isBagSpin
              ? 185
              : isUppercutFinisher
                ? 170
                : isHeavyPunch
                  ? 165
                  : isKick || isSpecial || isRailSpin
                    ? 160
                    : isHeadphoneWhip
                      ? 115
                      : 75) *
        windKbMult;
      if (isKickFinisher || isUppercutFinisher || isSoundSpecial) {
        e.vz = isUppercutFinisher ? 135 : 120;
        e.z = Math.max(e.z, 2);
      } else if (isJumpPunch) {
        e.vz = Math.max(e.vz, 95);
        e.z = Math.max(e.z, 2);
      } else if (isHeavyPunch) {
        e.vz = 58;
        e.z = Math.max(e.z, 1);
      }
      hitCount++;
      cleanHitCount++;
      if (isHeavyPunch) {
        this.trackDailyMission('land_heavy_punches', 1);
      }

      if (isCane) usedCane = true;

      const isStrongHit =
        guardBrokenNow ||
        isHeavyPunch ||
        isFinisher ||
        isKick ||
        isSpecial ||
        isSoundSpecial ||
        isRailSpin ||
        isBagSpin ||
        isCane;
      if (isStrongHit || isHeadphoneWhip) {
        landedStrongHit = true;
      }

      // Differentiated 16-bit impact flash & directional sparks at precise visual contact point
      const hitDir: 1 | -1 = kbDir >= 0 ? 1 : -1;
      const limbReach = isHeavyPunch
        ? 33
        : isKickFinisher
          ? 30
          : p.anim === 'punch2'
            ? 29
            : p.anim === 'jumpKick'
              ? 28
              : p.anim === 'kick'
                ? 26
                : isCane
                  ? 32
                  : isJumpPunch
                    ? 14
                    : 24;
      const limbTipX = p.x + p.facing * limbReach;
      const enemyEdgeX = e.x - hitDir * (e.isBoss ? 10 : 6);
      const isOmnidirectional = isSpecial || isSoundSpecial || isRailSpin || isBagSpin || isHeadphoneWhip;
      const collisionX = isOmnidirectional
        ? enemyEdgeX
        : p.facing > 0
          ? Math.max(p.x + 10, Math.min(e.x + 4, (limbTipX + enemyEdgeX) * 0.5))
          : Math.min(p.x - 10, Math.max(e.x - 4, (limbTipX + enemyEdgeX) * 0.5));
      const contactZ = isJumpPunch
        ? Math.max(e.z + 28, p.z + 34)
        : isKickFinisher
          ? Math.max(e.z + 23, p.z + 25)
          : p.anim === 'jumpKick'
            ? Math.max(e.z + 24, p.z + 26)
            : p.anim === 'kick'
              ? Math.max(e.z + 16, p.z + 18)
              : e.z + (p.anim === 'punch2' || isHeavyPunch ? 24 : 22);

      const impactKind: ImpactFlashKind =
        isJumpPunch || isUppercutFinisher
          ? 'uppercut'
          : isKickFinisher || isSoundSpecial || isSpecial || isRailSpin || isBagSpin || guardBrokenNow
            ? 'finisher'
            : isHeavyPunch
              ? 'heavy'
              : isKick
                ? 'kick'
                : 'jab';
      const flashLife =
        impactKind === 'finisher'
          ? 0.18
          : impactKind === 'heavy' || impactKind === 'uppercut'
            ? 0.16
            : impactKind === 'kick'
              ? 0.14
              : 0.11;

      this.impactFlashes.push({
        x: collisionX,
        y: e.y - contactZ,
        life: flashLife,
        maxLife: flashLife,
        strong: isStrongHit || isHeadphoneWhip || e.isBoss,
        kind: impactKind,
        dir: hitDir,
      });
      this.spawnHitSparks(collisionX, e.y, contactZ, hitDir, {
        target: e.isBoss ? 'turnstile_boss' : 'passenger',
        bossType: e.type,
        strong: isStrongHit || isHeadphoneWhip,
        finisher: isFinisher || isSoundSpecial || guardBrokenNow || isHeavyPunch,
        attackType: impactKind,
        kickTrail: isGroundKick,
      });
      if (isKickFinisher || isHeavyPunch || isUppercutFinisher || isSpecial || guardBrokenNow) {
        this.spawnGroundShockwave(
          e.x,
          e.y,
          isKickFinisher ? 30 : isSpecial || guardBrokenNow ? 32 : 25,
          guardBrokenNow ? '#38bdf8' : isKickFinisher ? '#f97316' : '#facc15',
          Boolean(isKickFinisher || isSpecial || guardBrokenNow)
        );
      }
      this.addFloatingText(`-${effectiveDamage}`, e.x, e.y, e.z + 32, guardBrokenNow ? '#38bdf8' : '#f8fafc');
      p.score += effectiveDamage * 2;

      if (p.anim === 'jumpKick' && e.isBoss) {
        this.bossBulletTimeTimer = Math.max(this.bossBulletTimeTimer, 0.48);
        this.hitstopTimer = Math.max(this.hitstopTimer, 0.055);
        this.spawnParticles(e.x, e.y, e.z + 24, '#fde047', 10);
      }

      if (e.hp <= 0) {
        this.handleEnemyDefeated(e);
      } else {
        this.checkBossHalfHpTaunt(e);
      }
    }

    if (hitCount > 0) {
      if (cleanHitCount > 0) {
        const isComboFinisher =
          isHeavyPunch ||
          isKickFinisher ||
          isUppercutFinisher ||
          (isCane && this.caneSpinVisual);
        const extraTargets = Math.min(3, Math.max(0, cleanHitCount - 1));
        const reduced = this.isReducedMotionPreferred();

        if (isComboFinisher) {
          // 3-frame base freeze scaling up to 6 frames as multiple targets are struck simultaneously
          const finisherFrames = reduced
            ? Math.min(2, 1 + Math.floor(extraTargets / 2))
            : 3 + extraTargets;
          this.hitstopFrames = Math.max(this.hitstopFrames, finisherFrames);
          if (!reduced) {
            const slowDuration = 0.085 + extraTargets * 0.03;
            const slowMinScale = Math.max(0.32, 0.52 - extraTargets * 0.06);
            this.comboFinisherSlowMax = Math.max(this.comboFinisherSlowMax, slowDuration);
            this.comboFinisherSlowTimer = Math.max(this.comboFinisherSlowTimer, slowDuration);
            this.comboFinisherSlowMinScale = Math.min(this.comboFinisherSlowMinScale, slowMinScale);
          }
          this.triggerShake(0.18 + extraTargets * 0.035, 3.8 + extraTargets * 0.95);
        } else if (landedStrongHit || landedGuardBreak) {
          const baseTimer =
            isSoundSpecial || landedGuardBreak
              ? 0.058
              : isSpecial || isRailSpin || isBagSpin
                ? 0.045
                : 0.024;
          this.hitstopTimer = Math.max(this.hitstopTimer, baseTimer + extraTargets * 0.01);
          this.triggerShake(
            (isSoundSpecial || landedGuardBreak ? 0.18 : 0.12) + extraTargets * 0.025,
            (isSoundSpecial || landedGuardBreak ? 3.8 : 2.5) + extraTargets * 0.7
          );
        } else {
          // Common hits stay brisk & responsive, with only a tiny nudge on multi-target cleaves
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.016 + extraTargets * 0.006);
        }

        this.registerHitChain(cleanHitCount);
        if (isExactStartFrame) {
          this.perfectHitTimer = 0.85;
          this.perfectHitSeq++;
        }
        vibrateHit(landedStrongHit);
        if (landedMetallicHit) {
          audio.playMetallicImpact(landedGuardBreak || landedStrongHit);
        }
        if (usedCane) {
          audio.playCaneCrack();
        } else if (isHeadphoneWhip) {
          audio.playWhipImpact();
        } else if (isBagSpin) {
          audio.playBagThump();
        } else if (isKickFinisher || isSpecial || p.anim === 'jumpKick') {
          audio.playKickImpact(true);
        } else if (isKick) {
          audio.playKickImpact(false);
        } else if (isUppercutFinisher || isHeavyPunch) {
          audio.playUppercutCrack();
        } else if (isSoundSpecial || isRailSpin) {
          audio.playHeavyHit();
        } else {
          audio.playPunchSnap();
        }
      }
      p.attackHasHit = true;
      if (!isSpecial && !isSoundSpecial) {
        const energyGain = isFinisher || isCane || isRailSpin || isBagSpin ? 14 : 8;
        this.addSpecialEnergy(energyGain);
      }
      if (
        p.comboStep > 0 ||
        p.comboStreak >= 2 ||
        isFinisher ||
        isKick ||
        isCane ||
        isSpecial ||
        isSoundSpecial ||
        isRailSpin ||
        isBagSpin ||
        isHeadphoneWhip
      ) {
        const streakBoost = Math.min(0.55, p.comboMultiplier * 0.065);
        const stepBoost = p.comboStep === 2 || isFinisher || isSpecial || isSoundSpecial ? 0.35 : 0.2;
        this.comboFlickerIntensity = Math.min(
          1,
          Math.max(this.comboFlickerIntensity, 0.3 + streakBoost + stepBoost)
        );
        this.comboFlickerTimer = Math.max(this.comboFlickerTimer, 0.85);
      }
      if (usedCane && p.caneCharges > 0) {
        p.caneCharges--;
      }
      this.pushHudSnapshot();
    }
  }

  private handleEnemyDefeated(e: EnemyEntity) {
    const p = this.player;
    const prevComboMultiplier = p.comboMultiplier;
    p.enemiesDefeated++;
    p.comboStreak += 1;
    p.comboMultiplier = p.comboStreak < 2 ? 1 : p.comboStreak;

    if (p.comboMultiplier > 10 && p.comboMultiplier > prevComboMultiplier) {
      this.triggerComboImpact(p.comboMultiplier);
    }

    const basePts = e.isBoss ? 800 : 120;
    const totalPts = basePts * p.comboMultiplier;
    p.score += totalPts;
    this.spawnParticles(e.x, e.y, 16, '#f97316', 6);

    if (p.comboMultiplier >= 2) {
      this.comboFlickerIntensity = Math.min(
        1,
        Math.max(this.comboFlickerIntensity, 0.42 + p.comboMultiplier * 0.06)
      );
      this.comboFlickerTimer = Math.max(this.comboFlickerTimer, 1.0);
    }

    if (p.comboMultiplier > 5) {
      this.triggerShake(0.36, 5);
      this.comboTintTimer = 0.65;
      this.spawnParticles(p.x, p.y, p.z + 20, '#f97316', 6);
    }

    if (!e.isRageClone) {
      const progress = recordDefeatedEnemyMilestone(1);
      if (progress.totalDefeated >= 50) {
        this.unlockAchievement('derrotar_50');
      }
      this.trackDailyMission('defeat_passengers', 1);
      if (e.isBoss) {
        this.trackDailyMission('defeat_bosses', 1);
      }
    }

    if (p.comboMultiplier >= 10) {
      this.unlockAchievement('rage_10x');
    }
    if (e.isBoss && p.rageTimer > 0) {
      this.unlockAchievement('boss_rage_ko');
    }
    if (p.anim === 'railSpin') {
      this.railSpinKoCount++;
      if (this.railSpinKoCount >= 2) {
        this.unlockAchievement('acrobata_busao');
      }
    }

    if (p.comboMultiplier === 10 || (p.comboMultiplier > 10 && p.rageTimer <= 0)) {
      this.activateRageBuff();
    }

    if (e.isChaser) {
      this.fiscalChasing = false;
      p.score += 280;
    }

    if (e.type === 'estudante') {
      p.makeupShieldTimer = Math.max(p.makeupShieldTimer, 10 + this.shopLoadout.buffDurationBonus);
      p.shieldHits = 5;
      audio.playMakeup();
      this.spawnParticles(p.x, p.y, p.z + 20, '#38bdf8', 14);
    }

    if (p.enemiesDefeated > 0 && p.enemiesDefeated % 5 === 0) {
      p.strengthBuffTimer = 10 + this.shopLoadout.buffDurationBonus;
      audio.playMakeup();
      this.spawnParticles(p.x, p.y, p.z + 20, '#f97316', 18);
    }

    let drop: ItemType | undefined = e.guaranteedDrop;
    if (!drop) {
      const r = Math.random();
      if (e.type === 'idosa' && r < 0.25) {
        drop = 'bengala';
      } else if (e.type === 'vendedor' && r < 0.16) {
        drop = r < 0.06 ? 'bilhete_dourado' : 'chocolate';
      } else if (e.type === 'estudante' && r < 0.35) {
        drop = 'creditos';
      } else if (e.type === 'patricinha' && r < 0.25) {
        drop = r < 0.14 ? 'desodorante' : 'maquiagem';
      } else if (e.type === 'tio_audio' && r < 0.18) {
        drop = r < 0.07 ? 'cafezinho' : 'creditos';
      } else if (e.type === 'skatista' && r < 0.18) {
        drop = r < 0.07 ? 'cafezinho' : 'maquiagem';
      }
    }

    if (drop) {
      this.spawnDrop(drop, e.x, e.y);
    }

    if (e.isBoss) {
      if (!this.bossFinisherState) {
        this.startBossFinisher(e);
      } else {
        this.triggerBossFinisher(e);
      }
    }
    this.pushHudSnapshot();
  }

  private checkBossHalfHpTaunt(e: EnemyEntity) {
    if (!e.isBoss || e.halfHpTauntTriggered || e.hp <= 0 || e.hp > e.maxHp * 0.5) {
      return;
    }
    e.halfHpTauntTriggered = true;
    const taunts = [
      'SEU COTOVELO TÁ NA MINHA COSTELA!',
      'NÃO CABE NEM UMA SARDINHA AQUI!',
      'PARA DE EMPURRAR QUE EU TÔ PRENSADO!',
      'TÁ ACHANDO QUE ISSO AQUI É UBER?!',
      'MINHA MOCHILA TÁ ESMAGADA, ESTAGIÁRIO!',
      'DÁ LICENÇA QUE O FUNDÃO JÁ LOTOU!',
      'APERTADO ASSIM EU BATO ATÉ NO MOTORISTA!',
      'NINGUÉM DESCE NESSA PARADA NÃO!',
    ];
    e.speechText = taunts[Math.floor(Math.random() * taunts.length)];
    e.speechTimer = 3.2;
  }

  private getBossFinisherTheme(e: EnemyEntity): {
    primaryColor: string;
    secondaryColor: string;
    style: 'turnstile' | 'armor' | 'tickets';
    koSpeech: string;
  } {
    if (e.type === 'boss_cobrador_blindado') {
      return {
        primaryColor: '#ef4444',
        secondaryColor: '#94a3b8',
        style: 'armor',
        koSpeech: 'BLINDAGEM QUEBROU!',
      };
    }
    if (e.type === 'boss_fiscal_chefe') {
      return {
        primaryColor: '#38bdf8',
        secondaryColor: '#f8fafc',
        style: 'tickets',
        koSpeech: 'ANOTEI NA CADERNETA...',
      };
    }
    if (e.type === 'boss_motorista') {
      return {
        primaryColor: '#eab308',
        secondaryColor: '#38bdf8',
        style: 'turnstile',
        koSpeech: 'FREIO DE MÃO PUXADO!',
      };
    }
    return {
      primaryColor: '#f97316',
      secondaryColor: '#facc15',
      style: 'turnstile',
      koSpeech: 'MINHA CATRACA!',
    };
  }

  private startBossFinisher(e: EnemyEntity) {
    const p = this.player;
    const allKinds: BossFinisherKind[] = [
      'piledriver',
      'giant_swing',
      'ground_pound',
      'collar_knee',
    ];
    const candidates = this.lastBossFinisherKind
      ? allKinds.filter((k) => k !== this.lastBossFinisherKind)
      : allKinds;
    const kind = candidates[Math.floor(Math.random() * candidates.length)];
    this.lastBossFinisherKind = kind;

    const durationMap: Record<BossFinisherKind, number> = {
      piledriver: 1.25,
      giant_swing: 1.55,
      ground_pound: 1.35,
      collar_knee: 1.20,
    };
    const duration = durationMap[kind];

    const bounds = this.getActiveWaveBounds();
    const minAnchorX = Math.max(bounds.minX + 52, this.camX + 58);
    const maxAnchorX = Math.min(bounds.maxX - 52, this.camX + INTERNAL_WIDTH - 58);
    const anchorX = Math.max(minAnchorX, Math.min(maxAnchorX, p.x));
    const anchorY = Math.max(AISLE_MIN_Y + 8, Math.min(AISLE_MAX_Y - 8, p.y));
    const facing: 1 | -1 = e.x >= anchorX ? 1 : -1;

    p.x = anchorX;
    p.y = anchorY;
    p.z = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.facing = facing;
    p.invulnTimer = Math.max(p.invulnTimer, duration + 0.65);
    p.attackHasHit = true;
    this.bufferedAction = null;
    this.bufferTimer = 0;

    const animMap: Record<BossFinisherKind, PlayerAnimState> = {
      piledriver: 'finisherPiledriver',
      giant_swing: 'finisherGiantSwing',
      ground_pound: 'finisherGroundPound',
      collar_knee: 'finisherCollarKnee',
    };
    this.setPlayerAnim(animMap[kind], duration);

    e.aiState = 'finisherVictim';
    e.finisherKind = kind;
    e.finisherProg = 0;
    e.finisherPhaseAngle = 0;
    e.facing = (facing === 1 ? -1 : 1) as 1 | -1;
    e.vx = 0;
    e.vy = 0;
    e.vz = 0;
    e.z = 0;
    e.hitFlashTimer = 0;
    e.heavyHurtTimer = 0;
    e.speechText = '';
    e.speechTimer = 0;

    // Immediately interrupt any other active boss/enemy windups or dashes
    for (const other of this.enemies) {
      if (other.id === e.id || other.hp <= 0) continue;
      if (
        other.aiState === 'windup' ||
        other.aiState === 'spinWindup' ||
        other.aiState === 'skateWindup' ||
        other.aiState === 'attack' ||
        other.aiState === 'spinAttack' ||
        other.aiState === 'skateDash'
      ) {
        other.aiState = 'approach';
        other.stateTimer = 0;
      }
      other.attackCooldown = Math.max(other.attackCooldown, 1.4);
    }

    this.bossFinisherState = {
      victimId: e.id,
      kind,
      elapsed: 0,
      duration,
      anchorX,
      anchorY,
      facing,
      didGrabFx: true,
      swingWhooshCount: 0,
      poundHitCount: 0,
      kneeHitDone: false,
      slamImpactDone: false,
    };

    audio.playGrappleGrab();
    this.hitstopTimer = 0.05;
    this.triggerShake(0.14, 3.2);
    this.spawnParticles(anchorX + facing * 12, anchorY, 18, '#fde047', 10);
  }

  private updateBossFinisher(dt: number) {
    const fs = this.bossFinisherState;
    if (!fs) return;
    const p = this.player;
    const e = this.enemies.find((en) => en.id === fs.victimId);

    if (!e) {
      this.bossFinisherState = null;
      this.setPlayerAnim('idle', 0);
      p.z = 0;
      p.vz = 0;
      return;
    }

    fs.elapsed += dt;
    const prog = Math.max(0, Math.min(1, fs.elapsed / fs.duration));
    p.animTimer = Math.max(0, fs.duration - fs.elapsed);
    p.invulnTimer = Math.max(p.invulnTimer, 0.4);
    e.finisherProg = prog;
    e.hitFlashTimer = 0;

    if (fs.kind === 'piledriver') {
      if (prog < 0.22) {
        const t = prog / 0.22;
        e.x = fs.anchorX + fs.facing * (18 - 10 * t);
        e.y = fs.anchorY;
        e.z = 6 * t;
        p.x = fs.anchorX;
        p.y = fs.anchorY;
        p.z = 0;
      } else if (prog < 0.56) {
        const lift = Math.min(1, (prog - 0.22) / 0.2);
        e.x = fs.anchorX + fs.facing * 6;
        e.y = fs.anchorY + 0.5;
        e.z = 6 + 28 * lift;
        p.z = 8 * lift;
      } else if (prog < 0.8) {
        const slamT = Math.min(1, (prog - 0.56) / 0.08);
        e.x = fs.anchorX + fs.facing * 8;
        e.y = fs.anchorY + 0.5;
        e.z = 34 * (1 - slamT);
        p.z = 8 * (1 - slamT);
        if (prog >= 0.62 && !fs.slamImpactDone) {
          fs.slamImpactDone = true;
          audio.playFinisherSlam();
          vibrateHit(true);
          this.triggerShake(0.32, 7.5);
          this.impactFlashes.push({
            x: e.x,
            y: e.y - 6,
            life: 0.22,
            maxLife: 0.22,
            strong: true,
          });
          this.spawnParticles(e.x, e.y, 4, '#fde047', 16);
          this.spawnHitSparks(e.x, e.y, 4, fs.facing, {
            target: 'turnstile_boss',
            bossType: e.type,
            strong: true,
            finisher: true,
          });
        }
      } else {
        e.x = fs.anchorX + fs.facing * 12;
        e.y = fs.anchorY + 0.5;
        e.z = 0;
        p.z = 0;
      }
    } else if (fs.kind === 'giant_swing') {
      if (prog < 0.2) {
        const t = prog / 0.2;
        e.x = fs.anchorX + fs.facing * (20 - 4 * t);
        e.y = fs.anchorY;
        e.z = 4 * t;
      } else if (prog < 0.8) {
        const spinProg = (prog - 0.2) / 0.6;
        const angle = spinProg * Math.PI * 4 * fs.facing;
        e.finisherPhaseAngle = angle;
        e.x = fs.anchorX + Math.cos(angle) * 34;
        e.y = fs.anchorY + Math.sin(angle) * 14;
        e.z = 16 + Math.sin(spinProg * Math.PI) * 8;
        if (
          (spinProg >= 0.1 && fs.swingWhooshCount === 0) ||
          (spinProg >= 0.56 && fs.swingWhooshCount === 1)
        ) {
          fs.swingWhooshCount++;
          audio.playGiantSwingWhoosh();
          this.spawnParticles(e.x, e.y, e.z + 10, '#38bdf8', 8);
        }
      } else {
        const rel = (prog - 0.8) / 0.2;
        e.finisherPhaseAngle = 0;
        e.x = fs.anchorX + fs.facing * (34 + 28 * rel);
        e.y = fs.anchorY;
        e.z = 16 * (1 - rel * 0.35);
        if (!fs.slamImpactDone) {
          fs.slamImpactDone = true;
          audio.playFinisherSlam();
          vibrateHit(true);
          this.triggerShake(0.24, 5.5);
          this.spawnHitSparks(e.x, e.y, e.z + 10, fs.facing, {
            target: 'turnstile_boss',
            bossType: e.type,
            strong: true,
            finisher: true,
          });
        }
      }
    } else if (fs.kind === 'ground_pound') {
      e.x = fs.anchorX + fs.facing * 10;
      e.y = fs.anchorY - 1;
      e.z = 0;
      p.x = fs.anchorX;
      p.y = fs.anchorY;
      p.z = 0;
      if (prog >= 0.34 && fs.poundHitCount === 0) {
        fs.poundHitCount = 1;
        audio.playHeavyHit();
        vibrateHit(true);
        this.triggerShake(0.18, 4.8);
        this.impactFlashes.push({
          x: e.x,
          y: e.y - 10,
          life: 0.16,
          maxLife: 0.16,
          strong: true,
        });
        this.spawnHitSparks(e.x, e.y, 10, fs.facing, {
          target: 'turnstile_boss',
          bossType: e.type,
          strong: true,
        });
      } else if (prog >= 0.66 && fs.poundHitCount === 1) {
        fs.poundHitCount = 2;
        audio.playFinisherSlam();
        vibrateHit(true);
        this.triggerShake(0.28, 6.8);
        this.impactFlashes.push({
          x: e.x,
          y: e.y - 10,
          life: 0.22,
          maxLife: 0.22,
          strong: true,
        });
        this.spawnParticles(e.x, e.y, 8, '#fde047', 14);
        this.spawnHitSparks(e.x, e.y, 10, fs.facing, {
          target: 'turnstile_boss',
          bossType: e.type,
          strong: true,
          finisher: true,
        });
      }
    } else if (fs.kind === 'collar_knee') {
      if (prog < 0.28) {
        const t = prog / 0.28;
        e.x = fs.anchorX + fs.facing * (24 - 11 * t);
        e.y = fs.anchorY;
        e.z = 0;
      } else if (prog < 0.64) {
        e.x = fs.anchorX + fs.facing * 14;
        e.y = fs.anchorY;
        e.z = 2;
        if (prog >= 0.44 && !fs.kneeHitDone) {
          fs.kneeHitDone = true;
          audio.playKickImpact(true);
          audio.playHeavyHit();
          vibrateHit(true);
          this.triggerShake(0.22, 5.5);
          this.impactFlashes.push({
            x: e.x - fs.facing * 4,
            y: e.y - 22,
            life: 0.18,
            maxLife: 0.18,
            strong: true,
          });
          this.spawnHitSparks(e.x, e.y, 20, fs.facing, {
            target: 'turnstile_boss',
            bossType: e.type,
            strong: true,
            finisher: true,
          });
        }
      } else {
        const sh = (prog - 0.64) / 0.36;
        e.x = fs.anchorX + fs.facing * (14 + 20 * sh);
        e.y = fs.anchorY;
        e.z = 5 * Math.sin(sh * Math.PI);
        if (prog >= 0.86 && !fs.slamImpactDone) {
          fs.slamImpactDone = true;
          audio.playFinisherSlam();
          this.triggerShake(0.22, 5.0);
          this.spawnParticles(e.x, e.y, 4, '#fde047', 12);
        }
      }
    }

    e.x = Math.max(24, Math.min(this.line.busLength - 32, e.x));
    e.y = Math.max(AISLE_MIN_Y, Math.min(AISLE_MAX_Y, e.y));

    if (prog >= 1) {
      const completedKind = fs.kind;
      const pushDir = fs.facing;
      this.bossFinisherState = null;
      e.finisherKind = undefined;
      e.finisherProg = undefined;
      e.finisherPhaseAngle = undefined;
      this.setPlayerAnim('idle', 0);
      p.z = 0;
      p.vz = 0;
      p.vx = 0;
      p.vy = 0;
      this.triggerBossFinisher(e, completedKind, pushDir);
    }
  }

  private triggerBossFinisher(
    e: EnemyEntity,
    finisherKind?: BossFinisherKind,
    pushDir?: 1 | -1
  ) {
    const theme = this.getBossFinisherTheme(e);
    const isFinalBoss = !this.hasRemainingBosses(e);
    const tossDir = pushDir ?? (-e.facing as 1 | -1);

    e.aiState = 'knockdown';
    e.stateTimer = isFinalBoss ? 0.88 : 0.46;
    e.vz = finisherKind === 'giant_swing' ? 195 : isFinalBoss ? 175 : 115;
    e.z = Math.max(e.z, 2);
    e.vx = tossDir * (finisherKind === 'giant_swing' ? 210 : 120);
    e.hitFlashTimer = 0.25;
    e.speechText = theme.koSpeech;
    e.speechTimer = isFinalBoss ? 1.05 : 0.85;

    if (isFinalBoss) {
      this.hitstopTimer = 0.2;
      this.bossBulletTimeTimer = Math.max(this.bossBulletTimeTimer, 0.78);
      this.bossKoFlashTimer = 0.55;
      this.bossKoTrailTimer = 0.035;
      this.triggerShake(0.6, 8.5);
      audio.playBossFinisher();
      vibrateHit(true);

      this.bossFinisherEffects.push({
        x: e.x,
        y: e.y,
        z: e.z,
        life: 0.95,
        maxLife: 0.95,
        label: 'K.O.!',
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        style: theme.style,
      });
    } else {
      this.bossKoTrailTimer = 0.06;
      this.triggerShake(0.28, 5.5);
      audio.playHeavyHit();
      vibrateHit(true);
    }

    this.spawnParticles(e.x, e.y, e.z + 20, '#facc15', isFinalBoss ? 22 : 14);
    this.spawnParticles(e.x, e.y, e.z + 22, theme.primaryColor, isFinalBoss ? 14 : 9);
    this.spawnHitSparks(e.x, e.y, e.z + 22, tossDir, {
      target: 'turnstile_boss',
      bossType: e.type,
      strong: true,
      finisher: true,
    });
  }

  private spawnBossKoBurst(e: EnemyEntity) {
    const theme = this.getBossFinisherTheme(e);
    const isFinalBoss = !this.hasRemainingBosses(e);
    audio.playHeavyHit();

    if (isFinalBoss) {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.085);
      this.triggerShake(0.52, 8.5);
      this.bossKoFlashTimer = 0.42;
      this.bossKoOverlay = {
        life: 1.4,
        maxLife: 1.4,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        style: theme.style,
      };
      this.bossFinisherEffects.push({
        x: e.x,
        y: e.y,
        z: e.z,
        life: 1.05,
        maxLife: 1.05,
        label: '',
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        style: theme.style,
      });
    } else {
      this.triggerShake(0.26, 4.8);
    }

    this.spawnParticles(e.x, e.y, e.z + 18, '#facc15', isFinalBoss ? 20 : 12);
    this.spawnParticles(e.x, e.y, e.z + 18, theme.primaryColor, isFinalBoss ? 16 : 8);
    this.spawnParticles(e.x, e.y, e.z + 20, '#f97316', isFinalBoss ? 12 : 6);
    this.spawnHitSparks(e.x, e.y, e.z + 18, -e.facing, {
      target: 'turnstile_boss',
      bossType: e.type,
      strong: true,
      finisher: true,
    });

    if (isFinalBoss && this.player.hp > 0) {
      const p = this.player;
      this.setPlayerAnim(this.pickUniqueVictoryPose(), 1.0);
      p.vx = 0;
      p.vy = 0;
      p.z = 0;
      p.vz = 0;
      p.invulnTimer = Math.max(p.invulnTimer, 1.15);
      audio.playHeal();
      this.spawnParticles(p.x, p.y, 26, '#facc15', 14);
    }
  }

  private activateRageBuff() {
    const p = this.player;
    p.rageTimer = 15;
    p.rageNotificationTimer = 5.0;
    audio.playSpecial();
    audio.playCorporateNotification();
    vibrateSpecial('rage');
    this.triggerShake(0.45, 7);
    this.comboTintTimer = 0.75;
    this.spawnParticles(p.x, p.y, p.z + 22, '#6366f1', 22);

    const bounds = this.getActiveWaveBounds();
    const activeRegulars = this.enemies.filter(
      (en) => !en.isRageClone && en.hp > 0 && (en.type === 'idosa' || en.type === 'patricinha')
    );

    if (activeRegulars.length > 0) {
      for (const orig of activeRegulars) {
        const cloneX = Math.min(
          bounds.maxX - 20,
          Math.max(bounds.minX + 20, orig.x + (orig.x > p.x ? 26 : -26))
        );
        const cloneY = orig.y > 190 ? orig.y - 22 : orig.y + 22;
        const clone = this.spawnEnemy(orig.type, cloneX, cloneY, false);
        clone.isRageClone = true;
      }
    } else {
      const activeWave = this.waves.find((w) => w.triggered && !w.cleared && !w.isBossWave);
      if (activeWave) {
        const regularSpawns = activeWave.spawns.filter(
          (s) => s.type === 'idosa' || s.type === 'patricinha'
        );
        for (const s of regularSpawns) {
          const spawnX = Math.min(
            activeWave.lockMaxX - 24,
            Math.max(p.x + 125, s.offsetX)
          );
          const clone = this.spawnEnemy(s.type, spawnX, s.y, false);
          clone.isRageClone = true;
        }
      }
    }
  }

  private resetComboStreak() {
    const p = this.player;
    p.comboStreak = 0;
    p.comboMultiplier = 1;
    p.hitsLanded = 0;
    this.hitChainTimer = 0;
    p.headphoneWhipUsed = false;
    this.comboTintTimer = 0;
    this.comboEdgeFlashTimer = 0;
    this.comboEdgeFlashStrength = 0;
    this.clearBufferedComboInput();
  }

  private damagePlayer(rawDmg: number) {
    const p = this.player;
    if (p.invulnTimer > 0 || this.bossFinisherState) return;

    if (p.anim === 'bagGuard') {
      this.triggerBagCounterSpin(true);
      return;
    }
    if (p.anim === 'bagSpin') {
      return;
    }

    if (p.makeupShieldTimer > 0 && p.shieldHits > 0) {
      p.invulnTimer = 0.28;
      p.shieldHits--;
      audio.playBlock();
      vibrateDamage(true);
      this.impactFlashes.push({
        x: p.x + p.facing * 8,
        y: p.y - p.z - 18,
        life: 0.13,
        maxLife: 0.13,
        strong: false,
        kind: 'blocked',
        dir: p.facing,
      });
      this.spawnHitSparks(p.x + p.facing * 6, p.y, p.z + 18, p.facing, {
        target: 'barrier',
        blocked: true,
        attackType: 'blocked',
      });
      if (p.shieldHits <= 0) {
        p.makeupShieldTimer = 0;
      }
      this.pushHudSnapshot();
      return;
    }

    const diff = LINE_DIFFICULTY[this.line.lineNumber];
    const dmg = Math.max(2, Math.round(rawDmg * diff.damageMult));
    p.hp = Math.max(0, p.hp - dmg);
    this.damageTakenThisLine = true;
    this.seatRestHoldTimer = 0;
    this.resetComboStreak();
    p.invulnTimer = 0.42;
    p.hitFlashTimer = 0.16;
    this.clearBufferedComboInput();
    this.setPlayerAnim('hurt', 0.22);
    audio.playHurt();
    this.triggerShake(0.16, 4);
    this.spawnHitSparks(p.x, p.y, p.z + 20, -p.facing, { target: 'player' });

    if (p.hp <= 0) {
      if (!this.dailyRunCounted) {
        this.dailyRunCounted = true;
        this.trackDailyMission('complete_runs', 1);
      }
      this.gameState = 'GAME_OVER';
      audio.playGameOver();
      vibrateGameOver();
    } else {
      vibrateDamage(false);
    }
    this.pushHudSnapshot();
  }

  private triggerShake(duration: number, mag: number) {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private updateBusEvents(dt: number) {
    if (this.turnstileCleared && this.gameMode !== 'infinite') return;

    if (this.busEventState !== 'none') {
      this.busEventWarnTimer -= dt;
      if (this.busEventWarnTimer <= 0) {
        const stateMap = {
          brake_warn: 'brake',
          bump_warn: 'bump',
          curve_warn: 'curve',
          window_vendor_warn: 'window_vendor',
          express_surge_warn: 'express_surge',
          door_crowd_warn: 'door_crowd',
          short_circuit_warn: 'short_circuit',
        } as const;
        const kind = stateMap[this.busEventState];
        this.busEventState = 'none';
        this.executeBusEvent(kind);
        this.busEventCooldown = 14 + Math.random() * 5;
      }
      return;
    }

    this.busEventCooldown -= dt;
    if (this.busEventCooldown <= 0) {
      const slot = this.busEventStep % 5;
      this.busEventStep++;
      if (slot === 0) {
        this.busEventState = 'brake_warn';
        this.busEventWarnTimer = 1.4;
        audio.playStopBell();
        this.showAlert('SEGURA NO FERRO! FREIO BRUSCO!', 1.4);
      } else if (slot === 1) {
        this.busEventState = 'bump_warn';
        this.busEventWarnTimer = 1.4;
        audio.playStopBell();
        this.showAlert('LOMBADA À FRENTE! PULE!', 1.4);
      } else if (slot === 2) {
        this.busEventState = 'door_crowd_warn';
        this.busEventWarnTimer = 1.4;
        audio.playWhistle();
        this.showAlert('PARADA DE EMBARQUE! PORTA ABRINDO!', 1.4);
      } else if (slot === 3) {
        this.busEventState = 'short_circuit_warn';
        this.busEventWarnTimer = 1.3;
        audio.playStopBell();
        this.showAlert('CURTO-CIRCUITO NO TETO! CARGA ELÉTRICA!', 1.3);
      } else if (this.line.lineNumber === 1) {
        this.busEventState = 'curve_warn';
        this.busEventWarnTimer = 1.5;
        audio.playStopBell();
        this.showAlert('CURVA FECHADA! SEGURA NA ALÇA!', 1.5);
      } else if (this.line.lineNumber === 2) {
        this.busEventState = 'window_vendor_warn';
        this.busEventWarnTimer = 1.4;
        audio.playWhistle();
        this.showAlert('SINAL VERMELHO! VENDEDOR NA JANELA!', 1.4);
      } else {
        this.busEventState = 'express_surge_warn';
        this.busEventWarnTimer = 1.4;
        audio.playStopBell();
        this.showAlert('PISTA EXPRESSA! VENTANIA TURBO!', 1.4);
      }
    }
  }

  private executeBusEvent(
    kind: 'brake' | 'bump' | 'curve' | 'window_vendor' | 'express_surge' | 'door_crowd' | 'short_circuit'
  ) {
    const p = this.player;
    if (kind === 'brake') {
      audio.playBusBrake();
      this.triggerShake(0.42, 6);

      if (p.z < 6 && p.anim !== 'railGrab' && p.anim !== 'railSpin') {
        this.busSlideVx = -165;
      }

      for (const e of this.enemies) {
        if (e.hp <= 0 || e.z >= 8) continue;
        const push = e.isBoss ? -95 : -215;
        e.vx = push;
        e.aiState = 'hurt';
        e.stateTimer = Math.max(e.stateTimer, 0.32);
      }

      // Check enemy-on-enemy chain collisions from brake slide
      for (let i = 0; i < this.enemies.length; i++) {
        const a = this.enemies[i];
        if (a.hp <= 0 || a.isBoss) continue;
        for (let j = i + 1; j < this.enemies.length; j++) {
          const b = this.enemies[j];
          if (b.hp <= 0) continue;
          if (Math.abs(a.x - b.x) < 28 && Math.abs(a.y - b.y) < 18) {
            a.hp -= 10;
            b.hp -= 10;
            this.spawnParticles((a.x + b.x) / 2, a.y, 14, '#fde047', 6);
            this.addFloatingText('-10', a.x, a.y, 34, '#fb923c');
            if (a.hp <= 0) this.handleEnemyDefeated(a);
            if (b.hp <= 0) this.handleEnemyDefeated(b);
            break;
          }
        }
      }
    } else if (kind === 'bump') {
      audio.playBusBump();
      this.triggerShake(0.32, 5);

      if (p.z === 0 && p.anim !== 'railGrab' && p.anim !== 'railSpin') {
        p.vz = 155;
        p.anim = 'jump';
      }

      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (e.z <= 2) {
          e.vz = e.isBoss ? 120 : 205;
          e.z = 2;
          if (!e.isBoss) {
            e.aiState = 'hurt';
            e.stateTimer = Math.max(e.stateTimer, 0.38);
          }
          this.spawnParticles(e.x, e.y, 4, '#cbd5e1', 4);
        }
      }
    } else if (kind === 'curve') {
      audio.playBusCurve();
      this.triggerShake(0.4, 5);
      const dir = Math.random() < 0.5 ? -1 : 1;

      if (p.z < 6 && p.anim !== 'railGrab' && p.anim !== 'railSpin') {
        this.busCurveVy = dir * 155;
      }

      for (const e of this.enemies) {
        if (e.hp <= 0 || e.z >= 8) continue;
        const nextY = e.y + dir * (e.isBoss ? 18 : 36);
        const clampedY = Math.max(AISLE_MIN_Y, Math.min(AISLE_MAX_Y, nextY));
        e.y = clampedY;
        if (clampedY === AISLE_MIN_Y || clampedY === AISLE_MAX_Y) {
          e.hp -= 8;
          e.hitFlashTimer = 0.16;
          this.spawnParticles(e.x, e.y, 14, '#fde047', 6);
          this.addFloatingText('-8', e.x, e.y, 34, '#fb923c');
          if (e.hp <= 0) {
            this.handleEnemyDefeated(e);
          } else {
            this.checkBossHalfHpTaunt(e);
          }
        }
      }
    } else if (kind === 'window_vendor') {
      audio.playGumSplat();
      const count = 3;
      const travelTime = 0.62;
      for (let i = 0; i < count; i++) {
        const startX = this.camX + 95 + i * 110;
        const targetY = AISLE_MIN_Y + 12 + Math.random() * (AISLE_MAX_Y - AISLE_MIN_Y - 24);
        this.projectiles.push({
          id: this.nextId++,
          kind: 'gum',
          fromPlayer: false,
          x: startX,
          y: 112,
          z: 36,
          vx: (Math.random() - 0.5) * 40,
          vy: (targetY - 112) / travelTime,
          vz: 85,
          damage: 8,
          life: 0.9,
          radius: 10,
        });
      }
    } else if (kind === 'door_crowd') {
      audio.playStopBell();
      const bounds = this.getActiveWaveBounds();
      if (this.enemies.length < 7) {
        const spawnX = Math.min(bounds.maxX - 24, Math.max(bounds.minX + 100, this.camX + INTERNAL_WIDTH - 48));
        const extraType: EnemyType = Math.random() < 0.5 ? 'tio_audio' : 'patricinha';
        const extraDrop: ItemType | undefined = Math.random() < 0.4 ? 'cafezinho' : undefined;
        const en = this.spawnEnemy(extraType, spawnX, 176, false, extraDrop);
        en.speechText = 'LICENÇA QUE TÁ LOTADO!';
        en.speechTimer = 2.0;
        this.spawnParticles(spawnX, 176, 18, '#facc15', 10);
      } else if (Math.random() < 0.45) {
        this.spawnDrop('cafezinho', Math.min(bounds.maxX - 30, p.x + 70), 186);
      }
    } else if (kind === 'short_circuit') {
      this.shortCircuitTimer = 3.8;
      this.addSpecialEnergy(25);
      audio.playSoundWave();
      this.triggerShake(0.28, 4.5);
      for (const e of this.enemies) {
        if (e.hp > 0 && !e.isBoss && Math.abs(e.x - p.x) < 160) {
          e.aiState = 'hurt';
          e.stateTimer = Math.max(e.stateTimer, 0.35);
          e.hitFlashTimer = 0.14;
        }
      }
    } else {
      this.expressWindTimer = 6.0;
      audio.playExpressWind();
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;

    const finisherActive = Boolean(this.bossFinisherState);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.aiState === 'finisherVictim') {
        continue;
      }

      if (e.aiState === 'knockdown') {
        e.stateTimer -= dt;
        e.walkPhase += dt * 4;
        e.x += e.vx * dt;
        e.vx *= Math.pow(0.18, dt);
        if (e.z > 0 || e.vz !== 0) {
          e.z += e.vz * dt;
          e.vz -= GRAVITY * dt;
          if (e.z <= 0) {
            e.z = 0;
            if (Math.abs(e.vz) > 75) {
              e.vz = Math.abs(e.vz) * 0.42;
              e.z = 1;
              this.triggerShake(0.18, 4.5);
              audio.playBusBump();
              this.spawnParticles(e.x, e.y, 6, '#facc15', 10);
            } else {
              e.vz = 0;
            }
          }
        }
        this.bossKoTrailTimer -= dt;
        if (this.bossKoTrailTimer <= 0) {
          this.bossKoTrailTimer = 0.09;
          this.spawnParticles(
            e.x,
            e.y,
            e.z + 16,
            Math.random() < 0.5 ? '#facc15' : '#f97316',
            3
          );
        }
        e.x = Math.max(24, Math.min(this.line.busLength - 32, e.x));
        if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
        if (e.speechTimer > 0) e.speechTimer = Math.max(0, e.speechTimer - dt);
        if (e.stateTimer <= 0) {
          this.spawnBossKoBurst(e);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.heavyHurtTimer && e.heavyHurtTimer > 0) {
        e.heavyHurtTimer = Math.max(0, e.heavyHurtTimer - dt);
      }
      if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      if (e.speechTimer > 0) e.speechTimer = Math.max(0, e.speechTimer - dt);
      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      if (finisherActive) {
        e.attackCooldown = Math.max(e.attackCooldown, 1.0);
        if (
          e.aiState === 'windup' ||
          e.aiState === 'spinWindup' ||
          e.aiState === 'skateWindup' ||
          e.aiState === 'attack' ||
          e.aiState === 'spinAttack' ||
          e.aiState === 'skateDash'
        ) {
          e.aiState = 'approach';
          e.stateTimer = 0;
        }
      }
      if (e.guardBrokenTimer > 0) {
        e.guardBrokenTimer = Math.max(0, e.guardBrokenTimer - dt);
        if (e.guardBrokenTimer === 0 && e.guardMax > 0) {
          e.guardHp = e.guardMax;
          if (e.type === 'estudante') {
            e.hasFrontBarrier = true;
          }
        }
      }

      if (!finisherActive && e.type === 'industria' && e.stinkActive && e.aiState !== 'hurt') {
        const dist = Math.hypot(p.x - e.x, (p.y - e.y) * 1.5);
        if (dist <= 40 && p.z < 18) {
          e.stinkTickTimer -= dt;
          if (e.stinkTickTimer <= 0) {
            e.stinkTickTimer = 0.6;
            this.damagePlayer(4);
          }
        }
      }

      const diff = LINE_DIFFICULTY[this.line.lineNumber];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (e.aiState === 'hurt') {
        e.stateTimer -= dt;
        e.x += e.vx * dt;
        e.vx *= Math.pow(0.04, dt);
        if (e.z > 0 || e.vz !== 0) {
          e.z += e.vz * dt;
          e.vz -= GRAVITY * dt;
          if (e.z <= 0) {
            e.z = 0;
            e.vz = 0;
          }
        }
        if (e.stateTimer <= 0) {
          e.aiState = 'approach';
          e.heavyHurtTimer = 0;
        }
      } else if (e.aiState === 'skateWindup') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'skateDash';
          e.stateTimer = 0.68;
          e.spinTickTimer = 0;
          audio.playSkateDash();
        }
      } else if (e.aiState === 'skateDash') {
        e.stateTimer -= dt;
        e.x += e.facing * 230 * diff.speedMult * dt;
        e.walkPhase += dt * 4;
        if (absDx < 26 && absDy < 16 && p.z < 18 && e.spinTickTimer <= 0) {
          e.spinTickTimer = 0.5;
          this.damagePlayer(10);
          p.vx = e.facing * 150;
        }
        if (e.stateTimer <= 0) {
          e.aiState = 'cooldown';
          e.stateTimer = 0.75 * diff.cooldownMult;
          e.attackCooldown = 2.0 * diff.cooldownMult;
        }
      } else if (e.aiState === 'spinWindup') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'spinAttack';
          e.stateTimer = 1.6;
          e.spinTickTimer = 0.05;
          audio.playTurnstileSpin();
        }
      } else if (e.aiState === 'spinAttack') {
        e.stateTimer -= dt;
        const dirX = Math.sign(dx) || e.facing;
        const dirY = Math.sign(dy);
        const activeArmorLevel = e.guardBrokenTimer > 0 ? 0 : Math.max(0, e.guardHp);
        const armorSpeedMult = Math.max(0.42, 1 - activeArmorLevel * 0.09);
        const spinSpeed =
          (e.type === 'boss_cobrador_blindado' ? 88 : 76) * diff.speedMult * armorSpeedMult;
        e.x += dirX * spinSpeed * dt;
        e.y += dirY * 45 * diff.speedMult * armorSpeedMult * dt;

        if (absDx < 32 && absDy < 20 && p.z < 20) {
          e.spinTickTimer -= dt;
          if (e.spinTickTimer <= 0) {
            e.spinTickTimer = 0.32;
            this.damagePlayer(e.type === 'boss_cobrador_blindado' ? 9 : 7);
          }
        }

        if (e.stateTimer <= 0) {
          e.aiState = 'cooldown';
          e.stateTimer = 0.85 * diff.cooldownMult;
          e.attackCooldown = 2.4 * diff.cooldownMult;
        }
      } else if (e.aiState === 'windup') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'attack';
          e.stateTimer = 0.24;
          this.executeEnemyAttack(e);
        }
      } else if (e.aiState === 'attack') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'cooldown';
          e.stateTimer = 0.45 * diff.cooldownMult;
          e.attackCooldown = (e.type === 'patricinha' ? 0.85 : 1.15) * diff.cooldownMult;
        }
      } else if (e.aiState === 'cooldown') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'approach';
        }
      } else if (finisherActive) {
        e.facing = dx >= 0 ? 1 : -1;
        e.walkPhase += dt * 0.4;
        if (absDx < 58) {
          e.x -= Math.sign(dx || 1) * 32 * dt;
        }
      } else {
        e.facing = dx >= 0 ? 1 : -1;

        const activeArmorLevel = e.guardBrokenTimer > 0 ? 0 : Math.max(0, e.guardHp);
        // Quanto maior o nível de blindagem (guardHp), menor a velocidade do inimigo
        const armorSpeedMult = Math.max(0.42, 1 - activeArmorLevel * 0.09);
        e.walkPhase += dt * (0.62 + 0.38 * armorSpeedMult);

        const baseSpeed =
          e.type === 'patricinha'
            ? 84
            : e.type === 'skatista'
              ? 92
              : e.isChaser
                ? 98
                : e.type === 'fiscal' || e.type === 'boss_fiscal_chefe'
                  ? 88
                  : e.type === 'boss_motorista'
                    ? 72
                    : e.type === 'boss_cobrador_blindado' || e.type === 'boss_cobrador'
                      ? 62
                      : e.type === 'industria'
                        ? 56
                        : e.type === 'tio_audio'
                          ? 48
                          : 58;
        const windSlowMult = this.expressWindTimer > 0 && !e.isBoss ? 0.85 : 1;
        const speed =
          baseSpeed *
          (e.isChaser ? Math.max(1, diff.speedMult) : diff.speedMult) *
          windSlowMult *
          armorSpeedMult;

        if (e.type === 'vendedor' || e.type === 'tio_audio') {
          const idealDist = e.type === 'tio_audio' ? 96 : 82;
          if (absDx > idealDist + 18) {
            e.x += Math.sign(dx) * speed * dt;
          } else if (absDx < 45) {
            e.x -= Math.sign(dx) * speed * 0.75 * dt;
          }
          if (absDy > 8) {
            e.y += Math.sign(dy) * speed * 0.6 * dt;
          }
          if (e.attackCooldown <= 0 && absDx < 155 && absDy < 34) {
            e.aiState = 'windup';
            e.stateTimer = 0.42 * diff.windupMult;
            if (e.type === 'tio_audio') {
              e.speechText = Math.random() < 0.5 ? 'ESCUTA ESSE ZAP!' : 'SOM NO TALO!';
            } else {
              e.speechText = Math.random() < 0.6 ? 'Cuidado com o rapa!' : 'CHICLETE!';
            }
            e.speechTimer = 1.4;
          }
        } else if (e.type === 'skatista' && e.attackCooldown <= 0 && absDx >= 55 && absDx < 175 && absDy < 22) {
          e.aiState = 'skateWindup';
          e.stateTimer = 0.45 * diff.windupMult;
          e.speechText = 'SAI DA FRENTE!';
          e.speechTimer = 1.0;
        } else if (
          (e.type === 'boss_cobrador' || e.type === 'boss_cobrador_blindado' || e.type === 'boss_motorista') &&
          e.attackCooldown <= 0 &&
          absDx < 145 &&
          Math.random() < 0.55
        ) {
          e.aiState = 'spinWindup';
          e.stateTimer = 0.65 * diff.windupMult;
          e.speechText = e.type === 'boss_motorista' ? 'VOLANTE TURBO!' : 'ROLETA GIRATÓRIA!';
          e.speechTimer = 1.2;
        } else if (
          (e.type === 'fiscal' || e.type === 'boss_fiscal_chefe') &&
          e.attackCooldown <= 0 &&
          absDx > 80 &&
          absDx < 200
        ) {
          e.aiState = 'windup';
          e.stateTimer = 0.4 * diff.windupMult;
          e.speechText = 'CADÊ O BILHETE?!';
          e.speechTimer = 1.1;
        } else if (
          e.type === 'boss_motorista' &&
          e.attackCooldown <= 0 &&
          absDx > 65 &&
          absDx < 205
        ) {
          e.aiState = 'windup';
          e.stateTimer = 0.42 * diff.windupMult;
          e.speechText = 'BUZINA NA ORELHA!';
          e.speechTimer = 1.1;
        } else {
          if (absDx > 28) {
            e.x += Math.sign(dx) * speed * dt;
          }
          if (absDy > 8) {
            e.y += Math.sign(dy) * speed * 0.68 * dt;
          }
          if (absDx <= 34 && absDy <= 15 && e.attackCooldown <= 0) {
            e.aiState = 'windup';
            e.stateTimer = (e.type === 'patricinha' ? 0.32 : 0.44) * diff.windupMult;
            if (e.type === 'idosa' && Math.random() < 0.65) {
              e.speechText = 'Eu quero ir pra Lapa!';
              e.speechTimer = 1.4;
            } else if (e.type === 'estudante' && Math.random() < 0.65) {
              e.speechText = 'Olha o SENAI!';
              e.speechTimer = 1.4;
            }
          }
        }
      }

      if (e.z > 0 || e.vz !== 0) {
        e.z += e.vz * dt;
        e.vz -= GRAVITY * dt;
        if (e.z <= 0) {
          e.z = 0;
          e.vz = 0;
        }
      }

      e.x = Math.max(20, Math.min(this.line.busLength - 28, e.x));
      e.y = Math.max(AISLE_MIN_Y, Math.min(AISLE_MAX_Y, e.y));
    }
  }

  private executeEnemyAttack(e: EnemyEntity) {
    const p = this.player;
    const dx = p.x - e.x;
    const dy = Math.abs(p.y - e.y);

    if (e.type === 'vendedor') {
      audio.playGumSplat();
      const clampedDx = Math.max(-105, Math.min(105, p.x - e.x));
      const targetX = e.x + clampedDx;
      const travelTime = 0.48;
      this.projectiles.push({
        id: this.nextId++,
        kind: 'gum',
        fromPlayer: false,
        x: e.x + e.facing * 8,
        y: e.y,
        z: 20,
        vx: (targetX - e.x) / travelTime,
        vy: ((p.y - e.y) / travelTime) * 0.7,
        vz: 96,
        damage: 8,
        life: 0.68,
        radius: 10,
      });
      return;
    }

    if (e.type === 'tio_audio') {
      audio.playSoundWave();
      this.projectiles.push({
        id: this.nextId++,
        kind: 'sound_ring',
        fromPlayer: false,
        x: e.x + e.facing * 12,
        y: e.y,
        z: 20,
        vx: e.facing * 155,
        vy: 0,
        vz: 0,
        damage: 8,
        life: 1.15,
        radius: 14,
      });
      return;
    }

    if (e.type === 'boss_motorista' && Math.abs(dx) > 54) {
      audio.playSoundWave();
      this.projectiles.push({
        id: this.nextId++,
        kind: 'sound_ring',
        fromPlayer: false,
        x: e.x + e.facing * 14,
        y: e.y,
        z: 22,
        vx: e.facing * 180,
        vy: 0,
        vz: 0,
        damage: 11,
        life: 1.25,
        radius: 17,
      });
      return;
    }

    if ((e.type === 'fiscal' || e.type === 'boss_fiscal_chefe') && Math.abs(dx) > 52) {
      audio.playWhistle();
      this.projectiles.push({
        id: this.nextId++,
        kind: e.type === 'boss_fiscal_chefe' ? 'fine_ticket' : 'whistle_wave',
        fromPlayer: false,
        x: e.x + e.facing * 12,
        y: e.y,
        z: 18,
        vx: e.facing * 175,
        vy: 0,
        vz: 0,
        damage: e.type === 'boss_fiscal_chefe' ? 12 : 9,
        life: 1.4,
        radius: 14,
      });
      return;
    }

    const reach = e.isBoss ? 42 : 34;
    if (dx * e.facing >= -6 && dx * e.facing <= reach && dy <= 16 && p.z < 22) {
      const dmg =
        e.type === 'boss_cobrador_blindado'
          ? 15
          : e.isBoss
            ? 12
            : e.type === 'estudante'
              ? 11
              : 9;
      this.damagePlayer(dmg);
      if (e.type === 'estudante') {
        p.vx = e.facing * 180;
      }
    }
  }

  private updateProjectiles(dt: number) {
    const p = this.player;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.kind === 'gum') {
        pr.z += pr.vz * dt;
        pr.vz -= GRAVITY * 0.65 * dt;
        if (pr.z <= 0) {
          audio.playGumSplat();
          this.hazards.push({
            id: this.nextId++,
            kind: 'gum_puddle',
            x: pr.x,
            y: Math.max(AISLE_MIN_Y + 4, Math.min(AISLE_MAX_Y - 4, pr.y)),
            radius: 15,
            life: 6.0,
          });
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (pr.fromPlayer && pr.kind === 'spray_cloud') {
        for (const e of this.enemies) {
          if (
            e.type === 'industria' &&
            e.stinkActive &&
            Math.abs(e.x - pr.x) < pr.radius &&
            Math.abs(e.y - pr.y) < 24
          ) {
            e.stinkActive = false;
            e.hitFlashTimer = 0.2;
            p.score += 150;
            this.registerHitChain(1);
            this.spawnParticles(e.x, e.y, 20, '#38bdf8', 14);
          }
        }
      } else if (pr.fromPlayer && pr.kind === 'sound_ring') {
        let hitSet = this.soundRingHits.get(pr.id);
        if (!hitSet) {
          hitSet = new Set<number>();
          this.soundRingHits.set(pr.id, hitSet);
        }
        for (const e of this.enemies) {
          if (e.hp <= 0 || hitSet.has(e.id)) continue;
          if (Math.abs(e.x - pr.x) < pr.radius && Math.abs(e.y - pr.y) < 34) {
            hitSet.add(e.id);
            if (e.type === 'industria' && e.stinkActive) {
              e.stinkActive = false;
            }
            e.hp -= pr.damage;
            e.hitFlashTimer = 0.16;
            e.aiState = 'hurt';
            e.stateTimer = 0.36;
            const kbDir = pr.vx >= 0 ? 1 : -1;
            e.vx = kbDir * 155;
            p.score += pr.damage * 2;
            this.registerHitChain(1);
            vibrateHit(true);
            if (e.type === 'boss_cobrador_blindado' || e.type === 'boss_cobrador') {
              audio.playMetallicImpact(false);
            } else {
              audio.playPunchSnap();
            }
            this.impactFlashes.push({
              x: e.x - kbDir * 6,
              y: e.y - e.z - 20,
              life: 0.14,
              maxLife: 0.14,
              strong: true,
              kind: 'finisher',
              dir: kbDir as 1 | -1,
            });
            this.spawnHitSparks(e.x, e.y, e.z + 20, kbDir, {
              target: e.isBoss ? 'turnstile_boss' : 'passenger',
              bossType: e.type,
              strong: true,
              attackType: 'finisher',
            });
            this.addFloatingText(`-${pr.damage}`, e.x, e.y, e.z + 34, '#38bdf8');
            if (e.hp <= 0) {
              this.handleEnemyDefeated(e);
            } else {
              this.checkBossHalfHpTaunt(e);
            }
          }
        }
      } else if (!pr.fromPlayer && !this.bossFinisherState) {
        if (
          Math.abs(pr.x - p.x) < pr.radius &&
          Math.abs(pr.y - p.y) < 16 &&
          Math.abs(pr.z - (p.z + 14)) < 18
        ) {
          if (p.anim === 'bagGuard') {
            this.triggerBagCounterSpin(true);
            this.projectiles.splice(i, 1);
            continue;
          }
          if (p.anim === 'bagSpin') {
            this.spawnParticles(pr.x, pr.y, pr.z, '#38bdf8', 6);
            this.projectiles.splice(i, 1);
            continue;
          }
          this.damagePlayer(pr.damage);
          if (pr.kind === 'gum') {
            p.stickySlowTimer = 2.0;
          }
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (pr.life <= 0) {
        this.soundRingHits.delete(pr.id);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateHazards(dt: number) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      if (h.life <= 0) {
        this.hazards.splice(i, 1);
        continue;
      }
      if (p.z < 4 && Math.abs(p.x - h.x) < h.radius && Math.abs(p.y - h.y) < 11) {
        if (p.stickySlowTimer <= 0.2) {
          p.stickySlowTimer = 1.6;
        }
      }
    }
  }

  private updateDrops(dt: number) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.bobPhase += dt;
      if (d.z > 0 || d.vz !== 0) {
        d.z += d.vz * dt;
        d.vz -= GRAVITY * dt;
        if (d.z <= 0) {
          d.z = 0;
          d.vz = 0;
        }
      }

      if (Math.abs(d.x - p.x) < 22 && Math.abs(d.y - p.y) < 18 && p.z < 24) {
        this.collectItem(d);
        this.drops.splice(i, 1);
        continue;
      }

      if (d.life <= 0) {
        this.drops.splice(i, 1);
      }
    }
  }

  private collectItem(d: DropItem) {
    const p = this.player;
    switch (d.type) {
      case 'bengala':
        p.caneCharges = 6;
        this.caneHintTimer = 4.5;
        audio.playPickup();
        break;
      case 'chocolate':
        p.hp = Math.min(p.maxHp, p.hp + 10);
        audio.playHeal();
        break;
      case 'creditos':
        p.credits += 2;
        audio.playPickup();
        break;
      case 'desodorante':
        p.deodorantCount = Math.min(4, p.deodorantCount + 1);
        audio.playPickup();
        break;
      case 'maquiagem':
        p.makeupShieldTimer = 10 + this.shopLoadout.buffDurationBonus;
        p.shieldHits = 5;
        p.score += 250;
        audio.playMakeup();
        break;
      case 'cafezinho':
        p.hp = Math.min(p.maxHp, p.hp + 6);
        this.addSpecialEnergy(40);
        p.speedBoostTimer = Math.max(p.speedBoostTimer, 5);
        audio.playHeal();
        break;
      case 'bilhete_dourado':
        p.credits += 4;
        p.score += 200;
        audio.playValidate();
        break;
    }
    this.spawnParticles(d.x, d.y, 12, '#fde047', 10);
    this.trackDailyMission('collect_drops', 1);
    this.pushHudSnapshot();
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.prevX = pt.x;
      pt.prevY = pt.y;
      pt.prevZ = pt.z;

      const dragFactor = pt.drag ? Math.exp(-pt.drag * dt) : 1;
      pt.vx *= dragFactor;
      pt.vy *= dragFactor;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vz -= GRAVITY * (pt.gravityScale ?? 0.7) * dt;

      if (pt.z <= 0) {
        pt.z = 0;
        if (pt.bounce && Math.abs(pt.vz) > 28) {
          pt.vz = Math.abs(pt.vz) * pt.bounce;
          pt.vx *= 0.82;
          pt.vy *= 0.82;
        } else {
          pt.vz = 0;
        }
      }
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.z += 22 * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private updateCamera(dt: number) {
    const bounds = this.getActiveWaveBounds();
    const targetCamX = this.player.x - INTERNAL_WIDTH * 0.36;
    const minCam = bounds.minX;
    const maxCam = Math.max(minCam, bounds.maxX - INTERNAL_WIDTH);
    const clampedTarget = Math.max(minCam, Math.min(maxCam, targetCamX));
    this.camX += (clampedTarget - this.camX) * Math.min(1, dt * 8);
  }

  private handleReachExitDoor() {
    if (this.levelClearTransition) return;
    this.heldKeys.clear();
    this.clearBufferedComboInput();
    const pose = this.pickUniqueVictoryPose();
    this.setPlayerAnim(pose, 1.15);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.z = 0;
    this.player.invulnTimer = 1.5;
    this.spawnParticles(this.player.x, this.player.y, 26, '#facc15', 14);
    this.spawnParticles(this.player.x, this.player.y, 22, '#34d399', 10);
    this.spawnParticles(this.player.x, this.player.y, 24, '#38bdf8', 8);
    if (this.currentLineIdx === BUS_LINES.length - 1) {
      audio.playVictory(this.line.lineNumber);
    } else {
      audio.playValidate();
      audio.playHeal();
    }
    this.levelClearTransition = { timer: 1.15, pose };
    this.pushHudSnapshot();
  }

  private finishReachExitDoor(pose: PlayerAnimState) {
    if (!this.damageTakenThisLine) {
      this.unlockAchievement('zero_damage_line');
    }
    if (!this.ticketValidated) {
      this.skippedValidationAnyLine = true;
    }

    if (this.currentLineIdx === BUS_LINES.length - 1) {
      if (this.ticketValidated && !this.skippedValidationAnyLine) {
        this.unlockAchievement('all_validated');
      }
      this.player.score += 1000;
      this.setPlayerAnim(pose, 0);
      if (!this.dailyRunCounted) {
        this.dailyRunCounted = true;
        this.trackDailyMission('complete_runs', 1);
      }
      this.gameState = 'VICTORY_SCENE';
      this.pushHudSnapshot();
    } else {
      const willFiscalChase = !this.ticketValidated;
      this.fiscalChasing = willFiscalChase;
      this.transitionPerksBought.clear();
      this.gameState = 'LINE_TRANSITION';
      audio.playPickup();
      this.pushHudSnapshot();
    }
  }

  private pushHudSnapshot() {
    const bosses: BossHudInfo[] = this.enemies
      .filter((e) => e.isBoss && e.hp > 0)
      .map((b) => ({
        name: b.name,
        hp: Math.max(0, b.hp),
        maxHp: b.maxHp,
        guardHp: b.guardMax > 0 ? Math.max(0, b.guardHp) : undefined,
        guardMax: b.guardMax > 0 ? b.guardMax : undefined,
        guardBroken: b.guardBrokenTimer > 0,
      }));

    const activeWave = this.waves.find((w) => w.triggered && !w.cleared);
    const goArrowActive = this.gameMode === 'campaign' && !activeWave && this.gameState === 'PLAYING';
    const nextLineDef = BUS_LINES[this.currentLineIdx + 1];
    const nearSeat = this.getEmptySeatUnderPlayer(158);
    const nearEmptySeat = Boolean(nearSeat && !this.usedSeatSlots.has(nearSeat.slot));
    const achievementProgress = loadAchievementProgress();
    const startX = 48;
    const routeSpan = Math.max(1, this.line.exitDoorX - 18 - startX);
    const routeProgress = Math.max(0, Math.min(1, (this.player.x - startX) / routeSpan));
    const turnstileProgress = Math.max(
      0,
      Math.min(1, (this.line.turnstileX - startX) / routeSpan)
    );

    this.onHudUpdate({
      gameMode: this.gameMode,
      gameState: this.gameState,
      lineNumber: this.line.lineNumber,
      lineCode: this.line.code,
      lineTitle: this.line.title,
      hp: Math.max(0, this.player.hp),
      maxHp: this.player.maxHp,
      score: this.player.score,
      hitsLanded: this.player.hitsLanded,
      bestHitChain: this.player.bestHitChain,
      enemiesDefeated: this.player.enemiesDefeated,
      comboStreak: this.player.comboStreak,
      comboMultiplier: this.player.comboMultiplier,
      perfectHitActive: this.perfectHitTimer > 0,
      perfectHitSeq: this.perfectHitSeq,
      credits: this.player.credits,
      ticketCost: this.getEffectiveTicketCost(),
      ticketValidated: this.ticketValidated,
      caneCharges: this.player.caneCharges,
      deodorantCount: this.player.deodorantCount,
      makeupShieldTimer: this.player.makeupShieldTimer,
      shieldHits: this.player.shieldHits,
      bagSkillCooldown: this.player.bagSkillCooldown,
      strengthBuffTimer: this.player.strengthBuffTimer,
      rageTimer: this.player.rageTimer,
      rageNotificationTimer: this.player.rageNotificationTimer,
      specialEnergy: this.player.specialEnergy,
      speedBoostTimer: this.player.speedBoostTimer,
      stickySlowTimer: this.player.stickySlowTimer,
      fiscalChasing: this.fiscalChasing,
      nearValidator: this.isNearValidator(),
      nearStopButton: this.isNearStopButton(),
      stopButtonReady: this.stopButtonCooldown <= 0,
      nearEmptySeat,
      seatRestProgress: Math.min(1, this.seatRestHoldTimer / 1.1),
      expressWindTimer: this.expressWindTimer,
      turnstileCleared: this.turnstileCleared,
      goArrowActive,
      routeProgress,
      turnstileProgress,
      infiniteWave: this.infiniteWave,
      infiniteTimeLeft: this.infiniteTimeLeft,
      bosses,
      alertMessage: this.alertMessage,
      badges: Array.from(this.runBadges),
      activeAchievementToast: this.activeAchievementToast,
      screenNotifications: [],
      combatLog: [],
      achievementStats: {
        unlockedCount: achievementProgress.unlockedIds.length,
        totalCount: ALLOWED_BADGE_IDS.length,
        totalDefeated: achievementProgress.totalDefeated,
      },
      skinStyle: this.shopLoadout.equippedSkin,
      garageConfig: this.shopLoadout.garage,
      lineSummary:
        this.gameState === 'LINE_TRANSITION'
          ? {
              completedLine: this.line.lineNumber,
              nextLine: nextLineDef?.lineNumber as 2 | 3 | undefined,
              nextLineTitle: nextLineDef?.title,
              ticketValidated: this.ticketValidated,
              fiscalAlert: this.fiscalChasing,
              score: this.player.score,
              purchasedPerks: Array.from(this.transitionPerksBought),
              victoryPose: this.isVictoryAnim(this.player.anim) ? this.player.anim : 'victory',
            }
          : undefined,
    });
  }

  private render() {
    if (
      this.gameState === 'TITLE_MENU' ||
      this.gameState === 'INTRO_SCENE' ||
      this.gameState === 'VICTORY_SCENE'
    ) {
      this.staticRenderedState = this.gameState;
      return;
    }

    const isStaticState =
      this.gameState === 'PAUSED' ||
      this.gameState === 'GAME_OVER' ||
      this.gameState === 'LINE_TRANSITION';
    if (isStaticState) {
      if (this.staticRenderedState === this.gameState) {
        return;
      }
      this.staticRenderedState = this.gameState;
    } else {
      this.staticRenderedState = null;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    if (this.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeMag;
      const sy = (Math.random() - 0.5) * 2 * this.shakeMag;
      ctx.translate(sx, sy);
    }

    const activeFlicker =
      this.comboFlickerTimer > 0
        ? this.comboFlickerIntensity * Math.min(1, this.comboFlickerTimer / 0.45)
        : 0;

    const routeProgress = Math.min(
      1,
      Math.max(0, this.camX / Math.max(1, this.line.busLength - INTERNAL_WIDTH))
    );
    const graffitiProgress = Math.min(
      1,
      (this.line.lineNumber - 1) * 0.25 +
        routeProgress * 0.45 +
        this.player.enemiesDefeated * 0.025
    );

    const turnstileSpinProgress =
      this.turnstileSpinTimer > 0
        ? 1 - this.turnstileSpinTimer / 0.72
        : this.turnstileCrossed
          ? 1
          : 0;

    // 1. 16-Bit Bus Interior
    drawVectorBusInterior(
      ctx,
      this.line,
      this.camX,
      this.simTime,
      this.turnstileCleared,
      this.ticketValidated,
      this.usedSeatSlots,
      this.expressWindTimer > 0,
      activeFlicker,
      graffitiProgress,
      this.graffitiSeed,
      turnstileSpinProgress,
      this.stopButtonCooldown <= 0
    );

    // 2. Glossy Sticky Gum Puddles
    for (const h of this.hazards) {
      const hx = h.x - this.camX;
      const hy = h.y;
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.ellipse(hx - 3, hy - 1.5, 4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2b. Localized ground shockwaves on ground finishers (drawn cleanly on the floor plane)
    if (this.groundShockwaves.length > 0) {
      const reduced = this.isReducedMotionPreferred();
      for (const sw of this.groundShockwaves) {
        const progress = 1 - Math.max(0, Math.min(1, sw.life / sw.maxLife));
        drawGroundShockwave(
          ctx,
          sw.x - this.camX,
          sw.y,
          progress,
          sw.color,
          sw.strong,
          sw.radius,
          reduced
        );
      }
    }

    // 3. Y-sorted entities
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    for (const d of this.drops) {
      drawables.push({
        y: d.y,
        draw: () => drawVectorDropItem(ctx, d.type, d.x - this.camX, d.y, d.z, d.bobPhase),
      });
    }

    for (const e of this.enemies) {
      const sortY =
        e.aiState === 'finisherVictim' && e.finisherKind === 'ground_pound'
          ? this.player.y - 2
          : e.y;
      drawables.push({
        y: sortY,
        draw: () => {
          const sx = e.x - this.camX;
          drawVectorEnemy(
            ctx,
            e.type,
            sx,
            e.y,
            e.z,
            e.facing,
            e.aiState,
            e.walkPhase,
            e.hasFrontBarrier,
            e.stinkActive,
            e.hitFlashTimer > 0,
            this.simTime,
            Boolean(e.heavyHurtTimer && e.heavyHurtTimer > 0),
            e.finisherKind,
            e.finisherProg ?? 0,
            e.finisherPhaseAngle ?? 0
          );
          if (!e.isBoss && e.aiState !== 'finisherVictim' && (e.hp < e.maxHp || e.guardMax > 0)) {
            const bw = 26;
            const bx = sx - bw / 2;
            const by = e.y - e.z - (e.guardMax > 0 ? 48 : 44);
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.roundRect(bx - 1, by - 1, bw + 2, e.guardMax > 0 ? 9.5 : 6, 2);
            ctx.fill();
            ctx.fillStyle = e.stinkActive ? '#84cc16' : '#ef4444';
            ctx.beginPath();
            ctx.roundRect(bx, by, (e.hp / e.maxHp) * bw, 4, 1.5);
            ctx.fill();

            if (e.guardMax > 0) {
              const gy = by + 5;
              const segW = (bw - (e.guardMax - 1)) / e.guardMax;
              for (let s = 0; s < e.guardMax; s++) {
                const segX = bx + s * (segW + 1);
                if (e.guardBrokenTimer > 0) {
                  ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
                } else {
                  ctx.fillStyle = s < e.guardHp ? '#38bdf8' : '#1e293b';
                }
                ctx.fillRect(segX, gy, segW, 2.5);
              }
            }
          }
          if (e.speechTimer > 0 && e.speechText) {
            ctx.save();
            ctx.font = e.isBoss ? 'bold 7px sans-serif' : 'bold 6.5px sans-serif';
            const tw = ctx.measureText(e.speechText).width;
            const padX = e.isBoss ? 6 : 4;
            const boxH = e.isBoss ? 14 : 12;
            const boxW = tw + padX * 2;
            const bx = Math.max(6, Math.min(INTERNAL_WIDTH - boxW - 6, sx - boxW / 2));
            const ty = e.y - e.z - (e.isBoss ? 66 : 54);

            // Subtle comic shadow for boss dialogue boxes
            if (e.isBoss) {
              ctx.fillStyle = '#090d16';
              ctx.beginPath();
              ctx.roundRect(bx + 1.5, ty - 8 + 1.5, boxW, boxH, 4.5);
              ctx.fill();
            }

            ctx.fillStyle = e.isBoss ? '#fef9c3' : '#ffffff';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = e.isBoss ? 1.8 : 1.5;
            ctx.beginPath();
            ctx.roundRect(bx, ty - 8, boxW, boxH, 4.5);
            ctx.fill();
            ctx.stroke();

            // Comic pointer tail pointing toward character head
            if (e.isBoss) {
              const tailX = Math.max(bx + 8, Math.min(bx + boxW - 8, sx));
              ctx.fillStyle = '#fef9c3';
              ctx.beginPath();
              ctx.moveTo(tailX - 3.5, ty - 8 + boxH - 0.5);
              ctx.lineTo(tailX, ty - 8 + boxH + 4.5);
              ctx.lineTo(tailX + 3.5, ty - 8 + boxH - 0.5);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }

            ctx.fillStyle = '#0f172a';
            ctx.fillText(e.speechText, bx + padX, ty + (e.isBoss ? 1.5 : 0.5));
            ctx.restore();
          }
        },
      });
    }

    drawables.push({
      y: this.player.y,
      draw: () => {
        this.drawPlayerSpecialElectricParticles(ctx, false);
        drawVectorPlayer(
          ctx,
          this.player.x - this.camX,
          this.player.y,
          this.player.z,
          this.player.facing,
          this.player.anim,
          this.player.animTimer,
          this.player.caneCharges > 0,
          this.player.makeupShieldTimer > 0,
          this.player.hitFlashTimer > 0,
          this.player.strengthBuffTimer > 0,
          this.player.rageTimer > 0,
          this.simTime,
          this.shopLoadout.equippedSkin,
          this.shopLoadout.garage,
          this.player.animDuration,
          {
            prevAnim:
              this.player.anim === 'idle' ? this.lastComboAttackAnim : this.activeAttackPrevAnim,
            chainActive: this.player.comboResetTimer > 0,
            comboStep: this.player.comboStep,
            caneSpin: this.caneSpinVisual,
          }
        );
        this.drawPlayerSpecialElectricParticles(ctx, true);
      },
    });

    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      item.draw();
    }

    // 4. Projectiles
    for (const pr of this.projectiles) {
      const pxX = pr.x - this.camX;
      const pxY = pr.y - pr.z;
      if (pr.kind === 'gum') {
        ctx.fillStyle = '#ec4899';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pxX, pxY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (pr.kind === 'spray_cloud') {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
        ctx.beginPath();
        ctx.ellipse(pxX, pxY, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(207, 250, 254, 0.75)';
        ctx.beginPath();
        ctx.ellipse(pxX, pxY, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.kind === 'whistle_wave') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(pxX, pxY, 7, -0.9, 0.9);
        ctx.stroke();
      } else if (pr.kind === 'fine_ticket') {
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(pxX - 5, pxY - 3, 10, 6, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(pxX - 3, pxY - 1, 6, 2);
      } else if (pr.kind === 'sound_ring') {
        ctx.save();
        if (pr.fromPlayer) {
          const pulse = 0.55 + Math.sin(this.simTime * 28) * 0.2;
          ctx.strokeStyle = `rgba(56, 189, 248, ${pulse.toFixed(2)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pxX, pxY, Math.min(24, pr.radius * 0.55), 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pxX, pxY, Math.min(16, pr.radius * 0.35), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(pxX, pxY, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(pxX, pxY, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 5. Crisp 16-bit pixel particles & metallic sparks + yellow-white impact flashes
    for (const pt of this.particles) {
      drawPixelParticle(ctx, pt, this.camX);
    }

    for (const fl of this.impactFlashes) {
      const progress = 1 - Math.max(0, Math.min(1, fl.life / fl.maxLife));
      drawImpactFlash(ctx, fl.x - this.camX, fl.y, progress, fl.strong, {
        kind: fl.kind,
        dir: fl.dir,
      });
    }

    // 5b. Boss Finisher KO Shockwaves & Debris
    for (const fx of this.bossFinisherEffects) {
      const progress = 1 - Math.max(0, Math.min(1, fx.life / fx.maxLife));
      drawBossFinisherEffect(
        ctx,
        fx.x - this.camX,
        fx.y,
        fx.z,
        progress,
        fx.label,
        fx.primaryColor,
        fx.secondaryColor,
        fx.style
      );
    }

    // 5c. Dynamic Special Illumination Overlay (spotlight + radial color glow on combat plane)
    if (this.specialLightTimer > 0) {
      const lp = this.specialLightTimer / Math.max(0.01, this.specialLightMax);
      const intensity = Math.sin(lp * Math.PI);
      const lx = this.player.x - this.camX;
      const ly = this.player.y - this.player.z - 20;
      const grad = ctx.createRadialGradient(lx, ly, 16, lx, ly, 168);
      if (this.specialLightColor === '#38bdf8') {
        grad.addColorStop(0, `rgba(186, 230, 253, ${(0.32 * intensity).toFixed(3)})`);
        grad.addColorStop(0.38, `rgba(56, 189, 248, ${(0.2 * intensity).toFixed(3)})`);
      } else {
        grad.addColorStop(0, `rgba(254, 240, 138, ${(0.3 * intensity).toFixed(3)})`);
        grad.addColorStop(0.38, `rgba(250, 204, 21, ${(0.18 * intensity).toFixed(3)})`);
      }
      grad.addColorStop(1, `rgba(2, 6, 23, ${(0.38 * intensity).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
    }

    // 6. Primeiro Plano (Foreground Plane): barras, bancos e detalhes próximos da câmera
    drawVectorForegroundLayer(ctx, this.line, this.camX, this.simTime);

    // 7. Pre-turnstile validator, STOP button & exit door prompts in world space
    {
      const bounce = Math.sin(this.simTime * 6) * 2.5;
      if (!this.ticketValidated) {
        const vx = this.line.validatorX - this.camX;
        if (vx > 0 && vx < INTERNAL_WIDTH) {
          const cost = this.getEffectiveTicketCost();
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(vx - 34, 82 + bounce, 68, 14, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText(`VALIDAR (${cost})`, vx - 25, 91.5 + bounce);
        }
      }

      if (this.stopButtonCooldown <= 0 && Math.abs(this.player.x - this.line.stopCordX) < 85) {
        const sx = this.line.stopCordX - this.camX;
        if (sx > 12 && sx < INTERNAL_WIDTH - 12) {
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(sx - 24, 74 + bounce, 48, 13, 3.5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('STOP', sx - 10, 83 + bounce);
        }
      }

      if (this.turnstileCleared && this.gameMode === 'campaign') {
        const dxDoor = this.line.exitDoorX - this.camX;
        if (dxDoor > 0 && dxDoor < INTERNAL_WIDTH) {
          ctx.fillStyle = '#059669';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(dxDoor - 24, 30 + bounce, 48, 13, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('SAÍDA ->', dxDoor - 17, 39 + bounce);
        }
      }
    }

    // 8. World-space seat rest progress bar (no button instruction boxes)
    if (this.gameState === 'PLAYING' && this.line.lineNumber === 1) {
      const p = this.player;
      const nearUnusedSeat = this.getEmptySeatUnderPlayer(158);
      if (nearUnusedSeat && !this.usedSeatSlots.has(nearUnusedSeat.slot) && this.seatRestHoldTimer > 0) {
        const px = p.x - this.camX;
        const py = p.y - p.z - 48;
        const pct = Math.min(1, this.seatRestHoldTimer / 1.1);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(px - 18, py - 5, 36, 6, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.roundRect(px - 16.5, py - 3.5, 33 * pct, 3, 1.5);
        ctx.fill();
      }
    }

    // 9. Floating damage / pickup texts (bold 16-bit arcade impact styling)
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const ft of this.floatingTexts) {
        const fx = ft.x - this.camX;
        const fy = ft.y - ft.z;
        const prog = 1 - Math.max(0, Math.min(1, ft.life / Math.max(0.01, ft.maxLife)));
        const popScale =
          prog < 0.16 ? 1.48 - (prog / 0.16) * 0.42 : 1.06 - prog * 0.1;
        const fadeAlpha = prog > 0.72 ? Math.max(0, (1 - prog) / 0.28) : 1;
        const dmgVal = Math.abs(parseInt(ft.text, 10)) || 0;
        const isCritOrHeavy =
          dmgVal >= 20 || ft.color === '#fde047' || ft.color === '#38bdf8';
        const fill =
          ft.color === '#f8fafc'
            ? isCritOrHeavy
              ? '#fde047'
              : '#fffbeb'
            : ft.color;
        const fontSize = isCritOrHeavy ? 10.5 : 9;

        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(popScale, popScale);
        ctx.globalAlpha = fadeAlpha;
        ctx.font = `italic 900 ${fontSize}px "Bungee", "Chakra Petch", sans-serif`;

        // Hard 16-bit arcade drop shadow
        ctx.fillStyle = '#020617';
        ctx.fillText(ft.text, 1.5, 2);

        // Thick dark comic outline + vivid fill
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 3.2;
        ctx.strokeText(ft.text, 0, 0);
        ctx.fillStyle = fill;
        ctx.fillText(ft.text, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // 9. Animated Jetpack Joyride-style "SIGA" badge (campaign only)
    const activeWave = this.waves.find((w) => w.triggered && !w.cleared);
    if (
      this.gameMode === 'campaign' &&
      !activeWave &&
      this.gameState === 'PLAYING' &&
      Math.floor(this.simTime * 4) % 2 === 0
    ) {
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(INTERNAL_WIDTH - 64, 62, 52, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SIGA', INTERNAL_WIDTH - 38, 73.5);
      ctx.restore();
    }

    // 10. Old city bus fluorescent light flicker (subtle ambient + intensified on combos & short circuit)
    if (this.gameState === 'PLAYING') {
      const stutter =
        Math.sin(this.simTime * 46) * 0.55 + Math.sin(this.simTime * 79 + 1.3) * 0.45;
      const ambientDip = Math.sin(this.simTime * 3.1) > 0.955 ? 0.045 : 0;
      if (this.shortCircuitTimer > 0) {
        const elecAlpha = Math.sin(this.simTime * 55) > 0 ? 0.16 : 0.05;
        ctx.fillStyle = `rgba(56, 189, 248, ${elecAlpha.toFixed(3)})`;
        ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
      } else if (activeFlicker > 0.05) {
        if (stutter < -0.1) {
          const dimAlpha = Math.min(0.18, 0.04 + activeFlicker * 0.13);
          ctx.fillStyle = `rgba(9, 13, 22, ${dimAlpha.toFixed(3)})`;
          ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
        } else if (stutter > 0.35) {
          const buzzAlpha = Math.min(0.11, 0.02 + activeFlicker * 0.08);
          ctx.fillStyle = `rgba(224, 242, 254, ${buzzAlpha.toFixed(3)})`;
          ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
        }
      } else if (ambientDip > 0) {
        ctx.fillStyle = `rgba(9, 13, 22, ${ambientDip.toFixed(3)})`;
        ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
      }
    }

    // 10b. Temporary overdrive color tint when combo multiplier exceeds 5x
    if (this.comboTintTimer > 0) {
      const progress = Math.min(1, this.comboTintTimer / 0.65);
      const fillAlpha = progress * 0.28;
      ctx.fillStyle = `rgba(249, 115, 22, ${fillAlpha.toFixed(3)})`;
      ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
    }

    // 10b-2. "Impacto de Combos" peripheral screen-edge flashes & spark particles above 10x
    if (this.comboEdgeFlashTimer > 0 || this.comboEdgeParticles.length > 0) {
      ctx.save();
      if (this.comboEdgeFlashTimer > 0) {
        const t = Math.max(0, Math.min(1, this.comboEdgeFlashTimer / this.comboEdgeFlashMax));
        const reduced = this.isReducedMotionPreferred();
        const pulse = reduced ? 0.55 : 0.78 + 0.22 * Math.sin((1 - t) * Math.PI * 3);
        const alpha = Math.min(0.68, Math.pow(t, 0.72) * 0.46 * this.comboEdgeFlashStrength * pulse);

        const topGrad = ctx.createLinearGradient(0, 0, 0, 34);
        topGrad.addColorStop(0, `rgba(250, 204, 21, ${(alpha * 0.95).toFixed(3)})`);
        topGrad.addColorStop(0.55, `rgba(251, 113, 133, ${(alpha * 0.4).toFixed(3)})`);
        topGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, INTERNAL_WIDTH, 34);

        const botGrad = ctx.createLinearGradient(0, INTERNAL_HEIGHT, 0, INTERNAL_HEIGHT - 34);
        botGrad.addColorStop(0, `rgba(56, 189, 248, ${(alpha * 0.95).toFixed(3)})`);
        botGrad.addColorStop(0.55, `rgba(249, 115, 22, ${(alpha * 0.4).toFixed(3)})`);
        botGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, INTERNAL_HEIGHT - 34, INTERNAL_WIDTH, 34);

        const leftGrad = ctx.createLinearGradient(0, 0, 44, 0);
        leftGrad.addColorStop(0, `rgba(56, 189, 248, ${(alpha * 0.9).toFixed(3)})`);
        leftGrad.addColorStop(0.5, `rgba(250, 204, 21, ${(alpha * 0.38).toFixed(3)})`);
        leftGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, 44, INTERNAL_HEIGHT);

        const rightGrad = ctx.createLinearGradient(INTERNAL_WIDTH, 0, INTERNAL_WIDTH - 44, 0);
        rightGrad.addColorStop(0, `rgba(251, 113, 133, ${(alpha * 0.9).toFixed(3)})`);
        rightGrad.addColorStop(0.5, `rgba(250, 204, 21, ${(alpha * 0.38).toFixed(3)})`);
        rightGrad.addColorStop(1, 'rgba(251, 113, 133, 0)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(INTERNAL_WIDTH - 44, 0, 44, INTERNAL_HEIGHT);

        ctx.strokeStyle = `rgba(254, 240, 138, ${Math.min(0.95, alpha * 1.35).toFixed(3)})`;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(1.1, 1.1, INTERNAL_WIDTH - 2.2, INTERNAL_HEIGHT - 2.2);
      }

      if (this.comboEdgeParticles.length > 0) {
        ctx.lineCap = 'round';
        for (const cp of this.comboEdgeParticles) {
          const pLife = Math.max(0, Math.min(1, cp.life / cp.maxLife));
          ctx.globalAlpha = pLife * 0.95;
          ctx.strokeStyle = cp.color;
          ctx.lineWidth = Math.max(1, cp.size * 0.85);
          ctx.beginPath();
          ctx.moveTo(cp.prevX, cp.prevY);
          ctx.lineTo(cp.x, cp.y);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, Math.max(0.7, cp.size * 0.48 * pLife), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 10c. Subtle Matrix bullet-time tint & concentric ripple during slow-mo boss flying kick
    if (this.bossBulletTimeTimer > 0) {
      const btAlpha = Math.min(1, this.bossBulletTimeTimer / 0.25) * 0.14;
      ctx.fillStyle = `rgba(16, 185, 129, ${btAlpha.toFixed(3)})`;
      ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
      const pScreenX = this.player.x - this.camX;
      const pScreenY = this.player.y - this.player.z - 18;
      const waveProg = (this.simTime * 5) % 1;
      ctx.save();
      ctx.strokeStyle = `rgba(74, 222, 128, ${(0.45 * (1 - waveProg)).toFixed(2)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(pScreenX, pScreenY, 26 + waveProg * 42, 16 + waveProg * 24, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 11. Boss Finisher KO screen flash & dramatic arcade edge vignette
    if (this.bossKoFlashTimer > 0) {
      const progress = Math.min(1, this.bossKoFlashTimer / 0.45);
      const flashAlpha = progress * 0.42;
      ctx.fillStyle = `rgba(254, 240, 138, ${flashAlpha.toFixed(3)})`;
      ctx.fillRect(-12, -12, INTERNAL_WIDTH + 24, INTERNAL_HEIGHT + 24);
    }

    // 12. Full-screen K.O. animation overlay across entire canvas (includes thumbs-up player!)
    if (this.bossKoOverlay) {
      const progress =
        1 - Math.max(0, Math.min(1, this.bossKoOverlay.life / this.bossKoOverlay.maxLife));
      drawFullScreenKoAnimation(
        ctx,
        INTERNAL_WIDTH,
        INTERNAL_HEIGHT,
        progress,
        this.bossKoOverlay.primaryColor,
        this.bossKoOverlay.secondaryColor,
        this.bossKoOverlay.style,
        this.shopLoadout.equippedSkin,
        this.shopLoadout.garage
      );
    }

    ctx.restore();
    this.postProcessor.present(this.simTime, activeFlicker);
  }
}
