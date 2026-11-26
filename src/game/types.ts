import { GarageConfig, PlayerSkinStyle } from './shop';

export type GameMode = 'campaign' | 'infinite';

export type AchievementBadgeId =
  | 'rage_10x'
  | 'all_validated'
  | 'zero_damage_line'
  | 'boss_rage_ko'
  | 'ninja_mochila'
  | 'acrobata_busao'
  | 'derrotar_50'
  | 'chegar_linha_3'
  | 'validar_sem_dano'
  | 'rush_onda_5';

export interface AchievementUnlockNotice {
  uid: number;
  id: AchievementBadgeId;
  label: string;
  description: string;
}

export type ScreenNotificationTone = 'gold' | 'cyan' | 'rose' | 'emerald';

export interface ScreenNotification {
  id: number;
  text: string;
  tone: ScreenNotificationTone;
  xPct: number;
  yPct: number;
}

export interface CombatLogEntry {
  id: number;
  text: string;
  tone: ScreenNotificationTone;
}

export type GameState =
  | 'TITLE_MENU'
  | 'INTRO_SCENE'
  | 'PLAYING'
  | 'PAUSED'
  | 'LINE_TRANSITION'
  | 'VICTORY_SCENE'
  | 'VICTORY'
  | 'GAME_OVER';

export type EnemyType =
  | 'idosa'
  | 'vendedor'
  | 'estudante'
  | 'patricinha'
  | 'industria'
  | 'fiscal'
  | 'tio_audio'
  | 'skatista'
  | 'boss_cobrador'
  | 'boss_motorista'
  | 'boss_cobrador_blindado'
  | 'boss_fiscal_chefe';

export type ItemType =
  | 'bengala'
  | 'chocolate'
  | 'creditos'
  | 'desodorante'
  | 'maquiagem'
  | 'cafezinho'
  | 'bilhete_dourado';

export type BossFinisherKind =
  | 'piledriver'
  | 'giant_swing'
  | 'ground_pound'
  | 'collar_knee';

export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'punch1'
  | 'punch2'
  | 'punch3'
  | 'heavyPunch'
  | 'cane'
  | 'kick'
  | 'kickFinisher'
  | 'jump'
  | 'jumpPunch'
  | 'jumpKick'
  | 'railGrab'
  | 'railSpin'
  | 'railSlam'
  | 'bagGuard'
  | 'bagSpin'
  | 'seatRest'
  | 'special'
  | 'soundSpecial'
  | 'headphoneWhip'
  | 'spray'
  | 'finisherPiledriver'
  | 'finisherGiantSwing'
  | 'finisherGroundPound'
  | 'finisherCollarKnee'
  | 'hurt'
  | 'knockdown'
  | 'victory'
  | 'victoryTie'
  | 'victoryBadge'
  | 'victoryCoffee'
  | 'thumbsUp';

export type EnemyAIState =
  | 'idle'
  | 'approach'
  | 'windup'
  | 'attack'
  | 'spinWindup'
  | 'spinAttack'
  | 'skateWindup'
  | 'skateDash'
  | 'cooldown'
  | 'hurt'
  | 'knockdown'
  | 'finisherVictim';

export interface PlayerEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  anim: PlayerAnimState;
  animTimer: number;
  animDuration?: number;
  comboStep: 0 | 1 | 2;
  comboResetTimer: number;
  attackHasHit: boolean;
  invulnTimer: number;
  hitFlashTimer: number;
  stickySlowTimer: number;
  caneCharges: number;
  deodorantCount: number;
  credits: number;
  makeupShieldTimer: number;
  shieldHits: number;
  bagSkillCooldown: number;
  strengthBuffTimer: number;
  rageTimer: number;
  rageNotificationTimer: number;
  specialEnergy: number;
  speedBoostTimer: number;
  score: number;
  hitsLanded: number;
  bestHitChain: number;
  enemiesDefeated: number;
  comboStreak: number;
  comboMultiplier: number;
  headphoneWhipUsed?: boolean;
}

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  name: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  aiState: EnemyAIState;
  stateTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  heavyHurtTimer?: number;
  hurtDuration?: number;
  hasFrontBarrier: boolean;
  guardHp: number;
  guardMax: number;
  guardBrokenTimer: number;
  stinkActive: boolean;
  stinkTickTimer: number;
  isBoss: boolean;
  isChaser: boolean;
  isRageClone?: boolean;
  spinTickTimer: number;
  speechText: string;
  speechTimer: number;
  halfHpTauntTriggered?: boolean;
  walkPhase: number;
  guaranteedDrop?: ItemType;
  finisherKind?: BossFinisherKind;
  finisherProg?: number;
  finisherPhaseAngle?: number;
}

