import { Award, BookOpen, CalendarCheck, Clock, Coins, Flame, ShoppingBag, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { GarageConfig, InfiniteRecord, PlayerSkinStyle } from '../game/shop';
import { EnemyType, GameMode } from '../game/types';
import {
  drawVectorEnemy,
  drawVectorExteriorBus,
  drawVectorPlayer,
} from '../game/vectorArt';

interface TitleScreenProps {
  onStart: () => void;
  onOpenLeaderboard: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  onOpenDailyMissions: () => void;
  onOpenTutorial: () => void;
  shopCoins: number;
  equippedSkin?: PlayerSkinStyle;
  garageConfig?: GarageConfig;
  achievementCount: number;
  achievementTotal: number;
  dailyCompletedCount: number;
  dailyTotalCount: number;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  infiniteBest: InfiniteRecord;
  modalOpen?: boolean;
}

const SHOWCASE_ENEMY_POOL: EnemyType[] = [
  'estudante',
  'idosa',
  'vendedor',
  'patricinha',
  'industria',
  'fiscal',
  'tio_audio',
  'skatista',
];

interface PreviewEnemy {
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
  walkPhase: number;
  aiState: 'approach' | 'hurt' | 'knockdown';
  hitFlash: number;
  koTimer: number;
}

interface PreviewSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function drawHeaderFightArenaBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  skyGrad: CanvasGradient,
  floorGrad: CanvasGradient
) {
  // Bus ceiling & upper trim
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 9, w, 3);

  // Nocturnal skyline scrolling outside the bus windows
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 12, w, 46);

  const cityScroll = (time * 48) % 320;
  const bPalette = ['#0f172a', '#1e293b', '#1e1b4b', '#172554'];
  for (let i = -1; i < 11; i++) {
    const bx = Math.round(i * 36 - (cityScroll % 36));
    const idx = Math.abs(i + Math.floor(cityScroll / 36)) % bPalette.length;
    const bh = 18 + ((idx * 11 + i * 7) % 20);
    ctx.fillStyle = bPalette[idx];
    ctx.fillRect(bx, 56 - bh, 32, bh);
    ctx.fillStyle = '#fde047';
    for (let wy = 56 - bh + 4; wy < 52; wy += 7) {
      for (let wx = bx + 4; wx < bx + 27; wx += 7) {
        if ((wx + wy) % 3 !== 0) ctx.fillRect(wx, wy, 2.5, 2.5);
      }
    }
  }

  // Passing streetlamp streaks outside windows
  const lampScroll = (time * 145) % 160;
  for (let lx = -lampScroll; lx < w + 40; lx += 160) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
    ctx.fillRect(Math.round(lx), 12, 7, 44);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(Math.round(lx + 1), 13, 5, 3);
  }

  // Window pillars, rounded rubber window frames & brushed bus wall trim
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 56, w, 24);
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 74, w, 6);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 56, w, 2);
  ctx.fillRect(0, 78, w, 2.5);

  for (let wx = 0; wx < w; wx += 64) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx - 2.5, 10, 5, 48);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(wx - 1, 12, 1.5, 44);
    ctx.beginPath();
    ctx.roundRect(wx + 3, 12, 58, 43, 6);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Back-row moquette blue bus seats
  for (let sx = 14; sx < w - 14; sx += 46) {
    ctx.beginPath();
    ctx.roundRect(sx, 60, 24, 17, 3.5);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(sx + 3, 61.5, 18, 2);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(sx + 6, 67, 2, 1.5);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(sx + 15, 71, 2, 1.5);
  }

  // Overhead yellow handrail + swaying commuter straps
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 15, w, 3.5);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 16, w, 1.5);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  for (let hx = 26; hx < w - 16; hx += 48) {
    const sway = Math.sin(time * 3.4 + hx * 0.08) * 1.8;
    ctx.beginPath();
    ctx.moveTo(hx, 18);
    ctx.lineTo(hx + sway, 27);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(hx + sway - 2.5), 26, 5, 4);
  }

  // Glossy bus aisle floor with window reflections
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 80, w, h - 80);

  for (let wx = 4; wx < w; wx += 64) {
    ctx.fillStyle = 'rgba(147, 197, 253, 0.08)';
    ctx.fillRect(wx, 80, 56, h - 80);
  }

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 80, w, 2.5);

  const floorScroll = (time * 72) % 34;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  for (let fx = -floorScroll; fx < w; fx += 34) {
    ctx.fillRect(Math.round(fx), 92, 14, 2);
    ctx.fillRect(Math.round(fx + 12), 118, 16, 2);
  }
}

