import { getStandingCommutersAtBay, isBusSeatOccupied } from './seats';
import { PlayerSkinStyle } from './shop';
import { EnemyType, ItemType, LineDefinition, Particle } from './types';

// ============================================================================
// 16-BIT PIXEL ART & BAYER DITHERING UTILITIES
// ============================================================================

const patternCache = new Map<string, CanvasPattern | null>();

function px(v: number): number {
  return Math.round(v);
}

/**
 * Generates a cached 4x4 Bayer ordered dithering pattern between two colors.
 * density: 1 (25% c2), 2 (50% checkerboard), 3 (75% c2), 4 (fabric speckle)
 */
function getBayerPattern(
  ctx: CanvasRenderingContext2D,
  c1: string,
  c2: string,
  density: 1 | 2 | 3 | 4 = 2
): CanvasPattern | string {
  const key = `${c1}|${c2}|${density}`;
  if (patternCache.has(key)) {
    return patternCache.get(key) || c1;
  }
  if (typeof document === 'undefined') return c1;

  const off = document.createElement('canvas');
  off.width = 4;
  off.height = 4;
  const octx = off.getContext('2d');
  if (!octx) return c1;

  octx.fillStyle = c1;
  octx.fillRect(0, 0, 4, 4);
  octx.fillStyle = c2;

  if (density === 1) {
    // 25% Bayer dots
    octx.fillRect(0, 0, 1, 1);
    octx.fillRect(2, 2, 1, 1);
    octx.fillRect(2, 0, 1, 1);
    octx.fillRect(0, 2, 1, 1);
  } else if (density === 2) {
    // 50% crisp 1px checkerboard
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if ((x + y) % 2 === 0) octx.fillRect(x, y, 1, 1);
      }
    }
  } else if (density === 3) {
    // 75% Bayer fill
    octx.fillRect(0, 0, 4, 4);
    octx.fillStyle = c1;
    octx.fillRect(1, 1, 1, 1);
    octx.fillRect(3, 3, 1, 1);
    octx.fillRect(3, 1, 1, 1);
    octx.fillRect(1, 3, 1, 1);
  } else {
    // Seat fabric moquette pattern
    octx.fillRect(0, 0, 1, 1);
    octx.fillRect(3, 1, 1, 1);
    octx.fillRect(1, 2, 1, 1);
    octx.fillRect(2, 3, 1, 1);
  }

  const pat = ctx.createPattern(off, 'repeat');
  patternCache.set(key, pat);
  return pat || c1;
}

function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string | CanvasPattern,
  outline?: string,
  lineWidth = 1.2
) {
  const rx = px(x);
  const ry = px(y);
  const rw = Math.max(1, px(w));
  const rh = Math.max(1, px(h));
  ctx.fillStyle = fill;
  ctx.fillRect(rx, ry, rw, rh);
  if (outline && lineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }
}

function pxBlockShaded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  shadow: string,
  highlight?: string,
  outline = '#090d16'
) {
  const rx = px(x);
  const ry = px(y);
  const rw = Math.max(2, px(w));
  const rh = Math.max(2, px(h));

  ctx.fillStyle = base;
  ctx.fillRect(rx, ry, rw, rh);

  // Bottom & back flat shadow block
  ctx.fillStyle = shadow;
  ctx.fillRect(rx, ry + Math.floor(rh * 0.62), rw, Math.ceil(rh * 0.38));
  ctx.fillRect(rx, ry, Math.max(1, Math.floor(rw * 0.22)), rh);

  if (highlight) {
    ctx.fillStyle = highlight;
    ctx.fillRect(rx + 1, ry + 1, Math.max(1, rw - 3), Math.max(1, Math.floor(rh * 0.2)));
  }

  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }
}

function fillStrokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient | CanvasPattern,
  stroke = '#090d16',
  lineWidth = 1.4
) {
  if (r <= 1.5) {
    pxRect(ctx, x, y, w, h, fill as string | CanvasPattern, lineWidth > 0 ? stroke : undefined, lineWidth);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(px(x), px(y), px(w), px(h), r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function fillStrokeCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient,
  stroke = '#090d16',
  lineWidth = 1.4
) {
  ctx.beginPath();
  ctx.arc(px(x), px(y), r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws a true stepped 16-bit pixel-art limb segment with 1px dark outline and flat shadow tone.
 */
function pxLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  fill: string,
  shadow?: string,
  outline = '#090d16'
) {
  const ax = px(x1);
  const ay = px(y1);
  const bx = px(x2);
  const by = px(y2);
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const size = Math.max(2, Math.round(thickness));
  const half = Math.floor(size * 0.5);
  const horizDominant = Math.abs(dx) >= Math.abs(dy);

  // Pass 1: Crisp stepped 1px dark outline
  ctx.fillStyle = outline;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(ax + dx * t);
    const cy = Math.round(ay + dy * t);
    ctx.fillRect(cx - half - 1, cy - half - 1, size + 2, size + 2);
  }

  // Pass 2: Inner primary pixel fill
  ctx.fillStyle = fill;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(ax + dx * t);
    const cy = Math.round(ay + dy * t);
    ctx.fillRect(cx - half, cy - half, size, size);
  }

  // Pass 3: Flat 16-bit shadow block along bottom/back edge
  if (shadow && size >= 3) {
    ctx.fillStyle = shadow;
    const sh = Math.max(1, Math.floor(size * 0.42));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(ax + dx * t);
      const cy = Math.round(ay + dy * t);
      if (horizDominant) {
        ctx.fillRect(cx - half, cy + half - sh, size, sh);
      } else {
        ctx.fillRect(cx - half, cy - half, sh, size);
      }
    }
  }
}

function drawAnimeKiAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  clock: number,
  options: {
    scale: number;
    outerColor: string;
    midColor: string;
    edgeStroke: string;
    coreColor: string;
    sparkColor: string;
    seedOffset: number;
  }
) {
  const { scale, outerColor, edgeStroke, coreColor, sparkColor, seedOffset } = options;
  const cx = px(x);
  const cy = px(baseY - 24 * scale);
  const frame = Math.floor(clock * 14 + seedOffset) % 2;

  ctx.save();
  // Crisp stepped pixel ki flames (16-bit arcade style)
  ctx.fillStyle = outerColor;
  ctx.strokeStyle = edgeStroke;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const spikes = 16;
  for (let i = 0; i < spikes; i++) {
    const t = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const isPeak = i % 2 === 0;
    const jit = ((i + frame) % 3) * 2.2 * scale;
    const rx = (isPeak ? 21 + jit * 0.5 : 14) * scale;
    const ry = (isPeak ? (Math.sin(t) < -0.4 ? 32 : 25) + jit : 18) * scale;
    const pxp = px(cx + Math.cos(t) * rx);
    const pyp = px(cy + Math.sin(t) * ry);
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = coreColor;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const isPeak = i % 2 === frame;
    const rx = (isPeak ? 13 : 9) * scale;
    const ry = (isPeak ? 20 : 13) * scale;
    const pxp = px(cx + Math.cos(t) * rx);
    const pyp = px(cy + Math.sin(t) * ry);
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fill();

  for (let p = 0; p < 4; p++) {
    const prog = (clock * 2.4 + p * 0.25 + seedOffset) % 1;
    const sx = px(cx + Math.sin(p * 2.1 + clock * 5) * 14 * scale);
    const sy = px(baseY - 6 - prog * 44 * scale);
    ctx.fillStyle = p % 2 === 0 ? '#ffffff' : sparkColor;
    ctx.fillRect(sx - 1, sy - 2, 2, 4);
  }
  ctx.restore();
}

// ============================================================================
// IMPACT FLASH STARBURST (5. Efeitos: Flash amarelo/branco, simples e direto)
// ============================================================================

export function drawImpactFlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  strong = false
) {
  const cx = px(x);
  const cy = px(y);
  const scale = strong ? 1.35 : 0.95;
  const shrink = progress < 0.35 ? 0.7 + (progress / 0.35) * 0.45 : Math.max(0.2, 1.15 - progress);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale * shrink, scale * shrink);

  // Outer golden-amber pixel starburst
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const rays = 10;
  for (let i = 0; i < rays; i++) {
    const a = (i * Math.PI * 2) / rays + (strong ? 0.2 : 0);
    const r = i % 2 === 0 ? (i % 4 === 0 ? 15 : 11) : 4;
    const pxp = px(Math.cos(a) * r);
    const pyp = px(Math.sin(a) * r);
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sharp white-hot pixel core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 7 : 2.5;
    const pxp = px(Math.cos(a) * r);
    const pyp = px(Math.sin(a) * r);
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Renders 16-bit pixel-aligned hit particles, including stepped metallic sparks
 * with white-hot -> metallic -> ember cooling palettes and tumbling shards.
 */
export function drawPixelParticle(
  ctx: CanvasRenderingContext2D,
  pt: Particle,
  camX: number
) {
  const sx = px(pt.x - camX);
  const sy = px(pt.y - pt.z);
  const maxLife = Math.max(0.05, pt.maxLife);
  const lifeRatio = Math.max(0, Math.min(1, pt.life / maxLife));
  const age = 1 - lifeRatio;

  if (pt.kind === 'spark') {
    // Discrete 16-bit palette cooling: white-hot core -> primary metallic -> cooled slag
    const cool = pt.coolColor ?? '#f97316';
    const headColor = age < 0.36 ? '#ffffff' : age < 0.74 ? pt.color : cool;
    const midColor = age < 0.28 ? pt.color : cool;
    const tailColor = cool;

    const ox = pt.prevX !== undefined ? px(pt.prevX - camX) : px(pt.x - pt.vx * 0.022 - camX);
    const oy =
      pt.prevY !== undefined && pt.prevZ !== undefined
        ? px(pt.prevY - pt.prevZ)
        : px(pt.y - pt.z + pt.vz * 0.022);

    const dx = sx - ox;
    const dy = sy - oy;
    const dist = Math.hypot(dx, dy);

    if (dist >= 1.5) {
      const steps = Math.min(4, Math.max(2, Math.round(dist * 0.75)));
      for (let i = 0; i < steps; i++) {
        const f = i / steps;
        const tx = px(ox + dx * f);
        const ty = px(oy + dy * f);
        ctx.fillStyle = i === 0 ? tailColor : midColor;
        ctx.fillRect(tx, ty, 1, 1);
      }
    }

    const headSize = pt.size >= 2.8 && age < 0.55 ? 2 : 1;
    ctx.fillStyle = headColor;
    ctx.fillRect(sx, sy, headSize, headSize);

    // Crisp 1px pixel cross-glint on peak metallic spark frames
    if ((age < 0.22 && pt.size >= 2.4) || (pt.z <= 1 && Math.abs(pt.vx) > 45 && age < 0.65)) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(sx - 1, sy, 1, 1);
      ctx.fillRect(sx + headSize, sy, 1, 1);
      ctx.fillRect(sx, sy - 1, 1, 1);
      ctx.fillRect(sx, sy + headSize, 1, 1);
    }
    return;
  }

  if (pt.kind === 'shard') {
    const glintFrame = Math.floor(pt.life * 28) % 3;
    const bodyColor =
      glintFrame === 0 ? '#ffffff' : glintFrame === 1 ? pt.color : (pt.coolColor ?? '#64748b');
    const w = pt.size >= 3 ? 3 : 2;
    const h = 2;
    // 1px dark 16-bit pixel shadow under shard
    ctx.fillStyle = '#090d16';
    ctx.fillRect(sx, sy + h, w, 1);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx, sy, w, h);
    if (glintFrame === 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
    }
    return;
  }

  // Standard crisp pixel square
  ctx.fillStyle = pt.color;
  const sz = Math.max(2, Math.round(pt.size * 0.85));
  ctx.fillRect(sx, sy, sz, sz);
}

// ============================================================================
// PLAYER SPRITE (16-BIT ARCADE PROPORTIONS & 6+ CRISP FIGHTING POSES)
// ============================================================================