export interface DropItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  z: number;
  vz: number;
  bobPhase: number;
  life: number;
}

export interface Projectile {
  id: number;
  kind: 'gum' | 'whistle_wave' | 'fine_ticket' | 'spray_cloud' | 'sound_ring';
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  radius: number;
}

export interface GroundHazard {
  id: number;
  kind: 'gum_puddle';
  x: number;
  y: number;
  radius: number;
  life: number;
}

export type ParticleKind = 'pixel' | 'spark' | 'shard';

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  kind?: ParticleKind;
  coolColor?: string;
  bounce?: number;
  drag?: number;
  gravityScale?: number;
  prevX?: number;
  prevY?: number;
  prevZ?: number;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  z: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface WaveSpawn {
  type: EnemyType;
  offsetX: number;
  y: number;
  guaranteedDrop?: ItemType;
}

export interface WaveZone {
  id: number;
  triggerX: number;
  lockMinX: number;
  lockMaxX: number;
  spawns: WaveSpawn[];
  triggered: boolean;
  cleared: boolean;
  isBossWave?: boolean;
  bossBanner?: string;
}

export interface LineDefinition {
  lineNumber: 1 | 2 | 3;
  code: string;
  title: string;
  subtitle: string;
  skyTop: string;
  skyBottom: string;
  buildingPalette: string[];
  accentColor: string;
  busLength: number;
  turnstileX: number;
  validatorX: number;
  stopCordX: number;
  exitDoorX: number;
  ticketCost: number;
  waves: Omit<WaveZone, 'triggered' | 'cleared'>[];
}

export interface BossHudInfo {
  name: string;
  hp: number;
  maxHp: number;
  subtitle?: string;
  guardHp?: number;
  guardMax?: number;
  guardBroken?: boolean;
}

export interface HudSnapshot {
  gameMode: GameMode;
  gameState: GameState;
  lineNumber: 1 | 2 | 3;
  lineCode: string;
  lineTitle: string;
  hp: number;
  maxHp: number;
  score: number;
  hitsLanded: number;
  bestHitChain: number;
  enemiesDefeated: number;
  comboStreak: number;
  comboMultiplier: number;
  credits: number;
  ticketCost: number;
  ticketValidated: boolean;
  caneCharges: number;
  deodorantCount: number;
  makeupShieldTimer: number;
  shieldHits: number;
  bagSkillCooldown: number;
  strengthBuffTimer: number;
  rageTimer: number;
  rageNotificationTimer: number;
  specialEnergy: number;
  speedBoostTimer: number;
  stickySlowTimer: number;
  fiscalChasing: boolean;
  nearValidator: boolean;
  nearStopButton: boolean;
  stopButtonReady: boolean;
  nearEmptySeat: boolean;
  seatRestProgress: number;
  expressWindTimer: number;
  turnstileCleared: boolean;
  goArrowActive: boolean;
  routeProgress: number;
  turnstileProgress: number;
  infiniteWave: number;
  infiniteTimeLeft: number;
  bosses: BossHudInfo[];
  alertMessage: string;
  badges: AchievementBadgeId[];
  activeAchievementToast: AchievementUnlockNotice | null;
  screenNotifications: ScreenNotification[];
  combatLog: CombatLogEntry[];
  achievementStats: {
    unlockedCount: number;
    totalCount: number;
    totalDefeated: number;
  };
  skinStyle?: PlayerSkinStyle;
  garageConfig?: GarageConfig;
  lineSummary?: {
    completedLine: 1 | 2 | 3;
    nextLine?: 2 | 3;
    nextLineTitle?: string;
    ticketValidated: boolean;
    fiscalAlert: boolean;
    score: number;
    purchasedPerks: string[];
    victoryPose?: PlayerAnimState;
  };
}