export function TitleScreen({
  onStart,
  onOpenLeaderboard,
  onOpenShop,
  onOpenAchievements,
  onOpenDailyMissions,
  onOpenTutorial,
  shopCoins,
  equippedSkin = 'classic',
  garageConfig,
  achievementCount,
  achievementTotal,
  dailyCompletedCount,
  dailyTotalCount,
  selectedMode,
  onSelectMode,
  infiniteBest,
  modalOpen = false,
}: TitleScreenProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;
  const { user, profile } = useFirebase();

  useEffect(() => {
    if (modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, modalOpen]);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const sky = ctx.createLinearGradient(0, 0, 0, 190);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(0.55, '#1e3a8a');
    sky.addColorStop(1, '#38bdf8');

    let rafId = 0;
    let time = 0;
    let last = performance.now();

    const drawScene = (now: number) => {
      rafId = requestAnimationFrame(drawScene);
      if (modalOpenRef.current || document.hidden) {
        last = now;
        return;
      }

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 480, 190);

      // Cel-shaded parallax city buildings (lightweight rects)
      const bScroll = (time * 38) % 480;
      const palette = ['#172554', '#1e293b', '#312e81', '#0f172a'];
      for (let i = -1; i < 12; i++) {
        const bx = Math.round(i * 48 - (bScroll % 48));
        const idx = Math.abs(i + Math.floor(bScroll / 48)) % palette.length;
        const bh = 42 + ((idx * 19 + i * 11) % 48);
        ctx.fillStyle = palette[idx];
        ctx.fillRect(bx, 185 - bh, 44, bh + 4);

        ctx.fillStyle = '#fde047';
        for (let wy = 185 - bh + 7; wy < 178; wy += 10) {
          for (let wx = bx + 6; wx < bx + 38; wx += 10) {
            if ((wx + wy) % 3 !== 0) ctx.fillRect(wx, wy, 5, 5);
          }
        }
      }

      // Sidewalk & road
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 182, 480, 14);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 196, 480, 74);

      const roadScroll = (time * 170) % 48;
      ctx.fillStyle = '#facc15';
      for (let rx = -roadScroll; rx < 480; rx += 48) {
        ctx.fillRect(Math.round(rx), 232, 26, 4);
      }

      const lampScroll = (time * 120) % 160;
      for (let lx = -lampScroll; lx < 480; lx += 160) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(Math.round(lx), 108, 4, 76);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(Math.round(lx - 4), 104, 14, 5);
      }

      const bob = Math.sin(time * 9) * 1.3;
      drawVectorExteriorBus(ctx, 240, 206 + bob, '101', time * 14);
    };

    rafId = requestAnimationFrame(drawScene);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Animated Fight Canvas inside the highlighted upper dark banner of the menu card
  useEffect(() => {
    const canvas = fightCanvasRef.current;
    if (!canvas) return;
    const W = 360;
    const H = 144;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const skyGrad = ctx.createLinearGradient(0, 12, 0, 56);
    skyGrad.addColorStop(0, '#070b18');
    skyGrad.addColorStop(1, '#172554');

    const floorGrad = ctx.createLinearGradient(0, 80, 0, H);
    floorGrad.addColorStop(0, '#475776');
    floorGrad.addColorStop(1, '#2d3a52');

    type SignatureMove = 'crane' | 'stunner' | 'rko' | 'trinity' | 'burly';
    const MOVE_SEQUENCE: SignatureMove[] = ['crane', 'stunner', 'rko', 'trinity', 'burly'];
    let moveIndex = 0;

    let bag: EnemyType[] = [];
    const pickRandomEnemy = (): EnemyType => {
      if (bag.length === 0) {
        bag = [...SHOWCASE_ENEMY_POOL];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop()!;
    };

    const spawnPreviewEnemy = (startX: number, yOverride?: number): PreviewEnemy => {
      const type = pickRandomEnemy();
      const baseSpeed =
        type === 'skatista'
          ? 44
          : type === 'patricinha' || type === 'estudante'
            ? 36
            : type === 'idosa'
              ? 30
              : 34;
      return {
        type,
        x: startX,
        y: yOverride ?? 122 + Math.floor(Math.random() * 10),
        z: 0,
        vx: 0,
        vz: 0,
        speed: baseSpeed + Math.random() * 5,
        walkPhase: Math.random() * 4,
        aiState: 'approach',
        hitFlash: 0,
        koTimer: 0,
      };
    };

    const enemies: PreviewEnemy[] = [
      spawnPreviewEnemy(150, 128),
      spawnPreviewEnemy(225, 124),
      spawnPreviewEnemy(300, 129),
    ];
    const sparks: PreviewSpark[] = [];

    const spawnBurst = (
      cx: number,
      cy: number,
      count: number,
      primary = '#fde047',
      secondary = '#38bdf8'
    ) => {
      for (let s = 0; s < count; s++) {
        const ang = (Math.PI * 2 * s) / count + Math.random() * 0.4;
        const spd = 65 + Math.random() * 105;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 22,
          life: 0.28 + Math.random() * 0.16,
          color: s % 2 === 0 ? primary : secondary,
        });
      }
    };

    let activeMove: SignatureMove = MOVE_SEQUENCE[0];
    let phase: 'wait' | 'seq' = 'wait';
    let waitTimer = 0;
    let seqTime = 0;
    let seqStage = 0;
    let targetEnemy: PreviewEnemy | null = null;
    let playerX = 42;
    const playerY = 128;
    let playerZ = 0;
    let playerAnim = 'fightStance';
    let impactFlashTimer = 0;
    let impactX = 80;
    let impactY = 92;
    let shockwaveTimer = 0;
    let shockwaveX = 78;
    let shockwaveColor = '#facc15';
    let cooldown = 0.18;

    let rafId = 0;
    let time = 0;
    let last = performance.now();

    const finishSequence = () => {
      phase = 'wait';
      waitTimer = 0;
      seqTime = 0;
      seqStage = 0;
      targetEnemy = null;
      playerAnim = 'fightStance';
      playerZ = 0;
      cooldown = 0.24;
      for (const en of enemies) {
        if (en.aiState === 'hurt') {
          en.aiState = 'knockdown';
          en.vx = 210;
          en.vz = 130;
          en.koTimer = 0;
        }
      }
      moveIndex = (moveIndex + 1) % MOVE_SEQUENCE.length;
      activeMove = MOVE_SEQUENCE[moveIndex];

      if (activeMove === 'burly') {
        const approachingCount = enemies.filter((e) => e.aiState === 'approach').length;
        for (let k = approachingCount; k < 3; k++) {
          enemies.push(spawnPreviewEnemy(200 + k * 48, 122 + (k % 3) * 4));
        }
      }
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (modalOpenRef.current || document.hidden) {
        last = now;
        return;
      }

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;

      if (cooldown > 0) cooldown -= dt;
      if (impactFlashTimer > 0) impactFlashTimer -= dt;
      if (shockwaveTimer > 0) shockwaveTimer -= dt;

      let lead = enemies.find((e) => e.aiState === 'approach');
      if (!lead) {
        lead = spawnPreviewEnemy(220, 126);
        enemies.push(lead);
      }

      if (phase === 'wait') {
        waitTimer += dt;
        playerX += (42 - playerX) * Math.min(1, dt * 12);
        playerZ += (0 - playerZ) * Math.min(1, dt * 12);
        playerAnim = 'fightStance';

        const triggerDist =
          activeMove === 'rko' ? 116 : activeMove === 'trinity' ? 110 : 104;
        const canTrigger =
          lead &&
          cooldown <= 0 &&
          lead.x <= triggerDist;

        if (canTrigger && lead) {
          lead.x = Math.max(88, lead.x);
          targetEnemy = lead;
          phase = 'seq';
          waitTimer = 0;
          seqTime = 0;
          seqStage = 0;
        }
      } else {
        seqTime += dt;
        const activeTarget = targetEnemy ?? lead;

        if (activeMove === 'crane') {
          if (seqTime < 0.42) {
            playerAnim = 'cranePrep';
            playerX = 42;
            playerZ = 0;
            if (seqStage === 0) seqStage = 1;
          } else if (seqTime < 0.8) {
            playerAnim = 'craneKick';
            const kProg = (seqTime - 0.42) / 0.38;
            playerX = 46 + Math.sin(kProg * Math.PI) * 14;
            playerZ = Math.sin(kProg * Math.PI) * 12;
            if (seqStage === 1) {
              seqStage = 2;
              if (activeTarget) {
                activeTarget.aiState = 'knockdown';
                activeTarget.vx = 250;
                activeTarget.vz = 148;
                activeTarget.z = 3;
                activeTarget.hitFlash = 0.18;
                impactFlashTimer = 0.16;
                impactX = activeTarget.x - 4;
                impactY = activeTarget.y - 26;
                spawnBurst(impactX, impactY, 10, '#fde047', '#f97316');
              }
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'stunner') {
          if (seqTime < 0.22) {
            playerAnim = 'kick';
            playerX = 52;
            if (seqStage === 0 && activeTarget) {
              seqStage = 1;
              activeTarget.aiState = 'hurt';
              activeTarget.hitFlash = 0.14;
              activeTarget.vx = -20;
              spawnBurst(activeTarget.x - 4, activeTarget.y - 16, 6, '#f8fafc', '#facc15');
            }
          } else if (seqTime < 0.7) {
            playerAnim = 'stunnerDrop';
            playerX = 60;
            playerZ = seqTime < 0.31 ? 7 * (1 - (seqTime - 0.22) / 0.09) : 0;
            if (seqStage === 1) {
              seqStage = 2;
              if (activeTarget) {
                activeTarget.x = Math.max(82, activeTarget.x);
                activeTarget.z = 5;
                activeTarget.aiState = 'knockdown';
                activeTarget.vx = 240;
                activeTarget.vz = 165;
                activeTarget.hitFlash = 0.22;
              }
              impactFlashTimer = 0.18;
              impactX = 74;
              impactY = playerY - 22;
              shockwaveTimer = 0.28;
              shockwaveX = 64;
              shockwaveColor = '#facc15';
              spawnBurst(74, playerY - 12, 12, '#fde047', '#f8fafc');
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'rko') {
          if (seqTime < 0.34) {
            const leapProg = seqTime / 0.34;
            playerAnim = 'rkoCatch';
            playerX = 44 + leapProg * 30;
            playerZ = Math.sin(leapProg * Math.PI) * 22;
            if (seqStage === 0) seqStage = 1;
            if (activeTarget) {
              activeTarget.x = Math.max(playerX + 18, activeTarget.x - 14 * dt);
              activeTarget.z = playerZ * 0.55;
            }
          } else if (seqTime < 0.76) {
            playerAnim = 'rkoSlam';
            playerX = 74;
            playerZ = 0;
            if (seqStage === 1) {
              seqStage = 2;
              if (activeTarget) {
                activeTarget.aiState = 'knockdown';
                activeTarget.vx = 235;
                activeTarget.vz = 160;
                activeTarget.z = 4;
                activeTarget.hitFlash = 0.22;
              }
              impactFlashTimer = 0.18;
              impactX = 86;
              impactY = playerY - 12;
              shockwaveTimer = 0.3;
              shockwaveX = 82;
              shockwaveColor = '#fb7185';
              spawnBurst(86, playerY - 10, 12, '#fb7185', '#fde047');
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'trinity') {
          if (seqTime < 0.48) {
            playerAnim = 'trinityFreeze';
            playerX = 44;
            playerZ = 20;
            if (seqStage === 0) seqStage = 1;
          } else if (seqTime < 0.88) {
            const snapProg = Math.min(1, (seqTime - 0.48) / 0.16);
            playerAnim = 'trinityStrike';
            playerX = 44 + snapProg * 28;
            playerZ = 20 - ((seqTime - 0.48) / 0.4) * 13;
            if (seqStage === 1 && snapProg >= 0.7) {
              seqStage = 2;
              if (activeTarget) {
                activeTarget.aiState = 'knockdown';
                activeTarget.vx = 260;
                activeTarget.vz = 138;
                activeTarget.z = 4;
                activeTarget.hitFlash = 0.2;
                impactFlashTimer = 0.17;
                impactX = activeTarget.x - 4;
                impactY = activeTarget.y - 22;
                spawnBurst(impactX, impactY, 12, '#22c55e', '#fef08a');
              }
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'burly') {
          if (seqTime < 0.36) {
            playerAnim = 'matrixDodge';
            playerX = 42;
            playerZ = 0;
            if (seqStage === 0) seqStage = 1;
          } else if (seqTime < 0.88) {
            playerAnim = 'burlyFlurry';
            playerX = 50 + Math.sin((seqTime - 0.36) * 26) * 5;
            playerZ = 0;
            if (Math.floor(seqTime * 16) > seqStage) {
              seqStage = Math.floor(seqTime * 16);
              const closeTargets = enemies.filter((e) => e.aiState === 'approach' && e.x < 155);
              if (closeTargets.length > 0) {
                const t = closeTargets[seqStage % closeTargets.length];
                t.hitFlash = 0.11;
                t.x += 3;
                impactFlashTimer = 0.08;
                impactX = t.x - 6;
                impactY = t.y - 22;
                spawnBurst(impactX, impactY, 4, '#22c55e', '#fde047');
              }
            }
          } else if (seqTime < 1.24) {
            playerAnim = 'kickFinisher';
            playerX = 62;
            playerZ = 6;
            if (seqStage < 99) {
              seqStage = 99;
              shockwaveTimer = 0.3;
              shockwaveX = 72;
              shockwaveColor = '#22c55e';
              for (const en of enemies) {
                if (en.aiState === 'approach' && en.x < 195) {
                  en.aiState = 'knockdown';
                  en.vx = 235 + Math.random() * 45;
                  en.vz = 135 + Math.random() * 30;
                  en.z = 3;
                  en.hitFlash = 0.2;
                  spawnBurst(en.x - 4, en.y - 20, 7, '#22c55e', '#fde047');
                }
              }
            }
          } else {
            finishSequence();
          }
        }
      }

      // Enemy movement & physics: calm speed, clean spacing behind player/active target
      const bulletTimeFactor = phase === 'seq' && activeMove === 'trinity' && seqTime < 0.48 ? 0.25 : 1;
      const baseFloorX = phase === 'seq' ? 142 : 96;
      let prevApproachX = baseFloorX - 48;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hitFlash > 0) e.hitFlash -= dt;

        if (e.aiState === 'approach') {
          const isLockedTarget = phase === 'seq' && e === targetEnemy;
          if (!isLockedTarget) {
            const minSlotX = Math.max(baseFloorX, prevApproachX + 48);
            if (e.x > minSlotX) {
              e.x = Math.max(minSlotX, e.x - e.speed * dt * bulletTimeFactor);
              e.walkPhase += dt * (e.speed / 22) * bulletTimeFactor;
            } else if (e.x < minSlotX) {
              e.x = Math.min(minSlotX, e.x + 95 * dt);
            }
            prevApproachX = e.x;
          }
        } else if (e.aiState === 'hurt') {
          e.x += e.vx * dt;
          e.vx *= Math.pow(0.1, dt);
        } else {
          e.koTimer += dt;
          e.x += e.vx * dt;
          e.vx *= Math.pow(0.76, dt);
          e.z += e.vz * dt;
          e.vz -= 480 * dt;
          if (e.z <= 0) {
            e.z = 0;
            e.vz = 0;
          }
        }
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        if (en.x > W + 32 || en.x < -40 || (en.aiState === 'knockdown' && en.koTimer > 0.85)) {
          if (en === targetEnemy) targetEnemy = null;
          enemies.splice(i, 1);
        }
      }

      // Keep a clean queue of approaching enemies from the right edge
      const approaching = enemies.filter((e) => e.aiState === 'approach');
      const desiredApproaching = 3;
      const maxApproachX = approaching.reduce((m, e) => Math.max(m, e.x), 0);
      if (approaching.length < desiredApproaching && maxApproachX < W - 44 && enemies.length < 7) {
        enemies.push(spawnPreviewEnemy(W + 14 + Math.random() * 20));
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 240 * dt;
        sp.life -= dt;
        if (sp.life <= 0) sparks.splice(i, 1);
      }
      if (sparks.length > 36) {
        sparks.splice(0, sparks.length - 36);
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawHeaderFightArenaBackdrop(ctx, W, H, time, skyGrad, floorGrad);

      // Floor shockwave ring on Stunner / RKO / Burly Brawl finisher
      if (shockwaveTimer > 0) {
        const p = 1 - shockwaveTimer / 0.3;
        ctx.strokeStyle = shockwaveColor;
        ctx.lineWidth = 2 * (1 - p * 0.5);
        ctx.beginPath();
        ctx.ellipse(Math.round(shockwaveX), playerY + 1, 14 + p * 34, 4 + p * 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const actors: Array<{ y: number; render: () => void }> = [
        {
          y: playerY,
          render: () => {
            drawVectorPlayer(
              ctx,
              playerX,
              playerY,
              playerZ,
              1,
              playerAnim,
              phase === 'seq' ? seqTime : time,
              false,
              false,
              false,
              false,
              false,
              time,
              equippedSkin,
              garageConfig
            );
          },
        },
        ...enemies.map((e) => ({
          y: e.y,
          render: () => {
            const fadeAlpha =
              e.aiState === 'knockdown' && e.koTimer > 0.55
                ? Math.max(0, 1 - (e.koTimer - 0.55) / 0.3)
                : 1;
            ctx.save();
            if (fadeAlpha < 1) ctx.globalAlpha = fadeAlpha;
            drawVectorEnemy(
              ctx,
              e.type,
              e.x,
              e.y,
              e.z,
              -1,
              e.aiState,
              e.walkPhase,
              e.type === 'estudante',
              false,
              e.hitFlash > 0,
              time
            );
            ctx.restore();
          },
        })),
      ];

      actors.sort((a, b) => a.y - b.y);
      for (const actor of actors) {
        actor.render();
      }

      if (impactFlashTimer > 0) {
        const r = 9 + (1 - impactFlashTimer / 0.18) * 9;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(Math.round(impactX), Math.round(impactY), r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.round(impactX), Math.round(impactY), r, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const sp of sparks) {
        ctx.fillStyle = sp.color;
        ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2.5, 2.5);
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [equippedSkin, garageConfig]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090d16]">
      <canvas
        ref={bgCanvasRef}
        style={{ imageRendering: 'pixelated' }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Centered dark vignette so the centered bus-themed menu pops cleanly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(15,23,42,0.72) 0%, rgba(9,13,22,0.88) 72%, rgba(9,13,22,0.96) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-between w-full h-full px-4 py-2.5 sm:px-6 sm:py-4 md:px-10 md:py-6 overflow-y-auto">
        {/* Top Bus Marquee Route Bar + Account & Fichas */}
        <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f172a]/90 border border-[#94a3b8]/70 shadow-[0_3px_0_#020617]">
            <span className="font-arcade-display text-[10px] md:text-xs tracking-wider text-[#facc15]">
              VIAÇÃO 10.527 · LINHAS 101 · 202 · 303
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenShop}
              title="Abrir Lojinha do Terminal"
              className="px-4 py-1.5 rounded-full bg-[#facc15] hover:bg-[#fde047] active:translate-y-0.5 border-2 border-[#020617] text-[#090d16] shadow-[0_4px_0_#020617] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Coins className="w-4 h-4 text-[#78350f] shrink-0" />
              <span className="font-arcade-display text-xs md:text-sm tabular-nums tracking-wide">
                {shopCoins} FICHAS
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDailyMissions}
              title="Ver missões diárias"
              className="px-3.5 py-1.5 rounded-full bg-[#0f172a]/95 hover:bg-slate-800 border-2 border-[#38bdf8] text-slate-100 font-arcade-display text-[11px] shadow-[0_4px_0_#020617] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
              <span className="tabular-nums">
                MISSÕES · {dailyCompletedCount}/{dailyTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAchievements}
              title="Ver conquistas e marcos"
              className="px-3.5 py-1.5 rounded-full bg-[#0f172a]/95 hover:bg-slate-800 border-2 border-[#facc15]/80 text-slate-100 font-arcade-display text-[11px] shadow-[0_4px_0_#020617] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
              <span className="tabular-nums">
                CONQUISTAS · {achievementCount}/{achievementTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-3.5 py-1.5 rounded-full bg-[#0f172a]/95 hover:bg-slate-800 border-2 border-[#38bdf8] text-slate-100 font-arcade-display text-[11px] shadow-[0_4px_0_#020617] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trophy className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
              {user ? `${(user.displayName || 'ESTAGIÁRIO').split(' ')[0].toUpperCase()} · ${profile?.bestScore ?? 0}` : 'ENTRAR / PLACAR'}
            </button>
          </div>
        </div>

        {/* Centered Menu Panel using the Bus Color Palette */}
        <div className="w-full max-w-xl my-auto rounded-2xl overflow-hidden border-4 border-[#0f172a] shadow-[0_10px_0_#020617] bg-[#1d4ed8] shrink-0">
          {/* Highlighted Upper Dark Bus Window Strip with Animated Fight Canvas */}
          <div className="relative overflow-hidden bg-[#090d16] aspect-[5/2] w-full px-4 pt-1.5 pb-2 sm:px-5 sm:pt-2.5 sm:pb-3 border-b-4 border-[#ef4444] flex flex-col items-center justify-start text-center">
            <canvas
              ref={fightCanvasRef}
              aria-label="Animação do estagiário em posição de luta no lado esquerdo enfrentando inimigos aleatórios vindos da direita"
              style={{ imageRendering: 'pixelated' }}
              className="absolute inset-0 w-full h-full object-contain"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(9,13,22,0.8) 0%, rgba(9,13,22,0.22) 48%, rgba(9,13,22,0.26) 100%)',
              }}
            />

            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 mb-0.5 rounded bg-[#052e16]/90 border border-[#334155]">
                <span className="font-mono-num text-[10px] sm:text-[11px] font-bold tracking-widest text-[#34d399]">
                  {selectedMode === 'infinite'
                    ? 'MODO INFINITO · HORA DO RUSH'
                    : 'DESTINO: ESCRITÓRIO 09:00'}
                </span>
              </div>

              <svg
                viewBox="0 0 540 120"
                className="w-full max-w-[270px] sm:max-w-[330px] md:max-w-[360px] drop-shadow-[0_6px_0_rgba(2,6,23,0.95)]"
                role="img"
                aria-label="Horário de Pico: Briga no Busão"
              >
                <g transform="skewX(-6)">
                  <text
                    x="270"
                    y="54"
                    textAnchor="middle"
                    fill="#020617"
                    stroke="#020617"
                    strokeWidth="12"
                    strokeLinejoin="round"
                    fontFamily="Bungee, sans-serif"
                    fontSize="44"
                  >
                    HORÁRIO DE PICO
                  </text>
                  <text
                    x="270"
                    y="54"
                    textAnchor="middle"
                    fill="#facc15"
                    fontFamily="Bungee, sans-serif"
                    fontSize="44"
                  >
                    HORÁRIO DE PICO
                  </text>

                  <text
                    x="270"
                    y="102"
                    textAnchor="middle"
                    fill="#020617"
                    stroke="#020617"
                    strokeWidth="9"
                    strokeLinejoin="round"
                    fontFamily="Bungee, sans-serif"
                    fontSize="30"
                  >
                    BRIGA NO BUSÃO
                  </text>
                  <text
                    x="270"
                    y="102"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontFamily="Bungee, sans-serif"
                    fontSize="30"
                  >
                    BRIGA NO BUSÃO
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Lower Royal Blue Bus Livery Body */}
          <div className="relative bg-gradient-to-b from-[#1d4ed8] via-[#1e40af] to-[#1e3a8a] px-4 py-3 sm:px-6 sm:py-4 flex flex-col items-center text-center gap-2.5 sm:gap-3">
            {/* Segmented Mode Selector */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-[#090d16] border-2 border-[#38bdf8]/75 shadow-[0_4px_0_#020617]">
              <button
                type="button"
                onClick={() => onSelectMode('campaign')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-arcade-display inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  selectedMode === 'campaign'
                    ? 'bg-[#facc15] text-[#090d16] shadow-sm'
                    : 'bg-slate-800/85 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                CAMPANHA (3 LINHAS)
              </button>
              <button
                type="button"
                onClick={() => onSelectMode('infinite')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-arcade-display inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  selectedMode === 'infinite'
                    ? 'bg-[#38bdf8] text-[#090d16] shadow-sm'
                    : 'bg-slate-800/85 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                HORA DO RUSH (INFINITO)
              </button>
            </div>

            {selectedMode === 'infinite' && infiniteBest.bestWave > 0 && (
              <div className="font-mono-num text-xs text-sky-100 font-semibold tabular-nums">
                Recorde Local: Onda {infiniteBest.bestWave} ·{' '}
                {infiniteBest.bestScore.toLocaleString('pt-BR')} pts
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={onStart}
                className="px-7 py-2.5 sm:py-3 rounded-xl bg-[#facc15] hover:bg-[#fde047] active:translate-y-0.5 text-[#090d16] font-arcade-display text-xs sm:text-sm md:text-base border-2 border-[#020617] shadow-[0_5px_0_#020617] transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0"
              >
                EMBARCAR AGORA
              </button>

              <button
                type="button"
                onClick={onOpenShop}
                className="px-4 py-2.5 sm:py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 active:translate-y-0.5 text-[#facc15] font-arcade-display text-[11px] sm:text-xs md:text-sm border-2 border-[#facc15] shadow-[0_5px_0_#020617] transition-transform cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>LOJINHA</span>
              </button>

              <button
                type="button"
                onClick={onOpenTutorial}
                className="px-4 py-2.5 sm:py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 active:translate-y-0.5 text-slate-200 font-arcade-display text-[11px] sm:text-xs md:text-sm border-2 border-slate-400 shadow-[0_5px_0_#020617] transition-transform cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>TUTORIAL</span>
              </button>
            </div>
          </div>
        </div>
        <div className="h-1 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