export function drawVectorPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  facing: 1 | -1,
  anim: string,
  animTimer: number,
  hasCane: boolean,
  hasMakeupShield: boolean,
  hitFlash: boolean,
  hasStrengthBuff = false,
  hasRageBuff = false,
  time = 0,
  skinStyle: PlayerSkinStyle = 'classic'
) {
  ctx.save();

  // Crisp 16-bit floor shadow
  const shadowScale = Math.max(0.5, 1 - z / 115);
  ctx.fillStyle = 'rgba(5, 8, 18, 0.56)';
  ctx.fillRect(
    px(x - 12 * shadowScale),
    px(y - 2 * shadowScale),
    px(24 * shadowScale),
    px(5 * shadowScale)
  );
  ctx.fillStyle = 'rgba(5, 8, 18, 0.35)';
  ctx.fillRect(
    px(x - 14 * shadowScale),
    px(y - 1 * shadowScale),
    px(28 * shadowScale),
    px(3 * shadowScale)
  );

  const auraClock = time > 0 ? time : animTimer;

  if (hasRageBuff) {
    drawAnimeKiAura(ctx, x, y - z, auraClock, {
      scale: hasStrengthBuff ? 1.1 : 1.02,
      outerColor: 'rgba(220, 38, 38, 0.88)',
      midColor: 'rgba(239, 68, 68, 0.7)',
      edgeStroke: '#7f1d1d',
      coreColor: 'rgba(254, 215, 170, 0.75)',
      sparkColor: '#f87171',
      seedOffset: 0,
    });
  }

  if (hasStrengthBuff) {
    drawAnimeKiAura(ctx, x, y - z, auraClock, {
      scale: hasRageBuff ? 0.88 : 0.98,
      outerColor: 'rgba(234, 179, 8, 0.88)',
      midColor: 'rgba(250, 204, 21, 0.7)',
      edgeStroke: '#854d0e',
      coreColor: 'rgba(254, 249, 195, 0.8)',
      sparkColor: '#fde047',
      seedOffset: 2.7,
    });
  }

  if (anim === 'victory') {
    // Golden 16-bit victory floor podium/spotlight highlight under player
    const pulse = Math.floor(auraClock * 5) % 2;
    ctx.fillStyle = pulse === 0 ? 'rgba(250, 204, 21, 0.36)' : 'rgba(52, 211, 153, 0.34)';
    ctx.fillRect(px(x - 18), px(y - 3), 36, 7);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px(x - 16), px(y + 3), 32, 2);
  }

  ctx.translate(px(x), px(y - z));
  ctx.scale(facing, 1);

  // Stepped 16-bit frame timing (4-frame walk, 2-frame idle breath)
  const walkFrame = ((Math.floor(animTimer * 10) % 4) + 4) % 4;
  const idleFrame = ((Math.floor(auraClock * 3.2) % 2) + 2) % 2;

  // Special kick (Tecla C) opens in suspended Matrix coil before snapping the flying kick
  const isSpecialCoil = anim === 'special' && animTimer > 0.22;
  const isTrinityCoil = isSpecialCoil;

  // Pose-specific body offsets & lean for unmistakable arcade silhouettes
  let bodyDx = 0;
  let bodyDy = 0;
  let leanAngle = 0;

  if (anim === 'idle') {
    bodyDy = idleFrame === 1 ? 1 : 0;
  } else if (anim === 'fightStance') {
    bodyDx = 1;
    bodyDy = Math.sin(auraClock * 9.5) > 0 ? 2 : 0;
    leanAngle = 0.09;
  } else if (anim === 'victory') {
    bodyDy = idleFrame === 1 ? -1 : 0;
    leanAngle = -0.04;
  } else if (anim === 'walk') {
    bodyDx = 1;
    bodyDy = walkFrame % 2 === 1 ? -1 : 0;
    leanAngle = 0.05;
  } else if (anim === 'punch1' || anim === 'punch2') {
    bodyDx = anim === 'punch2' ? 3 : 2;
    bodyDy = 1;
    leanAngle = 0.1;
  } else if (anim === 'punch3') {
    bodyDx = 2;
    bodyDy = -1;
    leanAngle = -0.05;
  } else if (anim === 'kick') {
    bodyDx = -2;
    bodyDy = -1;
    leanAngle = -0.14;
  } else if (anim === 'jumpKick') {
    bodyDx = 2;
    bodyDy = -3;
    leanAngle = -0.25;
  } else if (anim === 'special') {
    bodyDx = isSpecialCoil ? 0 : 4;
    bodyDy = -2;
    leanAngle = isSpecialCoil ? -0.34 : -0.3;
  } else if (anim === 'kickFinisher') {
    bodyDx = 2;
    bodyDy = -2;
    leanAngle = -0.22;
  } else if (anim === 'railSlam') {
    bodyDx = 0;
    bodyDy = 3;
    leanAngle = 0.24;
  } else if (anim === 'hurt') {
    // Reação mais inclinada!
    bodyDx = -4;
    bodyDy = 1;
    leanAngle = -0.28;
  } else if (anim === 'knockdown') {
    bodyDx = -5;
    bodyDy = 4;
    leanAngle = -0.55;
  } else if (anim === 'bagGuard') {
    // Pose muito clara de defesa agachada atrás da mochila
    bodyDx = -1;
    bodyDy = 4;
    leanAngle = 0.06;
  } else if (anim === 'headphoneWhip') {
    const whipProg = Math.max(0, Math.min(1, 1 - animTimer / 0.38));
    bodyDx = whipProg < 0.25 ? -3 : 3;
    bodyDy = 1;
    leanAngle = whipProg < 0.25 ? -0.14 : 0.14;
  } else if (anim === 'seatRest') {
    bodyDy = 5;
  } else if (anim === 'cranePrep') {
    bodyDy = -2;
    leanAngle = -0.05;
  } else if (anim === 'craneKick') {
    bodyDx = 2;
    bodyDy = -3;
    leanAngle = -0.25;
  } else if (anim === 'stunnerDrop') {
    bodyDx = 1;
    bodyDy = 11;
    leanAngle = -0.24;
  } else if (anim === 'rkoCatch') {
    bodyDx = 4;
    bodyDy = 3;
    leanAngle = 0.78;
  } else if (anim === 'rkoSlam') {
    bodyDx = 2;
    bodyDy = 10;
    leanAngle = 1.24;
  } else if (anim === 'trinityFreeze') {
    bodyDx = 0;
    bodyDy = -2;
    leanAngle = -0.34;
  } else if (anim === 'trinityStrike') {
    bodyDx = 4;
    bodyDy = -2;
    leanAngle = -0.3;
  } else if (anim === 'matrixDodge') {
    bodyDx = -2;
    bodyDy = 5;
    leanAngle = -0.72;
  } else if (anim === 'burlyFlurry') {
    bodyDx = 2;
    bodyDy = 1;
    leanAngle = 0.14;
  }

  const hipY = -17 + bodyDy;
  const torsoTopY = -33 + bodyDy;
  const headY = -44 + bodyDy;

  const skinPalette: Record<
    PlayerSkinStyle,
    {
      shirtBase: string;
      shirtShadow: string;
      shirtHi: string;
      sleeveMain: string;
      sleeveShadow: string;
      pantsUpperRear: string;
      pantsUpperRearDark: string;
      pantsLowerRear: string;
      pantsLowerRearDark: string;
      pantsUpperFront: string;
      pantsUpperFrontDark: string;
      pantsLowerFront: string;
      pantsLowerFrontDark: string;
      shoeBase: string;
      shoeAccent: string;
      shoeSole: string;
      tieMain: string;
      tieDark: string;
      hideChestTie?: boolean;
      bagMain: string;
      bagDark: string;
      bagPocket: string;
      bagTrim: string;
      beltMain: string;
      buckle: string;
      visorColor?: string;
      suitLapels?: boolean;
      senaiTee?: boolean;
      ninjaHeadTie?: boolean;
      motoboyGear?: boolean;
    }
  > = {
    classic: {
      shirtBase: '#f1f5f9',
      shirtShadow: '#94a3b8',
      shirtHi: '#ffffff',
      sleeveMain: '#f1f5f9',
      sleeveShadow: '#94a3b8',
      pantsUpperRear: '#1e2b58',
      pantsUpperRearDark: '#0f172a',
      pantsLowerRear: '#334155',
      pantsLowerRearDark: '#1e293b',
      pantsUpperFront: '#475569',
      pantsUpperFrontDark: '#1e2b58',
      pantsLowerFront: '#6076b8',
      pantsLowerFrontDark: '#334155',
      shoeBase: '#f1f5f9',
      shoeAccent: '#2563eb',
      shoeSole: '#334155',
      tieMain: '#dc2626',
      tieDark: '#991b1b',
      bagMain: '#1d4ed8',
      bagDark: '#0f172a',
      bagPocket: '#0284c7',
      bagTrim: '#3b82f6',
      beltMain: '#0f172a',
      buckle: '#e2e8f0',
    },
    menor_aprendiz: {
      shirtBase: '#f8fafc',
      shirtShadow: '#cbd5e1',
      shirtHi: '#ffffff',
      sleeveMain: '#f8fafc',
      sleeveShadow: '#cbd5e1',
      pantsUpperRear: '#172554',
      pantsUpperRearDark: '#090d16',
      pantsLowerRear: '#1e3a8a',
      pantsLowerRearDark: '#0f172a',
      pantsUpperFront: '#1e3a8a',
      pantsUpperFrontDark: '#172554',
      pantsLowerFront: '#2563eb',
      pantsLowerFrontDark: '#1e3a8a',
      shoeBase: '#f8fafc',
      shoeAccent: '#dc2626',
      shoeSole: '#0f172a',
      tieMain: '#dc2626',
      tieDark: '#991b1b',
      hideChestTie: true,
      senaiTee: true,
      bagMain: '#1e3a8a',
      bagDark: '#090d16',
      bagPocket: '#dc2626',
      bagTrim: '#60a5fa',
      beltMain: '#0f172a',
      buckle: '#94a3b8',
    },
    estagiario_chefe: {
      shirtBase: '#1e293b',
      shirtShadow: '#0f172a',
      shirtHi: '#475569',
      sleeveMain: '#1e293b',
      sleeveShadow: '#0f172a',
      pantsUpperRear: '#0f172a',
      pantsUpperRearDark: '#020617',
      pantsLowerRear: '#1e293b',
      pantsLowerRearDark: '#090d16',
      pantsUpperFront: '#1e293b',
      pantsUpperFrontDark: '#0f172a',
      pantsLowerFront: '#334155',
      pantsLowerFrontDark: '#0f172a',
      shoeBase: '#18181b',
      shoeAccent: '#52525b',
      shoeSole: '#090d16',
      tieMain: '#b91c1c',
      tieDark: '#7f1d1d',
      suitLapels: true,
      bagMain: '#0f172a',
      bagDark: '#020617',
      bagPocket: '#334155',
      bagTrim: '#facc15',
      beltMain: '#090d16',
      buckle: '#facc15',
    },
    estagiario_ninja: {
      shirtBase: '#0f172a',
      shirtShadow: '#020617',
      shirtHi: '#334155',
      sleeveMain: '#0f172a',
      sleeveShadow: '#020617',
      pantsUpperRear: '#090d16',
      pantsUpperRearDark: '#020617',
      pantsLowerRear: '#1e293b',
      pantsLowerRearDark: '#090d16',
      pantsUpperFront: '#1e293b',
      pantsUpperFrontDark: '#090d16',
      pantsLowerFront: '#334155',
      pantsLowerFrontDark: '#0f172a',
      shoeBase: '#0f172a',
      shoeAccent: '#dc2626',
      shoeSole: '#020617',
      tieMain: '#dc2626',
      tieDark: '#7f1d1d',
      hideChestTie: true,
      ninjaHeadTie: true,
      bagMain: '#1e293b',
      bagDark: '#020617',
      bagPocket: '#dc2626',
      bagTrim: '#475569',
      beltMain: '#991b1b',
      buckle: '#ef4444',
    },
    golden_exec: {
      shirtBase: '#475569',
      shirtShadow: '#1e293b',
      shirtHi: '#94a3b8',
      sleeveMain: '#475569',
      sleeveShadow: '#1e293b',
      pantsUpperRear: '#1e293b',
      pantsUpperRearDark: '#0f172a',
      pantsLowerRear: '#334155',
      pantsLowerRearDark: '#1e293b',
      pantsUpperFront: '#334155',
      pantsUpperFrontDark: '#1e293b',
      pantsLowerFront: '#475569',
      pantsLowerFrontDark: '#1e293b',
      shoeBase: '#1c1917',
      shoeAccent: '#ca8a04',
      shoeSole: '#090d16',
      tieMain: '#facc15',
      tieDark: '#ca8a04',
      suitLapels: true,
      bagMain: '#78350f',
      bagDark: '#451a03',
      bagPocket: '#b45309',
      bagTrim: '#facc15',
      beltMain: '#1c1917',
      buckle: '#fde047',
    },
    night_brawler: {
      shirtBase: '#1e293b',
      shirtShadow: '#090d16',
      shirtHi: '#475569',
      sleeveMain: '#1e293b',
      sleeveShadow: '#090d16',
      pantsUpperRear: '#0f172a',
      pantsUpperRearDark: '#020617',
      pantsLowerRear: '#1e293b',
      pantsLowerRearDark: '#0f172a',
      pantsUpperFront: '#1e293b',
      pantsUpperFrontDark: '#090d16',
      pantsLowerFront: '#334155',
      pantsLowerFrontDark: '#1e293b',
      shoeBase: '#0f172a',
      shoeAccent: '#ef4444',
      shoeSole: '#020617',
      tieMain: '#ef4444',
      tieDark: '#7f1d1d',
      bagMain: '#0f172a',
      bagDark: '#020617',
      bagPocket: '#991b1b',
      bagTrim: '#ef4444',
      beltMain: '#090d16',
      buckle: '#cbd5e1',
    },
    cyber_rush: {
      shirtBase: '#0f172a',
      shirtShadow: '#020617',
      shirtHi: '#1e3a8a',
      sleeveMain: '#0f172a',
      sleeveShadow: '#020617',
      pantsUpperRear: '#082f49',
      pantsUpperRearDark: '#020617',
      pantsLowerRear: '#0e7490',
      pantsLowerRearDark: '#083344',
      pantsUpperFront: '#0e7490',
      pantsUpperFrontDark: '#082f49',
      pantsLowerFront: '#06b6d4',
      pantsLowerFrontDark: '#0e7490',
      shoeBase: '#0f172a',
      shoeAccent: '#22d3ee',
      shoeSole: '#020617',
      tieMain: '#06b6d4',
      tieDark: '#0e7490',
      bagMain: '#0e7490',
      bagDark: '#083344',
      bagPocket: '#22d3ee',
      bagTrim: '#67e8f9',
      beltMain: '#083344',
      buckle: '#22d3ee',
      visorColor: '#22d3ee',
    },
    motoboy_turbinado: {
      shirtBase: '#22c55e',
      shirtShadow: '#15803d',
      shirtHi: '#86efac',
      sleeveMain: '#0f172a',
      sleeveShadow: '#020617',
      pantsUpperRear: '#0f172a',
      pantsUpperRearDark: '#020617',
      pantsLowerRear: '#1e293b',
      pantsLowerRearDark: '#090d16',
      pantsUpperFront: '#1e293b',
      pantsUpperFrontDark: '#0f172a',
      pantsLowerFront: '#334155',
      pantsLowerFrontDark: '#1e293b',
      shoeBase: '#0f172a',
      shoeAccent: '#f97316',
      shoeSole: '#020617',
      tieMain: '#f97316',
      tieDark: '#c2410c',
      hideChestTie: true,
      motoboyGear: true,
      bagMain: '#ea580c',
      bagDark: '#9a3412',
      bagPocket: '#facc15',
      bagTrim: '#fde047',
      beltMain: '#090d16',
      buckle: '#22c55e',
      visorColor: '#facc15',
    },
  };
  const pal = skinPalette[skinStyle];

  const drawShoe = (sx: number, sy: number, angled = false) => {
    ctx.save();
    ctx.translate(px(sx), px(sy));
    if (angled) ctx.rotate(-0.2);
    pxRect(ctx, -4, -3, 9, 4, pal.shoeBase, '#090d16', 1.2);
    ctx.fillStyle = pal.shoeSole;
    ctx.fillRect(-3, 0, 7, 1.5);
    ctx.fillStyle = pal.shoeAccent;
    ctx.fillRect(-3, -2, 3, 2);
    ctx.restore();
  };

  // --- LEGS (16-bit skin-aware trousers/denim/suit/ninja pants) ---
  if (anim === 'kick') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, -9, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, -9, -10, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-10, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 13, hipY - 2, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 13, hipY - 2, 24, hipY - 4, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(25, hipY - 4, true);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, hipY - 3, 23, -0.35, 0.35);
    ctx.stroke();
  } else if (anim === 'jumpKick') {
    // Chute da Garça / Crane Kick (Karatê Kid)
    pxLimb(ctx, bodyDx - 2, hipY, -6, -7, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -6, -7, -8, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-8, -2);

    pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 8, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 15, hipY - 8, 26, hipY - 16, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(27, hipY - 16, true);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(4, hipY - 6, 28, -0.95, 0.15);
    ctx.stroke();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(4, hipY - 6, 24, -0.85, 0.08);
    ctx.stroke();
  } else if (anim === 'special') {
    if (isSpecialCoil) {
      pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 3, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -8, hipY + 3, -13, hipY + 7, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-13, hipY + 7);

      pxLimb(ctx, bodyDx + 2, hipY, 10, hipY - 8, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 10, hipY - 8, 4, hipY + 1, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(5, hipY + 1);

      const pulse = (Math.sin(auraClock * 14) + 1) * 0.5;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, -18, 24 + pulse * 5, 16 + pulse * 3, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, -18, 31 + pulse * 5, 21 + pulse * 3, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 2, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -8, hipY + 2, -12, hipY + 8, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-12, hipY + 8);

      pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 3, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 15, hipY - 3, 27, hipY - 5, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(28, hipY - 5, true);

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(4, hipY - 4, 29, -0.48, 0.38);
      ctx.stroke();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(4, hipY - 4, 24, -0.35, 0.25);
      ctx.stroke();
    }
  } else if (anim === 'kickFinisher') {
    pxLimb(ctx, bodyDx - 2, hipY, -7, -9, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -7, -9, -9, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-9, -2);

    pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 5, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 15, hipY - 5, 27, hipY - 9, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(28, hipY - 9, true);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(3, hipY - 5, 27, -0.75, 0.45);
    ctx.stroke();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(3, hipY - 5, 25, -0.65, 0.38);
    ctx.stroke();
  } else if (anim === 'railSlam') {
    pxLimb(ctx, bodyDx - 3, hipY, -9, hipY + 7, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, hipY + 7, -6, hipY + 13, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-5, hipY + 13);

    pxLimb(ctx, bodyDx + 2, hipY, 8, hipY + 6, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8, hipY + 6, 6, hipY + 12, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(7, hipY + 12);

    ctx.fillStyle = '#fde047';
    ctx.fillRect(-13, -44, 2, 18);
    ctx.fillRect(12, -40, 2, 16);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-9, -49, 2, 13);
    ctx.fillRect(8, -46, 2, 12);
  } else if (anim === 'punch1' || anim === 'punch2') {
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -12, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-12, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 8, -9, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8, -9, 8, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(9, -2);
  } else if (anim === 'walk') {
    const strideTable = [
      { bx: -7, by: -2, fx: 8, fy: -2 },
      { bx: -2, by: -2, fx: 2, fy: -4 },
      { bx: 8, by: -2, fx: -7, fy: -2 },
      { bx: 2, by: -4, fx: -2, fy: -2 },
    ];
    const st = strideTable[walkFrame];
    pxLimb(ctx, bodyDx - 1, hipY, st.bx * 0.6, -9, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, st.bx * 0.6, -9, st.bx, st.by, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(st.bx + 1, st.by);

    pxLimb(ctx, bodyDx + 1, hipY, st.fx * 0.6, -9, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, st.fx * 0.6, -9, st.fx, st.fy, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(st.fx + 1, st.fy);
  } else if (anim === 'hurt' || anim === 'knockdown') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, -8, 5.6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, -8, -9, -2, 5.2, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-9, -2);
    pxLimb(ctx, bodyDx + 2, hipY, 6, -8, 5.6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 6, -8, 7, -3, 5.2, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(8, -3);
  } else if (anim === 'bagGuard') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, -7, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, -7, -10, -2, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-10, -2);
    pxLimb(ctx, bodyDx + 2, hipY, 7, -7, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 7, -7, 8, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(9, -2);
  } else if (anim === 'railGrab') {
    const sw = Math.sin(animTimer * 12) * 3;
    pxLimb(ctx, -2, hipY, -6 + sw, -5, 5.5, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, 2, hipY, 5 + sw, -6, 5.5, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    drawShoe(-6 + sw, -5);
    drawShoe(5 + sw, -6);
  } else if (anim === 'railSpin' || anim === 'bagSpin' || anim === 'soundSpecial') {
    const spread = anim === 'railSpin' ? 17 : 13;
    pxLimb(ctx, -2, hipY, -spread, -9, 5.6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, 2, hipY, spread, -9, 5.6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    drawShoe(-spread - 1, -9);
    drawShoe(spread + 1, -9);
    ctx.strokeStyle = anim === 'soundSpecial' ? '#38bdf8' : '#38bdf8';
    ctx.lineWidth = anim === 'soundSpecial' ? 3.0 : 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -14, anim === 'soundSpecial' ? 38 : anim === 'bagSpin' ? 32 : 28, anim === 'soundSpecial' ? 12 : 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (anim === 'soundSpecial') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, -14, 24, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (anim === 'seatRest') {
    pxLimb(ctx, -2, hipY, -6, -2, 5.6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, 2, hipY, 7, -2, 5.6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    drawShoe(-6, -2);
    drawShoe(8, -2);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(px(-14), px(-18), 28, 12);
  } else if (anim === 'victory' || anim === 'thumbsUp') {
    pxLimb(ctx, bodyDx - 2, hipY, -7, -9, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -7, -9, -8, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-8, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 7, -9, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 7, -9, 8, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(9, -2);
  } else if (anim === 'fightStance') {
    const stanceBob = Math.sin(auraClock * 9.5) > 0 ? 1 : 0;
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -11, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 9, -9 + stanceBob, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 9, -9 + stanceBob, 10, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(11, -2);
  } else if (anim === 'cranePrep') {
    pxLimb(ctx, bodyDx - 2, hipY, -2, -9, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -2, -9, -2, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-1, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 10, hipY - 9, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 10, hipY - 9, 6, hipY + 2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(7, hipY + 2);
  } else if (anim === 'craneKick') {
    pxLimb(ctx, bodyDx - 2, hipY, -6, -7, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -6, -7, -8, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-8, -2);

    pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 8, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 15, hipY - 8, 26, hipY - 16, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(27, hipY - 16, true);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(4, hipY - 6, 28, -0.95, 0.15);
    ctx.stroke();
  } else if (anim === 'stunnerDrop') {
    pxLimb(ctx, bodyDx - 2, hipY, 6, -3, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, 6, -3, 14, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(15, -2);

    pxLimb(ctx, bodyDx + 1, hipY, 8, -2, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8, -2, 17, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(18, -2);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(2, -1, 22, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (anim === 'rkoCatch' || anim === 'rkoSlam') {
    const legLift = anim === 'rkoCatch' ? -10 : -4;
    pxLimb(ctx, bodyDx - 3, hipY, -12, hipY + legLift * 0.5, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -12, hipY + legLift * 0.5, -20, hipY + legLift, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-20, hipY + legLift);

    pxLimb(ctx, bodyDx - 1, hipY, -10, hipY + legLift * 0.3, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, -10, hipY + legLift * 0.3, -18, hipY + legLift * 0.6, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(-18, hipY + legLift * 0.6);

    if (anim === 'rkoSlam') {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(4, -1, 26, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (anim === 'trinityFreeze') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 3, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, hipY + 3, -13, hipY + 7, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-13, hipY + 7);

    pxLimb(ctx, bodyDx + 2, hipY, 10, hipY - 8, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 10, hipY - 8, 4, hipY + 1, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(5, hipY + 1);

    // Bullet-time emerald ripples
    const pulse = (Math.sin(auraClock * 12) + 1) * 0.5;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -18, 24 + pulse * 5, 16 + pulse * 3, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, -18, 32 + pulse * 6, 22 + pulse * 4, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  } else if (anim === 'trinityStrike') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 2, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, hipY + 2, -12, hipY + 8, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-12, hipY + 8);

    pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 3, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 15, hipY - 3, 27, hipY - 5, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(28, hipY - 5, true);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(4, hipY - 4, 28, -0.45, 0.35);
    ctx.stroke();
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(4, hipY - 4, 24, -0.35, 0.25);
    ctx.stroke();
  } else if (anim === 'matrixDodge') {
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -11, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 8, -8, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8, -8, 10, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(11, -2);

    // Bullet trail streaks whizzing above Neo's torso
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-22, -32);
    ctx.lineTo(24, -36);
    ctx.moveTo(-18, -42);
    ctx.lineTo(28, -44);
    ctx.stroke();
  } else if (anim === 'burlyFlurry') {
    pxLimb(ctx, bodyDx - 2, hipY, -10, -8, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -10, -8, -12, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-12, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 10, -9, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 10, -9, 12, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(13, -2);
  } else {
    pxLimb(ctx, bodyDx - 2, hipY, -6, -9, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -6, -9, -7, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-7, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 6, -9, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 6, -9, 7, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(8, -2);
  }

  // --- UPPER BODY GROUP WITH LEAN ---
  ctx.save();
  ctx.translate(px(bodyDx), px(hipY));
  ctx.rotate(leanAngle);
  ctx.translate(-px(bodyDx), -px(hipY));

  // Backpack behind back (when not held forward)
  if (!hasMakeupShield && anim !== 'bagGuard' && anim !== 'bagSpin') {
    pxBlockShaded(ctx, bodyDx - 12, torsoTopY + 1, 7, 14, pal.bagMain, pal.bagDark, pal.bagTrim);
    pxRect(ctx, bodyDx - 12, torsoTopY + 7, 5, 5, pal.bagPocket, '#090d16', 1);
  }

  // Rear guard arm (under torso)
  if (anim === 'fightStance') {
    const fBob = Math.sin(auraClock * 9.5) > 0 ? -1 : 1;
    pxLimb(ctx, bodyDx + 1, torsoTopY + 4, bodyDx + 6, torsoTopY + 5 + fBob, 4.5, pal.shirtShadow, '#334155');
    pxLimb(ctx, bodyDx + 6, torsoTopY + 5 + fBob, bodyDx + 7, torsoTopY - 2 + fBob, 4.2, '#e5a97c', '#b46e42');
    pxRect(ctx, bodyDx + 5, torsoTopY - 5 + fBob, 5, 5, '#e5a97c', '#090d16', 1.1);
  } else if (anim === 'jumpKick' || anim === 'cranePrep' || anim === 'craneKick' || anim === 'trinityFreeze' || isTrinityCoil) {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 3, bodyDx - 11, torsoTopY - 3, 4.4, pal.sleeveShadow, '#334155');
    pxLimb(ctx, bodyDx - 11, torsoTopY - 3, bodyDx - 15, torsoTopY - 9, 4.2, '#e5a97c', '#b46e42');
    pxRect(ctx, bodyDx - 18, torsoTopY - 12, 5, 5, '#e5a97c', '#090d16', 1.1);
  } else if (anim === 'stunnerDrop') {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 5, bodyDx - 9, torsoTopY + 12, 4.4, pal.sleeveShadow, '#334155');
    pxRect(ctx, bodyDx - 12, torsoTopY + 10, 5, 5, '#e5a97c', '#090d16', 1.1);
  } else if (anim === 'rkoCatch' || anim === 'rkoSlam') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 12, torsoTopY - 2, 4.5, pal.sleeveShadow, '#334155');
    pxRect(ctx, bodyDx + 11, torsoTopY - 4, 5, 5, '#e5a97c', '#090d16', 1.1);
  } else if (anim === 'idle' || anim === 'walk') {
    const rSwing = anim === 'walk' ? (walkFrame < 2 ? -2 : 2) : 0;
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 5 + rSwing, torsoTopY + 9, 4.5, pal.shirtShadow, '#334155');
    pxLimb(ctx, bodyDx - 5 + rSwing, torsoTopY + 9, bodyDx - 1 + rSwing, torsoTopY + 7, 4.2, '#e5a97c', '#b46e42');
    pxRect(ctx, bodyDx - 3 + rSwing, torsoTopY + 4, 5, 5, '#e5a97c', '#090d16', 1.1);
  }

  // Torso (Commuter shirt or customized shop outfit + belt + necktie)
  pxBlockShaded(ctx, bodyDx - 7, torsoTopY, 15, 16, pal.shirtBase, pal.shirtShadow, pal.shirtHi);
  if (pal.suitLapels) {
    // Crisp white inner dress shirt V beneath blazer + tailored lapels
    pxRect(ctx, bodyDx, torsoTopY + 1, 5, 9, '#f8fafc');
    ctx.fillStyle = pal.shirtShadow;
    ctx.fillRect(bodyDx - 1, torsoTopY + 1, 1, 7);
    ctx.fillRect(bodyDx + 5, torsoTopY + 1, 1, 7);
    if (skinStyle === 'estagiario_chefe') {
      // Gold executive lapel pin
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bodyDx - 2, torsoTopY + 4, 2, 2);
    }
  } else if (pal.senaiTee) {
    // Menor Aprendiz SENAI white tee: crewneck collar, red chest logo & sleeve flag badge
    pxRect(ctx, bodyDx - 2, torsoTopY, 7, 2, '#cbd5e1');
    pxRect(ctx, bodyDx - 1, torsoTopY, 5, 1, '#f8fafc');
    // Red rectangular SENAI chest emblem
    pxRect(ctx, bodyDx + 1, torsoTopY + 4, 6, 3, '#dc2626', '#991b1b', 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bodyDx + 2, torsoTopY + 5, 4, 1);
    // Tiny rear SENAI shoulder badge
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bodyDx - 6, torsoTopY + 3, 3, 2);
    // Brazil flag patch on upper sleeve
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(bodyDx + 3, torsoTopY + 2, 4, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(bodyDx + 4, torsoTopY + 3, 2, 1);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(bodyDx + 5, torsoTopY + 3, 1, 1);
  } else if (pal.ninjaHeadTie) {
    // Diagonal crimson shinobi sash
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 6, torsoTopY + 1);
    ctx.lineTo(bodyDx - 6, hipY - 2);
    ctx.stroke();
  } else if (pal.motoboyGear) {
    // High-vis diagonal chest reflector stripes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bodyDx - 7, torsoTopY + 4, 15, 3);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bodyDx - 6, torsoTopY + 5, 13, 1.5);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bodyDx - 5, torsoTopY + 9, 11, 1.5);
  }

  // Belt & buckle
  pxRect(ctx, bodyDx - 7, hipY - 2, 15, 3, pal.beltMain);
  pxRect(ctx, bodyDx + 1, hipY - 2, 3, 3, pal.buckle);

  // Backpack diagonal strap across chest (subtle or hidden when ninja/suit)
  if (!pal.ninjaHeadTie) {
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 5, torsoTopY + 1);
    ctx.lineTo(bodyDx - 1, hipY - 2);
    ctx.stroke();
    ctx.strokeStyle = pal.bagMain;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Necktie (Gravata on chest — moved to forehead when Ninja skin is active!)
  const tieShift = anim === 'hurt' ? -2 : anim === 'walk' ? (walkFrame % 2 === 0 ? -1 : 1) : 0;
  if (!pal.hideChestTie) {
    pxRect(ctx, bodyDx + 1, torsoTopY + 1, 3, 3, pal.tieDark, '#090d16', 0.9);
    pxRect(ctx, bodyDx + 1 + tieShift, torsoTopY + 4, 3, 8, pal.tieMain, '#090d16', 0.9);
    pxRect(ctx, bodyDx + 2 + tieShift, torsoTopY + 11, 2, 2, pal.tieDark);
  }

  // --- HEAD (16-bit proportional head + slicked-back "topete lambido" hair) ---
  const skin = hasRageBuff ? '#fca5a5' : '#f1b586';
  const skinShadow = hasRageBuff ? '#dc2626' : '#c68353';
  pxBlockShaded(ctx, bodyDx - 5, headY, 11, 11, skin, skinShadow, undefined);

  // Lower ninja face mask when Estagiário Ninja is equipped
  if (pal.ninjaHeadTie) {
    pxRect(ctx, bodyDx - 5, headY + 6, 11, 5, '#1e293b', '#090d16', 1.0);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bodyDx - 4, headY + 8, 9, 2);
  }

  // Sleek slicked-back "topete lambido" pompadour swept neatly back!
  const pompadourLift = hasRageBuff ? 2 : 0;
  ctx.fillStyle = '#0f1326';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bodyDx - 6, headY + 5);
  ctx.lineTo(bodyDx - 7, headY + 1);
  ctx.lineTo(bodyDx - 5, headY - 2);
  ctx.lineTo(bodyDx + 1, headY - (4 + pompadourLift));
  ctx.lineTo(bodyDx + 7, headY - (5 + pompadourLift));
  ctx.lineTo(bodyDx + 8, headY - (2 + pompadourLift));
  ctx.lineTo(bodyDx + 5, headY + 2);
  ctx.lineTo(bodyDx - 2, headY + 2);
  ctx.lineTo(bodyDx - 4, headY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Slicked-back comb gloss shine along topete curve
  ctx.fillStyle = '#475569';
  ctx.fillRect(bodyDx - 3, headY - 2 - pompadourLift, 8, 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(bodyDx + 1, headY - 3 - pompadourLift, 4, 1);

  // Tie wrapped around forehead as Ninja Headband ("gravata na cabeça"!)
  if (pal.ninjaHeadTie) {
    const flutter = Math.sin(auraClock * 9) * 1.8;
    // Fluttering tie tails streaming from back knot
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 6, headY + 1);
    ctx.lineTo(bodyDx - 14, headY - 1 + flutter);
    ctx.lineTo(bodyDx - 16, headY + 1 + flutter);
    ctx.lineTo(bodyDx - 13, headY + 3 + flutter);
    ctx.lineTo(bodyDx - 6, headY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(bodyDx - 6, headY + 2);
    ctx.lineTo(bodyDx - 13, headY + 4 - flutter * 0.7);
    ctx.lineTo(bodyDx - 15, headY + 6 - flutter * 0.7);
    ctx.lineTo(bodyDx - 11, headY + 6 - flutter * 0.7);
    ctx.lineTo(bodyDx - 6, headY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forehead crimson tie band + diagonal white stripe + back knot
    pxRect(ctx, bodyDx - 6, headY + 1, 12, 2.5, '#dc2626', '#090d16', 0.9);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bodyDx + 1, headY + 1.5, 2, 1.5);
    pxRect(ctx, bodyDx - 8, headY + 1, 3, 3, '#991b1b', '#090d16', 0.9);
  }

  // Sharp pixel eye + brow (or Neon Cyber Visor / Happy Thumbs-Up Smile)
  if (pal.visorColor && anim !== 'hurt') {
    pxRect(ctx, bodyDx, headY + 3, 7, 3, pal.visorColor, '#090d16', 0.9);
    ctx.fillStyle = '#ecfeff';
    ctx.fillRect(bodyDx + 2, headY + 4, 3, 1);
  } else if (anim === 'thumbsUp') {
    // Confident arcade grin & bright sparkle eye while giving thumbs-up!
    pxRect(ctx, bodyDx + 2, headY + 4, 3, 2, '#ffffff');
    pxRect(ctx, bodyDx + 4, headY + 4, 1.5, 2, '#090d16');
    pxRect(ctx, bodyDx + 1, headY + 2, 5, 1, '#090d16');
    if (!pal.ninjaHeadTie) {
      pxRect(ctx, bodyDx + 1, headY + 7, 4, 2, '#ffffff', '#090d16', 0.7);
    }
  } else if (hasRageBuff) {
    pxRect(ctx, bodyDx + 2, headY + 4, 3, 2, '#ffffff');
    pxRect(ctx, bodyDx + 4, headY + 4, 1, 2, '#dc2626');
    pxRect(ctx, bodyDx + 1, headY + 2, 5, 1.5, '#090d16');
    if (!pal.ninjaHeadTie) {
      pxRect(ctx, bodyDx + 1, headY + 8, 4, 2, '#ffffff', '#090d16', 0.8);
    }
  } else if (anim === 'hurt') {
    pxRect(ctx, bodyDx + 1, headY + 4, 4, 1.5, '#090d16');
    if (!pal.ninjaHeadTie) {
      pxRect(ctx, bodyDx + 2, headY + 7, 3, 2, '#991b1b');
    }
  } else {
    pxRect(ctx, bodyDx + 2, headY + 4, 3, 2, '#ffffff');
    pxRect(ctx, bodyDx + 4, headY + 4, 1.5, 2, '#090d16');
    pxRect(ctx, bodyDx + 1, headY + 3, 5, 1, '#090d16');
  }

  // --- FRONT BACKPACK SHIELD (bagGuard or makeup shield) ---
  if (hasMakeupShield || anim === 'bagGuard') {
    const bagX = anim === 'bagGuard' ? bodyDx + 4 : bodyDx + 3;
    const bagY = anim === 'bagGuard' ? torsoTopY - 2 : torsoTopY + 1;
    pxBlockShaded(ctx, bagX, bagY, 10, 17, '#1d4ed8', '#0f172a', '#3b82f6');
    pxRect(ctx, bagX + 2, bagY + 5, 7, 8, '#38bdf8', '#090d16', 1.1);
    pxRect(ctx, bagX + 3, bagY + 2, 5, 1.5, '#facc15');

    if (anim === 'bagGuard') {
      // Unmistakable glowing pixel guard shield bracket!
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(bagX + 11, bagY - 3);
      ctx.lineTo(bagX + 15, bagY + 1);
      ctx.lineTo(bagX + 15, bagY + 16);
      ctx.lineTo(bagX + 11, bagY + 20);
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bagX + 17, bagY + 3);
      ctx.lineTo(bagX + 17, bagY + 14);
      ctx.stroke();
    }
  }

  // --- LEAD ARM & ATTACK ANIMATIONS ---
  if (anim === 'punch1' || anim === 'punch2') {
    const reach = anim === 'punch2' ? 24 : 21;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 9, torsoTopY + 4, 5, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 9, torsoTopY + 4, bodyDx + reach, torsoTopY + 4, 4.5, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + reach - 1, torsoTopY + 1, 6, 6, '#f1b586', '#090d16', 1.2);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bodyDx + 10, torsoTopY + 1, 10, 1.5);
  } else if (anim === 'punch3') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 5, bodyDx + 10, torsoTopY - 2, 5, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 10, torsoTopY - 2, bodyDx + 14, torsoTopY - 12, 4.5, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 11, torsoTopY - 16, 6, 6, '#f1b586', '#090d16', 1.2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bodyDx + 4, torsoTopY, 15, -1.2, 0.2);
    ctx.stroke();
  } else if (anim === 'cane') {
    const swingProgress = Math.max(0, Math.min(1, 1 - animTimer / 0.26));
    const ease = swingProgress < 0.65 ? 1 - Math.pow(1 - swingProgress / 0.65, 3) : 1;
    const pivotX = bodyDx + 3;
    const pivotY = torsoTopY + 3;
    const startAngle = -1.72;
    const endAngle = 0.36;
    const swingAngle = startAngle + (endAngle - startAngle) * ease;

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 26, startAngle, swingAngle);
    ctx.stroke();

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(swingAngle);
    pxLimb(ctx, 0, 0, 10, 0, 4.5, '#f1b586', '#c68353');
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(29, 0);
    ctx.arc(29, -3, 3, Math.PI * 0.5, Math.PI * 1.8, true);
    ctx.stroke();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(29, 0);
    ctx.arc(29, -3, 3, Math.PI * 0.5, Math.PI * 1.8, true);
    ctx.stroke();
    ctx.restore();

    if (swingProgress >= 0.52) {
      drawImpactFlash(
        ctx,
        pivotX + Math.cos(endAngle) * 30,
        pivotY + Math.sin(endAngle) * 30,
        (swingProgress - 0.52) / 0.48,
        false
      );
    }
  } else if (anim === 'headphoneWhip') {
    const prog = Math.max(0, Math.min(1, 1 - animTimer / 0.38));
    const extend = prog < 0.32 ? prog / 0.32 : prog < 0.72 ? 1 : Math.max(0.15, 1 - (prog - 0.72) / 0.28);
    const whipLen = Math.round(138 * extend);
    const handX = bodyDx + 10;
    const handY = torsoTopY + 4;

    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, handX, handY, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, handX - 1, handY - 2, 5, 5, '#f1b586', '#090d16', 1.1);

    const tipX = handX + whipLen;
    const tipY = handY - Math.sin(prog * Math.PI) * 5;
    const segs = 14;

    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(handX + 3, handY);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const wx = handX + 3 + (tipX - handX - 3) * t;
      const amp = Math.sin(t * Math.PI) * (1 - prog * 0.45) * 9;
      const wy = handY + Math.sin(t * Math.PI * 2.5 - prog * 14) * amp;
      ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    ctx.strokeStyle = prog < 0.5 ? '#ef4444' : '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(px(tipX), px(tipY));
    ctx.rotate(Math.sin(prog * 18) * 0.35);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, -Math.PI * 0.85, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    pxRect(ctx, -4, -9, 6, 5, '#ef4444', '#090d16', 1.1);
    pxRect(ctx, -4, 4, 6, 5, '#ef4444', '#090d16', 1.1);
    ctx.restore();

    if (prog > 0.18 && prog < 0.85) {
      drawImpactFlash(ctx, tipX + 5, tipY, (prog - 0.18) / 0.67, true);
      const noteOffsets = [0.35, 0.62, 0.86];
      noteOffsets.forEach((nt, idx) => {
        const nx = px(handX + whipLen * nt);
        const ny = px(handY - 12 - idx * 5 - Math.sin(prog * Math.PI) * 8);
        const col = idx % 2 === 0 ? '#fde047' : '#38bdf8';
        ctx.fillStyle = '#090d16';
        ctx.fillRect(nx - 1, ny - 6, 7, 8);
        ctx.fillStyle = col;
        ctx.fillRect(nx, ny - 5, 2, 5);
        ctx.fillRect(nx + 2, ny - 5, 3, 2);
        ctx.fillRect(nx - 2, ny - 1, 4, 3);
      });
    }
  } else if (anim === 'spray') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 10, torsoTopY + 3, 4.5, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 10, torsoTopY - 2, 5, 8, '#06b6d4', '#090d16', 1.1);
    pxRect(ctx, bodyDx + 11, torsoTopY - 4, 3, 2, '#f8fafc', '#090d16', 0.9);
  } else if (anim === 'railGrab' || anim === 'railSpin') {
    const railLocalY = Math.min(headY - 16, 75 - (y - z));
    pxRect(ctx, -4, railLocalY - 2, 8, 4, '#0f172a');
    pxRect(ctx, -1, railLocalY + 2, 2, headY - 12 - railLocalY, '#334155');
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-5, headY - 6);
    ctx.lineTo(0, headY - 12);
    ctx.lineTo(5, headY - 6);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.stroke();

    pxLimb(ctx, -3, torsoTopY + 2, -4, headY - 6, 4.4, pal.sleeveShadow, '#475569');
    pxLimb(ctx, 4, torsoTopY + 2, 4, headY - 6, 4.4, '#f1b586', '#c68353');
  } else if (anim === 'bagGuard') {
    pxLimb(ctx, bodyDx + 1, torsoTopY + 5, bodyDx + 7, torsoTopY + 7, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, bodyDx + 6, torsoTopY + 5, 4, 4, '#f1b586', '#090d16', 1);
  } else if (anim === 'bagSpin') {
    const spinAng = auraClock * 28;
    const bagX = Math.cos(spinAng) * 23;
    const bagY = torsoTopY + 4 + Math.sin(spinAng) * 5;
    pxLimb(ctx, 0, torsoTopY + 4, bagX * 0.72, bagY, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxBlockShaded(ctx, bagX - 5, bagY - 7, 10, 14, pal.bagMain, pal.bagDark, pal.bagTrim);
    pxRect(ctx, bagX - 3, bagY - 3, 6, 6, pal.bagPocket, '#090d16', 1);
  } else if (anim === 'soundSpecial') {
    pxLimb(ctx, -13, torsoTopY + 4, 13, torsoTopY + 4, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, -16, torsoTopY + 2, 5, 5, '#f1b586', '#090d16', 1);
    pxRect(ctx, 11, torsoTopY + 2, 5, 5, '#f1b586', '#090d16', 1);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, torsoTopY + 2, 26, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, torsoTopY + 2, 26, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();
  } else if (anim === 'special') {
    if (isSpecialCoil) {
      pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + 11, torsoTopY - 3, 4.5, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 11, torsoTopY - 3, bodyDx + 15, torsoTopY - 9, 4.3, '#f1b586', '#c68353');
      pxRect(ctx, bodyDx + 13, torsoTopY - 12, 5, 5, '#f1b586', '#090d16', 1.1);
    } else {
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 12, torsoTopY + 1, 4.5, pal.sleeveMain, pal.sleeveShadow);
      pxRect(ctx, bodyDx - 15, torsoTopY - 1, 4.5, 4.5, '#f1b586', '#090d16', 1);
      pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY + 8, 4.5, '#f1b586', '#c68353');
      pxRect(ctx, bodyDx + 9, torsoTopY + 6, 5, 5, '#f1b586', '#090d16', 1.1);
    }
  } else if (anim === 'hurt') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 10, torsoTopY + 1, 4.4, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 11, torsoTopY - 1, 4.4, '#f1b586', '#c68353');
  } else if (anim === 'kick') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 9, torsoTopY + 8, 4.4, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 7, torsoTopY + 1, 4.4, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 6, torsoTopY - 1, 4, 4, '#f1b586', '#090d16', 1);
  } else if (anim === 'kickFinisher') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 12, torsoTopY + 2, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, bodyDx - 14, torsoTopY, 4, 4, '#f1b586', '#090d16', 1);
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 9, torsoTopY + 9, 4.5, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 8, torsoTopY + 7, 5, 5, '#f1b586', '#090d16', 1.1);
  } else if (anim === 'railSlam') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 5, bodyDx + 3, torsoTopY + 14, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 3, torsoTopY + 5, bodyDx + 7, torsoTopY + 15, 4.8, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 1, torsoTopY + 13, 8, 6, '#f1b586', '#090d16', 1.2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(bodyDx + 5, torsoTopY + 18, 9, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else if (anim === 'thumbsUp') {
    // Left arm confident on hip
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 8, torsoTopY + 10, 4.5, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx - 8, torsoTopY + 10, bodyDx - 5, hipY - 1, 4.2, '#e5a97c', '#b46e42');

    // Right arm bent forward giving big 16-bit "JÓIA!" thumbs-up
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 11, torsoTopY + 4, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 11, torsoTopY + 4, bodyDx + 15, torsoTopY - 2, 4.6, '#f1b586', '#c68353');
    // Fist + unmistakable upward thumb!
    pxRect(ctx, bodyDx + 13, torsoTopY - 6, 7, 7, '#f1b586', '#090d16', 1.2);
    pxRect(ctx, bodyDx + 14, torsoTopY - 12, 3.5, 6.5, '#f1b586', '#090d16', 1.1);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bodyDx + 15, torsoTopY - 11, 1.5, 2);

    // Golden arcade sparkle glint right beside the thumb
    const gx = px(bodyDx + 16);
    const gy = px(torsoTopY - 17);
    const gs = Math.floor(auraClock * 8) % 2 === 0 ? 5 : 3;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(gx - 1, gy - gs, 2, gs * 2);
    ctx.fillRect(gx - gs, gy - 1, gs * 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 1, gy - 1, 2, 2);
  } else if (anim === 'victory') {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 8, torsoTopY + 11, 4.5, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx - 8, torsoTopY + 11, bodyDx - 5, hipY - 1, 4.2, '#e5a97c', '#b46e42');

    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 9, torsoTopY - 6, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 9, torsoTopY - 6, bodyDx + 10, headY - 11, 4.4, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 7, headY - 16, 6, 6, '#f1b586', '#090d16', 1.1);

    const glintX = px(bodyDx + 10);
    const glintY = px(headY - 22);
    const glintSize = Math.floor(auraClock * 6) % 2 === 0 ? 5 : 3;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(glintX - 1, glintY - glintSize, 2, glintSize * 2);
    ctx.fillRect(glintX - glintSize, glintY - 1, glintSize * 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(glintX - 1, glintY - 1, 2, 2);
  } else if (anim === 'fightStance') {
    const fBob = Math.sin(auraClock * 9.5) > 0 ? 1 : -1;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 7, torsoTopY + 6 + fBob, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 7, torsoTopY + 6 + fBob, bodyDx + 13, torsoTopY + 1 + fBob, 4.3, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 11, torsoTopY - 2 + fBob, 5.5, 5.5, '#f1b586', '#090d16', 1.15);
  } else if (anim === 'jumpKick' || anim === 'cranePrep' || anim === 'craneKick' || anim === 'trinityFreeze') {
    pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + 11, torsoTopY - 3, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 11, torsoTopY - 3, bodyDx + 15, torsoTopY - 9, 4.3, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 13, torsoTopY - 12, 5, 5, '#f1b586', '#090d16', 1.1);
  } else if (anim === 'stunnerDrop') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 8, torsoTopY - 2, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 8, torsoTopY - 2, bodyDx + 12, headY + 3, 4.4, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 9, headY, 5.5, 5.5, '#f1b586', '#090d16', 1.1);
  } else if (anim === 'rkoCatch' || anim === 'rkoSlam') {
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 14, torsoTopY + 3, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, bodyDx + 13, torsoTopY + 1, 6, 5.5, '#f1b586', '#090d16', 1.15);
  } else if (anim === 'trinityStrike') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 12, torsoTopY + 1, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, bodyDx - 15, torsoTopY - 1, 4.5, 4.5, '#f1b586', '#090d16', 1);
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY + 8, 4.5, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 9, torsoTopY + 6, 5, 5, '#f1b586', '#090d16', 1.1);
  } else if (anim === 'matrixDodge') {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 13, torsoTopY - 2, 4.4, pal.sleeveShadow, '#334155');
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 12, torsoTopY - 4, 4.4, '#f1b586', '#c68353');
  } else if (anim === 'burlyFlurry') {
    const f1 = Math.sin(auraClock * 42) * 5;
    const f2 = Math.cos(auraClock * 42) * 5;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 18 + f1, torsoTopY + 1, 4.4, pal.sleeveMain, pal.sleeveShadow);
    pxRect(ctx, bodyDx + 17 + f1, torsoTopY - 1, 5, 5, '#f1b586', '#090d16', 1.1);
    pxLimb(ctx, bodyDx + 2, torsoTopY + 6, bodyDx + 16 - f2, torsoTopY + 7, 4.2, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 15 - f2, torsoTopY + 5, 5, 5, '#22c55e', '#090d16', 1);
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 16 + f2, torsoTopY + 3, 4.2, pal.sleeveShadow, '#334155');
    pxRect(ctx, bodyDx - 19 + f2, torsoTopY + 1, 5, 5, '#fde047', '#090d16', 1);
  } else {
    const swing = anim === 'walk' ? (walkFrame < 2 ? 2 : -2) : 0;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 5 + swing, torsoTopY + 9, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 5 + swing, torsoTopY + 9, bodyDx + 9 + swing, torsoTopY + 6, 4.3, '#f1b586', '#c68353');
    pxRect(ctx, bodyDx + 8 + swing, torsoTopY + 3, 5, 5, '#f1b586', '#090d16', 1.1);

    if (hasCane) {
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(bodyDx + 9 + swing, torsoTopY + 6);
      ctx.lineTo(bodyDx + 19 + swing, torsoTopY - 4);
      ctx.arc(bodyDx + 20 + swing, torsoTopY - 2, 2.5, -Math.PI * 0.75, Math.PI * 0.35, false);
      ctx.stroke();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  }

  if (hitFlash) {
    ctx.fillStyle = 'rgba(254, 249, 195, 0.52)';
    ctx.fillRect(px(bodyDx - 8), px(headY - 4), 17, 30);
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// PLAYER COMBO & NEW-MOVE HINTS
// ============================================================================

function drawKeyCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  active: boolean
) {
  const w = label.length > 2 ? 22 : 12;
  fillStrokeRoundRect(
    ctx,
    x,
    y,
    w,
    11,
    2,
    active ? '#facc15' : '#1e293b',
    '#090d16',
    1.2
  );
  ctx.fillStyle = active ? '#090d16' : '#f8fafc';
  ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + 5.8);
  return w;
}

function drawAnimatedArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 'right' | 'up',
  time: number,
  color = '#38bdf8'
) {
  const pulse = ((time * 4) % 1) * 2.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  if (dir === 'right') {
    const ax = x + pulse;
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + 4.5, y);
    ctx.moveTo(ax + 2.3, y - 2.3);
    ctx.lineTo(ax + 5, y);
    ctx.lineTo(ax + 2.3, y + 2.3);
    ctx.stroke();
  } else {
    const ay = y - pulse;
    ctx.beginPath();
    ctx.moveTo(x, ay + 3);
    ctx.lineTo(x, ay - 2.5);
    ctx.moveTo(x - 2.3, ay);
    ctx.lineTo(x, ay - 3);
    ctx.lineTo(x + 2.3, ay);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPlayerComboHints(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  comboStep: 0 | 1 | 2,
  comboActive: boolean,
  airborne: boolean,
  hasShieldedEnemyNear: boolean,
  hasCane: boolean,
  time: number,
  isRailGrabbing = false,
  isBagGuarding = false,
  showGenericHints = true,
  hasHeadphoneWhipReady = false,
  hasPowerBuff = false
) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  const anchorY = Math.max(40, y - z - 56);

  if (hasHeadphoneWhipReady) {
    const boxW = 78;
    const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
    fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.94)', '#ef4444', 1.4);
    drawAnimatedArrow(ctx, bx + 6, anchorY + 8.5, 'right', time, '#fde047');
    drawKeyCap(ctx, bx + 15, anchorY + 3, 'J', true);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('FONE x7!', bx + 31, anchorY + 8.8);
    ctx.restore();
    return;
  }

  if (isBagGuarding) {
    const boxW = 70;
    const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
    fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.92)', '#38bdf8', 1.4);
    drawAnimatedArrow(ctx, bx + 6, anchorY + 8.5, 'right', time, '#38bdf8');
    drawKeyCap(ctx, bx + 15, anchorY + 3, 'J', true);
    drawKeyCap(ctx, bx + 29, anchorY + 3, 'K', true);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('GIRO', bx + 45, anchorY + 8.8);
    ctx.restore();
    return;
  }

  if (isRailGrabbing) {
    if (hasPowerBuff) {
      const boxW = 104;
      const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
      fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.94)', '#f97316', 1.5);
      drawKeyCap(ctx, bx + 4, anchorY + 3, 'J', false);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('GIRO', bx + 18, anchorY + 8.8);
      drawKeyCap(ctx, bx + 41, anchorY + 3, 'K', true);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 5.5px sans-serif';
      ctx.fillText('QUEDA!', bx + 56, anchorY + 8.8);
      ctx.restore();
      return;
    }
    const boxW = 70;
    const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
    fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.9)', '#facc15', 1.4);
    drawAnimatedArrow(ctx, bx + 6, anchorY + 8.5, 'right', time, '#facc15');
    drawKeyCap(ctx, bx + 15, anchorY + 3, 'J', true);
    drawKeyCap(ctx, bx + 29, anchorY + 3, 'K', true);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('GIRO', bx + 45, anchorY + 8.8);
    ctx.restore();
    return;
  }

  if (airborne && showGenericHints) {
    const boxW = 76;
    const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
    fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.86)', '#38bdf8', 1.2);
    drawAnimatedArrow(ctx, bx + 6, anchorY + 9, 'up', time, '#facc15');
    drawKeyCap(ctx, bx + 14, anchorY + 3, 'K', true);
    drawAnimatedArrow(ctx, bx + 31, anchorY + 9, 'up', time, '#38bdf8');
    drawKeyCap(ctx, bx + 39, anchorY + 3, 'ESP', false);
    ctx.restore();
    return;
  }

  if (hasCane) {
    const boxW = 54;
    const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
    fillStrokeRoundRect(ctx, bx, anchorY, boxW, 17, 3, 'rgba(9, 13, 22, 0.84)', '#facc15', 1.2);
    drawAnimatedArrow(ctx, bx + 6, anchorY + 8.5, 'right', time, '#facc15');
    drawKeyCap(ctx, bx + 15, anchorY + 3, 'J', true);
    drawAnimatedArrow(ctx, bx + 30, anchorY + 8.5, 'right', time, '#fb923c');
    drawKeyCap(ctx, bx + 38, anchorY + 3, 'K', false);
    ctx.restore();
    return;
  }

  if (!showGenericHints && !hasShieldedEnemyNear) {
    ctx.restore();
    return;
  }

  const nextIdx = comboActive ? (comboStep + 1) % 3 : 0;
  const boxW = hasShieldedEnemyNear ? 84 : 74;
  const bx = Math.max(6, Math.min(480 - boxW - 6, x - boxW / 2));
  fillStrokeRoundRect(
    ctx,
    bx,
    anchorY,
    boxW,
    17,
    3,
    'rgba(9, 13, 22, 0.82)',
    comboActive ? '#facc15' : '#475569',
    1.2
  );

  let cx = bx + 4;
  if (hasShieldedEnemyNear) {
    drawAnimatedArrow(ctx, cx + 1, anchorY + 8.5, 'right', time, '#f97316');
    cx += 9;
    cx += drawKeyCap(ctx, cx, anchorY + 3, 'K', true) + 3;
    drawAnimatedArrow(ctx, cx + 3, anchorY + 9.5, 'up', time, '#38bdf8');
    cx += 8;
    drawKeyCap(ctx, cx, anchorY + 3, 'ESP', false);
  } else {
    cx += drawKeyCap(ctx, cx, anchorY + 3, 'J', nextIdx === 0) + 2;
    drawAnimatedArrow(ctx, cx, anchorY + 8.5, 'right', time, nextIdx === 1 ? '#facc15' : '#64748b');
    cx += 8;
    cx += drawKeyCap(ctx, cx, anchorY + 3, 'J', nextIdx === 1) + 2;
    drawAnimatedArrow(ctx, cx, anchorY + 8.5, 'right', time, nextIdx === 2 ? '#facc15' : '#64748b');
    cx += 8;
    cx += drawKeyCap(ctx, cx, anchorY + 3, 'J', nextIdx === 2) + 3;
    drawKeyCap(ctx, cx, anchorY + 3, 'K', comboActive);
  }

  ctx.restore();
}

