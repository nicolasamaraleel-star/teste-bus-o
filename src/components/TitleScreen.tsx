import { Award, BookOpen, Clock, Coins, Flame, ShoppingBag, Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { RENDER_SCALE } from '../game/levels';
import { InfiniteRecord, PlayerSkinStyle } from '../game/shop';
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
  onOpenTutorial: () => void;
  shopCoins: number;
  equippedSkin?: PlayerSkinStyle;
  achievementCount: number;
  achievementTotal: number;
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

  // Window pillars & bus wall trim
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 56, w, 24);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 56, w, 2.5);
  ctx.fillRect(0, 78, w, 2.5);

  for (let wx = 0; wx <= w; wx += 64) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(wx - 2, 10, 4, 48);
    ctx.fillStyle = '#334155';
    ctx.fillRect(wx - 1, 12, 2, 44);
  }

  // Back-row bus seats silhouette
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#090d16';
  for (let sx = 14; sx < w - 14; sx += 46) {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(sx, 60, 24, 17);
    ctx.strokeRect(sx, 60, 24, 17);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(sx + 3, 62, 18, 2.5);
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

  // Bus aisle floor
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 80, w, h - 80);

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 80, w, 2.5);

  const floorScroll = (time * 72) % 34;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
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
  onOpenTutorial,
  shopCoins,
  equippedSkin = 'classic',
  achievementCount,
  achievementTotal,
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
    const W = 320;
    const H = 128;
    canvas.width = W * RENDER_SCALE;
    canvas.height = H * RENDER_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const skyGrad = ctx.createLinearGradient(0, 12, 0, 56);
    skyGrad.addColorStop(0, '#070b18');
    skyGrad.addColorStop(1, '#172554');

    const floorGrad = ctx.createLinearGradient(0, 80, 0, H);
    floorGrad.addColorStop(0, '#334155');
    floorGrad.addColorStop(1, '#1e293b');

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
          ? 88
          : type === 'patricinha' || type === 'estudante'
            ? 74
            : type === 'idosa'
              ? 62
              : 70;
      return {
        type,
        x: startX,
        y: yOverride ?? 108 + Math.floor(Math.random() * 10),
        z: 0,
        vx: 0,
        vz: 0,
        speed: baseSpeed + Math.random() * 10,
        walkPhase: Math.random() * 4,
        aiState: 'approach',
        hitFlash: 0,
      };
    };

    const enemies: PreviewEnemy[] = [
      spawnPreviewEnemy(138, 114),
      spawnPreviewEnemy(212, 110),
      spawnPreviewEnemy(286, 115),
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
    let playerX = 46;
    const playerY = 114;
    let playerZ = 0;
    let playerAnim = 'fightStance';
    let impactFlashTimer = 0;
    let impactX = 80;
    let impactY = 92;
    let shockwaveTimer = 0;
    let shockwaveX = 78;
    let shockwaveColor = '#facc15';
    let calloutText = '';
    let calloutColor = '#fde047';
    let calloutTimer = 0;
    let cooldown = 0.08;

    let rafId = 0;
    let time = 0;
    let last = performance.now();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const finishSequence = () => {
      phase = 'wait';
      waitTimer = 0;
      seqTime = 0;
      seqStage = 0;
      playerAnim = 'fightStance';
      playerZ = 0;
      cooldown = 0.08;
      moveIndex = (moveIndex + 1) % MOVE_SEQUENCE.length;
      activeMove = MOVE_SEQUENCE[moveIndex];

      // Pre-stage approaching enemies for Burly Brawl without waiting on knocked-out bodies
      if (activeMove === 'burly') {
        const approachingCount = enemies.filter((e) => e.aiState === 'approach').length;
        for (let k = approachingCount; k < 3 && enemies.length < 6; k++) {
          enemies.push(spawnPreviewEnemy(175 + k * 34, 108 + (k % 3) * 4));
        }
      }
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (modalOpenRef.current || document.hidden) {
        last = now;
        return;
      }

      const rawDt = Math.min((now - last) / 1000, 0.05);
      const dt = reduceMotion ? rawDt * 0.25 : rawDt;
      last = now;
      time += dt;

      if (cooldown > 0) cooldown -= dt;
      if (impactFlashTimer > 0) impactFlashTimer -= dt;
      if (shockwaveTimer > 0) shockwaveTimer -= dt;
      if (calloutTimer > 0) calloutTimer -= dt;

      let leadIdx = enemies.findIndex((e) => e.aiState === 'approach');
      if (leadIdx < 0) {
        enemies.push(spawnPreviewEnemy(150, 112));
        leadIdx = enemies.length - 1;
      }
      const lead = enemies[leadIdx];

      if (phase === 'wait') {
        waitTimer += dt;
        // Smoothly glide player back to left fighting stance spot
        playerX += (46 - playerX) * Math.min(1, dt * 14);
        playerZ += (0 - playerZ) * Math.min(1, dt * 14);
        playerAnim = 'fightStance';

        const triggerDist =
          activeMove === 'rko' ? 116 : activeMove === 'trinity' ? 110 : 106;
        const canTrigger =
          lead &&
          cooldown <= 0 &&
          ((lead.x <= triggerDist && lead.x >= 56) || (waitTimer > 0.75 && lead.x < W - 8));

        if (canTrigger && lead) {
          if (lead.x > triggerDist) lead.x = triggerDist - 4;
          if (lead.x < 68) lead.x = 76;
          phase = 'seq';
          waitTimer = 0;
          seqTime = 0;
          seqStage = 0;
        }
      } else {
        seqTime += dt;

        if (activeMove === 'crane') {
          // 1. CHUTE DA GARÇA (Karatê Kid)
          if (seqTime < 0.42) {
            playerAnim = 'cranePrep';
            playerX = 46;
            playerZ = 0;
            if (seqStage === 0) {
              seqStage = 1;
              calloutText = 'CHUTE DA GARÇA!';
              calloutColor = '#fde047';
              calloutTimer = 1.05;
            }
          } else if (seqTime < 0.8) {
            playerAnim = 'craneKick';
            const kProg = (seqTime - 0.42) / 0.38;
            playerX = 46 + Math.sin(kProg * Math.PI) * 14;
            playerZ = Math.sin(kProg * Math.PI) * 12;
            if (seqStage === 1) {
              seqStage = 2;
              if (lead) {
                lead.aiState = 'knockdown';
                lead.vx = 220;
                lead.vz = 148;
                lead.z = 3;
                lead.hitFlash = 0.18;
                impactFlashTimer = 0.16;
                impactX = lead.x - 4;
                impactY = lead.y - 26;
                spawnBurst(impactX, impactY, 10, '#fde047', '#f97316');
              }
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'stunner') {
          // 2. STONE COLD STUNNER (WWE)
          if (seqTime < 0.2) {
            playerAnim = 'kick';
            playerX = 52;
            if (seqStage === 0 && lead) {
              seqStage = 1;
              lead.aiState = 'hurt';
              lead.hitFlash = 0.14;
              lead.x = Math.min(84, Math.max(70, lead.x));
              calloutText = 'STONE COLD STUNNER!';
              calloutColor = '#facc15';
              calloutTimer = 1.15;
              spawnBurst(lead.x - 4, lead.y - 16, 6, '#f8fafc', '#facc15');
            }
          } else if (seqTime < 0.68) {
            playerAnim = 'stunnerDrop';
            playerX = 62;
            playerZ = seqTime < 0.29 ? 7 * (1 - (seqTime - 0.2) / 0.09) : 0;
            if (seqStage === 1) {
              seqStage = 2;
              if (lead) {
                lead.x = 76;
                lead.z = 5;
                lead.aiState = 'knockdown';
                lead.vx = 200;
                lead.vz = 170;
                lead.hitFlash = 0.22;
              }
              impactFlashTimer = 0.18;
              impactX = 72;
              impactY = playerY - 22;
              shockwaveTimer = 0.28;
              shockwaveX = 64;
              shockwaveColor = '#facc15';
              spawnBurst(72, playerY - 12, 12, '#fde047', '#f8fafc');
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'rko') {
          // 3. RKO (WWE)
          if (seqTime < 0.34) {
            const leapProg = seqTime / 0.34;
            playerAnim = 'rkoCatch';
            playerX = 46 + leapProg * 36;
            playerZ = Math.sin(leapProg * Math.PI) * 23;
            if (seqStage === 0) {
              seqStage = 1;
              calloutText = 'RKO OUTTA NOWHERE!';
              calloutColor = '#fb7185';
              calloutTimer = 1.15;
            }
            if (lead) {
              lead.x = Math.max(playerX + 12, lead.x - 18 * dt);
              lead.z = playerZ * 0.55;
            }
          } else if (seqTime < 0.74) {
            playerAnim = 'rkoSlam';
            playerX = 82;
            playerZ = 0;
            if (seqStage === 1) {
              seqStage = 2;
              if (lead) {
                lead.aiState = 'knockdown';
                lead.vx = 185;
                lead.vz = 165;
                lead.z = 4;
                lead.hitFlash = 0.22;
              }
              impactFlashTimer = 0.18;
              impactX = 90;
              impactY = playerY - 12;
              shockwaveTimer = 0.3;
              shockwaveX = 86;
              shockwaveColor = '#fb7185';
              spawnBurst(88, playerY - 10, 12, '#fb7185', '#fde047');
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'trinity') {
          // 4. CHUTE VOADOR DE TRINITY (Matrix Bullet-Time Pause Kick)
          if (seqTime < 0.48) {
            playerAnim = 'trinityFreeze';
            playerX = 52;
            playerZ = 21;
            if (seqStage === 0) {
              seqStage = 1;
              calloutText = 'VOADORA TRINITY!';
              calloutColor = '#4ade80';
              calloutTimer = 1.15;
            }
          } else if (seqTime < 0.88) {
            const snapProg = Math.min(1, (seqTime - 0.48) / 0.16);
            playerAnim = 'trinityStrike';
            playerX = 52 + snapProg * 30;
            playerZ = 21 - ((seqTime - 0.48) / 0.4) * 14;
            if (seqStage === 1 && snapProg >= 0.7) {
              seqStage = 2;
              if (lead) {
                lead.aiState = 'knockdown';
                lead.vx = 240;
                lead.vz = 132;
                lead.z = 4;
                lead.hitFlash = 0.2;
                impactFlashTimer = 0.17;
                impactX = lead.x - 4;
                impactY = lead.y - 22;
                spawnBurst(impactX, impactY, 12, '#22c55e', '#fef08a');
              }
            }
          } else {
            finishSequence();
          }
        } else if (activeMove === 'burly') {
          // 5. BURLY BRAWL (Matrix Neo Multi-Enemy Rush + Bullet Dodge + Flurry)
          if (seqTime < 0.36) {
            playerAnim = 'matrixDodge';
            playerX = 46;
            playerZ = 0;
            if (seqStage === 0) {
              seqStage = 1;
              calloutText = 'BURLY BRAWL!';
              calloutColor = '#22c55e';
              calloutTimer = 1.4;
            }
          } else if (seqTime < 0.88) {
            playerAnim = 'burlyFlurry';
            playerX = 56 + Math.sin((seqTime - 0.36) * 26) * 6;
            playerZ = 0;
            // Rapidly hit & juggle approaching enemies
            if (Math.floor(seqTime * 16) > seqStage) {
              seqStage = Math.floor(seqTime * 16);
              const closeTargets = enemies.filter((e) => e.aiState === 'approach' && e.x < 118);
              if (closeTargets.length > 0) {
                const t = closeTargets[seqStage % closeTargets.length];
                t.hitFlash = 0.11;
                t.x += 4;
                impactFlashTimer = 0.08;
                impactX = t.x - 6;
                impactY = t.y - 22;
                spawnBurst(impactX, impactY, 4, '#22c55e', '#fde047');
              }
            }
          } else if (seqTime < 1.24) {
            playerAnim = 'kickFinisher';
            playerX = 68;
            playerZ = 6;
            if (seqStage < 99) {
              seqStage = 99;
              shockwaveTimer = 0.3;
              shockwaveX = 72;
              shockwaveColor = '#22c55e';
              for (const en of enemies) {
                if (en.aiState === 'approach' && en.x < 175) {
                  en.aiState = 'knockdown';
                  en.vx = 215 + Math.random() * 55;
                  en.vz = 125 + Math.random() * 35;
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

      // Enemy movement & physics (bullet-time slow during Trinity freeze!)
      const bulletTimeFactor = phase === 'seq' && activeMove === 'trinity' && seqTime < 0.48 ? 0.2 : 1;
      const rushFactor = phase === 'wait' && lead && lead.x > 116 ? 1.55 : 1;

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.hitFlash > 0) e.hitFlash -= dt;

        if (e.aiState === 'approach') {
          const stopFloor = phase === 'seq' && activeMove === 'burly' ? 68 + (i % 3) * 14 : 68;
          if (e.x > stopFloor) {
            e.x -= e.speed * dt * bulletTimeFactor * rushFactor;
            e.walkPhase += dt * (e.speed / 28) * bulletTimeFactor * rushFactor;
          }
        } else if (e.aiState === 'hurt') {
          e.x += e.vx * dt;
          e.vx *= Math.pow(0.1, dt);
        } else {
          e.x += e.vx * dt;
          e.vx *= Math.pow(0.45, dt);
          e.z += e.vz * dt;
          e.vz -= 480 * dt;
          if (e.z <= 0) {
            e.z = 0;
            e.vz = 0;
          }
        }

        if (e.x > W + 32 || e.x < -40) {
          enemies.splice(i, 1);
        }
      }

      // Keep a continuous queue of approaching enemies from the right edge (ignore flying KO bodies)
      const approaching = enemies.filter((e) => e.aiState === 'approach');
      const desiredApproaching = activeMove === 'burly' ? 4 : 3;
      const maxApproachX = approaching.reduce((m, e) => Math.max(m, e.x), 0);
      if (approaching.length < desiredApproaching && maxApproachX < W - 36 && enemies.length < 6) {
        enemies.push(spawnPreviewEnemy(W + 10 + Math.random() * 20));
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
      ctx.scale(RENDER_SCALE, RENDER_SCALE);

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
              equippedSkin
            );
          },
        },
        ...enemies.map((e) => ({
          y: e.y,
          render: () => {
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
              e.type === 'industria',
              e.hitFlash > 0,
              time
            );
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

      if (calloutTimer > 0 && calloutText) {
        ctx.font = 'bold 8.5px "Bungee", "Chakra Petch", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#020617';
        ctx.fillText(calloutText, 11, H - 4);
        ctx.fillStyle = calloutColor;
        ctx.fillText(calloutText, 10, H - 5);
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [equippedSkin]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090d16]">
      <canvas
        ref={bgCanvasRef}
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
            <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="font-arcade-display text-[10px] md:text-xs tracking-wider text-[#facc15]">
              VIAÇÃO 10.527 · LINHAS 101 · 202 · 303
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenShop}
              title="Abrir Lojinha do Terminal"
              className="px-4 py-1.5 rounded-full bg-[#facc15] bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] active:translate-y-0.5 border-2 border-[#020617] text-[#090d16] shadow-[0_4px_0_#020617] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Coins className="w-4 h-4 text-[#78350f] shrink-0" />
              <span className="font-arcade-display text-xs md:text-sm tabular-nums tracking-wide">
                {shopCoins} FICHAS
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAchievements}
              title="Ver conquistas e marcos"
              className="px-3.5 py-1.5 rounded-full bg-[#0f172a]/95 hover:bg-slate-800 border-2 border-[#facc15]/80 text-slate-100 font-arcade-display text-[11px] shadow-[0_4px_0_#020617] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
              <span>
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
          <div className="relative overflow-hidden bg-[#0f172a] px-4 pt-2.5 pb-16 sm:px-5 sm:pt-3 sm:pb-20 border-b-4 border-[#ef4444] flex flex-col items-center text-center">
            <canvas
              ref={fightCanvasRef}
              aria-label="Animação do estagiário em posição de luta no lado esquerdo enfrentando inimigos aleatórios vindos da direita"
              style={{ imageRendering: 'pixelated' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(9,13,22,0.78) 0%, rgba(9,13,22,0.28) 54%, rgba(9,13,22,0.38) 100%)',
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
                className="px-7 py-2.5 sm:py-3 rounded-xl bg-[#facc15] bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] active:translate-y-0.5 text-[#090d16] font-arcade-display text-xs sm:text-sm md:text-base border-2 border-[#020617] shadow-[0_5px_0_#020617] transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white whitespace-nowrap shrink-0"
              >
                EMBARCAR AGORA
              </button>

              <button
                type="button"
                onClick={onOpenShop}
                className="px-4 py-2.5 sm:py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 active:translate-y-0.5 text-[#facc15] font-arcade-display text-[11px] sm:text-xs md:text-sm border-2 border-[#facc15] shadow-[0_5px_0_#020617] transition-transform cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>LOJINHA DO TERMINAL</span>
              </button>

              <button
                type="button"
                onClick={onOpenTutorial}
                className="px-4 py-2.5 sm:py-3 rounded-xl bg-[#0f172a] hover:bg-slate-800 active:translate-y-0.5 text-[#38bdf8] font-arcade-display text-[11px] sm:text-xs md:text-sm border-2 border-[#38bdf8] shadow-[0_5px_0_#020617] transition-transform cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
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