// ============================================================================
// ENEMY SPRITES (16-BIT ARCADE PROPORTIONS + STRONG HURT RECOIL)
// ============================================================================

export function drawVectorEnemy(
  ctx: CanvasRenderingContext2D,
  type: EnemyType,
  x: number,
  y: number,
  z: number,
  facing: 1 | -1,
  aiState: string,
  walkPhase: number,
  hasFrontBarrier: boolean,
  stinkActive: boolean,
  hitFlash: boolean,
  time: number
) {
  ctx.save();

  const isLargeBoss = type === 'boss_cobrador_blindado' || type === 'boss_cobrador';
  const shadowW = isLargeBoss ? 32 : 24;
  ctx.fillStyle = 'rgba(5, 8, 18, 0.54)';
  ctx.fillRect(px(x - shadowW / 2), px(y - 2), shadowW, 5);

  // Stink aura for Industry Worker (minimal clean 16-bit dots)
  if (type === 'industria' && stinkActive) {
    ctx.save();
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px(x - 28), px(y - 10), 56, 16);
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const ang = time * 2.4 + i * 1.57;
      const sx = px(x + Math.cos(ang) * 20);
      const sy = px(y - 22 + Math.sin(ang) * 8);
      pxRect(ctx, sx - 2, sy - 2, 5, 5, '#a3e635', '#365314', 1);
    }
    ctx.restore();
  }

  const isAboutToAttack =
    aiState === 'windup' || aiState === 'spinWindup' || aiState === 'skateWindup';
  const warnPulse = isAboutToAttack ? 0.42 + Math.sin(time * 20) * 0.16 : 0;

  if (isAboutToAttack) {
    ctx.strokeStyle = `rgba(251, 113, 133, ${(warnPulse * 0.85).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(px(x), px(y), shadowW * 0.56, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(px(x), px(y - z));

  const isKnockdown = aiState === 'knockdown';
  const isSpinning = aiState === 'spinAttack';
  const isHurt = aiState === 'hurt';
  if (!isSpinning) {
    ctx.scale(facing, 1);
  }
  if (isKnockdown && Math.floor(time * 20) % 2 === 0) {
    ctx.globalAlpha = 0.65;
  }

  const strideFrame =
    aiState === 'approach' ? ((Math.floor(walkPhase * 8) % 4) + 4) % 4 : 0;
  const strideMap = [-5, 0, 5, 0];
  const walkSwing = strideMap[strideFrame];
  const bob = aiState === 'approach' && strideFrame % 2 === 1 ? -1 : 0;

  // Strong leaned-back hurt reaction ("reação mais inclinada")!
  const windupTilt = aiState === 'windup' || aiState === 'spinWindup' ? -0.1 : 0;
  if (isKnockdown) {
    ctx.translate(0, -8);
    ctx.rotate(z > 4 ? -0.45 - Math.sin(walkPhase * 2) * 0.35 : -1.42);
    ctx.translate(0, 8);
  } else if (isHurt) {
    ctx.translate(-3, 0);
    ctx.rotate(-0.28);
  } else {
    ctx.rotate(windupTilt);
  }

  // Subtle glowing silhouette outline when enemy is about to attack
  if (isAboutToAttack) {
    const outW = isLargeBoss ? 26 : 19;
    const outH = isLargeBoss ? 54 : 46;
    const outX = -Math.round(outW / 2);
    const outY = -outH + bob;
    ctx.save();
    ctx.strokeStyle = `rgba(251, 113, 133, ${(warnPulse * 0.65).toFixed(2)})`;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(outX - 1.5, outY - 1.5, outW + 3, outH + 2, 7);
    ctx.stroke();
    ctx.strokeStyle = `rgba(254, 240, 138, ${(warnPulse * 0.9).toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(outX, outY, outW, outH - 1, 6);
    ctx.stroke();
    ctx.restore();
  }

  const drawShoe = (sx: number, sy: number, col = '#0f172a') => {
    pxRect(ctx, sx - 4, sy - 3, 8, 4, col, '#090d16', 1.1);
  };

  switch (type) {
    case 'idosa': {
      const by = -42 + bob;
      pxLimb(ctx, -2, -14, -4 + walkSwing, -2, 4.5, '#d99b6c', '#b46e42');
      pxLimb(ctx, 2, -14, 4 - walkSwing, -2, 4.5, '#f1b586', '#c68353');
      drawShoe(-4 + walkSwing, -2, '#78350f');
      drawShoe(4 - walkSwing, -2, '#78350f');

      // Floral purple dress
      pxBlockShaded(ctx, -7, by + 11, 15, 18, '#a855f7', '#6b21a8', '#c084fc');
      pxRect(ctx, -3, by + 16, 3, 3, '#f472b6');
      pxRect(ctx, 2, by + 22, 3, 3, '#fde047');

      // Head + bun + glasses
      pxRect(ctx, -9, by + 1, 5, 6, '#94a3b8', '#090d16', 1.1);
      pxBlockShaded(ctx, -5, by, 10, 10, '#f1b586', '#c68353');
      pxRect(ctx, -6, by - 2, 11, 4, '#cbd5e1', '#090d16', 1.1);
      pxRect(ctx, 1, by + 3, 5, 3, '#38bdf8', '#090d16', 1);

      if (aiState === 'attack') {
        pxLimb(ctx, 3, by + 14, 18, by + 11, 3.6, '#78350f', '#451a03');
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(6, by + 12, 15, -0.4, 0.4);
        ctx.stroke();
      } else if (isHurt) {
        pxLimb(ctx, 3, by + 14, 10, by + 7, 3.4, '#78350f', '#451a03');
      } else {
        pxLimb(ctx, 4, by + 15, 8, by + 29, 3.4, '#78350f', '#451a03');
      }
      break;
    }

    case 'vendedor': {
      const by = -44 + bob;
      pxLimb(ctx, -2, -16, -4 + walkSwing, -2, 5, '#1e293b', '#0f172a');
      pxLimb(ctx, 2, -16, 4 - walkSwing, -2, 5, '#334155', '#1e293b');
      drawShoe(-4 + walkSwing, -2, '#cbd5e1');
      drawShoe(4 - walkSwing, -2, '#cbd5e1');

      pxBlockShaded(ctx, -7, by + 11, 15, 17, '#0284c7', '#075985', '#38bdf8');
      pxRect(ctx, -4, by + 12, 9, 14, '#facc15', '#090d16', 1);
      // Candy tray
      pxRect(ctx, 1, by + 20, 10, 6, '#be123c', '#090d16', 1.1);
      pxRect(ctx, 3, by + 21, 3, 2, '#f472b6');
      pxRect(ctx, 7, by + 21, 3, 2, '#fde047');

      pxBlockShaded(ctx, -5, by, 10, 10, '#d99b6c', '#a1623b');
      pxRect(ctx, -6, by - 3, 12, 4, '#ef4444', '#090d16', 1.1);
      pxRect(ctx, 2, by - 1, 7, 2.5, '#991b1b', '#090d16', 1);
      pxRect(ctx, 2, by + 3, 2, 2, '#090d16');
      break;
    }

    case 'estudante': {
      const by = -45 + bob;
      pxLimb(ctx, -2, -17, -4 + walkSwing, -2, 5.2, '#1e293b', '#0f172a');
      pxLimb(ctx, 2, -17, 4 - walkSwing, -2, 5.2, '#334155', '#1e293b');
      drawShoe(-4 + walkSwing, -2, '#f8fafc');
      drawShoe(4 - walkSwing, -2, '#f8fafc');

      pxBlockShaded(ctx, -7, by + 11, 14, 17, '#10b981', '#047857', '#34d399');
      pxBlockShaded(ctx, -5, by, 10, 10, '#f1b586', '#c68353');
      pxRect(ctx, -6, by - 3, 12, 4, '#1e293b', '#090d16', 1.1);
      pxRect(ctx, -4, by + 2, 4, 5, '#f97316', '#090d16', 1);
      pxRect(ctx, 2, by + 4, 2, 2, '#090d16');

      if (hasFrontBarrier) {
        const pushX = aiState === 'attack' ? 5 : 0;
        pxBlockShaded(ctx, 2 + pushX, by + 8, 12, 22, '#2563eb', '#1e3a8a', '#60a5fa');
        pxRect(ctx, 4 + pushX, by + 12, 8, 6, '#f97316', '#090d16', 1);
        pxRect(ctx, 3 + pushX, by + 21, 9, 2.5, '#facc15');
      }
      break;
    }

    case 'patricinha': {
      const by = -44 + bob;
      pxLimb(ctx, -2, -16, -4 + walkSwing, -2, 4.2, '#f1b586', '#c68353');
      pxLimb(ctx, 2, -16, 4 - walkSwing, -2, 4.2, '#f1b586', '#c68353');
      drawShoe(-4 + walkSwing, -2, '#ec4899');
      drawShoe(4 - walkSwing, -2, '#ec4899');

      pxBlockShaded(ctx, -6, by + 11, 13, 13, '#ec4899', '#9d174d', '#f472b6');
      pxRect(ctx, -6, by + 23, 13, 5, '#f8fafc', '#090d16', 1.1);

      pxRect(ctx, -9, by + 1, 5, 11, '#facc15', '#090d16', 1.1);
      pxBlockShaded(ctx, -5, by, 10, 10, '#fcd5b5', '#d99b6c');
      pxRect(ctx, -6, by - 3, 12, 4, '#fde047', '#090d16', 1.1);
      pxRect(ctx, 0, by + 2, 6, 3, '#090d16');

      const bagX = aiState === 'attack' ? 10 : 4;
      pxBlockShaded(ctx, bagX, by + 16, 8, 8, '#db2777', '#831843');
      break;
    }

    case 'industria': {
      const by = -48 + bob;
      pxLimb(ctx, -3, -17, -5 + walkSwing, -2, 6, '#1e3a8a', '#0f172a');
      pxLimb(ctx, 3, -17, 5 - walkSwing, -2, 6, '#172554', '#090d16');
      drawShoe(-5 + walkSwing, -2, '#451a03');
      drawShoe(5 - walkSwing, -2, '#451a03');

      pxBlockShaded(ctx, -9, by + 11, 19, 20, '#1e40af', '#172554', '#3b82f6');
      pxRect(ctx, -8, by + 18, 17, 3.5, '#f97316', '#090d16', 1);

      if (stinkActive) {
        pxRect(ctx, -5, by + 14, 3, 3, '#65a30d', '#365314', 0.8);
        pxRect(ctx, 3, by + 14, 3, 3, '#65a30d', '#365314', 0.8);
      }

      pxBlockShaded(ctx, -5, by, 11, 11, '#e5a97c', '#b46e42');
      pxBlockShaded(ctx, -7, by - 4, 15, 6, '#facc15', '#ca8a04', '#fef08a');
      pxRect(ctx, 3, by + 4, 2, 2, '#090d16');

      const armExt = aiState === 'attack' ? 15 : isHurt ? -7 : 7;
      pxLimb(ctx, 4, by + 16, armExt, by + 15, 5, '#e5a97c', '#b46e42');
      break;
    }

    case 'fiscal':
    case 'boss_fiscal_chefe': {
      const isChefe = type === 'boss_fiscal_chefe';
      const by = (isChefe ? -48 : -45) + bob;
      pxLimb(ctx, -3, -17, -4 + walkSwing, -2, 5.5, '#0f172a', '#020617');
      pxLimb(ctx, 3, -17, 4 - walkSwing, -2, 5.5, '#1e293b', '#0f172a');
      drawShoe(-4 + walkSwing, -2, '#020617');
      drawShoe(4 - walkSwing, -2, '#020617');

      pxBlockShaded(
        ctx,
        -8,
        by + 11,
        16,
        17,
        isChefe ? '#1e40af' : '#2563eb',
        '#172554',
        '#60a5fa'
      );
      pxRect(ctx, -1, by + 12, 3, 12, '#0f172a');
      if (isChefe) {
        pxRect(ctx, -9, by + 10, 5, 3, '#facc15', '#090d16', 1);
        pxRect(ctx, 4, by + 10, 5, 3, '#facc15', '#090d16', 1);
      }

      pxBlockShaded(ctx, -5, by, 11, 11, '#f1b586', '#c68353');
      pxRect(ctx, -7, by - 4, 14, 5, '#0f172a', '#020617', 1.1);
      pxRect(ctx, -5, by - 6, 10, 3, isChefe ? '#facc15' : '#38bdf8', '#090d16', 1);
      pxRect(ctx, 2, by - 1, 6, 2, '#020617');

      pxRect(ctx, 3, by + 7, 4, 2, '#facc15', '#090d16', 0.9);
      const clipX = aiState === 'attack' ? 11 : 5;
      pxRect(ctx, clipX, by + 13, 8, 10, '#7f1d1d', '#090d16', 1.1);
      pxRect(ctx, clipX + 1.5, by + 14.5, 5, 7, '#f8fafc');
      break;
    }

    case 'tio_audio': {
      const by = -45 + bob;
      pxLimb(ctx, -2, -16, -4 + walkSwing, -2, 5.2, '#334155', '#0f172a');
      pxLimb(ctx, 2, -16, 4 - walkSwing, -2, 5.2, '#475569', '#1e293b');
      drawShoe(-4 + walkSwing, -2, '#78350f');
      drawShoe(4 - walkSwing, -2, '#78350f');

      // Striped polo shirt
      pxBlockShaded(ctx, -8, by + 11, 16, 17, '#eab308', '#a16207', '#fef08a');
      pxRect(ctx, -7, by + 16, 14, 2, '#0f172a');
      pxRect(ctx, -7, by + 22, 14, 2, '#0f172a');

      // Balding crown + glasses + mustache
      pxBlockShaded(ctx, -5, by, 10, 10, '#e5a97c', '#b46e42');
      pxRect(ctx, -6, by + 1, 3, 5, '#64748b');
      pxRect(ctx, 1, by + 3, 5, 3, '#cbd5e1', '#090d16', 1);
      pxRect(ctx, 1, by + 7, 5, 2, '#475569');

      // Smartphone held forward blasting loud audio waves
      const phX = aiState === 'attack' || aiState === 'windup' ? 11 : 6;
      pxLimb(ctx, 3, by + 16, phX, by + 14, 4.2, '#e5a97c', '#b46e42');
      pxRect(ctx, phX, by + 9, 5, 9, '#0f172a', '#020617', 1);
      pxRect(ctx, phX + 1, by + 10, 3, 6, aiState === 'windup' ? '#ef4444' : '#38bdf8');
      if (aiState === 'windup' || aiState === 'attack') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(phX + 6, by + 13, 6, -0.7, 0.7);
        ctx.stroke();
      }
      break;
    }

    case 'skatista': {
      const by = -43 + (aiState === 'skateDash' ? -2 : bob);
      // Red/gold pixel skateboard beneath feet!
      pxRect(ctx, -14, -5, 28, 3.5, '#dc2626', '#090d16', 1.1);
      pxRect(ctx, -10, -2, 4, 3, '#facc15', '#090d16', 0.9);
      pxRect(ctx, 6, -2, 4, 3, '#facc15', '#090d16', 0.9);

      pxLimb(ctx, -3, -15, -6, -6, 4.8, '#1e293b', '#0f172a');
      pxLimb(ctx, 3, -15, 6, -6, 4.8, '#334155', '#0f172a');

      // Hooded skater windbreaker
      pxBlockShaded(ctx, -7, by + 10, 14, 15, '#7c3aed', '#4c1d95', '#a78bfa');
      pxRect(ctx, -3, by + 14, 7, 5, '#facc15', '#090d16', 0.9);

      pxBlockShaded(ctx, -5, by, 10, 10, '#f1b586', '#c68353');
      // Backward snapback cap
      pxRect(ctx, -6, by - 3, 12, 4, '#ef4444', '#090d16', 1.1);
      pxRect(ctx, -10, by - 1, 5, 2, '#991b1b', '#090d16', 0.9);
      pxRect(ctx, 2, by + 4, 2, 2, '#090d16');
      break;
    }

    case 'boss_motorista': {
      const by = -51 + bob;
      pxLimb(ctx, -4, -18, -5 + walkSwing, -2, 6.2, '#0f172a', '#020617');
      pxLimb(ctx, 4, -18, 5 - walkSwing, -2, 6.2, '#1e293b', '#0f172a');
      drawShoe(-5 + walkSwing, -2, '#020617');
      drawShoe(5 - walkSwing, -2, '#020617');

      // Transit driver blue uniform + dark vest + red driver tie
      pxBlockShaded(ctx, -10, by + 12, 21, 21, '#0284c7', '#075985', '#38bdf8');
      pxRect(ctx, -9, by + 12, 6, 19, '#1e293b', '#090d16', 1);
      pxRect(ctx, 4, by + 12, 6, 19, '#1e293b', '#090d16', 1);
      pxRect(ctx, -1, by + 13, 3, 12, '#dc2626', '#090d16', 0.9);

      // Peaked driver cap + grumpy brows
      pxBlockShaded(ctx, -6, by, 12, 11, '#d99b6c', '#a1623b');
      pxRect(ctx, -7, by - 5, 14, 5, '#0f172a', '#020617', 1.1);
      pxRect(ctx, -5, by - 6, 10, 2, '#facc15');
      pxRect(ctx, 2, by - 1, 7, 2.5, '#020617');
      pxRect(ctx, 2, by + 4, 3, 2, '#090d16');

      // Giant detachable Bus Steering Wheel weapon!
      const wheelX = aiState === 'attack' || isSpinning ? 12 : 9;
      const wheelY = by + 21;
      const wheelSpin = isSpinning ? time * 18 : 0;
      ctx.save();
      ctx.translate(wheelX, wheelY);
      ctx.rotate(wheelSpin);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = isSpinning ? '#facc15' : '#334155';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      pxRect(ctx, -10, -1.5, 20, 3, '#475569');
      pxRect(ctx, -1.5, 0, 3, 10, '#475569');
      pxRect(ctx, -3, -3, 6, 6, '#facc15', '#090d16', 1);
      ctx.restore();
      break;
    }

    case 'boss_cobrador':
    case 'boss_cobrador_blindado': {
      const armored = type === 'boss_cobrador_blindado';
      const by = armored ? -52 : -47;
      const scaleW = armored ? 1.15 : 1;

      ctx.save();
      ctx.scale(scaleW, 1);
      pxLimb(ctx, -4, -18, -5 + walkSwing, -2, 6.5, '#0f172a', '#020617');
      pxLimb(ctx, 4, -18, 5 - walkSwing, -2, 6.5, '#1e293b', '#0f172a');
      drawShoe(-5 + walkSwing, -2, '#334155');
      drawShoe(5 - walkSwing, -2, '#334155');

      pxBlockShaded(
        ctx,
        -10,
        by + 12,
        21,
        22,
        armored ? '#475569' : '#1e40af',
        '#1e293b',
        armored ? '#94a3b8' : '#3b82f6'
      );
      if (armored) {
        pxBlockShaded(ctx, -12, by + 10, 25, 6, '#94a3b8', '#475569', '#e2e8f0');
        pxRect(ctx, -3, by + 19, 7, 6, '#ef4444', '#090d16', 1.1);
      } else {
        pxRect(ctx, -5, by + 15, 11, 10, '#facc15', '#090d16', 1.1);
      }

      pxBlockShaded(ctx, -6, by, 12, 12, armored ? '#64748b' : '#d99b6c', '#334155');
      if (armored) {
        pxRect(ctx, -7, by - 4, 15, 6, '#334155', '#090d16', 1.1);
        pxRect(ctx, -1, by + 3, 8, 3.5, '#ef4444', '#090d16', 1);
      } else {
        pxRect(ctx, -7, by - 4, 14, 5, '#0f172a', '#020617', 1.1);
        pxRect(ctx, 3, by + 4, 2, 2, '#090d16');
      }
      ctx.restore();

      const spinAngle = isSpinning ? time * 24 : aiState === 'spinWindup' ? time * 6 : 0.4;
      const hubX = isSpinning ? 0 : 11;
      const hubY = by + 22;
      const armCount = armored ? 4 : 3;
      const armLen = armored ? 27 : 21;

      if (isSpinning) {
        ctx.strokeStyle = armored ? '#ef4444' : '#facc15';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, hubY, armLen + 4, (armLen + 4) * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < armCount; i++) {
        const a = spinAngle + (i * Math.PI * 2) / armCount;
        const ax = hubX + Math.cos(a) * armLen;
        const ay = hubY + Math.sin(a) * armLen * 0.65;
        pxLimb(ctx, hubX, hubY, ax, ay, 3.5, '#e2e8f0', '#64748b');
        pxRect(ctx, ax - 3, ay - 3, 6, 6, armored ? '#ef4444' : '#facc15', '#090d16', 1.1);
      }
      pxRect(ctx, hubX - 4, hubY - 4, 8, 8, '#facc15', '#090d16', 1.2);
      break;
    }
  }

  if (hitFlash) {
    const flashW = isLargeBoss ? 22 : 16;
    const flashH = isLargeBoss ? 48 : 40;
    ctx.fillStyle = 'rgba(254, 249, 195, 0.56)';
    ctx.fillRect(-Math.round(flashW / 2), -flashH - 2 + bob, flashW, flashH);
  }

  if (isAboutToAttack) {
    pxRect(ctx, -6, -64, 12, 13, '#ef4444', '#090d16', 1.2);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('!', -2.5, -54);
  }

  ctx.restore();

  if (aiState === 'knockdown') {
    ctx.save();
    for (let s = 0; s < 3; s++) {
      const ang = time * 7 + (s * Math.PI * 2) / 3;
      const sx = px(x + Math.cos(ang) * 16);
      const sy = px(y - z - 24 + Math.sin(ang) * 4);
      pxRect(ctx, sx - 2, sy - 2, 5, 5, '#facc15', '#090d16', 1);
    }
    ctx.restore();
  }
}

// ============================================================================
// BOSS FINISHER & FULL SCREEN K.O.
// ============================================================================

export function drawBossFinisherEffect(
  ctx: CanvasRenderingContext2D,
  sx: number,
  y: number,
  z: number,
  progress: number,
  label: string,
  primaryColor: string,
  secondaryColor: string,
  style: 'turnstile' | 'armor' | 'tickets'
) {
  const cy = y - z - 18;
  const alpha = Math.max(0, 1 - progress);
  ctx.save();
  ctx.globalAlpha = alpha;

  const outerR = 14 + progress * 68;
  const innerR = 8 + progress * 46;
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = Math.max(1, 4 * (1 - progress));
  ctx.beginPath();
  ctx.ellipse(sx, cy, outerR, outerR * 0.56, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = Math.max(1, 3 * (1 - progress));
  ctx.beginPath();
  ctx.ellipse(sx, cy, innerR, innerR * 0.56, 0, 0, Math.PI * 2);
  ctx.stroke();

  const rayCount = 10;
  for (let i = 0; i < rayCount; i++) {
    const a = (i * Math.PI * 2) / rayCount + progress * 0.4;
    const r1 = 10 + progress * 22;
    const r2 = 22 + progress * 56;
    ctx.strokeStyle = i % 2 === 0 ? '#fef08a' : secondaryColor;
    ctx.lineWidth = 2.2 * (1 - progress * 0.6);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
    ctx.lineTo(sx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.7);
    ctx.stroke();
  }

  for (let d = 0; d < 6; d++) {
    const ang = (d * Math.PI) / 3 + 0.3;
    const dist = 10 + progress * 52;
    const dx = sx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist * 0.65 - Math.sin(progress * Math.PI) * 16;
    ctx.save();
    ctx.translate(px(dx), px(dy));
    ctx.rotate(progress * 8 + d);
    if (style === 'tickets') {
      pxRect(ctx, -4, -2, 8, 4, '#f8fafc', '#090d16', 1);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -1, 6, 1.5);
    } else if (style === 'armor') {
      pxRect(ctx, -4, -3, 8, 6, d % 2 === 0 ? '#94a3b8' : '#ef4444', '#090d16', 1);
    } else {
      pxRect(ctx, -6, -1.5, 12, 3, d % 2 === 0 ? '#e2e8f0' : '#facc15', '#090d16', 1);
    }
    ctx.restore();
  }

  if (label) {
    const popScale = progress < 0.2 ? 0.7 + (progress / 0.2) * 0.45 : 1.15 - progress * 0.15;
    ctx.save();
    ctx.translate(sx, cy - 18 - progress * 16);
    ctx.scale(popScale, popScale);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4;
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = '#facc15';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export function drawFullScreenKoAnimation(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  progress: number,
  primaryColor: string,
  secondaryColor: string,
  style: 'turnstile' | 'armor' | 'tickets',
  skinStyle: PlayerSkinStyle = 'classic'
) {
  const cx = W * 0.5;
  const cy = H * 0.5;
  const fadeOut = progress > 0.76 ? Math.max(0, 1 - (progress - 0.76) / 0.24) : 1;

  ctx.save();
  ctx.globalAlpha = fadeOut;

  const vig = ctx.createRadialGradient(cx, cy, 40, cx, cy, W * 0.65);
  vig.addColorStop(0, 'rgba(9, 13, 22, 0.08)');
  vig.addColorStop(0.55, 'rgba(9, 13, 22, 0.52)');
  vig.addColorStop(1, 'rgba(2, 6, 23, 0.88)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const rayCount = 26;
  const maxReach = Math.hypot(W, H) * 0.62;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i * Math.PI * 2) / rayCount + progress * 0.25;
    const inner = 26 + progress * 48 + (i % 3) * 10;
    const outer = Math.max(inner + 36, maxReach * (0.65 + 0.35 * ((i % 2) + progress)));
    ctx.strokeStyle = i % 3 === 0 ? '#fef08a' : i % 2 === 0 ? primaryColor : secondaryColor;
    ctx.lineWidth = (i % 2 === 0 ? 3.4 : 2.1) * (1 - progress * 0.45);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  const ring1 = 24 + progress * 290;
  const ring2 = 12 + progress * 210;
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = Math.max(1.5, 6 * (1 - progress * 0.75));
  ctx.beginPath();
  ctx.arc(cx, cy, ring1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = Math.max(1.2, 4.2 * (1 - progress * 0.75));
  ctx.beginPath();
  ctx.arc(cx, cy, ring2, 0, Math.PI * 2);
  ctx.stroke();

  const bandHeight = (progress < 0.16 ? progress / 0.16 : 1) * 76;
  ctx.save();
  ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
  ctx.fillRect(0, cy - bandHeight * 0.5, W, bandHeight);
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, cy - bandHeight * 0.5, W, 3.5);
  ctx.fillRect(0, cy + bandHeight * 0.5 - 3.5, W, 3.5);

  ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
  for (let s = -2; s < 10; s++) {
    const sx = ((s * 68 + progress * 260) % (W + 120)) - 60;
    ctx.beginPath();
    ctx.moveTo(sx, cy - bandHeight * 0.5 + 3.5);
    ctx.lineTo(sx + 22, cy - bandHeight * 0.5 + 3.5);
    ctx.lineTo(sx + 6, cy + bandHeight * 0.5 - 3.5);
    ctx.lineTo(sx - 16, cy + bandHeight * 0.5 - 3.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  for (let d = 0; d < 14; d++) {
    const ang = (d * Math.PI * 2) / 14 + 0.18;
    const dist = 28 + progress * (180 + (d % 3) * 45);
    const dx = cx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist * 0.62 - Math.sin(progress * Math.PI) * 18;
    ctx.save();
    ctx.translate(px(dx), px(dy));
    ctx.rotate(progress * 9 + d);
    if (d % 2 === 0) {
      pxRect(ctx, -4, -4, 8, 8, '#fde047', '#090d16', 1.2);
    } else if (style === 'tickets') {
      pxRect(ctx, -6, -3, 12, 6, '#f8fafc', '#090d16', 1.2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-4, -1, 8, 2);
    } else if (style === 'armor') {
      pxRect(ctx, -5, -4, 10, 8, '#94a3b8', '#090d16', 1.2);
    } else {
      pxRect(ctx, -8, -2, 16, 4, '#facc15', '#090d16', 1.2);
    }
    ctx.restore();
  }

  // Animated player thumbs-up portrait ("dando jóia") sliding in from the left!
  const slideIn = progress < 0.22 ? progress / 0.22 : 1;
  const ease = 1 - Math.pow(1 - slideIn, 3);
  const heroX = -42 + ease * 116;
  const heroY = H - 14 + Math.sin(progress * 18) * 1.5;
  ctx.save();
  ctx.translate(px(heroX), px(heroY));
  ctx.scale(2.15, 2.15);
  drawVectorPlayer(
    ctx,
    0,
    0,
    0,
    1,
    'thumbsUp',
    progress * 1.6,
    false,
    false,
    false,
    false,
    false,
    progress * 2.2,
    skinStyle
  );
  ctx.restore();

  let popScale = 1;
  if (progress < 0.15) {
    popScale = 2.4 - (progress / 0.15) * 1.45;
  } else if (progress < 0.26) {
    popScale = 0.95 + ((progress - 0.15) / 0.11) * 0.12;
  } else {
    popScale = 1.07 - (progress - 0.26) * 0.08;
  }
  const jitterX = progress < 0.45 ? Math.sin(progress * 110) * 2.5 : 0;
  const jitterY = progress < 0.45 ? Math.cos(progress * 95) * 2 : 0;

  ctx.save();
  ctx.translate(cx + 38 + jitterX, cy + jitterY);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.scale(popScale, popScale);
  ctx.font = '900 54px Bungee, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#020617';
  ctx.fillText('K.O.!', 4, 5);
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 11;
  ctx.lineJoin = 'round';
  ctx.strokeText('K.O.!', 0, 0);

  const koGrad = ctx.createLinearGradient(0, -28, 0, 28);
  koGrad.addColorStop(0, '#fef08a');
  koGrad.addColorStop(0.5, '#facc15');
  koGrad.addColorStop(1, primaryColor);
  ctx.fillStyle = koGrad;
  ctx.fillText('K.O.!', 0, 0);
  ctx.restore();

  if (progress < 0.16) {
    const flashAlpha = (1 - progress / 0.16) * 0.55;
    ctx.fillStyle = `rgba(254, 240, 138, ${flashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// ============================================================================
// PICKUP DROPS (16-BIT PIXEL PROPS)
// ============================================================================

export function drawVectorDropItem(
  ctx: CanvasRenderingContext2D,
  type: ItemType,
  x: number,
  y: number,
  z: number,
  bobPhase: number
) {
  const bob = Math.round(Math.sin(bobPhase * 5) * 2);
  const dy = px(y - z + bob);
  const dx = px(x);

  ctx.save();
  ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
  ctx.fillRect(dx - 9, px(y - 2), 18, 5);

  switch (type) {
    case 'bengala':
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(dx - 10, dy - 5);
      ctx.lineTo(dx + 8, dy - 5);
      ctx.arc(dx + 8, dy - 8, 3, Math.PI * 0.5, Math.PI * 1.8, true);
      ctx.stroke();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      break;

    case 'chocolate':
      pxRect(ctx, dx - 8, dy - 12, 16, 10, '#78350f', '#090d16', 1.2);
      pxRect(ctx, dx - 8, dy - 12, 9, 10, '#dc2626', '#090d16', 1.2);
      pxRect(ctx, dx + 2, dy - 10, 4, 3, '#92400e');
      break;

    case 'creditos':
      pxRect(ctx, dx - 9, dy - 13, 18, 11, '#2563eb', '#090d16', 1.2);
      pxRect(ctx, dx - 9, dy - 9, 18, 3, '#facc15', '#090d16', 1);
      pxRect(ctx, dx - 6, dy - 11, 4, 3, '#fde047');
      break;

    case 'desodorante':
      pxRect(ctx, dx - 5, dy - 14, 10, 13, '#06b6d4', '#090d16', 1.2);
      pxRect(ctx, dx - 4, dy - 17, 8, 4, '#f8fafc', '#090d16', 1.1);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(dx - 2, dy - 12, 2, 8);
      break;

    case 'maquiagem':
      pxRect(ctx, dx - 7, dy - 13, 10, 10, '#ec4899', '#090d16', 1.2);
      pxRect(ctx, dx - 5, dy - 11, 6, 6, '#bae6fd', '#090d16', 1);
      pxRect(ctx, dx + 4, dy - 14, 4, 8, '#ef4444', '#090d16', 1.1);
      break;

    case 'cafezinho':
      pxRect(ctx, dx - 5, dy - 13, 10, 12, '#f8fafc', '#090d16', 1.2);
      pxRect(ctx, dx - 5, dy - 9, 10, 4, '#92400e');
      pxRect(ctx, dx - 6, dy - 15, 12, 3, '#451a03', '#090d16', 1);
      // Animated steam pixel wisps
      ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
      ctx.fillRect(dx - 3, dy - 19 - (bob % 2), 2, 3);
      ctx.fillRect(dx + 1, dy - 20 + (bob % 2), 2, 3);
      break;

    case 'bilhete_dourado':
      pxRect(ctx, dx - 10, dy - 14, 20, 12, '#facc15', '#090d16', 1.2);
      pxRect(ctx, dx - 10, dy - 9, 20, 3, '#b45309', '#090d16', 0.9);
      pxRect(ctx, dx - 7, dy - 12, 5, 3, '#fef08a');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + 4, dy - 13, 2, 2);
      break;
  }
  ctx.restore();
}

// ============================================================================
// DYNAMIC LINE-THEMED RANDOMIZED BUS GRAFFITI OVERLAYS (WALLS, WINDOWS, SEATS)
// ============================================================================

const LINE_GRAFFITI_THEMES: Record<
  1 | 2 | 3,
  { words: string[]; colors: string[]; accent: string }
> = {
  1: {
    words: ['101', 'WIFI0', 'FARIA', 'CAFE', 'TECH', 'SP'],
    colors: ['#38bdf8', '#fde047', '#34d399', '#cbd5e1'],
    accent: '#bae6fd',
  },
  2: {
    words: ['202', 'OZ', 'TURNO', 'METAL', 'PICO', 'Z/O'],
    colors: ['#fb923c', '#facc15', '#a3e635', '#38bdf8'],
    accent: '#fdba74',
  },
  3: {
    words: ['303', 'CAOS', 'FURIA', 'REI', 'BUS', 'BARRO'],
    colors: ['#f43f5e', '#e879f9', '#a3e635', '#facc15', '#38bdf8'],
    accent: '#fb7185',
  },
};

function seededHash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function drawWallGraffitiOverlay(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  lineNumber: 1 | 2 | 3,
  seed: number
) {
  const theme = LINE_GRAFFITI_THEMES[lineNumber];
  const h = seededHash(seed);
  const word = theme.words[h % theme.words.length];
  const color = theme.colors[(h >>> 4) % theme.colors.length];
  const color2 = theme.colors[((h >>> 8) + 1) % theme.colors.length];
  const style = (h >>> 12) % 4;

  ctx.save();
  ctx.globalAlpha = lineNumber === 1 ? 0.56 : lineNumber === 2 ? 0.72 : 0.84;

  if (style === 0) {
    // Bubble / Wildstyle spray throw-up on interior bus lower wall panel
    ctx.font = lineNumber === 3 ? 'bold 9px monospace' : 'bold 7.5px monospace';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.6;
    ctx.strokeText(word, px(wx), px(wy));
    ctx.fillStyle = color;
    ctx.fillText(word, px(wx), px(wy));
    // Spray paint drips & underline
    ctx.fillStyle = color2;
    ctx.fillRect(px(wx), px(wy + 2), word.length * 5, 1.5);
    if (lineNumber >= 2) {
      ctx.fillRect(px(wx + 4), px(wy + 3), 1.5, 4);
      ctx.fillRect(px(wx + 13), px(wy + 3), 1.5, 3);
    }
  } else if (style === 1) {
    // Stencil badge: tech sticker (L1), gear bolt (L2), or wildstyle crown (L3)
    const sx = px(wx);
    const sy = px(wy - 9);
    pxRect(ctx, sx - 1, sy - 1, 16, 11, 'rgba(9, 13, 22, 0.75)', color, 1);
    if (lineNumber === 1) {
      ctx.fillStyle = color;
      ctx.fillRect(sx + 2, sy + 2, 10, 2);
      ctx.fillRect(sx + 4, sy + 5, 6, 2);
    } else if (lineNumber === 2) {
      // Industrial gear/bolt stencil
      ctx.fillStyle = color;
      ctx.fillRect(sx + 4, sy + 1, 6, 7);
      ctx.fillRect(sx + 2, sy + 3, 10, 3);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(sx + 6, sy + 3, 2, 3);
    } else {
      // Wildstyle spray crown
      ctx.fillStyle = color;
      ctx.fillRect(sx + 2, sy + 2, 2, 5);
      ctx.fillRect(sx + 6, sy + 1, 2, 6);
      ctx.fillRect(sx + 10, sy + 2, 2, 5);
      ctx.fillRect(sx + 2, sy + 6, 10, 2);
    }
  } else if (style === 2) {
    // Tilted marker tag + spray dots
    ctx.translate(px(wx), px(wy));
    ctx.rotate(((h % 5) - 2) * 0.045);
    ctx.font = 'italic bold 7px monospace';
    ctx.fillStyle = '#090d16';
    ctx.fillText(word, 1, 1);
    ctx.fillStyle = color;
    ctx.fillText(word, 0, 0);
    ctx.fillStyle = color2;
    ctx.fillRect(-3, -4, 2, 2);
    ctx.fillRect(word.length * 4 + 2, -2, 2, 2);
  } else {
    // Lightning / arrow street tag
    ctx.fillStyle = '#090d16';
    ctx.fillRect(px(wx), px(wy - 7), 18, 7);
    ctx.fillStyle = color;
    ctx.fillRect(px(wx + 2), px(wy - 6), 10, 2);
    ctx.fillRect(px(wx + 6), px(wy - 4), 10, 2);
    ctx.fillStyle = color2;
    ctx.fillRect(px(wx + 14), px(wy - 6), 2, 5);
  }
  ctx.restore();
}

function drawWindowGraffitiTag(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  lineNumber: 1 | 2 | 3,
  seed: number,
  alpha: number
) {
  const theme = LINE_GRAFFITI_THEMES[lineNumber];
  const h = seededHash(seed);
  const word = theme.words[h % theme.words.length];
  const color = theme.colors[(h * 3) % theme.colors.length];
  const kind = h % 3;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (kind === 0) {
    // Stylized street tag + underline arrow on window
    ctx.font = 'bold 7.5px monospace';
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.2;
    ctx.strokeText(word, px(wx), px(wy));
    ctx.fillStyle = color;
    ctx.fillText(word, px(wx), px(wy));
    ctx.fillRect(px(wx), px(wy + 2), word.length * 4.5, 1.5);
    ctx.fillRect(px(wx + word.length * 4.5 - 2), px(wy + 1), 3, 3);
  } else if (kind === 1) {
    // Mini 16-bit street crown + tag
    ctx.fillStyle = '#090d16';
    ctx.fillRect(px(wx - 1), px(wy - 8), 11, 6);
    ctx.fillStyle = color;
    ctx.fillRect(px(wx), px(wy - 7), 2, 4);
    ctx.fillRect(px(wx + 4), px(wy - 8), 2, 5);
    ctx.fillRect(px(wx + 8), px(wy - 7), 2, 4);
    ctx.fillRect(px(wx), px(wy - 4), 10, 2);
  } else {
    // Scratched white/cyan marker tag
    ctx.font = 'italic bold 6.5px monospace';
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.fillText(`${word}*`, px(wx), px(wy));
  }
  ctx.restore();
}

function drawSeatGraffitiTag(
  ctx: CanvasRenderingContext2D,
  bx: number,
  lineNumber: 1 | 2 | 3,
  seed: number
) {
  const theme = LINE_GRAFFITI_THEMES[lineNumber];
  const h = seededHash(seed);
  const color = theme.colors[(h * 5) % theme.colors.length];
  const tag = theme.words[(h * 2) % theme.words.length];

  ctx.save();
  ctx.globalAlpha = lineNumber === 1 ? 0.58 : lineNumber === 2 ? 0.72 : 0.84;
  if (h % 2 === 0) {
    ctx.font = 'bold 5.2px monospace';
    ctx.fillStyle = '#090d16';
    ctx.fillText(tag, px(bx + 5), px(124));
    ctx.fillStyle = color;
    ctx.fillText(tag, px(bx + 4), px(123));
  } else {
    // Pixel lightning / star sticker tag on seat backrest
    ctx.fillStyle = '#090d16';
    ctx.fillRect(px(bx + 8), px(117), 9, 9);
    ctx.fillStyle = color;
    ctx.fillRect(px(bx + 11), px(118), 4, 3);
    ctx.fillRect(px(bx + 9), px(121), 5, 2);
    ctx.fillRect(px(bx + 12), px(123), 3, 2);
  }
  ctx.restore();
}

// ============================================================================
// BACKGROUND & FOREGROUND COMMUTERS (SIMPLE, MUTED, LOW-ANIMATION, VARIED)
// ============================================================================

function drawSeatedCommuter(
  ctx: CanvasRenderingContext2D,
  bx: number,
  lineNumber: 1 | 2 | 3,
  variant: number,
  time: number
) {
  ctx.save();
  const cx = px(bx + 14);
  // Subtle slow 1px breathing/nod (pouca animação, sem roubar atenção)
  const breath = Math.floor(time * 1.4 + variant * 1.7) % 2 === 0 ? 0 : 1;
  const skinColors = ['#d99b6c', '#b97b50', '#c98a5b', '#e2ab82', '#9c623b'];
  const shirtColors = ['#7e22ce', '#9a3412', '#475569', '#0f766e', '#991b1b'];
  const hairColors = ['#111528', '#271911', '#334155', '#1e1b4b', '#52525b'];
  const skin = skinColors[variant % skinColors.length];
  const shirt = shirtColors[variant % shirtColors.length];
  const hair = hairColors[variant % hairColors.length];
  const archetype = variant % 5;

  // Slightly muted background contrast so foreground fighters dominate
  if (archetype === 0) {
    // Woman with crossed arms (matches left background passenger in reference image)
    pxBlockShaded(ctx, cx - 8, 121 + breath, 16, 13, shirt, '#3b0764');
    pxBlockShaded(ctx, cx - 5, 110 + breath, 10, 10, skin, '#7c4a2d');
    pxRect(ctx, cx - 7, 108 + breath, 14, 6, hair, '#090d16', 1);
    pxRect(ctx, cx - 7, 112 + breath, 3, 7, hair);
    pxRect(ctx, cx + 4, 112 + breath, 3, 7, hair);
    // Crossed arms bar
    pxRect(ctx, cx - 6, 126 + breath, 12, 4, skin, '#090d16', 1);
  } else if (archetype === 1) {
    // Newspaper reader (matches back left newspaper reader in reference image)
    pxBlockShaded(ctx, cx - 8, 120, 16, 14, '#334155', '#1e293b');
    pxBlockShaded(ctx, cx - 5, 110, 10, 10, skin, '#7c4a2d');
    pxRect(ctx, cx - 5, 109, 10, 4, hair, '#090d16', 1);
    // Open folded 16-bit newspaper
    pxRect(ctx, cx - 10, 122 + breath, 20, 11, '#cbd5e1', '#090d16', 1.1);
    ctx.fillStyle = '#475569';
    ctx.fillRect(cx - 8, 124 + breath, 7, 1.5);
    ctx.fillRect(cx - 8, 127 + breath, 7, 1.5);
    ctx.fillRect(cx + 1, 124 + breath, 7, 1.5);
    ctx.fillRect(cx + 1, 127 + breath, 7, 1.5);
    ctx.fillRect(cx, 122 + breath, 1, 11);
  } else if (archetype === 2) {
    // Commuter with glasses leaning slightly on seat edge (matches center-right NPC)
    pxBlockShaded(ctx, cx - 8, 121 + breath, 16, 13, '#78350f', '#451a03');
    pxBlockShaded(ctx, cx - 5, 110 + breath, 10, 10, skin, '#7c4a2d');
    pxRect(ctx, cx - 6, 108 + breath, 12, 5, hair, '#090d16', 1);
    pxRect(ctx, cx - 4, 114 + breath, 3, 2, '#090d16');
    pxRect(ctx, cx + 1, 114 + breath, 3, 2, '#090d16');
    pxRect(ctx, cx - 1, 114 + breath, 2, 1, '#94a3b8');
    pxRect(ctx, cx - 7, 127 + breath, 14, 4, skin, '#090d16', 1);
  } else if (archetype === 3) {
    // Sleepy / helmeted commuter on Line 2
    pxBlockShaded(ctx, cx - 8, 121, 16, 13, '#475569', '#1e293b');
    const nod = lineNumber === 1 ? breath : 0;
    pxBlockShaded(ctx, cx - 5, 111 + nod, 10, 10, skin, '#7c4a2d');
    if (lineNumber === 2) {
      pxRect(ctx, cx - 7, 107 + nod, 14, 5, '#ca8a04', '#090d16', 1);
    } else {
      pxRect(ctx, cx - 5, 109 + nod, 10, 4, hair, '#090d16', 1);
    }
    pxRect(ctx, cx - 3, 116 + nod, 2, 1, '#090d16');
    pxRect(ctx, cx + 1, 116 + nod, 2, 1, '#090d16');
  } else {
    // Woman in muted coral/amber shirt with simple folded hands
    pxBlockShaded(ctx, cx - 8, 121 + breath, 16, 13, shirt, '#450a0a');
    pxBlockShaded(ctx, cx - 5, 110 + breath, 10, 10, skin, '#7c4a2d');
    pxRect(ctx, cx - 6, 108 + breath, 12, 5, hair, '#090d16', 1);
    pxRect(ctx, cx - 6, 112 + breath, 2, 6, hair);
    pxRect(ctx, cx + 4, 112 + breath, 2, 6, hair);
    pxRect(ctx, cx - 4, 128 + breath, 8, 4, skin, '#090d16', 1);
  }
  ctx.restore();
}

function drawStandingCommuter(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  variant: number,
  time: number,
  mode: 'pole' | 'strap' = 'pole'
) {
  ctx.save();
  // Standing behind combat lane (feet around y = 144, tucked against seats/pole)
  const pxX = px(mode === 'pole' ? anchorX - 11 : anchorX);
  const breath = Math.floor(time * 1.2 + variant) % 2 === 0 ? 0 : 1;
  const shirts = ['#94a3b8', '#64748b', '#78350f', '#475569'];
  const pantsList = ['#1e3a8a', '#334155', '#1e293b', '#312e81'];
  const skins = ['#d99b6c', '#b97b50', '#c8875a', '#9c623b'];
  const shirt = shirts[Math.abs(variant) % shirts.length];
  const pants = pantsList[Math.abs(variant) % pantsList.length];
  const skin = skins[Math.abs(variant) % skins.length];

  // Muted dark shadow at feet
  ctx.fillStyle = 'rgba(5, 8, 18, 0.45)';
  ctx.fillRect(pxX - 8, 143, 16, 3);

  // Legs & sneakers
  pxRect(ctx, pxX - 5, 126, 4, 16, pants, '#090d16', 1);
  pxRect(ctx, pxX + 1, 126, 4, 16, pants, '#090d16', 1);
  pxRect(ctx, pxX - 6, 141, 6, 3, '#cbd5e1', '#090d16', 1);
  pxRect(ctx, pxX + 1, 141, 6, 3, '#cbd5e1', '#090d16', 1);

  // Occasional small muted backpack for crowd variety
  if (variant % 3 === 1) {
    pxRect(ctx, pxX - 9, 108 + breath, 5, 13, '#1e293b', '#090d16', 1);
  }

  // Torso
  pxBlockShaded(ctx, pxX - 6, 106 + breath, 13, 20, shirt, '#334155');

  if (mode === 'pole') {
    // Arm reaching out to grip yellow vertical pole
    pxLimb(ctx, pxX + 4, 110 + breath, anchorX + 2, 103, 3.6, skin, '#7c4a2d');
    pxRect(ctx, anchorX, 101, 4, 4, skin, '#090d16', 1);
  } else {
    // Arm reaching up to grip overhead yellow strap
    pxLimb(ctx, pxX + 4, 108 + breath, pxX + 5, 88, 3.4, skin, '#7c4a2d');
    pxRect(ctx, pxX + 3, 86, 4, 4, skin, '#090d16', 1);
  }

  // Head + cap or hair silhouette
  pxBlockShaded(ctx, pxX - 4, 95 + breath, 9, 10, skin, '#7c4a2d');
  if (variant % 2 === 0) {
    pxRect(ctx, pxX - 5, 92 + breath, 11, 4, '#334155', '#090d16', 1);
    pxRect(ctx, pxX + 2, 95 + breath, 6, 2, '#1e293b', '#090d16', 1);
  } else {
    pxRect(ctx, pxX - 5, 92 + breath, 11, 5, '#0f172a', '#090d16', 1);
  }

  ctx.restore();
}

function drawTurnstileConductor(
  ctx: CanvasRenderingContext2D,
  turnX: number,
  time: number
) {
  ctx.save();
  const cx = px(turnX - 18);
  const breath = Math.floor(time * 1.5) % 2 === 0 ? 0 : 1;
  // Muted transit uniform behind the turnstile box
  pxBlockShaded(ctx, cx - 8, 114 + breath, 16, 16, '#64748b', '#334155');
  pxBlockShaded(ctx, cx - 5, 103 + breath, 10, 10, '#c98a5b', '#7c4a2d');
  pxRect(ctx, cx - 6, 100 + breath, 12, 4, '#334155', '#090d16', 1);
  pxRect(ctx, cx + 1, 102 + breath, 6, 2, '#0f172a');
  pxRect(ctx, cx - 2, 116 + breath, 2, 9, '#0f172a');
  ctx.restore();
}

// ============================================================================
// SIGNS, LED BOARDS & LINE POSTERS (COMPACT & CRISP)
// ============================================================================

interface LineAdPosterSpec {
  tag: string;
  headline: string;
  subline: string;
  bg: string;
  border: string;
  badge: string;
  textColor: string;
}

const LINE_AD_POSTERS: Record<1 | 2 | 3, LineAdPosterSpec[]> = {
  1: [
    {
      tag: 'CAFÉ ESTÁGIO',
      headline: 'ACORDA JÁ!',
      subline: 'Pra não passar do ponto',
      bg: '#cbd5e1',
      border: '#334155',
      badge: '#92400e',
      textColor: '#0f172a',
    },
    {
      tag: 'SENAI TURBO',
      headline: 'MOCHILA XXL',
      subline: 'Cabe até o motorista',
      bg: '#bae6fd',
      border: '#0369a1',
      badge: '#0284c7',
      textColor: '#0c4a6e',
    },
    {
      tag: 'ALPHAVELLA',
      headline: 'COWORKING 0800',
      subline: 'Sem Wi-Fi no busão!',
      bg: '#ddd6fe',
      border: '#3730a3',
      badge: '#4338ca',
      textColor: '#1e1b4b',
    },
  ],
  2: [
    {
      tag: 'OZ-FRESH',
      headline: 'SPRAY TURBO',
      subline: 'Neutraliza turno inteiro',
      bg: '#a5f3fc',
      border: '#0e7490',
      badge: '#0891b2',
      textColor: '#164e63',
    },
    {
      tag: 'MARMITA DO ZÉ',
      headline: 'BIFE + FRITAS',
      subline: 'Só R$ 12 na saída Oz',
      bg: '#fed7aa',
      border: '#9a3412',
      badge: '#c2410c',
      textColor: '#431407',
    },
    {
      tag: 'TURNO FÁBRICA',
      headline: 'HORA EXTRA',
      subline: 'Capacete obrigatório!',
      bg: '#fef08a',
      border: '#854d0e',
      badge: '#ca8a04',
      textColor: '#422006',
    },
  ],
  3: [
    {
      tag: 'CATRACA VOLT',
      headline: 'ENERGÉTICO',
      subline: 'Fique de pé até o fim',
      bg: '#0f172a',
      border: '#16a34a',
      badge: '#15803d',
      textColor: '#e2e8f0',
    },
    {
      tag: 'BILHETE FÁCIL',
      headline: 'VALIDE AQUI!',
      subline: 'Evite o fiscal na cola',
      bg: '#bfdbfe',
      border: '#1e40af',
      badge: '#1d4ed8',
      textColor: '#0f172a',
    },
    {
      tag: 'GRUDEX GUM',
      headline: 'CHICLETE MAX',
      subline: 'Gruda por 3 estações',
      bg: '#fbcfe8',
      border: '#9d174d',
      badge: '#be185d',
      textColor: '#500724',
    },
  ],
};

function drawRoadsideArrivalSign(
  ctx: CanvasRenderingContext2D,
  sx: number,
  lineCode: string,
  time: number,
  approachingStop: boolean
) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  pxRect(ctx, sx, 46, 3, 46, '#475569', '#090d16', 1);

  const blink = Math.floor(time * (approachingStop ? 6 : 2.5)) % 2 === 0;
  pxRect(
    ctx,
    sx - 1,
    42,
    5,
    5,
    blink ? (approachingStop ? '#facc15' : '#38bdf8') : '#334155',
    '#090d16',
    1
  );

  // Illuminated dark nocturnal bus stop totem
  pxRect(ctx, sx + 7, 48, 42, 16, '#090d16', '#334155', 1);
  ctx.fillStyle = approachingStop ? '#facc15' : '#34d399';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText(approachingStop ? 'PARADA!' : `L.${lineCode}`, sx + 10, 55);
  ctx.fillStyle = blink ? '#facc15' : '#94a3b8';
  ctx.font = 'bold 5px monospace';
  ctx.fillText(approachingStop ? 'PONTO!' : 'CHEGANDO', sx + 10, 61.5);
  ctx.restore();
}

function drawInteriorArrivalDisplay(
  ctx: CanvasRenderingContext2D,
  dx: number,
  line: LineDefinition,
  time: number,
  turnstileCleared: boolean,
  approachingStop: boolean
) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const w = 66;
  const h = 15;
  const topY = 26;

  pxRect(ctx, dx, topY, w, h, '#090d16', '#334155', 1.2);
  pxRect(ctx, dx + 2, topY + 2, w - 12, h - 4, '#020617');

  const ledOn = Math.floor(time * (turnstileCleared ? 6 : 3)) % 2 === 0;
  pxRect(
    ctx,
    dx + w - 8,
    topY + 4,
    5,
    5,
    turnstileCleared
      ? ledOn
        ? '#ef4444'
        : '#7f1d1d'
      : approachingStop
        ? ledOn
          ? '#facc15'
          : '#713f12'
        : ledOn
          ? '#10b981'
          : '#064e3b',
    '#090d16',
    1
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx + 3, topY + 2, w - 14, h - 4);
  ctx.clip();

  const msg = turnstileCleared
    ? 'PARADA SOLICITADA • DESÇA ->   '
    : approachingStop
      ? `ÔNIBUS CHEGANDO • ${line.code}   `
      : `PRÓXIMO PONTO • L.${line.code}   `;
  ctx.font = 'bold 5.8px monospace';
  const textW = ctx.measureText(msg).width;
  const offset = (time * 24) % textW;
  ctx.fillStyle = turnstileCleared ? '#fca5a5' : approachingStop ? '#facc15' : '#34d399';
  ctx.fillText(msg, px(dx + 4 - offset), topY + 10);
  ctx.fillText(msg, px(dx + 4 - offset + textW), topY + 10);
  ctx.restore();
  ctx.restore();
}

function drawLineAdPoster(
  ctx: CanvasRenderingContext2D,
  pxX: number,
  poster: LineAdPosterSpec
) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const w = 58;
  const h = 21;
  const py = 27;

  pxRect(ctx, pxX, py, w, h, poster.bg, poster.border, 1.4);
  pxRect(ctx, pxX + 1, py + 1, w - 2, 7, poster.badge);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 5px monospace';
  ctx.fillText(poster.tag, px(pxX + 3), py + 6.2);

  ctx.fillStyle = poster.textColor;
  ctx.font = 'bold 5.5px sans-serif';
  ctx.fillText(poster.headline, px(pxX + 3), py + 14.5);
  ctx.font = 'bold 4.8px sans-serif';
  ctx.fillText(poster.subline, px(pxX + 3), py + 19.5);
  ctx.restore();
}

// ============================================================================
// 16-BIT NOCTURNAL BUS INTERIOR (CONTRAST, DEPTH, LIGHTS, SEATS, GRAFFITI)
// ============================================================================

export function drawVectorBusInterior(
  ctx: CanvasRenderingContext2D,
  line: LineDefinition,
  camX: number,
  time: number,
  turnstileCleared: boolean,
  ticketValidated: boolean,
  usedSeatSlots?: Set<number>,
  expressWindActive = false,
  comboFlicker = 0,
  graffitiProgress = 0,
  graffitiSeed = 1,
  turnstileSpinProgress = 0,
  stopButtonReady = false
) {
  const W = 480;
  const routeProgress = Math.min(1, Math.max(0, camX / Math.max(1, line.busLength - W)));
  const approachingStop = turnstileCleared || routeProgress > 0.68;

  // 1. EXTERIOR NOTURNO COM LUZES URBANAS (Nocturnal Sky & Cityscape in Windows y: 22..96)
  const skyTop = line.lineNumber === 2 ? '#110c1c' : '#060a17';
  const skyMid = line.lineNumber === 2 ? '#1f152e' : '#0b1429';
  const skyBot = line.lineNumber === 2 ? '#2c1e3b' : '#12203f';

  ctx.fillStyle = skyTop;
  ctx.fillRect(0, 22, W, 24);
  ctx.fillStyle = getBayerPattern(ctx, skyTop, skyMid, 2);
  ctx.fillRect(0, 40, W, 14);
  ctx.fillStyle = skyMid;
  ctx.fillRect(0, 50, W, 20);
  ctx.fillStyle = getBayerPattern(ctx, skyMid, skyBot, 2);
  ctx.fillRect(0, 66, W, 12);
  ctx.fillStyle = skyBot;
  ctx.fillRect(0, 74, W, 24);

  if (line.lineNumber === 3) {
    // Nocturnal Rodoviária Terminal platforms & illuminated pillars
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 22, W, 11);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(0, 32, W, 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 76, W, 22);

    const platScroll = (time * 55 + camX * 0.3) % 480;
    for (let i = -1; i < 6; i++) {
      const pxX = px(i * 115 - (platScroll % 115));
      const bayNum = (Math.abs(i + Math.floor(platScroll / 115)) % 6) + 1;
      pxRect(ctx, pxX + 4, 28, 8, 48, '#0f172a', '#020617', 1);
      pxRect(ctx, pxX + 16, 36, 40, 12, '#1e3a8a', '#090d16', 1);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 5.5px monospace';
      ctx.fillText(`PLAT ${bayNum}`, pxX + 19, 44);
      const platBlink = Math.floor(time * 4 + bayNum) % 2 === 0;
      pxRect(ctx, pxX + 49, 40, 4, 4, platBlink ? '#34d399' : '#065f46');

      if (bayNum % 2 === 1) {
        pxRect(ctx, pxX + 62, 50, 40, 24, '#334155', '#090d16', 1);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(pxX + 66, 54, 8, 5);
        ctx.fillRect(pxX + 78, 54, 8, 5);
      }
    }
  } else {
    // Nocturnal city buildings with glowing amber/gold windows & dark trees
    const scroll = (time * 58 + camX * 0.25) % 480;
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 46 - (scroll % 46));
      const idx = Math.abs(i + Math.floor(scroll / 46));
      const bh = 28 + ((idx * 17 + i * 7) % 34);
      const bColor = idx % 3 === 0 ? '#0b1122' : idx % 3 === 1 ? '#111a33' : '#16213e';

      pxRect(ctx, bx, 96 - bh, 41, bh + 4, bColor, '#050813', 1);

      // Glowing amber/orange nocturnal apartment/office window pixel dots!
      for (let wy = 96 - bh + 5; wy < 84; wy += 8) {
        for (let wx = bx + 5; wx < bx + 34; wx += 9) {
          const lit = ((idx * 13 + wx * 3 + wy * 7) % 11) < 4;
          if (lit) {
            ctx.fillStyle = (wx + wy) % 2 === 0 ? '#f59e0b' : '#fde047';
            ctx.fillRect(wx, wy, 4, 4);
          } else {
            ctx.fillStyle = '#070b17';
            ctx.fillRect(wx, wy, 4, 4);
          }
        }
      }

      if (line.lineNumber === 1 && i % 2 === 0) {
        // Dark nocturnal park tree silhouettes
        pxRect(ctx, bx + 10, 74, 18, 18, '#0b1c1f');
        pxRect(ctx, bx + 13, 70, 12, 12, '#112a2b');
      } else if (line.lineNumber === 2 && i % 3 === 0) {
        // Factory smokestack + orange beacon
        pxRect(ctx, bx + 15, 96 - bh - 12, 6, 13, '#1e1b2e', '#090d16', 1);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(bx + 17, 96 - bh - 13, 2, 2);
      }
    }
  }

  // Dark asphalt nocturnal street + amber streetlight dots
  ctx.fillStyle = '#0b0f1d';
  ctx.fillRect(0, 88, W, 9);
  ctx.fillStyle = '#ca8a04';
  const laneScroll = (time * 145 + camX * 0.5) % 44;
  for (let lx = -laneScroll; lx < W; lx += 44) {
    ctx.fillRect(px(lx), 91, 18, 2);
  }
  const lampScroll = (time * 95 + camX * 0.42) % 320;
  for (let sx = 120 - lampScroll; sx < W + 60; sx += 320) {
    drawRoadsideArrivalSign(ctx, px(sx), line.code, time, approachingStop);
  }

  // Crisp 16-bit diagonal pixel glass reflection streaks on windows
  ctx.fillStyle = getBayerPattern(ctx, 'rgba(0,0,0,0)', 'rgba(147, 197, 253, 0.22)', 2);
  for (let gx = -(camX % 116); gx < W; gx += 116) {
    ctx.beginPath();
    ctx.moveTo(px(gx + 22), 22);
    ctx.lineTo(px(gx + 34), 22);
    ctx.lineTo(px(gx + 16), 96);
    ctx.lineTo(px(gx + 4), 96);
    ctx.closePath();
    ctx.fill();
  }

  // 2. DARKER INTERIOR CEILING + STRONG FLUORESCENT LIGHT FIXTURES
  ctx.fillStyle = '#141b2d';
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = getBayerPattern(ctx, '#141b2d', '#0b101d', 2);
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 19, W, 3);

  for (let vx = 42 - (camX % 160); vx < W; vx += 160) {
    // Dark recessed roof vent
    pxBlockShaded(ctx, vx, 3, 42, 10, '#27344f', '#141b2d', '#3b4d70', '#090d16');

    // Strong fluorescent ceiling tube between vents
    const fx = px(vx + 72);
    const stutterSignal =
      Math.sin(time * 43 + vx * 0.1) * 0.5 +
      Math.sin(time * 71 + vx * 0.03) * 0.5;
    const ambientDip = Math.sin(time * 3.1) > 0.96 ? 0.28 : 0;
    const tubeDim =
      comboFlicker > 0.05
        ? stutterSignal < -0.15
          ? Math.min(0.85, 0.35 + comboFlicker * 0.5)
          : 0
        : ambientDip;

    pxRect(ctx, fx, 4, 52, 9, '#1e293b', '#090d16', 1.2);
    const coreColor = tubeDim > 0.4 ? '#64748b' : tubeDim > 0.1 ? '#bae6fd' : '#ffffff';
    const haloColor = tubeDim > 0.4 ? '#334155' : '#7dd3fc';
    pxRect(ctx, fx + 3, 6, 46, 5, haloColor);
    pxRect(ctx, fx + 5, 7, 42, 3, coreColor);

    if (tubeDim < 0.5) {
      // Smooth projected ceiling light cone whose falloff is dithered by the post-process shader
      const coneAlpha = (0.14 + comboFlicker * 0.08) * (1 - tubeDim);
      const coneGrad = ctx.createLinearGradient(fx + 26, 13, fx + 26, 146);
      coneGrad.addColorStop(0, `rgba(224, 242, 254, ${coneAlpha.toFixed(3)})`);
      coneGrad.addColorStop(0.55, `rgba(186, 230, 253, ${(coneAlpha * 0.45).toFixed(3)})`);
      coneGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(fx + 3, 13);
      ctx.lineTo(fx + 49, 13);
      ctx.lineTo(fx + 84, 146);
      ctx.lineTo(fx - 32, 146);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 3. DARKER BUS WINDOW PILLARS, LOWER WALL, PROGRESSIVE GRAFFITI & DISPLAYS
  ctx.fillStyle = '#1b2438';
  ctx.fillRect(0, 94, W, 15);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 94, W, 3);
  ctx.fillStyle = '#2b3854';
  ctx.fillRect(0, 97, W, 2);

  const linePosters = LINE_AD_POSTERS[line.lineNumber];
  const firstBayIdx = Math.floor(camX / 116) - 1;
  for (let b = firstBayIdx; b <= firstBayIdx + 6; b++) {
    const wx = px(b * 116 - camX);
    const worldWx = b * 116;

    // Shaded dark steel window frame & pillar + red stop button (matching reference image!)
    pxBlockShaded(ctx, wx, 22, 13, 73, '#28334d', '#0f172a', '#475569');
    pxRect(ctx, wx - 2, 21, 17, 6, '#090d16');
    // Red emergency stop button housing on pillar
    pxRect(ctx, wx + 4, 37, 5, 12, '#dc2626', '#090d16', 1);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(wx + 6, 40, 1, 2);
    // Chunky dark rubber window sill frame
    pxRect(ctx, wx + 13, 25, 103, 3, '#090d16');
    pxRect(ctx, wx + 13, 91, 103, 4, '#090d16');

    if (worldWx > line.turnstileX - 95 || worldWx < -40) continue;

    // Dynamic line-themed randomized graffiti on background wall panels, pillars & windows!
    const wallSeed = seededHash(b * 31 + line.lineNumber * 97 + graffitiSeed);
    const densityBoost = line.lineNumber === 1 ? 0.12 : line.lineNumber === 2 ? 0.42 : 0.72;
    const effectiveDensity = Math.min(1, graffitiProgress + densityBoost);

    // Lower interior bus wall graffiti overlay (y: 96..107)
    if ((wallSeed % 100) / 100 < effectiveDensity) {
      const offsetX = 20 + (wallSeed % 44);
      drawWallGraffitiOverlay(ctx, wx + offsetX, 105, line.lineNumber, wallSeed);
    }
    if (line.lineNumber >= 2 && ((wallSeed >>> 8) % 100) / 100 < effectiveDensity) {
      const offsetX2 = 68 + ((wallSeed >>> 5) % 24);
      drawWallGraffitiOverlay(ctx, wx + offsetX2, 104, line.lineNumber, wallSeed + 19);
    }
    if (line.lineNumber === 3 && ((wallSeed >>> 12) % 3) === 0) {
      // Peak-hour Line 3 pillar vertical spray tag
      drawWallGraffitiOverlay(ctx, wx + 2, 74, 3, wallSeed + 41);
    }

    // Randomized urban graffiti tags on bus windows
    const windowSeed = seededHash(b * 17 + line.lineNumber * 53 + graffitiSeed);
    const windowThreshold = ((windowSeed % 10) / 10) * 0.8;
    if (effectiveDensity > windowThreshold + 0.05) {
      drawWindowGraffitiTag(
        ctx,
        wx + 20 + (windowSeed % 14),
        81 - (windowSeed % 7),
        line.lineNumber,
        windowSeed,
        0.68
      );
    }
    if (effectiveDensity > 0.5 && windowSeed % 2 === 0) {
      drawWindowGraffitiTag(
        ctx,
        wx + 74 + (windowSeed % 10),
        66,
        line.lineNumber,
        windowSeed + 7,
        0.56
      );
    }

    if (Math.abs(b) % 3 === 0) {
      drawInteriorArrivalDisplay(ctx, wx + 22, line, time, turnstileCleared, approachingStop);
    } else if (Math.abs(b) % 2 === 1) {
      const poster = linePosters[Math.abs(b) % linePosters.length];
      drawLineAdPoster(ctx, wx + 26, poster);
    }
  }

  // Vivid continuous horizontal top yellow grab bar ("amarelo das barras mais vivo")
  pxBlockShaded(ctx, -4, 21, W + 8, 5, '#facc15', '#ca8a04', '#fef08a');

  // 4. DEEP ROYAL BLUE PATTERNED SEATS ("azul dos bancos mais profundo") & YELLOW POLES
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 108, W, 41);
  ctx.fillStyle = getBayerPattern(ctx, '#111827', '#090d16', 1);
  ctx.fillRect(0, 108, W, 41);

  const royalSeatFabric = getBayerPattern(ctx, '#1e40af', '#172554', 4);
  const royalCushionFabric = getBayerPattern(ctx, '#1d4ed8', '#1e3a8a', 4);
  const prioritySeatFabric = getBayerPattern(ctx, '#eab308', '#ca8a04', 4);

  const firstSeatBay = Math.max(0, Math.floor(camX / 76) - 1);
  for (let bay = firstSeatBay; bay <= firstSeatBay + 8; bay++) {
    const worldSx = bay * 76;
    const sx = px(worldSx - camX);
    if (worldSx > line.turnstileX - 45) continue;

    // Vivid golden-yellow vertical grab pole with crisp dark outline & clamps
    pxBlockShaded(ctx, sx + 2, 22, 6, 126, '#facc15', '#ca8a04', '#fef08a');
    pxRect(ctx, sx, 21, 10, 6, '#090d16');
    pxRect(ctx, sx, 68, 10, 5, '#090d16');

    const drawSeat = (bx: number, priority: boolean, slot: number) => {
      // Sculpted slate headrest grip
      pxBlockShaded(ctx, bx + 5, 103, 18, 8, '#475569', '#1e293b', '#64748b');
      pxRect(ctx, bx + 9, 105, 10, 3, '#090d16');

      // Deep shaded seat backrest with moquette dither pattern
      const backFill = priority ? prioritySeatFabric : royalSeatFabric;
      pxRect(ctx, bx, 109, 28, 25, backFill, '#090d16', 1.5);
      // Side bevel shadow & top highlight edge
      ctx.fillStyle = priority ? '#a16207' : '#0f172a';
      ctx.fillRect(bx + 1, 110, 3, 23);
      ctx.fillStyle = priority ? '#fef08a' : '#60a5fa';
      ctx.fillRect(bx + 3, 110, 23, 2);

      // Seat cushion base
      pxRect(ctx, bx - 1, 132, 30, 12, priority ? '#ca8a04' : royalCushionFabric, '#090d16', 1.5);
      ctx.fillStyle = priority ? '#fef08a' : '#3b82f6';
      ctx.fillRect(bx + 1, 133, 26, 2);

      // Randomized line-themed graffiti tags on seat backs
      const seatSeed = seededHash(slot * 29 + line.lineNumber * 71 + graffitiSeed);
      const seatThreshold = ((seatSeed % 10) / 10) * 0.85;
      const lineDensity = Math.min(1, graffitiProgress + (line.lineNumber - 1) * 0.3);
      if (lineDensity > seatThreshold + 0.12) {
        drawSeatGraffitiTag(ctx, bx, line.lineNumber, seatSeed);
      }

      const occupied = isBusSeatOccupied(line.lineNumber, slot);
      if (occupied) {
        drawSeatedCommuter(ctx, bx, line.lineNumber, (slot * 3 + line.lineNumber) % 5, time);
      } else if (!usedSeatSlots?.has(slot)) {
        // Clear emerald empty-seat highlight
        ctx.fillStyle = '#10b981';
        ctx.fillRect(bx + 3, 135, 22, 3);
      }
    };

    // Keep priority yellow seat rare/early (bay 0 left) and make the rest deep royal blue like reference!
    drawSeat(sx + 11, bay === 0, bay * 2);
    drawSeat(sx + 43, false, bay * 2 + 1);

    // Dynamically scale standing commuters per bay by lineNumber without crowding the aisle
    if (worldSx > 90 && worldSx < line.turnstileX - 95) {
      const standingCount = getStandingCommutersAtBay(line.lineNumber, bay);
      if (standingCount >= 1) {
        drawStandingCommuter(ctx, sx + 2, bay * 3 + line.lineNumber, time, 'pole');
      }
      if (standingCount >= 2) {
        drawStandingCommuter(ctx, sx + 40, bay * 5 + line.lineNumber + 1, time, 'strap');
      }
    }
  }

  // 4b. Overhead Horizontal Bar & Yellow Straps (at y = 69..74 so skyline & faces stay readable)
  const railEndWorldX = line.exitDoorX - 24;
  const railVisibleEndX = Math.min(W + 4, railEndWorldX - camX);
  if (railVisibleEndX > -4) {
    const firstStrut = Math.max(0, Math.floor(camX / 76) - 1);
    for (let bay = firstStrut; bay <= firstStrut + 8; bay++) {
      const worldX = bay * 76 + 5;
      if (worldX > railEndWorldX - 8) continue;
      const sx = px(worldX - camX);
      pxRect(ctx, sx - 2, 25, 4, 46, '#475569', '#090d16', 1.1);
    }

    // Vivid yellow horizontal grab bar
    pxBlockShaded(ctx, -4, 70, railVisibleEndX + 4, 5, '#facc15', '#ca8a04', '#fef08a');

    if (railEndWorldX - camX <= W + 4) {
      pxRect(ctx, railEndWorldX - camX - 3, 69, 7, 7, '#facc15', '#090d16', 1.2);
    }

    const firstStrap = Math.max(0, Math.floor(camX / 38) - 1);
    for (let s = firstStrap; s <= firstStrap + 15; s++) {
      const worldHx = s * 38 + 20;
      if (worldHx > railEndWorldX - 10) continue;
      const hx = px(worldHx - camX);
      if (hx < -14 || hx > W + 14) continue;

      const sway = Math.round(Math.sin(time * 2.5 + s * 0.9));
      pxRect(ctx, hx - 3, 69, 6, 6, '#090d16');
      pxRect(ctx, hx - 1, 75, 2, 5, '#1e293b');
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(hx, 80);
      ctx.lineTo(hx - 4 + sway, 87);
      ctx.lineTo(hx + 4 + sway, 87);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  // 5. BAYER-DITHERED COOL SLATE BUS AISLE FLOOR + PROJECTED SHADOW TRANSITIONS (y: 148..236)
  ctx.fillStyle = getBayerPattern(ctx, '#475569', '#5b6b84', 4);
  ctx.fillRect(0, 148, W, 62);
  ctx.fillStyle = getBayerPattern(ctx, '#38455c', '#475569', 2);
  ctx.fillRect(0, 206, W, 30);

  // Projected shadow cast by the row of bus seats onto the upper aisle floor
  const seatCastShadow = ctx.createLinearGradient(0, 148, 0, 176);
  seatCastShadow.addColorStop(0, 'rgba(5, 8, 18, 0.54)');
  seatCastShadow.addColorStop(0.55, 'rgba(5, 8, 18, 0.24)');
  seatCastShadow.addColorStop(1, 'rgba(5, 8, 18, 0)');
  ctx.fillStyle = seatCastShadow;
  ctx.fillRect(0, 148, W, 28);

  // Projected shadow along bottom foreground edge onto the lower aisle floor
  const fgCastShadow = ctx.createLinearGradient(0, 212, 0, 236);
  fgCastShadow.addColorStop(0, 'rgba(5, 8, 18, 0)');
  fgCastShadow.addColorStop(0.6, 'rgba(5, 8, 18, 0.28)');
  fgCastShadow.addColorStop(1, 'rgba(5, 8, 18, 0.56)');
  ctx.fillStyle = fgCastShadow;
  ctx.fillRect(0, 212, W, 24);

  // Crisp top/bottom yellow aisle curb strips
  pxBlockShaded(ctx, -4, 146, W + 8, 4, '#facc15', '#ca8a04', '#fef08a');
  pxBlockShaded(ctx, -4, 234, W + 8, 4, '#facc15', '#ca8a04', '#fef08a');

  // Subtle floor inspection hatches
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.2;
  for (let hx = 40 - (camX % 180); hx < W; hx += 180) {
    ctx.strokeRect(px(hx), 174, 48, 28);
  }

  // 6. END-OF-BUS: CONDUCTOR, TURNSTILE (3-ARM ROTOR), VALIDATOR & SINGLE EXIT DOOR
  const turnX = px(line.turnstileX - camX);
  if (turnX > -60 && turnX < W + 60) {
    // Yellow floor threshold stripes right at the turnstile entry (matching reference image!)
    for (let s = 0; s < 4; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#facc15' : '#090d16';
      ctx.fillRect(turnX - 6 + s * 6, 214, 5, 18);
    }

    drawTurnstileConductor(ctx, turnX, time);
    pxBlockShaded(ctx, turnX - 8, 118, 16, 118, '#64748b', '#334155', '#94a3b8');
    pxBlockShaded(ctx, turnX - 10, 142, 20, 9, '#facc15', '#ca8a04', '#fef08a');

    // Classic 3-arm metallic chrome turnstile rotor bars (spins smoothly when crossed!)
    const isSpinning = turnstileSpinProgress > 0 && turnstileSpinProgress < 1;
    const baseAngle = isSpinning
      ? turnstileSpinProgress * Math.PI * 2.66
      : turnstileCleared && turnstileSpinProgress >= 1
        ? (Math.PI * 2) / 3
        : 0;
    const hubX = turnX - 2;
    const hubY = 154;

    if (isSpinning) {
      // Crisp 16-bit rotation motion trail arc around hub
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hubX, hubY, 17, baseAngle - 1.2, baseAngle);
      ctx.stroke();
    }

    for (let arm = 0; arm < 3; arm++) {
      const ang = baseAngle + (arm * Math.PI * 2) / 3;
      const armEx = hubX + Math.cos(ang) * 14;
      const armEy = hubY + 12 + Math.sin(ang) * 10;
      pxLimb(
        ctx,
        hubX,
        hubY,
        armEx,
        armEy,
        3,
        isSpinning ? '#e2e8f0' : '#cbd5e1',
        '#64748b'
      );
    }
    pxRect(ctx, hubX - 5, hubY - 3, 10, 6, '#e2e8f0', '#090d16', 1.1);

    if (!turnstileCleared) {
      pxRect(ctx, turnX - 3, 150, 6, 82, '#ef4444', '#090d16', 1.4);
      pxRect(ctx, turnX - 7, 178, 14, 9, '#facc15', '#090d16', 1.4);
    } else {
      const flashGreen = isSpinning && Math.floor(time * 16) % 2 === 0;
      pxRect(ctx, turnX - 4, 122, 8, 8, flashGreen ? '#fde047' : '#10b981', '#090d16', 1.4);
      // Animated green/gold forward chevrons showing crossed / clear turnstile passage
      const arrowShift = Math.floor(time * 8) % 3;
      for (let c = 0; c < 2; c++) {
        const ax = turnX + 10 + c * 6 + arrowShift * 2;
        ctx.fillStyle = isSpinning ? '#fde047' : '#34d399';
        ctx.fillRect(ax, 146, 3, 2);
        ctx.fillRect(ax + 2, 148, 3, 2);
        ctx.fillRect(ax, 150, 3, 2);
      }
    }
  }

  const valX = px(line.validatorX - camX);
  if (valX > -40 && valX < W + 40) {
    pxBlockShaded(ctx, valX - 3, 22, 6, 128, '#facc15', '#ca8a04', '#fef08a');
    pxRect(ctx, valX - 13, 96, 26, 42, '#090d16', '#020617', 1.5);
    pxRect(ctx, valX - 10, 99, 20, 36, '#eab308', '#090d16', 1.1);
    pxRect(ctx, valX - 8, 102, 16, 29, '#1e293b', '#090d16', 1.1);
    const screenColor = ticketValidated
      ? '#10b981'
      : Math.floor(time * 4) % 2 === 0
        ? '#bae6fd'
        : '#7dd3fc';
    pxRect(ctx, valX - 6, 105, 12, 11, screenColor, '#090d16', 1);
    pxRect(ctx, valX - 5, 122, 4, 4, ticketValidated ? '#22c55e' : '#ef4444', '#090d16', 0.8);
    pxRect(ctx, valX + 1, 122, 4, 4, ticketValidated ? '#22c55e' : '#facc15', '#090d16', 0.8);
  }

  // Interactive Mid-Bus STOP Button / Cord ("Sinal de Parada")
  const stopX = px(line.stopCordX - camX);
  if (stopX > -40 && stopX < W + 40) {
    pxBlockShaded(ctx, stopX - 2.5, 22, 5, 126, '#facc15', '#ca8a04', '#fef08a');
    pxRect(ctx, stopX - 7, 94, 14, 22, '#0f172a', '#020617', 1.3);
    const btnBlink = stopButtonReady && Math.floor(time * 5) % 2 === 0;
    pxRect(
      ctx,
      stopX - 4,
      98,
      8,
      9,
      stopButtonReady ? (btnBlink ? '#ef4444' : '#f97316') : '#475569',
      '#020617',
      1.1
    );
    ctx.fillStyle = stopButtonReady ? '#fef08a' : '#94a3b8';
    ctx.font = 'bold 4.2px monospace';
    ctx.fillText('STOP', stopX - 5.5, 113);
  }

  const doorX = px(line.exitDoorX - camX);
  if (doorX > -60 && doorX < W + 60) {
    const doorOpen = turnstileCleared;
    // Yellow hazard threshold stripes on floor by exit door
    for (let s = 0; s < 5; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#facc15' : '#090d16';
      ctx.fillRect(doorX - 18 + s * 8, 149, 8, 16);
    }

    pxRect(ctx, doorX - 20, 44, 48, 104, '#090d16');
    if (doorOpen) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(doorX - 16, 48, 40, 98);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(doorX - 16, 114, 40, 32);
      pxBlockShaded(ctx, doorX - 19, 48, 7, 98, '#facc15', '#ca8a04');
      pxBlockShaded(ctx, doorX + 20, 48, 7, 98, '#facc15', '#ca8a04');
      pxRect(ctx, doorX - 15, 30, 38, 12, '#10b981', '#090d16', 1.4);
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 7px monospace';
      ctx.fillText('SAÍDA', doorX - 11, 38.5);
    } else {
      pxBlockShaded(ctx, doorX - 16, 48, 19, 98, '#1e3a8a', '#0f172a', '#2563eb');
      pxBlockShaded(ctx, doorX + 5, 48, 19, 98, '#1e3a8a', '#0f172a', '#2563eb');
      pxRect(ctx, doorX - 14, 52, 15, 48, '#0b101d', '#090d16', 1.1);
      pxRect(ctx, doorX + 7, 52, 15, 48, '#0b101d', '#090d16', 1.1);
    }
  }

  // 7. BOTTOM FOREGROUND EDGE: DARK BUS SKIRT + FOREGROUND SEAT & PASSENGER SILHOUETTES
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 237, W, 33);

  const fgSeatPattern = getBayerPattern(ctx, '#1e3a8a', '#0f172a', 4);
  const fgStep = line.lineNumber === 1 ? 186 : line.lineNumber === 2 ? 128 : 88;
  for (let fg = -((camX * 1.18) % fgStep); fg < W + 70; fg += fgStep) {
    const fx = px(fg);
    const fgIdx = Math.abs(Math.floor((fg + camX * 1.18) / fgStep));
    // Foreground dark blue seat tops peeking from bottom frame
    pxRect(ctx, fx + 24, 244, 34, 26, fgSeatPattern, '#020617', 1.5);
    pxRect(ctx, fx + 28, 241, 26, 6, '#334155', '#020617', 1.2);

    // Foreground passenger silhouettes (muted/dark below combat aisle, denser on higher lines)
    if (fgIdx % 2 === 0) {
      pxBlockShaded(ctx, fx + 10, 243, 15, 16, '#9c623b', '#5c341d');
      pxRect(ctx, fx + 9, 239, 17, 9, '#111528', '#020617', 1.2);
      pxRect(ctx, fx + 6, 256, 24, 14, '#1e293b', '#020617', 1.2);
    } else {
      pxBlockShaded(ctx, fx + 64, 246, 14, 14, '#7c4a2d', '#452412');
      pxRect(ctx, fx + 63, 242, 17, 7, '#1d4ed8', '#020617', 1.2);
      pxRect(ctx, fx + 74, 246, 9, 3, '#1e3a8a', '#020617', 1);
      pxRect(ctx, fx + 59, 257, 25, 13, '#334155', '#020617', 1.2);
    }

    if (line.lineNumber === 3 && fgIdx % 2 === 0) {
      // Extra standing/seated foreground silhouette on peak Line 3
      pxBlockShaded(ctx, fx + 50, 244, 14, 14, '#b97b50', '#6d3e1e');
      pxRect(ctx, fx + 49, 240, 16, 7, '#334155', '#020617', 1.2);
      pxRect(ctx, fx + 46, 256, 22, 14, '#0f172a', '#020617', 1.2);
    }
  }

  // 8. Express Bus Wind Streaks
  if (expressWindActive) {
    ctx.save();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
    for (let i = 0; i < 6; i++) {
      const wx = px(((time * 380 + i * 95) % (W + 80)) - 60);
      const wy = 115 + i * 21;
      ctx.fillRect(wx, wy, 36, 1.5);
    }
    ctx.restore();
  }
}

export function drawVectorForegroundPoles(ctx: CanvasRenderingContext2D, camX: number) {
  const W = 480;
  for (let fx = -(camX % 210); fx < W; fx += 210) {
    pxBlockShaded(ctx, fx + 30, 232, 5, 14, '#facc15', '#ca8a04', '#fef08a');
  }
}

export function drawVectorExteriorBus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lineCode: string,
  wheelPhase: number
) {
  ctx.save();
  ctx.translate(px(x), px(y));

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(-104, 12, 208, 8);

  pxBlockShaded(ctx, -100, -48, 200, 58, '#e2e8f0', '#94a3b8', '#ffffff');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(-98, -46, 196, 24);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-98, -22, 72, 30);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(36, -22, 62, 30);
  ctx.fillStyle = '#172554';
  ctx.fillRect(-98, 0, 196, 9);

  // Diagonal transit stripes
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(-14, -22, 10, 30);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-1, -22, 8, 30);
  ctx.fillStyle = '#475569';
  ctx.fillRect(10, -22, 10, 30);

  for (let wx = -92; wx < 56; wx += 24) {
    pxRect(ctx, wx, -44, 20, 18, '#1e3a8a', '#090d16', 1.2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(wx + 2, -42, 16, 4);
  }

  pxRect(ctx, 64, -45, 33, 24, '#334155', '#090d16', 1.4);
  pxRect(ctx, 69, -42, 23, 7, '#064e3b', '#090d16', 1);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText(`L.${lineCode}`, 71, -36.5);

  pxRect(ctx, 92, -5, 7, 5, '#fef08a', '#090d16', 1);
  pxRect(ctx, 64, 1, 30, 6, '#dc2626', '#090d16', 1);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 4.5px monospace';
  ctx.fillText('10.527', 70, 5.5);

  const drawWheel = (wx: number) => {
    fillStrokeCircle(ctx, wx, 10, 10.5, '#090d16', '#020617', 1.5);
    fillStrokeCircle(ctx, wx, 10, 6, '#94a3b8', '#334155', 1.2);
    const lx = Math.cos(wheelPhase) * 2.5;
    const ly = Math.sin(wheelPhase) * 2.5;
    pxRect(ctx, wx + lx - 1, 10 + ly - 1, 3, 3, '#334155');
  };
  drawWheel(-58);
  drawWheel(50);

  ctx.restore();
}

// ============================================================================
// PAUSE MENU CANVAS: PLAYER DORMÍNDO APOIADO NA BARRA DO ÔNIBUS (16-BIT)
// ============================================================================

export function drawPauseSleepingCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  lineNumber: 1 | 2 | 3 = 1,
  skinStyle: PlayerSkinStyle = 'classic'
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Dark nocturnal sky & scrolling city lights outside bus window
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, width, height);

  const skyTop = lineNumber === 2 ? '#110c1c' : '#060a17';
  const skyBot = lineNumber === 2 ? '#241734' : '#0f1b38';
  ctx.fillStyle = skyTop;
  ctx.fillRect(0, 14, width, 34);
  ctx.fillStyle = getBayerPattern(ctx, skyTop, skyBot, 2);
  ctx.fillRect(0, 44, width, 16);
  ctx.fillStyle = skyBot;
  ctx.fillRect(0, 56, width, 24);

  const cityScroll = (time * 24) % 140;
  for (let i = -1; i < 6; i++) {
    const bx = px(i * 36 - (cityScroll % 36));
    const idx = Math.abs(i + Math.floor(cityScroll / 36));
    const bh = 22 + ((idx * 13) % 24);
    pxRect(ctx, bx, 76 - bh, 32, bh + 4, idx % 2 === 0 ? '#0b1122' : '#131d38', '#020617', 1);
    for (let wy = 76 - bh + 5; wy < 68; wy += 7) {
      for (let wx = bx + 4; wx < bx + 26; wx += 7) {
        if ((idx + wx + wy) % 3 === 0) {
          ctx.fillStyle = (wx + wy) % 2 === 0 ? '#f59e0b' : '#fde047';
          ctx.fillRect(wx, wy, 3, 3);
        }
      }
    }
  }

  // Soft diagonal nocturnal window glass gleam
  ctx.fillStyle = getBayerPattern(ctx, 'rgba(0,0,0,0)', 'rgba(147, 197, 253, 0.16)', 2);
  ctx.beginPath();
  ctx.moveTo(32, 14);
  ctx.lineTo(48, 14);
  ctx.lineTo(30, 76);
  ctx.lineTo(14, 76);
  ctx.closePath();
  ctx.fill();

  // 2. Interior dark ceiling, fluorescent lamp glow & horizontal yellow handrail
  ctx.fillStyle = '#141b2d';
  ctx.fillRect(0, 0, width, 16);
  pxRect(ctx, width * 0.25, 3, 46, 7, '#1e293b', '#090d16', 1);
  pxRect(ctx, width * 0.25 + 3, 5, 40, 3, '#bae6fd');

  // Subtle projected light cone
  const coneGrad = ctx.createLinearGradient(width * 0.4, 10, width * 0.4, height);
  coneGrad.addColorStop(0, 'rgba(186, 230, 253, 0.16)');
  coneGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = coneGrad;
  ctx.fillRect(18, 10, width - 36, height - 10);

  // Top dark window rubber sill + lower bus interior wall
  pxRect(ctx, 0, 14, width, 3, '#090d16');
  pxRect(ctx, 0, 75, width, 4, '#090d16');
  ctx.fillStyle = '#1b2438';
  ctx.fillRect(0, 79, width, 18);

  // Royal-blue patterned bus seat on the right
  const seatPattern = getBayerPattern(ctx, '#1e40af', '#172554', 4);
  pxBlockShaded(ctx, width - 66, 78, 26, 7, '#475569', '#1e293b', '#64748b');
  pxRect(ctx, width - 70, 84, 34, 24, seatPattern, '#090d16', 1.4);
  pxRect(ctx, width - 72, 106, 38, 10, '#1d4ed8', '#090d16', 1.4);

  // 3. Bus aisle slate floor with yellow curb strip
  ctx.fillStyle = getBayerPattern(ctx, '#475569', '#5b6b84', 4);
  ctx.fillRect(0, 108, width, height - 108);
  pxBlockShaded(ctx, -2, 107, width + 4, 3, '#facc15', '#ca8a04', '#fef08a');

  // Subtle bus vibration sway (1px rhythmic engine idle)
  const busIdleY = Math.floor(time * 4) % 2 === 0 ? 0 : 0.6;
  const breath = Math.floor(time * 1.6) % 2 === 0 ? 0 : 1;

  // 4. Overhead horizontal yellow handrail & swaying strap
  const poleX = px(width * 0.44);
  pxBlockShaded(ctx, -2, 14, width + 4, 5, '#facc15', '#ca8a04', '#fef08a');
  pxBlockShaded(ctx, -2, 46, width + 4, 4, '#facc15', '#ca8a04', '#fef08a');

  const strapX = poleX + 38;
  const sway = Math.round(Math.sin(time * 1.9));
  pxRect(ctx, strapX - 3, 45, 6, 5, '#090d16');
  pxRect(ctx, strapX - 1, 50, 2, 4, '#1e293b');
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(strapX, 54);
  ctx.lineTo(strapX - 4 + sway, 61);
  ctx.lineTo(strapX + 4 + sway, 61);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 5. Vivid Yellow Vertical Grab Pole ("Barra do Ônibus") behind/next to player
  pxBlockShaded(ctx, poleX - 3, 14, 7, 98, '#facc15', '#ca8a04', '#fef08a');
  pxRect(ctx, poleX - 5, 14, 11, 5, '#090d16');
  pxRect(ctx, poleX - 5, 45, 11, 5, '#090d16');

  // 6. Player asleep leaning against the yellow vertical grab pole!
  const pxBaseX = poleX + 10;
  const pxBaseY = 114 + busIdleY;

  // Floor shadow
  ctx.fillStyle = 'rgba(5, 8, 18, 0.56)';
  ctx.fillRect(pxBaseX - 13, pxBaseY - 2, 26, 4);

  const skinMap: Record<
    PlayerSkinStyle,
    {
      shirt: string;
      shirtSh: string;
      hi: string;
      tie: string;
      bag: string;
      bagSh: string;
      pants1: string;
      pants2: string;
      visor?: string;
      senai?: boolean;
      suit?: boolean;
      ninja?: boolean;
    }
  > = {
    classic: {
      shirt: '#f1f5f9',
      shirtSh: '#94a3b8',
      hi: '#ffffff',
      tie: '#dc2626',
      bag: '#1d4ed8',
      bagSh: '#0f172a',
      pants1: '#3b4a7a',
      pants2: '#5a6ca6',
    },
    menor_aprendiz: {
      shirt: '#f8fafc',
      shirtSh: '#cbd5e1',
      hi: '#ffffff',
      tie: '#dc2626',
      bag: '#1e3a8a',
      bagSh: '#090d16',
      pants1: '#172554',
      pants2: '#1e3a8a',
      senai: true,
    },
    estagiario_chefe: {
      shirt: '#1e293b',
      shirtSh: '#0f172a',
      hi: '#475569',
      tie: '#b91c1c',
      bag: '#0f172a',
      bagSh: '#020617',
      pants1: '#0f172a',
      pants2: '#1e293b',
      suit: true,
    },
    estagiario_ninja: {
      shirt: '#0f172a',
      shirtSh: '#020617',
      hi: '#334155',
      tie: '#dc2626',
      bag: '#1e293b',
      bagSh: '#020617',
      pants1: '#090d16',
      pants2: '#1e293b',
      ninja: true,
    },
    golden_exec: {
      shirt: '#475569',
      shirtSh: '#1e293b',
      hi: '#94a3b8',
      tie: '#facc15',
      bag: '#78350f',
      bagSh: '#451a03',
      pants1: '#1e293b',
      pants2: '#334155',
      suit: true,
    },
    night_brawler: {
      shirt: '#1e293b',
      shirtSh: '#090d16',
      hi: '#475569',
      tie: '#ef4444',
      bag: '#0f172a',
      bagSh: '#020617',
      pants1: '#0f172a',
      pants2: '#1e293b',
    },
    cyber_rush: {
      shirt: '#0f172a',
      shirtSh: '#020617',
      hi: '#1e3a8a',
      tie: '#06b6d4',
      bag: '#0e7490',
      bagSh: '#083344',
      pants1: '#082f49',
      pants2: '#0e7490',
      visor: '#22d3ee',
    },
    motoboy_turbinado: {
      shirt: '#22c55e',
      shirtSh: '#15803d',
      hi: '#86efac',
      tie: '#f97316',
      bag: '#ea580c',
      bagSh: '#9a3412',
      pants1: '#0f172a',
      pants2: '#1e293b',
      visor: '#facc15',
    },
  };
  const pal = skinMap[skinStyle];

  ctx.save();
  ctx.translate(px(pxBaseX), px(pxBaseY));

  // Crossed/relaxed resting legs leaning back toward the pole
  pxLimb(ctx, -3, -17, -7, -9, 5.5, pal.pants1, '#090d16');
  pxLimb(ctx, -7, -9, -8, -2, 5.2, pal.pants1, '#090d16');
  pxRect(ctx, -11, -3, 8, 4, pal.suit || pal.ninja ? '#18181b' : '#f1f5f9', '#090d16', 1.1);

  pxLimb(ctx, 2, -17, 6, -9, 5.5, pal.pants2, pal.pants1);
  pxLimb(ctx, 6, -9, 3, -2, 5.2, pal.pants2, pal.pants1);
  pxRect(ctx, 1, -3, 8, 4, pal.suit || pal.ninja ? '#18181b' : '#f1f5f9', '#090d16', 1.1);

  // Torso leaning softly against the yellow pole on the left (-x)
  const torsoTop = -33 + breath;
  // Backpack slung against chest/side
  pxBlockShaded(ctx, 3, torsoTop + 2, 7, 13, pal.bag, pal.bagSh);

  // Shirt & details
  pxBlockShaded(ctx, -8, torsoTop, 14, 16, pal.shirt, pal.shirtSh, pal.hi);
  if (pal.suit) {
    pxRect(ctx, -3, torsoTop + 1, 5, 7, '#f8fafc');
  } else if (pal.senai) {
    pxRect(ctx, -1, torsoTop + 4, 6, 3, '#dc2626', '#991b1b', 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, torsoTop + 5, 4, 1);
  }
  pxRect(ctx, -8, -19 + breath, 14, 3, pal.ninja ? '#991b1b' : '#0f172a');
  if (!pal.senai && !pal.ninja) {
    pxRect(ctx, -2, torsoTop + 3, 3, 9, pal.tie, '#090d16', 0.9);
  }

  // Left arm wrapped/resting upward holding the yellow pole while snoozing
  pxLimb(ctx, -6, torsoTop + 3, -10, torsoTop - 4, 4.4, pal.shirt, pal.shirtSh);
  pxRect(ctx, -13, torsoTop - 7, 5, 5, '#f1b586', '#090d16', 1.1);

  // Right arm resting loosely across torso
  pxLimb(ctx, 3, torsoTop + 5, -1, torsoTop + 11, 4.2, '#f1b586', '#c68353');

  // Head tilted slightly back onto the pole, eyes peacefully closed + slicked topete lambido!
  const headY = -43 + breath;
  pxBlockShaded(ctx, -8, headY, 11, 11, '#f1b586', '#c68353');
  if (pal.ninja) {
    pxRect(ctx, -8, headY + 6, 11, 5, '#1e293b', '#090d16', 0.9);
  }
  // Slicked-back topete lambido hair
  ctx.fillStyle = '#0f1326';
  ctx.beginPath();
  ctx.moveTo(-9, headY + 4);
  ctx.lineTo(-10, headY);
  ctx.lineTo(-6, headY - 3);
  ctx.lineTo(1, headY - 5);
  ctx.lineTo(5, headY - 4);
  ctx.lineTo(4, headY + 1);
  ctx.lineTo(-7, headY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.fillRect(-5, headY - 3, 8, 2);

  if (pal.ninja) {
    // Red tie headband on forehead with trailing knot
    pxRect(ctx, -9, headY + 1, 12, 2.5, '#dc2626', '#090d16', 0.9);
    pxRect(ctx, -12, headY + 1, 4, 3, '#991b1b', '#090d16', 0.8);
    pxRect(ctx, -15, headY + 3, 4, 2, '#dc2626', '#090d16', 0.8);
  }

  if (pal.visor) {
    pxRect(ctx, -6, headY + 4, 7, 2, '#0e7490', '#090d16', 0.8);
  } else {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-3, headY + 5, 4, 1.5);
  }
  if (!pal.ninja) {
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-1, headY + 8, 2, 2);
  }

  // 7. Animated floating pixel "Zzz" bubbles!
  const zCycle = (time * 0.9) % 1;
  const zs = [
    { off: 0, label: 'z', size: 6.5 },
    { off: 0.34, label: 'Z', size: 8 },
    { off: 0.68, label: 'z', size: 9.5 },
  ];
  for (let i = 0; i < zs.length; i++) {
    const p = (zCycle + zs[i].off) % 1;
    const zx = px(4 + Math.sin(p * 6 + i) * 3 + p * 12);
    const zy = px(headY - 4 - p * 22);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p < 0.2 ? p * 5 : 1 - (p - 0.2) * 1.1));
    ctx.font = `bold ${zs[i].size}px monospace`;
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2;
    ctx.strokeText(zs[i].label, zx, zy);
    ctx.fillStyle = '#fde047';
    ctx.fillText(zs[i].label, zx, zy);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// GAME OVER CANVAS: PLAYER CHORANDO NO PONTO DE ÔNIBUS NA CHUVA (16-BIT)
// ============================================================================

export function drawGameOverCryingCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  lineNumber: 1 | 2 | 3 = 1,
  skinStyle: PlayerSkinStyle = 'classic'
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Stormy nocturnal urban backdrop
  ctx.fillStyle = '#040711';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = getBayerPattern(ctx, '#060c1d', '#0d1836', 2);
  ctx.fillRect(0, 18, width, 66);

  // Distant dim city skyline silhouettes
  for (let i = 0; i < 8; i++) {
    const bh = 22 + ((i * 17) % 26);
    pxRect(ctx, i * 30 - 4, 86 - bh, 26, bh, '#0b1224', '#020617', 1);
  }

  // Flickering streetlamp + amber puddle cone
  const lampFlicker = Math.sin(time * 21) > -0.75 ? 1 : 0.4;
  pxRect(ctx, 28, 12, 4, 88, '#1e293b', '#020617', 1);
  pxRect(ctx, 25, 10, 18, 5, '#334155', '#020617', 1);
  ctx.fillStyle = `rgba(251, 191, 36, ${(0.18 * lampFlicker).toFixed(2)})`;
  ctx.beginPath();
  ctx.moveTo(30, 15);
  ctx.lineTo(44, 15);
  ctx.lineTo(74, 114);
  ctx.lineTo(8, 114);
  ctx.closePath();
  ctx.fill();

  // Bus departing into the distance on the right with glowing red taillights
  const busOut = Math.min(34, (time * 12) % 44);
  const bx = px(158 + busOut * 0.45);
  pxRect(ctx, bx, 64, 38, 22, '#1e3a8a', '#020617', 1.2);
  pxRect(ctx, bx + 4, 67, 30, 8, '#0b101d', '#020617', 1);
  pxRect(ctx, bx + 3, 79, 5, 4, '#ef4444');
  pxRect(ctx, bx + 30, 79, 5, 4, '#ef4444');
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText(lineNumber === 3 ? '303' : lineNumber === 2 ? '202' : '101', bx + 13, 73);

  // Wet sidewalk & rain puddles
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 96, width, height - 96);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 95, width, 2);
  ctx.fillStyle = '#38bdf8';
  const ripple = Math.floor(time * 6) % 2;
  ctx.fillRect(46 - ripple, 114, 16 + ripple * 2, 1.5);
  ctx.fillRect(142 + ripple, 117, 14 - ripple, 1.5);

  // Bus stop sign & bench ("PONTO")
  pxRect(ctx, 188, 24, 3, 72, '#475569', '#020617', 1);
  pxRect(ctx, 174, 20, 26, 12, '#0284c7', '#090d16', 1.1);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 5.5px monospace';
  ctx.fillText('PONTO', 178, 28);

  const benchX = 72;
  const benchY = 82;
  pxRect(ctx, benchX, benchY, 64, 5, '#475569', '#020617', 1.2);
  pxRect(ctx, benchX + 6, benchY + 5, 5, 13, '#334155', '#020617', 1);
  pxRect(ctx, benchX + 52, benchY + 5, 5, 13, '#334155', '#020617', 1);

  // Player skin palette
  const skinColors: Record<
    PlayerSkinStyle,
    { shirt: string; shirtSh: string; pants: string; tie: string; bag: string; ninja?: boolean; senai?: boolean; visor?: string }
  > = {
    classic: { shirt: '#f1f5f9', shirtSh: '#94a3b8', pants: '#1e3a8a', tie: '#dc2626', bag: '#1d4ed8' },
    menor_aprendiz: { shirt: '#f8fafc', shirtSh: '#cbd5e1', pants: '#172554', tie: '#dc2626', bag: '#1e3a8a', senai: true },
    estagiario_chefe: { shirt: '#1e293b', shirtSh: '#0f172a', pants: '#0f172a', tie: '#b91c1c', bag: '#0f172a' },
    estagiario_ninja: { shirt: '#0f172a', shirtSh: '#020617', pants: '#090d16', tie: '#dc2626', bag: '#1e293b', ninja: true },
    motoboy_turbinado: { shirt: '#22c55e', shirtSh: '#15803d', pants: '#0f172a', tie: '#f97316', bag: '#ea580c', visor: '#facc15' },
    golden_exec: { shirt: '#475569', shirtSh: '#1e293b', pants: '#1e293b', tie: '#facc15', bag: '#78350f' },
    night_brawler: { shirt: '#1e293b', shirtSh: '#090d16', pants: '#0f172a', tie: '#ef4444', bag: '#0f172a' },
    cyber_rush: { shirt: '#0f172a', shirtSh: '#020617', pants: '#082f49', tie: '#06b6d4', bag: '#0e7490', visor: '#22d3ee' },
  };
  const pal = skinColors[skinStyle];

  // Slumped sobbing player sitting on the bench!
  const sob = Math.floor(time * 9) % 2 === 0 ? 0 : 1;
  const cx = 104;
  const cy = benchY + sob;

  // Backpack resting sadly beside player on the bench
  pxBlockShaded(ctx, benchX + 8, benchY - 12, 12, 12, pal.bag, '#090d16');
  pxRect(ctx, benchX + 10, benchY - 7, 8, 5, pal.tie, '#090d16', 0.9);

  // Seated bent legs
  pxLimb(ctx, cx - 3, cy - 2, cx - 10, cy + 12, 5.5, pal.pants, '#020617');
  pxLimb(ctx, cx + 4, cy - 2, cx + 10, cy + 12, 5.5, pal.pants, '#020617');
  pxRect(ctx, cx - 13, cy + 10, 8, 4, '#cbd5e1', '#090d16', 1.1);
  pxRect(ctx, cx + 6, cy + 10, 8, 4, '#cbd5e1', '#090d16', 1.1);

  // Hunched torso
  pxBlockShaded(ctx, cx - 8, cy - 17, 16, 15, pal.shirt, pal.shirtSh);
  if (pal.senai) {
    pxRect(ctx, cx - 2, cy - 12, 6, 3, '#dc2626');
  } else if (!pal.ninja) {
    pxRect(ctx, cx - 1, cy - 15, 3, 9, pal.tie, '#090d16', 0.8);
  }

  // Head tilted down with slicked topete lambido
  const hy = cy - 26;
  pxBlockShaded(ctx, cx - 6, hy, 12, 11, '#f1b586', '#c68353');
  if (pal.ninja) {
    pxRect(ctx, cx - 6, hy + 6, 12, 5, '#1e293b', '#090d16', 0.9);
  }
  ctx.fillStyle = '#0f1326';
  ctx.beginPath();
  ctx.moveTo(cx - 7, hy + 4);
  ctx.lineTo(cx - 7, hy - 1);
  ctx.lineTo(cx - 3, hy - 4);
  ctx.lineTo(cx + 5, hy - 5);
  ctx.lineTo(cx + 7, hy + 1);
  ctx.lineTo(cx - 5, hy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.fillRect(cx - 3, hy - 3, 8, 2);

  if (pal.ninja) {
    pxRect(ctx, cx - 7, hy + 1, 14, 2.5, '#dc2626', '#090d16', 0.8);
  }

  // Tightly shut crying eyes (`><` / squinted shut) + trembling frown
  pxRect(ctx, cx - 4, hy + 4, 3, 1.5, '#090d16');
  pxRect(ctx, cx + 1, hy + 4, 3, 1.5, '#090d16');
  if (!pal.ninja) {
    pxRect(ctx, cx - 2, hy + 8, 4, 2, '#991b1b');
  }

  // Hands wiping eyes / knees
  pxLimb(ctx, cx - 7, cy - 13, cx - 6, hy + 6, 4, pal.shirtSh, '#090d16');
  pxLimb(ctx, cx + 7, cy - 13, cx + 6, hy + 6, 4, pal.shirt, '#090d16');

  // Streaming cartoon 16-bit pixel tears pouring from both eyes!
  for (let side = -1; side <= 1; side += 2) {
    const eyeX = cx + side * 3;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(eyeX - 1, hy + 5, 2, 5);
    for (let d = 0; d < 3; d++) {
      const dropP = (time * 2.8 + d * 0.34 + (side > 0 ? 0.15 : 0)) % 1;
      const dx = px(eyeX + side * dropP * 5);
      const dy = px(hy + 7 + dropP * 26);
      pxRect(ctx, dx - 1, dy - 1, 2.5, 3, '#7dd3fc', '#0284c7', 0.6);
    }
  }

  // Subtle pixel rain streaks across the whole frame
  ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
  for (let r = 0; r < 18; r++) {
    const rx = px(((r * 37 + time * 55) % (width + 20)) - 10);
    const ry = px((r * 29 + time * 190) % height);
    ctx.fillRect(rx, ry, 1, 6);
  }

  ctx.restore();
}
