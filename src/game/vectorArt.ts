import { getStandingCommutersAtBay, isBusSeatOccupied } from './seats';
import {
  DEFAULT_GARAGE_CONFIG,
  GarageConfig,
  GarageHairStyle,
  getGarageSwatchDef,
  PlayerSkinStyle,
} from './shop';
import {
  BossFinisherKind,
  BossMotoristaAttackKind,
  EnemyType,
  ImpactFlashKind,
  ItemType,
  LineDefinition,
  Particle,
} from './types';

// ============================================================================
// 16-BIT PIXEL ART & BAYER DITHERING UTILITIES
// ============================================================================

const contextPatternCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, CanvasPattern | null>
>();

const contextBusShadowCache = new WeakMap<
  CanvasRenderingContext2D,
  {
    seatCastShadow: CanvasGradient;
    fgCastShadow: CanvasGradient;
    coneGrad: CanvasGradient;
  }
>();

function getBusInteriorGradients(ctx: CanvasRenderingContext2D) {
  let cached = contextBusShadowCache.get(ctx);
  if (!cached) {
    const seatCastShadow = ctx.createLinearGradient(0, 148, 0, 178);
    seatCastShadow.addColorStop(0, 'rgba(4, 7, 16, 0.68)');
    seatCastShadow.addColorStop(0.55, 'rgba(5, 8, 18, 0.30)');
    seatCastShadow.addColorStop(1, 'rgba(5, 8, 18, 0)');

    const fgCastShadow = ctx.createLinearGradient(0, 210, 0, 236);
    fgCastShadow.addColorStop(0, 'rgba(5, 8, 18, 0)');
    fgCastShadow.addColorStop(0.6, 'rgba(4, 7, 16, 0.34)');
    fgCastShadow.addColorStop(1, 'rgba(4, 7, 16, 0.70)');

    const coneGrad = ctx.createLinearGradient(0, 13, 0, 146);
    coneGrad.addColorStop(0, 'rgba(103, 232, 249, 0.96)');
    coneGrad.addColorStop(0.52, 'rgba(56, 189, 248, 0.42)');
    coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

    cached = { seatCastShadow, fgCastShadow, coneGrad };
    contextBusShadowCache.set(ctx, cached);
  }
  return cached;
}

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
  let patternCache = contextPatternCache.get(ctx);
  if (!patternCache) {
    patternCache = new Map<string, CanvasPattern | null>();
    contextPatternCache.set(ctx, patternCache);
  }
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
 * Draws a crisp 16-bit cel-shaded tapered limb with dark outline and clean shadow side.
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
  const ax = x1;
  const ay = y1;
  const bx = x2;
  const by = y2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pass 1: Crisp dark arcade outline
  ctx.strokeStyle = outline;
  ctx.lineWidth = thickness + 2.4;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Pass 2: Base tone fill
  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Pass 3: Clean cel-shaded shadow band along lower/inner edge
  if (shadow && thickness >= 2.8 && len > 0.5) {
    const nx = -dy / len;
    const ny = dx / len;
    // Bias shadow downward or toward rear (-x)
    const sign = ny >= 0 ? 1 : -1;
    const shift = Math.max(0.6, thickness * 0.19);
    const sx = nx * sign * shift;
    const sy = Math.max(Math.abs(ny) * shift, thickness * 0.14);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = fill;
    ctx.lineWidth = thickness;
    ctx.stroke();

    // Draw shadow offset inside outer stroke by narrowing slightly
    ctx.strokeStyle = shadow;
    ctx.lineWidth = Math.max(1.4, thickness * 0.44);
    ctx.beginPath();
    ctx.moveTo(ax + sx * 0.7, ay + sy * 0.7);
    ctx.lineTo(bx + sx * 0.7, by + sy * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function celRolledCuff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  width: number,
  base: string,
  shadow: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = base;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.roundRect(-2.4, -width * 0.56, 4.8, width * 1.12, 1.4);
  ctx.fill();
  ctx.fillStyle = shadow;
  ctx.fillRect(-1.8, width * 0.1, 3.6, width * 0.4);
  ctx.stroke();
  ctx.restore();
}

function celFist(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  shadow: string,
  outline = '#090d16'
) {
  const r = size * 0.52;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - r, y - r * 0.9, size, size * 0.92, r * 0.55);
  ctx.fillStyle = fill;
  ctx.fill();
  // Bottom/knuckle cel shadow
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.roundRect(x - r + 0.6, y + r * 0.05, size - 1.2, r * 0.78, r * 0.35);
  ctx.fill();
  // Crisp outline + subtle finger crease
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x - r, y - r * 0.9, size, size * 0.92, r * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.15, y - r * 0.2);
  ctx.lineTo(x + r * 0.45, y - r * 0.2);
  ctx.lineWidth = 0.85;
  ctx.stroke();
  ctx.restore();
}

function celSneaker(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  base: string,
  sole: string,
  accent: string,
  angled = false
) {
  ctx.save();
  ctx.translate(sx, sy);
  if (angled) ctx.rotate(-0.22);

  // Main upper body (low-top athletic canvas sneaker)
  ctx.beginPath();
  ctx.moveTo(-4.8, -3.5);
  ctx.lineTo(1.6, -3.5);
  ctx.quadraticCurveTo(5.6, -2.6, 5.8, -0.4);
  ctx.lineTo(5.8, 1.3);
  ctx.lineTo(-4.8, 1.3);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();

  // Crisp vulcanized midsole along bottom
  ctx.fillStyle = sole;
  ctx.fillRect(-4.4, -0.2, 9.8, 1.4);

  // Classic white/accent toe cap + side stripe / laces
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(2.4, -2.5);
  ctx.quadraticCurveTo(5.5, -2.1, 5.6, -0.2);
  ctx.lineTo(2.4, -0.2);
  ctx.closePath();
  ctx.fill();

  // Tiny lace ticks
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-1.2, -3.1, 1.4, 0.9);
  ctx.fillRect(0.6, -2.8, 1.4, 0.9);

  // Crisp outer shoe silhouette stroke
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(-4.8, -3.5);
  ctx.lineTo(1.6, -3.5);
  ctx.quadraticCurveTo(5.6, -2.6, 5.8, -0.4);
  ctx.lineTo(5.8, 1.3);
  ctx.lineTo(-4.8, 1.3);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function celSandal(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  strapColor: string,
  skinColor: string
) {
  ctx.save();
  ctx.translate(sx, sy);
  // Foot/toes
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(-4, -2.5, 9, 3, 1.4);
  ctx.fill();
  ctx.stroke();
  // Flip-flop sole
  ctx.fillStyle = strapColor;
  ctx.fillRect(-4.5, 0, 10, 1.5);
  ctx.strokeRect(-4.5, 0, 10, 1.5);
  // Diagonal Y-strap
  ctx.strokeStyle = strapColor;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-2, -1.8);
  ctx.lineTo(2.5, -0.2);
  ctx.stroke();
  ctx.restore();
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
// IMPACT FLASH STARBURST (Asymmetric arcade comic starburst w/ sharp rays)
// ============================================================================

export function drawImpactFlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  strong = false,
  options?: {
    kind?: ImpactFlashKind;
    dir?: 1 | -1;
  }
) {
  const cx = px(x);
  const cy = px(y);
  const kind: ImpactFlashKind = options?.kind ?? (strong ? 'heavy' : 'jab');
  const dir: 1 | -1 = options?.dir ?? 1;
  const p = Math.max(0, Math.min(1, progress));
  const isPotent = kind === 'finisher' || kind === 'heavy';
  const fade = isPotent
    ? Math.max(0.05, Math.pow(1 - p, 1.32))
    : p < 0.65
      ? 1
      : Math.max(0.08, 1 - (p - 0.65) / 0.35);

  if (kind === 'blocked') {
    const shrink = p < 0.25 ? 0.72 + (p / 0.25) * 0.38 : Math.max(0.2, 1.1 - p * 0.92);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir * shrink, shrink);
    ctx.globalAlpha = fade * 0.92;

    // Cool steel-cyan guard deflection chevron & diamond shield flash
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5 + p * 4, -1.05, 1.05);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = '#bae6fd';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5.5);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    return;
  }

  const baseScale =
    kind === 'finisher'
      ? 1.54
      : kind === 'heavy'
        ? 1.42
        : kind === 'uppercut'
          ? 1.24
          : kind === 'kick'
            ? 1.16
            : 0.96;
  const shrink = isPotent
    ? p < 0.16
      ? 0.88 + (p / 0.16) * 0.34
      : Math.max(0.14, 1.22 - (p - 0.16) * 1.28)
    : p < 0.24
      ? 0.74 + (p / 0.24) * 0.42
      : Math.max(0.18, 1.16 - p * 0.98);

  ctx.save();
  ctx.translate(cx, cy);
  if (kind === 'uppercut') {
    ctx.scale(dir * baseScale * shrink * 0.92, baseScale * shrink * 1.22);
  } else {
    ctx.scale(dir * baseScale * shrink, baseScale * shrink);
  }
  ctx.globalAlpha = fade;

  // Luminous radial core halo on heavy & finisher impacts (rapidly dissipates)
  if (isPotent && p < 0.52) {
    const coreGlowAlpha = (1 - p / 0.52) * (kind === 'finisher' ? 0.56 : 0.48);
    ctx.save();
    ctx.globalAlpha = coreGlowAlpha;
    ctx.fillStyle = kind === 'finisher' ? '#fde047' : '#fef08a';
    ctx.beginPath();
    ctx.ellipse(2, 0, 15 + p * 6, 11 + p * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Potent shock ring & directional energy transfer cone
  if (kind === 'finisher') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
    ctx.lineWidth = Math.max(1, 2.4 * (1 - p * 0.78));
    ctx.beginPath();
    ctx.arc(0, 0, 11 + p * 14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'heavy') {
    // Forward kinetic punch cone illustrating force transfer into target
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.88)';
    ctx.lineWidth = Math.max(1, 2.2 * (1 - p * 0.8));
    ctx.beginPath();
    ctx.arc(2, 0, 12 + p * 10, -0.95, 0.95);
    ctx.stroke();
  }

  // Slash arc highlight along contact vector
  if (kind === 'kick' || kind === 'finisher') {
    ctx.strokeStyle = kind === 'finisher' ? '#fb923c' : '#7dd3fc';
    ctx.lineWidth = kind === 'finisher' ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.arc(-4, 1, 16, -0.85, 0.75);
    ctx.stroke();
  }

  // Directional speed spikes tailored per attack family
  const streakAngles =
    kind === 'uppercut'
      ? [-2.15, -1.7, -1.25, -0.85, 0.4, 2.55]
      : kind === 'kick'
        ? [-0.9, -0.35, 0.15, 0.65, -2.55, 2.4]
        : kind === 'heavy'
          ? [-0.55, -0.22, 0.0, 0.24, 0.58, -2.6, 2.6]
          : [-2.45, -1.65, -0.65, 0.18, 0.95, 2.2];
  ctx.strokeStyle =
    kind === 'uppercut'
      ? '#38bdf8'
      : kind === 'finisher'
        ? '#ef4444'
        : '#f97316';
  ctx.lineWidth = kind === 'jab' ? 1.2 : isPotent ? 1.8 : 1.5;
  for (let i = 0; i < streakAngles.length; i++) {
    const a = streakAngles[i];
    const r0 = kind === 'jab' ? 7.5 : isPotent ? 8.5 : 9;
    const r1 =
      i % 2 === 0
        ? kind === 'jab'
          ? 16.5
          : isPotent
            ? 25
            : 22
        : kind === 'jab'
          ? 13
          : isPotent
            ? 19.5
            : 17.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }

  // Asymmetrical outer starburst (directional stretch on punches & kicks)
  const rays = kind === 'finisher' ? 16 : kind === 'jab' ? 10 : 14;
  ctx.beginPath();
  for (let i = 0; i < rays; i++) {
    const a = (i * Math.PI * 2) / rays + (kind === 'heavy' ? 0.12 : 0.06);
    const forwardBias =
      Math.cos(a) > 0.28 && kind !== 'uppercut'
        ? isPotent
          ? 1.38
          : 1.18
        : 1;
    const upBias = Math.sin(a) < -0.35 && kind === 'uppercut' ? 1.24 : 1;
    const r =
      (i % 2 === 0 ? (i % 4 === 0 ? 17.5 : 13) : 4.1) * forwardBias * upBias;
    const pxp = Math.cos(a) * r;
    const pyp = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fillStyle = kind === 'uppercut' ? '#fde047' : '#facc15';
  ctx.fill();
  ctx.strokeStyle =
    kind === 'finisher' ? '#dc2626' : kind === 'uppercut' ? '#0284c7' : '#ea580c';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Inner bright lemon starburst
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12 + 0.12;
    const forwardStretch = isPotent && Math.cos(a) > 0.35 ? 1.24 : 1;
    const r = (i % 2 === 0 ? (isPotent ? 12.2 : 11) : 3.2) * forwardStretch;
    const pxp = Math.cos(a) * r;
    const pyp = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fillStyle = '#fef08a';
  ctx.fill();

  // White-hot luminous jagged impact core (enlarged for heavy & finisher)
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const r = i % 2 === 0 ? (isPotent ? 8.2 : 6.5) : isPotent ? 2.8 : 2.0;
    const pxp = Math.cos(a) * r;
    const pyp = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(pxp, pyp);
    else ctx.lineTo(pxp, pyp);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

export function drawGroundShockwave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  color: string,
  strong: boolean,
  maxRadius: number,
  reducedMotion = false
) {
  const p = Math.max(0, Math.min(1, progress));
  const ease = 1 - Math.pow(1 - p, 2.6);
  const rx = Math.max(6, (reducedMotion ? 0.65 : ease) * maxRadius);
  const ry = rx * 0.34;
  const alpha = Math.pow(1 - p, 1.15) * (reducedMotion ? 0.38 : strong ? 0.78 : 0.56);
  if (alpha <= 0.02) return;

  const cx = px(x);
  const cy = px(y);

  ctx.save();
  // Crisp outer 16-bit elliptical shock ring on the floor plane
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = strong ? Math.max(1.2, 2.8 * (1 - p * 0.72)) : Math.max(1, 2.0 * (1 - p * 0.68));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Secondary warm inner pressure ring on strong impacts (zero extra particles)
  if (strong && p < 0.72) {
    ctx.globalAlpha = (1 - p / 0.72) * (reducedMotion ? 0.25 : 0.52);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle white-hot inner floor ripple during early impact frames
  if (p < 0.52) {
    ctx.globalAlpha = (1 - p / 0.52) * (reducedMotion ? 0.3 : 0.65);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4 compact outward floor dust ticks so ground contact reads cleanly without blocking sprites
  if (!reducedMotion) {
    const tickAlpha = (1 - p) * 0.68;
    ctx.globalAlpha = tickAlpha;
    ctx.fillStyle = color;
    ctx.fillRect(px(cx - rx - 1), cy - 1, 2, 1.5);
    ctx.fillRect(px(cx + rx - 1), cy - 1, 2, 1.5);
    ctx.fillRect(cx - 1, px(cy - ry - 1), 2, 1.5);
    ctx.fillRect(cx - 1, px(cy + ry), 2, 1.5);
  }
  ctx.restore();
}

/**
 * Renders 16-bit pixel-aligned hit particles, including stepped metallic sparks
 * with white-hot -> metallic -> ember cooling palettes, stylized kick trails, and tumbling shards.
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

  if (pt.kind === 'kickTrail') {
    const ox = pt.prevX !== undefined ? px(pt.prevX - camX) : px(pt.x - pt.vx * 0.028 - camX);
    const oy =
      pt.prevY !== undefined && pt.prevZ !== undefined
        ? px(pt.prevY - pt.prevZ)
        : px(pt.y - pt.z + pt.vz * 0.028);
    const dx = sx - ox;
    const dy = sy - oy;
    const midX = px(ox + dx * 0.55);
    const midY = px(oy + dy * 0.55);
    const cool = pt.coolColor ?? '#f97316';

    ctx.save();
    ctx.globalAlpha = Math.max(0.15, lifeRatio * 0.92);
    ctx.strokeStyle = cool;
    ctx.lineWidth = pt.size >= 2.8 ? 2.4 : 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    ctx.strokeStyle = pt.color;
    ctx.lineWidth = pt.size >= 2.8 ? 1.8 : 1.4;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    if (age < 0.45) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    ctx.restore();
    return;
  }

  if (pt.kind === 'spark') {
    // Discrete 16-bit palette cooling: white-hot core -> primary metallic -> cooled slag
    const cool = pt.coolColor ?? '#f97316';
    const headColor = age < 0.34 ? '#ffffff' : age < 0.72 ? pt.color : cool;
    const midColor = age < 0.28 ? pt.color : cool;
    const tailColor = cool;

    const ox = pt.prevX !== undefined ? px(pt.prevX - camX) : px(pt.x - pt.vx * 0.024 - camX);
    const oy =
      pt.prevY !== undefined && pt.prevZ !== undefined
        ? px(pt.prevY - pt.prevZ)
        : px(pt.y - pt.z + pt.vz * 0.024);

    const dx = sx - ox;
    const dy = sy - oy;
    const dist = Math.hypot(dx, dy);

    if (dist >= 1.4) {
      const steps = Math.min(5, Math.max(2, Math.round(dist * 0.8)));
      for (let i = 0; i < steps; i++) {
        const f = i / steps;
        const tx = px(ox + dx * f);
        const ty = px(oy + dy * f);
        ctx.fillStyle = i <= 1 ? tailColor : midColor;
        const segSize = i >= steps - 1 && pt.size >= 2.8 && age < 0.45 ? 2 : 1;
        ctx.fillRect(tx, ty, segSize, segSize);
      }
    }

    const headSize = pt.size >= 2.7 && age < 0.55 ? 2 : 1;
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

  // Standard crisp pixel square with subtle dissipation shrink near end of life
  ctx.fillStyle = pt.color;
  const lifeShrink = lifeRatio < 0.3 ? 0.65 : 0.85;
  const sz = Math.max(1, Math.round(pt.size * lifeShrink));
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
  skinStyle: PlayerSkinStyle = 'classic',
  garageConfig?: GarageConfig,
  animDuration?: number,
  comboVisualContext?: {
    prevAnim?: string;
    chainActive?: boolean;
    comboStep?: number;
    caneSpin?: boolean;
  }
) {
  ctx.save();

  // Crisp directional 16-bit cast shadow (grounding fighters cleanly on glossy floor)
  const shadowScale = Math.max(0.48, 1 - z / 115);
  ctx.save();
  ctx.fillStyle = 'rgba(6, 9, 22, 0.66)';
  ctx.beginPath();
  ctx.ellipse(x - 2 * facing, y + 0.5, 16 * shadowScale, 3.8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(6, 9, 22, 0.40)';
  ctx.beginPath();
  ctx.ellipse(x - 5 * facing, y + 1.2, 21 * shadowScale, 2.7 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const auraClock = time > 0 ? time : animTimer;

  if (anim === 'special' || anim === 'soundSpecial') {
    const isSonic = anim === 'soundSpecial';
    const maxSpecT = isSonic ? 0.42 : 0.46;
    const specProg = Math.max(0, Math.min(1, 1 - animTimer / maxSpecT));
    const glowAlpha = Math.sin(specProg * Math.PI) * 0.55 + 0.18;
    const floorGlowR = isSonic ? 38 + specProg * 28 : 28 + specProg * 20;

    // Characteristic floor illumination halo beneath player during Specials
    ctx.save();
    ctx.fillStyle = isSonic
      ? `rgba(56, 189, 248, ${(glowAlpha * 0.48).toFixed(2)})`
      : `rgba(250, 204, 21, ${(glowAlpha * 0.44).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(px(x), px(y), floorGlowR, floorGlowR * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSonic
      ? `rgba(254, 240, 138, ${(glowAlpha * 0.35).toFixed(2)})`
      : `rgba(74, 222, 128, ${(glowAlpha * 0.38).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(px(x), px(y), floorGlowR * 0.58, floorGlowR * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vertical light pillar behind silhouette
    const pillarW = isSonic ? 28 : 22;
    ctx.fillStyle = isSonic
      ? `rgba(56, 189, 248, ${(glowAlpha * 0.22).toFixed(2)})`
      : `rgba(250, 204, 21, ${(glowAlpha * 0.2).toFixed(2)})`;
    ctx.fillRect(px(x - pillarW * 0.5), px(y - z - 56), pillarW, 56);
    ctx.restore();
  }

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

  const isVictoryPose =
    anim === 'victory' ||
    anim === 'victoryTie' ||
    anim === 'victoryBadge' ||
    anim === 'victoryCoffee';

  if (isVictoryPose) {
    // Golden 16-bit victory floor podium/spotlight highlight under player
    const pulse = Math.floor(auraClock * 5) % 2;
    ctx.fillStyle = pulse === 0 ? 'rgba(250, 204, 21, 0.36)' : 'rgba(52, 211, 153, 0.34)';
    ctx.fillRect(px(x - 18), px(y - 3), 36, 7);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px(x - 16), px(y + 3), 32, 2);
  }

  ctx.translate(px(x), px(y - z));
  ctx.scale(facing, 1);

  // Stepped 16-bit frame timing (8-frame walk cycle preserving ~0.4s stride, 2-frame idle breath)
  const walkFrame = ((Math.floor(animTimer * 20) % 8) + 8) % 8;
  const idleFrame = ((Math.floor(auraClock * 3.2) % 2) + 2) % 2;

  const hasExplicitDuration = typeof animDuration === 'number' && animDuration > 0;
  const animProgress = hasExplicitDuration
    ? Math.max(0, Math.min(1, 1 - animTimer / animDuration))
    : 0.48;

  // Special kick (Tecla C) opens in suspended Matrix coil before snapping the flying kick
  const isSpecialCoil = anim === 'special' && animTimer > 0.22;
  const isTrinityCoil = isSpecialCoil;

  const prevComboAnim = comboVisualContext?.prevAnim ?? 'idle';
  const isComboChainActive = Boolean(comboVisualContext?.chainActive);
  const isFinalCaneSpin = Boolean(comboVisualContext?.caneSpin) && anim === 'cane';
  const isComboHoldGuard =
    anim === 'idle' &&
    isComboChainActive &&
    (prevComboAnim === 'punch1' || prevComboAnim === 'punch2' || prevComboAnim === 'kick');

  // Pose-specific body offsets & lean for unmistakable arcade silhouettes
  let bodyDx = 0;
  let bodyDy = 0;
  let leanAngle = 0;

  if (isComboHoldGuard) {
    // Keep protagonist engaged in coiled martial-arts follow-through between chained hits (never neutral)
    const holdBob = Math.sin(auraClock * 15) > 0 ? 0.5 : 0;
    bodyDx = prevComboAnim === 'punch2' ? 2.8 : prevComboAnim === 'punch1' ? 2.2 : 1.5;
    bodyDy = 1.6 + holdBob;
    leanAngle = prevComboAnim === 'kick' ? -0.04 : 0.1;
  } else if (anim === 'idle') {
    bodyDy = idleFrame === 1 ? 1 : 0;
  } else if (anim === 'fightStance') {
    bodyDx = 1;
    bodyDy = Math.sin(auraClock * 9.5) > 0 ? 2 : 0;
    leanAngle = 0.09;
  } else if (anim === 'victory') {
    bodyDy = idleFrame === 1 ? -1 : 0;
    leanAngle = -0.04;
  } else if (anim === 'victoryTie') {
    bodyDx = -1;
    bodyDy = idleFrame === 1 ? 0.5 : 0;
    leanAngle = -0.08;
  } else if (anim === 'victoryBadge') {
    bodyDx = 1;
    bodyDy = idleFrame === 1 ? 1.5 : 0.5;
    leanAngle = 0.05;
  } else if (anim === 'victoryCoffee') {
    bodyDy = idleFrame === 1 ? -0.5 : 0.5;
    leanAngle = -0.03;
  } else if (anim === 'walk') {
    const walkBobTable = [1, 1.8, 0.2, -1, 1, 1.8, 0.2, -1];
    const walkLeanTable = [0.06, 0.075, 0.045, 0.05, 0.06, 0.075, 0.045, 0.05];
    bodyDx = 0.8;
    bodyDy = walkBobTable[walkFrame];
    leanAngle = walkLeanTable[walkFrame];
  } else if (anim === 'punch1') {
    if (animProgress < 0.18) {
      const ant = animProgress / 0.18;
      bodyDx = -1.6 * ant;
      bodyDy = 0.8 * ant;
      leanAngle = -0.07 * ant;
    } else if (animProgress < 0.68) {
      bodyDx = 3.2;
      bodyDy = 1.0;
      leanAngle = 0.12;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      if (isComboChainActive) {
        // Hold forward follow-through into coiled guard so punch2 flows seamlessly
        bodyDx = 2.2 + rec * 1.0;
        bodyDy = 1.2 - rec * 0.2;
        leanAngle = 0.08 + rec * 0.04;
      } else {
        bodyDx = 3.2 * rec;
        bodyDy = 1.0 * rec;
        leanAngle = 0.12 * rec;
      }
    }
  } else if (anim === 'punch2') {
    const startDx = prevComboAnim === 'punch1' ? 2.2 : prevComboAnim === 'kick' ? 1.5 : 0;
    const startLean = prevComboAnim === 'punch1' ? 0.08 : prevComboAnim === 'kick' ? 0.04 : 0;
    if (animProgress < 0.20) {
      // Seamless shoulder/hip windup out of jab or kick follow-through
      const t = animProgress / 0.20;
      bodyDx = startDx + (0.6 - startDx) * t;
      bodyDy = 1.3 + 0.2 * t;
      leanAngle = startLean + (-0.06 - startLean) * t;
    } else if (animProgress < 0.68) {
      bodyDx = 4.8;
      bodyDy = 1.5;
      leanAngle = 0.19;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      if (isComboChainActive) {
        bodyDx = 2.8 + rec * 2.0;
        bodyDy = 1.5;
        leanAngle = 0.11 + rec * 0.08;
      } else {
        bodyDx = 4.8 * rec;
        bodyDy = 1.5 * rec;
        leanAngle = 0.19 * rec;
      }
    }
  } else if (anim === 'punch3') {
    bodyDx = 2;
    bodyDy = -1;
    leanAngle = -0.05;
  } else if (anim === 'heavyPunch') {
    const startDx =
      prevComboAnim === 'punch2' ? 2.8 : prevComboAnim === 'punch1' ? 2.2 : prevComboAnim === 'kick' ? 1.5 : 0;
    const startLean =
      prevComboAnim === 'punch2' ? 0.11 : prevComboAnim === 'punch1' ? 0.08 : 0;
    if (animProgress < 0.30) {
      // Deep expressive torque windup flowing directly out of punch2's forward lean
      const windProg = Math.min(1, animProgress / 0.30);
      const ease = 1 - Math.pow(1 - windProg, 2);
      bodyDx = startDx + (-5.5 - startDx) * ease;
      bodyDy = 1.4 + 1.0 * ease;
      leanAngle = startLean + (-0.28 - startLean) * ease;
    } else if (animProgress < 0.68) {
      // Explosive full-body finisher lunge snapped tightly to engine contact window (animTimer <= 0.30)
      const snap = Math.min(1, (animProgress - 0.30) / 0.025);
      bodyDx = -2.0 + 9.2 * snap;
      bodyDy = 1.8;
      leanAngle = -0.04 + 0.29 * snap;
    } else {
      // Expressive martial follow-through recovery
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      bodyDx = 1.5 + rec * 5.7;
      bodyDy = 0.6 + rec * 1.2;
      leanAngle = 0.05 + rec * 0.20;
    }
  } else if (anim === 'kick') {
    const startDx = prevComboAnim === 'punch1' || prevComboAnim === 'punch2' ? 2.0 : 0;
    const startLean = prevComboAnim === 'punch1' || prevComboAnim === 'punch2' ? 0.08 : 0;
    if (animProgress < 0.24) {
      const ant = animProgress / 0.24;
      bodyDx = startDx + (-1.5 - startDx) * ant;
      bodyDy = 0.6 - 1.6 * ant;
      leanAngle = startLean + (-0.08 - startLean) * ant;
    } else if (animProgress < 0.70) {
      bodyDx = -2.0;
      bodyDy = -1.0;
      leanAngle = -0.19;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.70) / 0.30);
      if (isComboChainActive) {
        // Step down directly into forward-weighted chain stance
        bodyDx = 1.5 - rec * 3.5;
        bodyDy = 1.2 - rec * 2.2;
        leanAngle = 0.05 - rec * 0.24;
      } else {
        bodyDx = -2.0 * rec;
        bodyDy = -1.0 * rec;
        leanAngle = -0.19 * rec;
      }
    }
  } else if (anim === 'jumpPunch') {
    if (animProgress < 0.18) {
      // Coiled Shoryuken crouch prep before rising skyward
      const ant = animProgress / 0.18;
      bodyDx = -2 * ant;
      bodyDy = 2 * ant;
      leanAngle = 0.14 * ant;
    } else if (animProgress < 0.74) {
      // Rising Shoryuken uppercut: proud lifted chest tilted into the skyward dragon punch
      bodyDx = 2.5;
      bodyDy = -3.5;
      leanAngle = -0.18;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.74) / 0.26);
      bodyDx = 2.5 * rec;
      bodyDy = -3.5 * rec;
      leanAngle = -0.18 * rec;
    }
  } else if (anim === 'jumpKick') {
    if (animProgress < 0.20) {
      bodyDx = 0;
      bodyDy = -2;
      leanAngle = -0.14;
    } else if (animProgress < 0.78) {
      bodyDx = 2;
      bodyDy = -3;
      leanAngle = -0.26;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.78) / 0.22);
      bodyDx = 2 * rec;
      bodyDy = -3 * rec;
      leanAngle = -0.26 * rec;
    }
  } else if (anim === 'special') {
    bodyDx = isSpecialCoil ? 0 : 4;
    bodyDy = -2;
    leanAngle = isSpecialCoil ? -0.34 : -0.3;
  } else if (anim === 'kickFinisher') {
    const startDx =
      prevComboAnim === 'punch2' ? 2.8 : prevComboAnim === 'punch1' ? 2.2 : prevComboAnim === 'kick' ? 1.5 : 0;
    const startLean =
      prevComboAnim === 'kick' ? 0.05 : prevComboAnim === 'punch1' || prevComboAnim === 'punch2' ? 0.10 : 0;
    if (animProgress < 0.26) {
      // Expressive spring-coiled pivot synchronized right up to engine contact threshold (animTimer <= 0.28)
      const ant = animProgress / 0.26;
      bodyDx = startDx + (-3.6 - startDx) * ant;
      bodyDy = 1.2 + 1.8 * ant;
      leanAngle = startLean + (-0.12 - startLean) * ant;
    } else if (animProgress < 0.72) {
      // Dramatic high roundhouse finisher lean-back snapped to contact frame
      bodyDx = 4.2;
      bodyDy = -2.8;
      leanAngle = -0.32;
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.72) / 0.28);
      bodyDx = 1.2 + rec * 3.0;
      bodyDy = 0.6 - rec * 3.4;
      leanAngle = 0.04 - rec * 0.36;
    }
  } else if (anim === 'cane') {
    if (isFinalCaneSpin) {
      if (animProgress < 0.16) {
        const ant = animProgress / 0.16;
        bodyDx = -2.5 * ant;
        bodyDy = 1.5 * ant;
        leanAngle = -0.18 * ant;
      } else if (animProgress < 0.78) {
        const spinPhase = (animProgress - 0.16) / 0.62;
        bodyDx = 3.5;
        bodyDy = -1.5 - Math.sin(spinPhase * Math.PI) * 1.5;
        leanAngle = Math.cos(spinPhase * Math.PI * 2) * 0.22;
      } else {
        const rec = Math.max(0, 1 - (animProgress - 0.78) / 0.22);
        bodyDx = 3.5 * rec;
        bodyDy = -1.5 * rec;
        leanAngle = 0.16 * rec;
      }
    } else if (animProgress < 0.22) {
      // Frame 2: cock cane overhead behind head/shoulders
      const ant = animProgress / 0.22;
      bodyDx = -2.5 * ant;
      bodyDy = -1 * ant;
      leanAngle = -0.16 * ant;
    } else if (animProgress < 0.46) {
      // Frame 3: high forward diagonal slash thrust
      bodyDx = 2.5;
      bodyDy = -0.5;
      leanAngle = 0.10;
    } else if (animProgress < 0.72) {
      // Frame 4: deep low forward lunge sweep
      bodyDx = 3.5;
      bodyDy = 2.2;
      leanAngle = 0.24;
    } else {
      // Frames 5-7: pull cane horizontally back across chest into upright guard
      const rec = Math.max(0, 1 - (animProgress - 0.72) / 0.28);
      bodyDx = 3.5 * rec;
      bodyDy = 2.2 * rec;
      leanAngle = 0.24 * rec;
    }
  } else if (anim === 'finisherPiledriver') {
    if (animProgress < 0.22) {
      const t = animProgress / 0.22;
      bodyDx = 3 * t;
      bodyDy = 2 * t;
      leanAngle = 0.22 * t;
    } else if (animProgress < 0.56) {
      const t = Math.min(1, (animProgress - 0.22) / 0.18);
      bodyDx = 0;
      bodyDy = -2 * t;
      leanAngle = -0.15 * t;
    } else if (animProgress < 0.80) {
      const slamT = Math.min(1, (animProgress - 0.56) / 0.08);
      bodyDx = 1;
      bodyDy = -2 + 12 * slamT;
      leanAngle = -0.1 + 0.36 * slamT;
    } else {
      const rec = 1 - Math.min(1, (animProgress - 0.80) / 0.20);
      bodyDx = 1 * rec;
      bodyDy = 10 * rec;
      leanAngle = 0.26 * rec;
    }
  } else if (anim === 'finisherGiantSwing') {
    if (animProgress < 0.20) {
      const t = animProgress / 0.20;
      bodyDx = -3 * t;
      bodyDy = 3 * t;
      leanAngle = -0.24 * t;
    } else if (animProgress < 0.80) {
      const spinAng = ((animProgress - 0.20) / 0.60) * Math.PI * 4;
      bodyDx = -Math.cos(spinAng) * 2;
      bodyDy = 2;
      leanAngle = -0.28 * Math.cos(spinAng);
    } else {
      const rec = 1 - Math.min(1, (animProgress - 0.80) / 0.20);
      bodyDx = 4 * rec;
      bodyDy = 1 * rec;
      leanAngle = 0.22 * rec;
    }
  } else if (anim === 'finisherGroundPound') {
    if (animProgress < 0.18) {
      const t = animProgress / 0.18;
      bodyDx = 0;
      bodyDy = 8 * t;
      leanAngle = 0.16 * t;
    } else if (animProgress < 0.82) {
      const sub = animProgress < 0.50
        ? (animProgress - 0.18) / 0.32
        : (animProgress - 0.50) / 0.32;
      bodyDx = sub < 0.38 ? -1 : 2;
      bodyDy = 8 + (sub < 0.38 ? -1 : 2);
      leanAngle = sub < 0.38 ? -0.14 : 0.36;
    } else {
      const rec = 1 - Math.min(1, (animProgress - 0.82) / 0.18);
      bodyDx = 0;
      bodyDy = 8 * rec;
      leanAngle = 0.14 * rec;
    }
  } else if (anim === 'finisherCollarKnee') {
    if (animProgress < 0.28) {
      const t = animProgress / 0.28;
      bodyDx = 4 * t;
      bodyDy = 0;
      leanAngle = 0.09 * t;
    } else if (animProgress < 0.64) {
      const k = Math.sin(((animProgress - 0.28) / 0.36) * Math.PI);
      bodyDx = 3 - 2 * k;
      bodyDy = -1 * k;
      leanAngle = -0.18 * k;
    } else {
      const sh = Math.sin(((animProgress - 0.64) / 0.36) * Math.PI);
      bodyDx = 5 * sh;
      bodyDy = 1 * sh;
      leanAngle = 0.22 * sh;
    }
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
    Exclude<PlayerSkinStyle, 'custom'>,
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
      shirtBase: '#f8fafc',
      shirtShadow: '#c7d2fe',
      shirtHi: '#ffffff',
      sleeveMain: '#f8fafc',
      sleeveShadow: '#c7d2fe',
      pantsUpperRear: '#333252',
      pantsUpperRearDark: '#1e1d36',
      pantsLowerRear: '#3f3e61',
      pantsLowerRearDark: '#262542',
      pantsUpperFront: '#4b496e',
      pantsUpperFrontDark: '#2f2e4a',
      pantsLowerFront: '#585680',
      pantsLowerFrontDark: '#363457',
      shoeBase: '#111827',
      shoeAccent: '#f8fafc',
      shoeSole: '#e2e8f0',
      tieMain: '#ef4444',
      tieDark: '#b91c1c',
      bagMain: '#272b3b',
      bagDark: '#161924',
      bagPocket: '#353b50',
      bagTrim: '#64748b',
      beltMain: '#0f172a',
      buckle: '#facc15',
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

  const customCfg = skinStyle === 'custom' ? (garageConfig ?? DEFAULT_GARAGE_CONFIG) : null;
  const pal: (typeof skinPalette)['classic'] = (() => {
    if (!customCfg) {
      return skinPalette[skinStyle === 'custom' ? 'classic' : skinStyle] ?? skinPalette.classic;
    }
    const tie = getGarageSwatchDef(customCfg.tieColor, 'crimson');
    const bag = getGarageSwatchDef(customCfg.backpackColor, 'royal_blue');
    return {
      ...skinPalette.classic,
      shoeBase: '#f1f5f9',
      shoeAccent: tie.main,
      shoeSole: '#334155',
      tieMain: tie.main,
      tieDark: tie.dark,
      bagMain: bag.main,
      bagDark: bag.dark,
      bagPocket: bag.isNeon ? bag.highlight : bag.dark,
      bagTrim: bag.highlight,
      beltMain: '#0f172a',
      buckle: tie.isNeon ? tie.highlight : '#e2e8f0',
    };
  })();
  const isFemale = Boolean(customCfg && customCfg.gender === 'female');
  const activeHairStyle: GarageHairStyle | 'classic_tousled' = customCfg
    ? customCfg.hairStyle
    : 'classic_tousled';
  const hairSwatch = customCfg
    ? getGarageSwatchDef(customCfg.hairColor, 'dark_navy')
    : { key: 'chestnut', label: 'Castanho', main: '#853a14', dark: '#542008', highlight: '#c26d2d', isNeon: false };

  const skinTone = hasRageBuff ? '#fca5a5' : '#f5b56e';
  const skinShade = hasRageBuff ? '#dc2626' : '#d67d36';

  const drawShoe = (sx: number, sy: number, angled = false) => {
    celSneaker(ctx, sx, sy, pal.shoeBase, pal.shoeSole, pal.shoeAccent, angled);
  };

  // --- LEGS (16-bit skin-aware trousers/denim/suit/ninja pants) ---
  if (anim === 'kick') {
    pxLimb(ctx, bodyDx - 2, hipY, -8, -9, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -8, -9, -10, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-10, -2);

    if (animProgress < 0.24) {
      // Antecipação: knee chambered tightly up
      const ch = animProgress / 0.24;
      const kx = 8 * ch + 4;
      const ky = hipY - 9 * ch;
      pxLimb(ctx, bodyDx + 2, hipY, kx, ky, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, kx, ky, kx - 3, ky + 8, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(kx - 2, ky + 8);
    } else if (animProgress < 0.70) {
      // Impacto: full sharp snap kick extension
      pxLimb(ctx, bodyDx + 2, hipY, 13, hipY - 2, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 13, hipY - 2, 24, hipY - 4, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(25, hipY - 4, true);

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(4, hipY - 3, 24, -0.38, 0.38);
      ctx.stroke();
    } else {
      // Recuo: lands forward into ready combat lunge if chained, or controlled stance
      const rec = Math.max(0, 1 - (animProgress - 0.70) / 0.30);
      const targetFx = isComboChainActive ? 9 : 7;
      const fx = targetFx + rec * (24 - targetFx);
      const fy = -2 + rec * (hipY - 2);
      pxLimb(ctx, bodyDx + 2, hipY, bodyDx + 6 + rec * 7, -9 + rec * (hipY + 7), 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, bodyDx + 6 + rec * 7, -9 + rec * (hipY + 7), fx, fy, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(fx + 1, fy, rec > 0.4);
    }
  } else if (anim === 'jumpPunch') {
    // Classic Shoryuken airborne silhouette: high driving front knee + extended trailing rear leg
    if (animProgress < 0.18) {
      pxLimb(ctx, bodyDx - 2, hipY, -7, hipY + 3, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -7, hipY + 3, -10, hipY + 9, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-10, hipY + 9);

      pxLimb(ctx, bodyDx + 2, hipY, 7, hipY - 3, 5.9, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 7, hipY - 3, 4, hipY + 6, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(5, hipY + 6);
    } else if (animProgress < 0.74) {
      pxLimb(ctx, bodyDx - 2, hipY, -6, hipY + 5, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -6, hipY + 5, -11, hipY + 13, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-11, hipY + 13);

      pxLimb(ctx, bodyDx + 2, hipY, 11, hipY - 9, 6.1, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 11, hipY - 9, 6, hipY + 1, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(7, hipY + 1);
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.74) / 0.26);
      const bfx = -9 - rec * 2;
      const bfy = hipY + 8 + rec * 5;
      const fky = hipY - 2 - rec * 7;
      pxLimb(ctx, bodyDx - 2, hipY, -6, hipY + 3 + rec * 2, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -6, hipY + 3 + rec * 2, bfx, bfy, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(bfx, bfy);

      pxLimb(ctx, bodyDx + 2, hipY, 8 + rec * 3, fky, 5.9, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 8 + rec * 3, fky, 5 + rec, hipY + 6 - rec * 5, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(6 + rec, hipY + 6 - rec * 5);
    }
  } else if (anim === 'jumpKick') {
    // Chute da Garça / Crane Kick (Karatê Kid)
    pxLimb(ctx, bodyDx - 2, hipY, -6, -7, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -6, -7, -8, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-8, -2);

    if (animProgress < 0.20) {
      // Antecipação: airborne crane tuck
      pxLimb(ctx, bodyDx + 2, hipY, 10, hipY - 9, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 10, hipY - 9, 5, hipY + 1, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(6, hipY + 1);
    } else if (animProgress < 0.78) {
      // Impacto: high crane kick extension
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
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.78) / 0.22);
      const kx = 10 + rec * 5;
      const fx = 10 + rec * 16;
      const fy = -2 + rec * (hipY - 14);
      pxLimb(ctx, bodyDx + 2, hipY, kx, hipY - 6 * rec, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, kx, hipY - 6 * rec, fx, fy, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(fx + 1, fy, rec > 0.4);
    }
  } else if (anim === 'special') {
    if (isSpecialCoil) {
      pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 3, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -8, hipY + 3, -13, hipY + 7, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-13, hipY + 7);

      pxLimb(ctx, bodyDx + 2, hipY, 10, hipY - 8, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 10, hipY - 8, 4, hipY + 1, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(5, hipY + 1);

      const pulse = (Math.sin(auraClock * 16) + 1) * 0.5;
      // Intense condensing aura rings + 4-way star charge glint
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.92)';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.ellipse(0, -18, 25 + pulse * 5, 17 + pulse * 3, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.82)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -18, 33 + pulse * 6, 22 + pulse * 3, -0.25, 0, Math.PI * 2);
      ctx.stroke();

      const flareR = 7 + pulse * 4;
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px(bodyDx + 10) - 1, px(-22 - flareR), 2, flareR * 2);
      ctx.fillRect(px(bodyDx + 10) - flareR, px(-22) - 1, flareR * 2, 2);
    } else {
      pxLimb(ctx, bodyDx - 2, hipY, -8, hipY + 2, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -8, hipY + 2, -12, hipY + 8, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-12, hipY + 8);

      pxLimb(ctx, bodyDx + 3, hipY, 15, hipY - 3, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 15, hipY - 3, 27, hipY - 5, 5.8, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(28, hipY - 5, true);

      // Blazing triple-arc special kick trail + forward light cone
      ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
      ctx.beginPath();
      ctx.moveTo(bodyDx + 2, hipY - 8);
      ctx.lineTo(38, hipY - 22);
      ctx.lineTo(42, hipY + 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(4, hipY - 4, 31, -0.52, 0.42);
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(4, hipY - 4, 28, -0.48, 0.38);
      ctx.stroke();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(4, hipY - 4, 23, -0.35, 0.25);
      ctx.stroke();
    }
  } else if (anim === 'kickFinisher') {
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 6.1, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -11, -2, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    if (animProgress < 0.26) {
      // Antecipação: coiled pivot crouch synchronized up to contact threshold (animTimer <= 0.28)
      pxLimb(ctx, bodyDx + 2, hipY, 9, hipY - 8, 6.1, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 9, hipY - 8, 6, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(7, -2);
    } else if (animProgress < 0.72) {
      // Impacto: explosive high roundhouse finisher kick with 3-tone arc
      pxLimb(ctx, bodyDx + 3, hipY, 16, hipY - 7, 6.3, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 16, hipY - 7, 28, hipY - 12, 5.9, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(29, hipY - 12, true);

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.arc(3, hipY - 6, 29, -0.82, 0.48);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(3, hipY - 6, 26.5, -0.74, 0.42);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(3, hipY - 6, 24, -0.62, 0.30);
      ctx.stroke();
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.72) / 0.28);
      const fx = 10 + rec * 18;
      const fy = -2 + rec * (hipY - 10);
      pxLimb(ctx, bodyDx + 2, hipY, 9 + rec * 7, -8 + rec * (hipY + 1), 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 9 + rec * 7, -8 + rec * (hipY + 1), fx, fy, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(fx + 1, fy, rec > 0.35);
    }
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
  } else if (anim === 'punch1') {
    const isAnt = animProgress < 0.18;
    const isRec = animProgress >= 0.68;
    const recFloor = isComboChainActive ? 0.78 : 0.6;
    const lungeScale = isAnt ? 0.65 : isRec ? Math.max(recFloor, 1 - (animProgress - 0.68) / 0.32) : 1;
    const lunge = 13 * lungeScale;
    pxLimb(ctx, bodyDx - 2, hipY, -9 * lungeScale, -8, 6.2, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9 * lungeScale, -8, -lunge, -1.5, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-lunge, -1.5);

    pxLimb(ctx, bodyDx + 2, hipY, 8 + 2 * lungeScale, -9, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8 + 2 * lungeScale, -9, 7.5 + 1.5 * lungeScale, -1.5, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(8.5 + 1.5 * lungeScale, -1.5);
  } else if (anim === 'punch2') {
    const isAnt = animProgress < 0.20;
    const isRec = animProgress >= 0.68;
    const recFloor = isComboChainActive ? 0.82 : 0.62;
    const lungeScale = isAnt ? 0.74 : isRec ? Math.max(recFloor, 1 - (animProgress - 0.68) / 0.32) : 1;
    const rearFootX = -15.5 * lungeScale;
    const frontKneeX = 9 + 2 * lungeScale;
    const frontFootX = 8.5 + 1.8 * lungeScale;
    pxLimb(ctx, bodyDx - 2, hipY, rearFootX * 0.6, -8, 6.2, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, rearFootX * 0.6, -8, rearFootX, -1.5, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(rearFootX, -1.5);

    pxLimb(ctx, bodyDx + 2, hipY, frontKneeX, -9, 6.3, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, frontKneeX, -9, frontFootX, -1.5, 5.7, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(frontFootX + 1, -1.5);
  } else if (anim === 'heavyPunch') {
    const isWindup = animProgress < 0.30;
    const rearPlantX = isWindup ? -14.5 : -18;
    const frontPlantX = isWindup ? 7.5 : 11.5;
    pxLimb(ctx, bodyDx - 2, hipY, rearPlantX + 4.5, -7.5, 6.4, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, rearPlantX + 4.5, -7.5, rearPlantX, -1.5, 5.8, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(rearPlantX, -1.5);

    pxLimb(ctx, bodyDx + 2, hipY, frontPlantX + 1.5, -8, 6.5, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, frontPlantX + 1.5, -8, frontPlantX, -1.5, 5.9, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(frontPlantX + 1, -1.5);
  } else if (anim === 'finisherPiledriver') {
    if (animProgress >= 0.56 && animProgress < 0.84) {
      // Wide seated piledriver slam stance + ground shockwave
      pxLimb(ctx, bodyDx - 3, hipY, -14, -4, 6.2, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -14, -4, -17, -1.5, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-17, -1.5);

      pxLimb(ctx, bodyDx + 3, hipY, 14, -4, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 14, -4, 17, -1.5, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(18, -1.5);

      const wave = Math.min(1, (animProgress - 0.56) / 0.28);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(1.2, 3 * (1 - wave));
      ctx.beginPath();
      ctx.ellipse(2, -1, 14 + wave * 28, 4 + wave * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Braced athletic lift stance
      pxLimb(ctx, bodyDx - 2, hipY, -11, -8, 6.2, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -11, -8, -12, -2, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-12, -2);

      pxLimb(ctx, bodyDx + 2, hipY, 10, -8, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 10, -8, 11, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(12, -2);
    }
  } else if (anim === 'finisherGiantSwing') {
    pxLimb(ctx, bodyDx - 2, hipY, -13, -7, 6.2, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -13, -7, -15, -2, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-15, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 12, -7, 6.2, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 12, -7, 14, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(15, -2);

    if (animProgress >= 0.20 && animProgress < 0.80) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, -14, 34, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (anim === 'finisherGroundPound') {
    // Kneeling / mounting straddle posture over the downed boss
    pxLimb(ctx, bodyDx - 2, hipY, -10, -3, 6.0, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -10, -3, -15, -2, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-15, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 8, -3, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 8, -3, 4, -2, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(5, -2);
  } else if (anim === 'finisherCollarKnee') {
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 6.0, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -11, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    if (animProgress >= 0.28 && animProgress < 0.64) {
      // Explosive upward knee drive into boss midsection
      const k = Math.sin(((animProgress - 0.28) / 0.36) * Math.PI);
      const kx = 10 + 4 * k;
      const ky = -8 - 10 * k;
      pxLimb(ctx, bodyDx + 2, hipY, kx, ky, 6.4, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, kx, ky, kx - 5, ky + 9, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(kx - 4, ky + 9);
      if (k > 0.45) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(kx + 2, ky, 10, -1.1, 1.1);
        ctx.stroke();
      }
    } else {
      pxLimb(ctx, bodyDx + 2, hipY, 9, -8, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 9, -8, 10, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(11, -2);
    }
  } else if (anim === 'walk') {
    // 8-pose biomechanical walk cycle: Contact -> Down (weight plant) -> Passing -> High Point (x2)
    // Planted foot sweeps back underneath body to prevent sliding; swing foot lifts with knee flexion
    const strideTable: Array<{
      bkx: number;
      bky: number;
      bfx: number;
      bfy: number;
      fkx: number;
      fky: number;
      ffx: number;
      ffy: number;
    }> = [
      // 0: Contact R (front heel plants forward, rear pushes off behind)
      { bkx: -4.5, bky: -8, bfx: -9.5, bfy: -2, fkx: 6.0, fky: -8, ffx: 9.5, ffy: -2 },
      // 1: Down R (weight settles onto front foot, rear lifts off floor)
      { bkx: -6.0, bky: -9, bfx: -10.5, bfy: -4.8, fkx: 4.5, fky: -7.2, ffx: 5.0, ffy: -1.6 },
      // 2: Passing R (front leg supports under hip, rear knee drives forward)
      { bkx: 3.5, bky: -10.2, bfx: -2.0, bfy: -5.8, fkx: 0.2, fky: -8.8, ffx: -0.8, ffy: -1.6 },
      // 3: High Point R (rear leg reaches forward to strike, front pushes back)
      { bkx: 6.5, bky: -9.5, bfx: 7.5, bfy: -4.2, fkx: -3.0, fky: -8.2, ffx: -6.0, ffy: -2 },
      // 4: Contact L (rear heel plants forward, front pushes off behind)
      { bkx: 6.0, bky: -8, bfx: 9.5, bfy: -2, fkx: -4.5, fky: -8, ffx: -9.5, ffy: -2 },
      // 5: Down L (weight settles onto rear foot, front lifts off floor)
      { bkx: 4.5, bky: -7.2, bfx: 5.0, bfy: -1.6, fkx: -6.0, fky: -9, ffx: -10.5, ffy: -4.8 },
      // 6: Passing L (rear leg supports under hip, front knee drives forward)
      { bkx: 0.2, bky: -8.8, bfx: -0.8, bfy: -1.6, fkx: 3.5, fky: -10.2, ffx: -2.0, ffy: -5.8 },
      // 7: High Point L (front leg reaches forward to strike, rear pushes back)
      { bkx: -3.0, bky: -8.2, bfx: -6.0, bfy: -2, fkx: 6.5, fky: -9.5, ffx: 7.5, ffy: -4.2 },
    ];
    const st = strideTable[walkFrame];
    pxLimb(ctx, bodyDx - 1, hipY, st.bkx, st.bky, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, st.bkx, st.bky, st.bfx, st.bfy, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(st.bfx + 0.8, st.bfy);

    pxLimb(ctx, bodyDx + 1, hipY, st.fkx, st.fky, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, st.fkx, st.fky, st.ffx, st.ffy, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(st.ffx + 0.8, st.ffy);
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
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = anim === 'soundSpecial' ? 3.4 : 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -14, anim === 'soundSpecial' ? 42 : anim === 'bagSpin' ? 32 : 28, anim === 'soundSpecial' ? 14 : 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (anim === 'soundSpecial') {
      const sonicProg = Math.max(0, Math.min(1, 1 - animTimer / 0.42));
      const pulseR = 24 + sonicProg * 28;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, -14, pulseR, pulseR * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, -14, 24, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Equalizer resonance bars around player
      for (let b = -3; b <= 3; b++) {
        if (b === 0) continue;
        const bx = b * 7;
        const bh = 6 + Math.abs(Math.sin(auraClock * 26 + b * 1.4)) * 11;
        ctx.fillStyle = Math.abs(b) % 2 === 0 ? '#38bdf8' : '#fde047';
        ctx.fillRect(px(bx), px(-28 - bh * 0.5), 2.5, px(bh));
      }
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
  } else if (anim === 'victoryTie') {
    // Relaxed casual swagger stance leaning slightly on rear heel
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -10, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-10, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 6, -9, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 6, -9, 7, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(8, -2);
  } else if (anim === 'victoryBadge') {
    // Wide heroic power-stance showing off the corporate badge trophy
    pxLimb(ctx, bodyDx - 3, hipY, -10, -8, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -10, -8, -11, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    pxLimb(ctx, bodyDx + 3, hipY, 10, -8, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 10, -8, 11, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(12, -2);
  } else if (anim === 'victoryCoffee') {
    // Weight on back leg, front foot casually propped forward on heel
    pxLimb(ctx, bodyDx - 2, hipY, -5, -9, 6, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -5, -9, -6, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-6, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 9, -9, 6, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 9, -9, 12, -3, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(13, -3);
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
  } else if (anim === 'cane') {
    if (isFinalCaneSpin) {
      if (animProgress < 0.16) {
        pxLimb(ctx, bodyDx - 2, hipY, -9, -7, 6.0, pal.pantsUpperRear, pal.pantsUpperRearDark);
        pxLimb(ctx, -9, -7, -11, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
        drawShoe(-11, -2);

        pxLimb(ctx, bodyDx + 2, hipY, 9, -7, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
        pxLimb(ctx, 9, -7, 9, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
        drawShoe(10, -2);
      } else if (animProgress < 0.78) {
        const spinPhase = (animProgress - 0.16) / 0.62;
        const spinStep = Math.cos(spinPhase * Math.PI * 2) * 8;
        pxLimb(ctx, bodyDx - 1, hipY, -spinStep * 0.7, -8, 5.8, pal.pantsUpperRear, pal.pantsUpperRearDark);
        pxLimb(ctx, -spinStep * 0.7, -8, -spinStep, -3, 5.4, pal.pantsLowerRear, pal.pantsLowerRearDark);
        drawShoe(-spinStep, -3);

        pxLimb(ctx, bodyDx + 1, hipY, spinStep * 0.7, -8, 5.8, pal.pantsUpperFront, pal.pantsUpperFrontDark);
        pxLimb(ctx, spinStep * 0.7, -8, spinStep, -3, 5.4, pal.pantsLowerFront, pal.pantsLowerFrontDark);
        drawShoe(spinStep + 1, -3);
      } else {
        pxLimb(ctx, bodyDx - 2, hipY, -8, -8, 5.9, pal.pantsUpperRear, pal.pantsUpperRearDark);
        pxLimb(ctx, -8, -8, -10, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
        drawShoe(-10, -2);

        pxLimb(ctx, bodyDx + 2, hipY, 8, -9, 5.9, pal.pantsUpperFront, pal.pantsUpperFrontDark);
        pxLimb(ctx, 8, -9, 9, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
        drawShoe(10, -2);
      }
    } else if (animProgress < 0.22) {
      pxLimb(ctx, bodyDx - 2, hipY, -8, -8, 5.9, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -8, -8, -10, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-10, -2);

      pxLimb(ctx, bodyDx + 2, hipY, 7, -9, 5.9, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 7, -9, 8, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(9, -2);
    } else if (animProgress < 0.46) {
      pxLimb(ctx, bodyDx - 2, hipY, -10, -8, 6.0, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -10, -8, -13, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-13, -2);

      pxLimb(ctx, bodyDx + 2, hipY, 9, -9, 6.0, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 9, -9, 11, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(12, -2);
    } else if (animProgress < 0.72) {
      pxLimb(ctx, bodyDx - 2, hipY, -11, -7, 6.0, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, -11, -7, -14, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(-14, -2);

      pxLimb(ctx, bodyDx + 2, hipY, 11, -7, 6.1, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, 11, -7, 11, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(12, -2);
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.72) / 0.28);
      const rFootX = -8 - rec * 6;
      const fFootX = 8 + rec * 3;
      pxLimb(ctx, bodyDx - 2, hipY, rFootX + 2, -8, 5.9, pal.pantsUpperRear, pal.pantsUpperRearDark);
      pxLimb(ctx, rFootX + 2, -8, rFootX, -2, 5.5, pal.pantsLowerRear, pal.pantsLowerRearDark);
      drawShoe(rFootX, -2);

      pxLimb(ctx, bodyDx + 2, hipY, fFootX, -8.5, 5.9, pal.pantsUpperFront, pal.pantsUpperFrontDark);
      pxLimb(ctx, fFootX, -8.5, fFootX, -2, 5.5, pal.pantsLowerFront, pal.pantsLowerFrontDark);
      drawShoe(fFootX + 1, -2);
    }
  } else if (isComboHoldGuard) {
    // Coiled martial-arts ready legs between combo hits
    pxLimb(ctx, bodyDx - 2, hipY, -9, -8, 6.1, pal.pantsUpperRear, pal.pantsUpperRearDark);
    pxLimb(ctx, -9, -8, -11, -2, 5.6, pal.pantsLowerRear, pal.pantsLowerRearDark);
    drawShoe(-11, -2);

    pxLimb(ctx, bodyDx + 2, hipY, 9, -8.5, 6.1, pal.pantsUpperFront, pal.pantsUpperFrontDark);
    pxLimb(ctx, 9, -8.5, 9.5, -2, 5.6, pal.pantsLowerFront, pal.pantsLowerFrontDark);
    drawShoe(10.5, -2);
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

  // Backpack behind back (rounded ergonomic pack + step-synced bounce & sway)
  const walkStepBagY =
    anim === 'walk' ? [0.6, 1.3, 0.2, -0.7, 0.6, 1.3, 0.2, -0.7][walkFrame] : 0;
  const walkStepBagX =
    anim === 'walk' ? [-0.5, -0.8, -0.2, 0.3, -0.5, -0.8, -0.2, 0.3][walkFrame] : 0;
  if (!hasMakeupShield && anim !== 'bagGuard' && anim !== 'bagSpin') {
    const bagTopY = torsoTopY + walkStepBagY;
    const bagBaseX = bodyDx + walkStepBagX;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bagBaseX - 5, bagTopY + 1);
    ctx.quadraticCurveTo(bagBaseX - 14.5, bagTopY + 1.5, bagBaseX - 14, bagTopY + 9);
    ctx.quadraticCurveTo(bagBaseX - 14, bagTopY + 16, bagBaseX - 6, bagTopY + 16);
    ctx.closePath();
    ctx.fillStyle = pal.bagMain;
    ctx.fill();
    // Cel shadow along lower curve
    ctx.fillStyle = pal.bagDark;
    ctx.beginPath();
    ctx.ellipse(bagBaseX - 9.5, bagTopY + 12.5, 4, 3, 0.2, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bagBaseX - 5, bagTopY + 1);
    ctx.quadraticCurveTo(bagBaseX - 14.5, bagTopY + 1.5, bagBaseX - 14, bagTopY + 9);
    ctx.quadraticCurveTo(bagBaseX - 14, bagTopY + 16, bagBaseX - 6, bagTopY + 16);
    ctx.closePath();
    ctx.stroke();
    // Side pocket + top highlight seam
    fillStrokeRoundRect(ctx, bagBaseX - 13, bagTopY + 6.5, 5.5, 6, 1.8, pal.bagPocket, '#090d16', 1.0);
    ctx.strokeStyle = pal.bagTrim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bagBaseX - 11.5, bagTopY + 3.5);
    ctx.quadraticCurveTo(bagBaseX - 9, bagTopY + 2.2, bagBaseX - 6.5, bagTopY + 3);
    ctx.stroke();
    ctx.restore();
  }

  // Rear guard arm (under torso)
  if (anim === 'fightStance' || isComboHoldGuard) {
    const fBob = isComboHoldGuard ? 0 : Math.sin(auraClock * 9.5) > 0 ? -1 : 1;
    pxLimb(ctx, bodyDx + 1, torsoTopY + 4, bodyDx + 6, torsoTopY + 5 + fBob, 4.6, pal.shirtShadow, '#475569');
    pxLimb(ctx, bodyDx + 6, torsoTopY + 5 + fBob, bodyDx + 7, torsoTopY - 1 + fBob, 4.2, skinTone, skinShade);
    celFist(ctx, bodyDx + 7.5, torsoTopY - 2 + fBob, 5.2, skinTone, skinShade);
  } else if (anim === 'jumpPunch') {
    if (animProgress < 0.18) {
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 5, torsoTopY + 7, 4.6, pal.sleeveShadow, '#334155');
      celFist(ctx, bodyDx - 6, torsoTopY + 7.5, 5.1, skinTone, skinShade);
    } else if (animProgress < 0.74) {
      // Rear arm clenched tightly downward by hip/waist to emphasize skyward Shoryuken uppercut
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 5, torsoTopY + 9, 4.7, pal.sleeveShadow, '#334155');
      celRolledCuff(ctx, bodyDx - 5, torsoTopY + 9, 1.35, 4.7, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx - 5, torsoTopY + 9, bodyDx - 6.5, hipY + 0.5, 4.2, skinTone, skinShade);
      celFist(ctx, bodyDx - 6.5, hipY + 1, 5.3, skinTone, skinShade);
    } else {
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4.5, bodyDx - 6, torsoTopY + 8, 4.6, pal.sleeveShadow, '#334155');
      celRolledCuff(ctx, bodyDx - 4.5, torsoTopY + 7.5, 0.35, 4.6, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx - 4.5, torsoTopY + 7.5, bodyDx + 1, torsoTopY + 4.5, 4.2, skinTone, skinShade);
      celFist(ctx, bodyDx + 1.5, torsoTopY + 4, 5.2, skinTone, skinShade);
    }
  } else if (anim === 'jumpKick' || anim === 'cranePrep' || anim === 'craneKick' || anim === 'trinityFreeze' || isTrinityCoil) {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 3, bodyDx - 11, torsoTopY - 3, 4.5, pal.sleeveShadow, '#334155');
    pxLimb(ctx, bodyDx - 11, torsoTopY - 3, bodyDx - 15, torsoTopY - 9, 4.2, skinTone, skinShade);
    celFist(ctx, bodyDx - 15.5, torsoTopY - 9.5, 5, skinTone, skinShade);
  } else if (anim === 'stunnerDrop') {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 5, bodyDx - 9, torsoTopY + 12, 4.4, pal.sleeveShadow, '#334155');
    celFist(ctx, bodyDx - 9.5, torsoTopY + 12.5, 5, skinTone, skinShade);
  } else if (anim === 'rkoCatch' || anim === 'rkoSlam') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 12, torsoTopY - 2, 4.5, pal.sleeveShadow, '#334155');
    celFist(ctx, bodyDx + 13, torsoTopY - 2, 5.2, skinTone, skinShade);
  } else if (anim === 'punch1') {
    // Coiled rear power arm loaded at chest/jaw ready to unleash punch2 cross
    const loadBack = animProgress >= 0.68 && isComboChainActive ? -1.5 : 0;
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4.5, bodyDx - 5 + loadBack, torsoTopY + 8.5, 4.8, pal.sleeveShadow, '#475569');
    celRolledCuff(ctx, bodyDx - 3.5 + loadBack, torsoTopY + 8, 0.35, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx - 3.5 + loadBack, torsoTopY + 8, bodyDx + 1.5, torsoTopY + 4.2, 4.4, skinTone, skinShade);
    celFist(ctx, bodyDx + 2, torsoTopY + 3.8, 5.5, skinTone, skinShade);
  } else if (anim === 'punch2') {
    // Alternating jab arm pulls tightly back across ribs as rear shoulder rotates into the cross punch
    const pullBack = animProgress < 0.20 ? (animProgress / 0.20) : 1;
    const fistX = bodyDx + 5 - pullBack * 7.5;
    const fistY = torsoTopY + 5.5 + pullBack * 1.5;
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4.5, bodyDx - 6, torsoTopY + 8.5, 4.8, pal.sleeveShadow, '#475569');
    celRolledCuff(ctx, bodyDx - 5, torsoTopY + 8, 0.35, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx - 5, torsoTopY + 8, fistX, fistY, 4.4, skinTone, skinShade);
    celFist(ctx, fistX, fistY, 5.4, skinTone, skinShade);
  } else if (anim === 'kick') {
    // Tight jaw guard arm while balancing snap kick
    pxLimb(ctx, bodyDx + 1, torsoTopY + 3.5, bodyDx + 6, torsoTopY + 5, 4.6, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx + 6, torsoTopY + 5, bodyDx + 7, torsoTopY + 0.5, 4.2, skinTone, skinShade);
    celFist(ctx, bodyDx + 7.5, torsoTopY, 5.2, skinTone, skinShade);
  } else if (anim === 'kickFinisher') {
    // Expressive forward/chest counterbalance arm during high roundhouse finisher
    const whip = animProgress >= 0.26 && animProgress < 0.72 ? 1 : 0.4;
    pxLimb(ctx, bodyDx + 1, torsoTopY + 3.5, bodyDx + 6 + whip * 2, torsoTopY + 4.5, 4.7, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx + 6 + whip * 2, torsoTopY + 4.5, bodyDx + 7 + whip * 2, torsoTopY - 0.5, 4.3, skinTone, skinShade);
    celFist(ctx, bodyDx + 7.5 + whip * 2, torsoTopY - 1, 5.4, skinTone, skinShade);
  } else if (anim === 'heavyPunch') {
    if (animProgress < 0.30) {
      // Rear guard arm forward slightly for balance while pulling punching shoulder back
      pxLimb(ctx, bodyDx + 1, torsoTopY + 4, bodyDx + 8.5, torsoTopY + 4.5, 4.6, pal.shirtShadow, '#475569');
      celFist(ctx, bodyDx + 9.5, torsoTopY + 4, 5.3, skinTone, skinShade);
    } else {
      // Taut chest-guard bent rear arm on punch contact & recovery
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4.5, bodyDx - 5, torsoTopY + 8.5, 4.8, pal.sleeveShadow, '#475569');
      celRolledCuff(ctx, bodyDx - 3.5, torsoTopY + 8, 0.35, 4.8, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx - 3.5, torsoTopY + 8, bodyDx + 1.5, torsoTopY + 4.5, 4.4, skinTone, skinShade);
      celFist(ctx, bodyDx + 2, torsoTopY + 4, 5.6, skinTone, skinShade);
    }
  } else if (anim === 'cane') {
    if (isFinalCaneSpin && animProgress >= 0.16 && animProgress < 0.78) {
      const spinPhase = (animProgress - 0.16) / 0.62;
      const counterX = bodyDx - Math.cos(spinPhase * Math.PI * 2) * 11;
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, counterX, torsoTopY + 5, 4.6, pal.sleeveShadow, '#334155');
      celFist(ctx, counterX, torsoTopY + 5, 5.2, skinTone, skinShade);
    } else if (animProgress < 0.46) {
      // Rear guard hand tucked cleanly near ribs during windup & high slash
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 5, torsoTopY + 7, 4.6, pal.sleeveShadow, '#334155');
      pxLimb(ctx, bodyDx - 5, torsoTopY + 7, bodyDx + 1, torsoTopY + 5, 4.2, skinTone, skinShade);
      celFist(ctx, bodyDx + 1.5, torsoTopY + 5, 5.0, skinTone, skinShade);
    } else if (animProgress < 0.72) {
      // Counterbalance sweep back during low cane strike
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 8, torsoTopY + 7.5, 4.6, pal.sleeveShadow, '#334155');
      celFist(ctx, bodyDx - 9, torsoTopY + 8.5, 5.0, skinTone, skinShade);
    } else {
      // Frames 5-7: second hand braces cane pull-back across chest
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4.5, bodyDx + 2, torsoTopY + 8, 4.6, pal.sleeveShadow, '#334155');
      pxLimb(ctx, bodyDx + 2, torsoTopY + 8, bodyDx + 6, torsoTopY + 7, 4.2, skinTone, skinShade);
      celFist(ctx, bodyDx + 6.5, torsoTopY + 7, 5.0, skinTone, skinShade);
    }
  } else if (anim === 'finisherPiledriver') {
    if (animProgress >= 0.22 && animProgress < 0.56) {
      // Both arms raised lifting inverted boss overhead
      pxLimb(ctx, bodyDx - 3, torsoTopY + 2, bodyDx - 2, torsoTopY - 8, 4.8, pal.sleeveShadow, '#334155');
      celFist(ctx, bodyDx - 2, torsoTopY - 9, 5.4, skinTone, skinShade);
    } else {
      pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx + 6, torsoTopY + 7, 4.8, pal.sleeveShadow, '#334155');
      celFist(ctx, bodyDx + 7, torsoTopY + 7, 5.4, skinTone, skinShade);
    }
  } else if (anim === 'finisherGroundPound' && animProgress >= 0.50 && animProgress < 0.82) {
    // Second punch using rear/left arm slamming straight down
    const sub = (animProgress - 0.50) / 0.32;
    const strikeY = sub < 0.38 ? torsoTopY - 12 : hipY + 7;
    const strikeX = sub < 0.38 ? bodyDx - 5 : bodyDx + 4;
    pxLimb(ctx, bodyDx - 2, torsoTopY + 3, strikeX, strikeY, 4.8, pal.sleeveShadow, '#334155');
    celFist(ctx, strikeX, strikeY, 6.2, skinTone, skinShade);
  } else if (anim === 'idle' || anim === 'walk') {
    // Opposite arm swing synced to 8-frame walk cycle (rear arm forward when front leg plants back, etc.)
    const rSwing = anim === 'walk' ? [3.6, 2.4, 0, -2.6, -3.8, -2.4, 0, 2.6][walkFrame] : 0;
    const rLift = anim === 'walk' ? [-0.6, -0.2, 0.5, -0.3, -0.8, -0.3, 0.5, -0.3][walkFrame] : 0;
    const elbowX = bodyDx - 3 + rSwing * 0.7;
    const elbowY = torsoTopY + 9 + rLift;
    const handX = bodyDx + 1.5 + rSwing * 1.15;
    const handY = torsoTopY + 6.8 + (rSwing > 0 ? -0.9 : 0.6);
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, elbowX, elbowY, 4.5, pal.shirtShadow, '#475569');
    pxLimb(ctx, elbowX, elbowY, handX, handY, 4.2, skinTone, skinShade);
    celFist(ctx, handX + 0.6, handY - 0.4, 4.8, skinTone, skinShade);
  }

  // Torso (Cel-shaded tapered dress shirt / outfit + fold lines + V-collar)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bodyDx - 7.5, torsoTopY + 1);
  ctx.quadraticCurveTo(bodyDx, torsoTopY - 1, bodyDx + 8, torsoTopY + 1);
  ctx.lineTo(bodyDx + 7, hipY - 1);
  ctx.lineTo(bodyDx - 7, hipY - 1);
  ctx.closePath();
  ctx.fillStyle = pal.shirtBase;
  ctx.fill();

  // Cel shadow along left/lower torso & subtle shirt crease
  ctx.fillStyle = pal.shirtShadow;
  ctx.beginPath();
  ctx.moveTo(bodyDx - 7.5, torsoTopY + 2);
  ctx.lineTo(bodyDx - 3, torsoTopY + 4);
  ctx.lineTo(bodyDx - 1, hipY - 2);
  ctx.lineTo(bodyDx + 7, hipY - 4);
  ctx.lineTo(bodyDx + 7, hipY - 1);
  ctx.lineTo(bodyDx - 7, hipY - 1);
  ctx.closePath();
  ctx.fill();

  // Upper chest highlight
  ctx.fillStyle = pal.shirtHi;
  ctx.fillRect(bodyDx - 2, torsoTopY + 1, 7, 3);

  // Crisp torso outline
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(bodyDx - 7.5, torsoTopY + 1);
  ctx.quadraticCurveTo(bodyDx, torsoTopY - 1, bodyDx + 8, torsoTopY + 1);
  ctx.lineTo(bodyDx + 7, hipY - 1);
  ctx.lineTo(bodyDx - 7, hipY - 1);
  ctx.closePath();
  ctx.stroke();

  // Crisp shirt collar tips
  if (!pal.senaiTee && !pal.ninjaHeadTie && !pal.motoboyGear) {
    ctx.fillStyle = pal.shirtHi;
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 2, torsoTopY);
    ctx.lineTo(bodyDx + 1, torsoTopY + 3.2);
    ctx.lineTo(bodyDx + 4.5, torsoTopY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  if (isFemale) {
    // Subtle tapered waist & feminine blouse contour
    ctx.fillStyle = '#090d16';
    ctx.fillRect(bodyDx - 7, hipY - 5, 1.2, 4);
    ctx.fillRect(bodyDx + 6.2, hipY - 5, 1.2, 4);
  }
  if (pal.suitLapels) {
    // Crisp white inner dress shirt V beneath blazer + tailored lapels
    pxRect(ctx, bodyDx, torsoTopY + 1, 5, 9, '#f8fafc');
    ctx.fillStyle = pal.shirtShadow;
    ctx.fillRect(bodyDx - 1, torsoTopY + 1, 1, 7);
    ctx.fillRect(bodyDx + 5, torsoTopY + 1, 1, 7);
    if (skinStyle === 'estagiario_chefe') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bodyDx - 2, torsoTopY + 4, 2, 2);
    }
  } else if (pal.senaiTee) {
    pxRect(ctx, bodyDx - 2, torsoTopY, 7, 2, '#cbd5e1');
    pxRect(ctx, bodyDx - 1, torsoTopY, 5, 1, '#f8fafc');
    pxRect(ctx, bodyDx + 1, torsoTopY + 4, 6, 3, '#dc2626', '#991b1b', 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bodyDx + 2, torsoTopY + 5, 4, 1);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bodyDx - 6, torsoTopY + 3, 3, 2);
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(bodyDx + 3, torsoTopY + 2, 4, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(bodyDx + 4, torsoTopY + 3, 2, 1);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(bodyDx + 5, torsoTopY + 3, 1, 1);
  } else if (pal.ninjaHeadTie) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 6, torsoTopY + 1);
    ctx.lineTo(bodyDx - 6, hipY - 2);
    ctx.stroke();
  } else if (pal.motoboyGear) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bodyDx - 7, torsoTopY + 4, 15, 3);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bodyDx - 6, torsoTopY + 5, 13, 1.5);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bodyDx - 5, torsoTopY + 9, 11, 1.5);
  }

  // Belt & gold/metallic buckle
  pxRect(ctx, bodyDx - 7, hipY - 2.5, 14.5, 3, pal.beltMain, '#090d16', 1);
  pxRect(ctx, bodyDx + 1, hipY - 2.5, 3.2, 3, pal.buckle, '#090d16', 0.8);

  // Twin backpack shoulder straps looping cleanly over shoulders
  if (!pal.ninjaHeadTie) {
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 3.1;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 4.5, torsoTopY + 0.5);
    ctx.quadraticCurveTo(bodyDx - 3, torsoTopY + 7, bodyDx - 4.5, hipY - 2);
    ctx.stroke();
    ctx.strokeStyle = pal.bagMain;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    // Front shoulder strap near chest
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 4.5, torsoTopY + 0.5);
    ctx.lineTo(bodyDx + 5.2, torsoTopY + 7.5);
    ctx.stroke();
    ctx.strokeStyle = pal.bagMain;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Dynamic tapered necktie (Gravata) synced with steps, attacks & hurt
  const walkTieTable = [-1.4, -2.0, -0.5, 1.0, 0.2, -1.6, -0.4, 1.1];
  const tieShift =
    anim === 'hurt'
      ? -2.5
      : anim === 'walk'
        ? walkTieTable[walkFrame]
        : isFinalCaneSpin && animProgress >= 0.16 && animProgress < 0.78
          ? Math.cos(((animProgress - 0.16) / 0.62) * Math.PI * 2) * 3.2
          : anim === 'heavyPunch'
            ? -3.4
            : anim === 'kickFinisher'
              ? -2.8
              : anim === 'punch2'
                ? -2.1
                : anim === 'punch1' || anim === 'jumpPunch'
                  ? -1.6
                  : isComboHoldGuard
                    ? -0.8
                    : 0;
  if (!pal.hideChestTie) {
    ctx.save();
    // Blade
    ctx.beginPath();
    ctx.moveTo(bodyDx + 1.2, torsoTopY + 3);
    ctx.lineTo(bodyDx + 3.2, torsoTopY + 3);
    ctx.lineTo(bodyDx + 3.6 + tieShift, torsoTopY + 11.5);
    ctx.lineTo(bodyDx + 1.9 + tieShift, torsoTopY + 13.8);
    ctx.lineTo(bodyDx + 0.5 + tieShift, torsoTopY + 11.2);
    ctx.closePath();
    ctx.fillStyle = pal.tieMain;
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 0.95;
    ctx.stroke();
    // Highlight stripe on tie
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(bodyDx + 1.5 + tieShift * 0.4, torsoTopY + 5, 0.9, 5);
    // Knot
    pxRect(ctx, bodyDx + 0.8, torsoTopY + 1, 3.2, 2.8, pal.tieDark, '#090d16', 0.9);
    ctx.restore();
  }

  // Hanging corporate ID badge ("Crachá") clipped to front shoulder strap (office/custom skins)
  if (!pal.hideChestTie && !pal.senaiTee && !pal.motoboyGear && !pal.ninjaHeadTie) {
    const badgeSwing = tieShift * 0.45;
    ctx.save();
    ctx.translate(bodyDx + 5.4 + badgeSwing, torsoTopY + 7.6);
    ctx.rotate(badgeSwing * 0.08);
    // Clip ring
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-0.8, -1.5, 1.6, 2);
    // White badge card
    pxRect(ctx, -2.2, 0.3, 4.6, 5.2, '#f8fafc', '#090d16', 0.85);
    // Tiny badge photo square + text bar
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-1.2, 1.2, 2.2, 2.1);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-1.2, 3.9, 2.8, 0.8);
    ctx.restore();
  }

  // --- HEAD (Expressive cel-shaded 16-bit anime/arcade proportions + ear + hair + gender) ---
  ctx.save();
  // Neck connector
  ctx.fillStyle = skinShade;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.1;
  ctx.fillRect(bodyDx - 2.2, headY + 9, 5, 3);
  ctx.strokeRect(bodyDx - 2.2, headY + 9, 5, 3);

  // Rounded-jaw head silhouette
  ctx.beginPath();
  ctx.moveTo(bodyDx - 5.2, headY + 1);
  ctx.lineTo(bodyDx + 5.4, headY + 1);
  ctx.quadraticCurveTo(bodyDx + 6.4, headY + 6, bodyDx + 5.2, headY + 9.8);
  ctx.quadraticCurveTo(bodyDx + 2, headY + 11.4, bodyDx - 2.5, headY + 10.6);
  ctx.lineTo(bodyDx - 5.4, headY + 8.5);
  ctx.closePath();
  ctx.fillStyle = skinTone;
  ctx.fill();

  // Warm jaw/cheek cel shadow
  ctx.fillStyle = skinShade;
  ctx.beginPath();
  ctx.moveTo(bodyDx - 5.2, headY + 6.5);
  ctx.lineTo(bodyDx - 1.5, headY + 9.2);
  ctx.lineTo(bodyDx + 4.8, headY + 9.8);
  ctx.quadraticCurveTo(bodyDx + 1.5, headY + 11.3, bodyDx - 2.5, headY + 10.6);
  ctx.lineTo(bodyDx - 5.4, headY + 8.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(bodyDx - 5.2, headY + 1);
  ctx.lineTo(bodyDx + 5.4, headY + 1);
  ctx.quadraticCurveTo(bodyDx + 6.4, headY + 6, bodyDx + 5.2, headY + 9.8);
  ctx.quadraticCurveTo(bodyDx + 2, headY + 11.4, bodyDx - 2.5, headY + 10.6);
  ctx.lineTo(bodyDx - 5.4, headY + 8.5);
  ctx.closePath();
  ctx.stroke();

  // Crisp side ear with inner fold
  fillStrokeCircle(ctx, bodyDx - 4.8, headY + 5.6, 2.0, skinTone, '#090d16', 1.0);
  ctx.fillStyle = skinShade;
  ctx.fillRect(bodyDx - 5.4, headY + 5.1, 1.1, 1.1);
  ctx.restore();

  // Lower ninja face mask when Estagiário Ninja is equipped
  if (pal.ninjaHeadTie) {
    pxRect(ctx, bodyDx - 5, headY + 6, 11, 5, '#1e293b', '#090d16', 1.0);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bodyDx - 4, headY + 8, 9, 2);
  }

  // Hair styles (Classic Tousled Chestnut + Custom Pompadour / Spiky / Afro / Ponytail)
  const pompadourLift = hasRageBuff ? 2 : 0;
  ctx.fillStyle = hairSwatch.main;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.2;

  if (activeHairStyle === 'classic_tousled') {
    // Expressive spiky-swept anime/arcade hair matching the reference illustration!
    ctx.beginPath();
    ctx.moveTo(bodyDx - 5.6, headY + 5);
    ctx.lineTo(bodyDx - 7.8, headY + 2.2);
    ctx.lineTo(bodyDx - 5.8, headY + 0.5);
    ctx.lineTo(bodyDx - 7.2, headY - 2.8);
    ctx.lineTo(bodyDx - 3.6, headY - 2.4);
    ctx.lineTo(bodyDx - 2.8, headY - (5.6 + pompadourLift));
    ctx.lineTo(bodyDx + 0.4, headY - (3.8 + pompadourLift));
    ctx.lineTo(bodyDx + 2.8, headY - (6.0 + pompadourLift));
    ctx.lineTo(bodyDx + 4.4, headY - (3.4 + pompadourLift));
    ctx.lineTo(bodyDx + 7.8, headY - (3.6 + pompadourLift));
    ctx.lineTo(bodyDx + 6.4, headY - 0.5);
    ctx.lineTo(bodyDx + 7.5, headY + 1.8);
    ctx.lineTo(bodyDx + 4.6, headY + 2.1);
    ctx.lineTo(bodyDx + 2.4, headY + 0.6);
    ctx.lineTo(bodyDx - 2.2, headY + 2.2);
    ctx.lineTo(bodyDx - 4.0, headY + 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Warm cel-shaded hair crown highlight + darker nape tuft
    ctx.fillStyle = hairSwatch.highlight;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 2.4, headY - 2.6 - pompadourLift * 0.5);
    ctx.lineTo(bodyDx + 2.2, headY - 4.4 - pompadourLift * 0.7);
    ctx.lineTo(bodyDx + 5.2, headY - 2.2);
    ctx.lineTo(bodyDx + 1.2, headY - 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hairSwatch.dark;
    ctx.fillRect(bodyDx - 5.6, headY + 1.5, 2.2, 2.5);
  } else if (activeHairStyle === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(bodyDx - 6, headY + 5);
    ctx.lineTo(bodyDx - 8, headY);
    ctx.lineTo(bodyDx - 5, headY - 1);
    ctx.lineTo(bodyDx - 6, headY - (6 + pompadourLift));
    ctx.lineTo(bodyDx - 1, headY - (3 + pompadourLift));
    ctx.lineTo(bodyDx + 1, headY - (8 + pompadourLift));
    ctx.lineTo(bodyDx + 3, headY - (3 + pompadourLift));
    ctx.lineTo(bodyDx + 7, headY - (6 + pompadourLift));
    ctx.lineTo(bodyDx + 6, headY);
    ctx.lineTo(bodyDx + 5, headY + 2);
    ctx.lineTo(bodyDx - 3, headY + 2);
    ctx.lineTo(bodyDx - 4, headY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hairSwatch.highlight;
    ctx.fillRect(bodyDx - 5, headY - 4 - pompadourLift, 2, 2);
    ctx.fillRect(bodyDx + 1, headY - 6 - pompadourLift, 2, 2);
    ctx.fillRect(bodyDx + 5, headY - 4 - pompadourLift, 2, 2);
  } else if (activeHairStyle === 'afro') {
    ctx.beginPath();
    ctx.arc(bodyDx - 0.5, headY - 1 - pompadourLift * 0.5, 8.8, Math.PI * 0.85, Math.PI * 2.08);
    ctx.lineTo(bodyDx + 5, headY + 2);
    ctx.lineTo(bodyDx - 4, headY + 2);
    ctx.lineTo(bodyDx - 5, headY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hairSwatch.highlight;
    ctx.fillRect(bodyDx - 4, headY - 7 - pompadourLift * 0.5, 5, 2);
    ctx.fillRect(bodyDx + 2, headY - 6 - pompadourLift * 0.5, 3, 2);
    ctx.fillStyle = hairSwatch.dark;
    ctx.fillRect(bodyDx - 7, headY, 2, 3);
  } else if (activeHairStyle === 'ponytail') {
    const tailSway = Math.sin(auraClock * 7.5 + (anim === 'walk' ? 1.2 : 0)) * 1.6;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 6, headY + 2);
    ctx.lineTo(bodyDx - 12, headY + 4 + tailSway);
    ctx.lineTo(bodyDx - 14, headY + 11 + tailSway);
    ctx.lineTo(bodyDx - 10, headY + 13 + tailSway);
    ctx.lineTo(bodyDx - 7, headY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    pxRect(ctx, bodyDx - 8, headY + 1, 2.5, 3, pal.tieMain, '#090d16', 0.8);
    ctx.fillStyle = hairSwatch.main;
    ctx.beginPath();
    ctx.moveTo(bodyDx - 6, headY + 5);
    ctx.lineTo(bodyDx - 7, headY);
    ctx.lineTo(bodyDx - 3, headY - (3 + pompadourLift));
    ctx.lineTo(bodyDx + 4, headY - (3 + pompadourLift));
    ctx.lineTo(bodyDx + 6, headY + 1);
    ctx.lineTo(bodyDx + 2, headY + 2);
    ctx.lineTo(bodyDx - 4, headY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hairSwatch.highlight;
    ctx.fillRect(bodyDx - 2, headY - 2 - pompadourLift, 6, 1.5);
  } else {
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
    ctx.fillStyle = hairSwatch.highlight;
    ctx.fillRect(bodyDx - 3, headY - 2 - pompadourLift, 8, 2);
    ctx.fillStyle = hairSwatch.isNeon ? '#ffffff' : '#94a3b8';
    ctx.fillRect(bodyDx + 1, headY - 3 - pompadourLift, 4, 1);
  }

  if (isFemale && activeHairStyle !== 'afro') {
    ctx.fillStyle = hairSwatch.main;
    ctx.fillRect(bodyDx - 5, headY + 3, 2, 6);
  }

  // Tie wrapped around forehead as Ninja Headband ("gravata na cabeça"!)
  if (pal.ninjaHeadTie) {
    const flutter = Math.sin(auraClock * 9) * 1.8;
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

    pxRect(ctx, bodyDx - 6, headY + 1, 12, 2.5, '#dc2626', '#090d16', 0.9);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(bodyDx + 1, headY + 1.5, 2, 1.5);
    pxRect(ctx, bodyDx - 8, headY + 1, 3, 3, '#991b1b', '#090d16', 0.9);
  }

  // Expressive face: determined brow, white sclera + dark pupil, nose shadow & gritted/grin mouth
  if (pal.visorColor && anim !== 'hurt') {
    pxRect(ctx, bodyDx, headY + 3, 7, 3, pal.visorColor, '#090d16', 0.9);
    ctx.fillStyle = '#ecfeff';
    ctx.fillRect(bodyDx + 2, headY + 4, 3, 1);
  } else if (anim === 'thumbsUp' || isVictoryPose) {
    if (anim === 'victoryCoffee') {
      // Cheerful wink / relaxed eye enjoying the coffee break
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(bodyDx + 1.2, headY + 4.8);
      ctx.quadraticCurveTo(bodyDx + 3.2, headY + 3.2, bodyDx + 5.0, headY + 4.8);
      ctx.stroke();
    } else if (anim === 'victoryTie') {
      // Cool half-lidded confident gaze
      pxRect(ctx, bodyDx + 1.5, headY + 4.3, 3.2, 1.8, '#ffffff');
      pxRect(ctx, bodyDx + 3.4, headY + 4.4, 1.4, 1.5, '#090d16');
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bodyDx + 0.8, headY + 3.7);
      ctx.lineTo(bodyDx + 5.2, headY + 3.9);
      ctx.stroke();
    } else {
      pxRect(ctx, bodyDx + 1.5, headY + 4, 3.2, 2.2, '#ffffff');
      pxRect(ctx, bodyDx + 3.4, headY + 4.2, 1.5, 1.8, '#090d16');
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(bodyDx + 0.8, headY + 2.8);
      ctx.lineTo(bodyDx + 5.2, headY + 2.3);
      ctx.stroke();
    }
    if (isFemale) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bodyDx + 1, headY + 3.5, 1, 1);
    }
    if (!pal.ninjaHeadTie) {
      if (anim === 'victoryTie' || anim === 'victoryCoffee') {
        // Confident smirk
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(bodyDx + 1.4, headY + 8.1);
        ctx.quadraticCurveTo(bodyDx + 3.4, headY + 8.6, bodyDx + 5.0, headY + 7.2);
        ctx.stroke();
      } else {
        pxRect(ctx, bodyDx + 1, headY + 7.2, 4, 2, '#ffffff', '#090d16', 0.7);
      }
    }
  } else if (hasRageBuff) {
    pxRect(ctx, bodyDx + 1.5, headY + 4, 3.2, 2.2, '#ffffff');
    pxRect(ctx, bodyDx + 3.5, headY + 4.2, 1.3, 1.8, '#dc2626');
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 0.5, headY + 2.5);
    ctx.lineTo(bodyDx + 5.2, headY + 3.5);
    ctx.stroke();
    if (!pal.ninjaHeadTie) {
      pxRect(ctx, bodyDx + 1.2, headY + 7.5, 3.8, 2, '#ffffff', '#090d16', 0.8);
    }
  } else if (anim === 'hurt') {
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 1, headY + 3.8);
    ctx.lineTo(bodyDx + 4.5, headY + 4.8);
    ctx.lineTo(bodyDx + 1, headY + 5.5);
    ctx.stroke();
    if (!pal.ninjaHeadTie) {
      pxRect(ctx, bodyDx + 2, headY + 7.2, 3, 2, '#991b1b');
    }
  } else {
    // Sharp sclera + dark iris + determined slanted eyebrow
    pxRect(ctx, bodyDx + 1.5, headY + 4, 3.4, 2.2, '#ffffff');
    pxRect(ctx, bodyDx + 3.5, headY + 4.2, 1.5, 1.9, '#090d16');
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 0.6, headY + 2.6);
    ctx.lineTo(bodyDx + 5.4, headY + 3.6);
    ctx.stroke();
    if (!pal.ninjaHeadTie) {
      // Gritted expression on attack/stance or determined line on idle
      if (
        anim === 'punch1' ||
        anim === 'punch2' ||
        anim === 'heavyPunch' ||
        anim === 'kickFinisher' ||
        anim === 'fightStance' ||
        isComboHoldGuard
      ) {
        pxRect(ctx, bodyDx + 1.5, headY + 7.6, 3.2, 1.6, '#ffffff', '#090d16', 0.75);
      } else {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(bodyDx + 1.8, headY + 8, 2.8, 1);
      }
    }
    if (isFemale) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bodyDx + 1, headY + 3.5, 1.2, 1);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(bodyDx + 2, headY + 8.1, 2.4, 1);
    }
  }

  // --- FRONT BACKPACK SHIELD (bagGuard or makeup shield) ---
  if (hasMakeupShield || anim === 'bagGuard') {
    const bagX = anim === 'bagGuard' ? bodyDx + 4 : bodyDx + 3;
    const bagY = anim === 'bagGuard' ? torsoTopY - 2 : torsoTopY + 1;
    pxBlockShaded(ctx, bagX, bagY, 10, 17, pal.bagMain, pal.bagDark, pal.bagTrim);
    pxRect(ctx, bagX + 2, bagY + 5, 7, 8, customCfg ? pal.bagPocket : '#38bdf8', '#090d16', 1.1);
    pxRect(ctx, bagX + 3, bagY + 2, 5, 1.5, '#facc15');

    if (anim === 'bagGuard') {
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
  if (anim === 'punch1') {
    const maxReach = 22;
    if (animProgress < 0.18) {
      // Snappy jab coil
      const pull = animProgress / 0.18;
      const backX = bodyDx - 2.2 * pull;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.5, backX - 1.5, torsoTopY + 6, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, backX - 1.5, torsoTopY + 6, -0.25, 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, backX - 1.5, torsoTopY + 6, backX + 2.5, torsoTopY + 4, 4.5, skinTone, skinShade);
      celFist(ctx, backX + 3.5, torsoTopY + 3.8, 5.8, skinTone, skinShade);
    } else if (animProgress < 0.68) {
      // Crisp horizontal jab + yellow speed smear
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.5, bodyDx + 11, torsoTopY + 3.5, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 11.5, torsoTopY + 3.5, 0, 5.2, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 12.5, torsoTopY + 3.5, bodyDx + maxReach, torsoTopY + 3.5, 4.6, skinTone, skinShade);
      celFist(ctx, bodyDx + maxReach + 1.5, torsoTopY + 3.2, 6.4, skinTone, skinShade);
      ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
      ctx.fillRect(bodyDx + 12, torsoTopY + 0.5, 11, 1.3);
    } else {
      // Hold coiled forward combat guard when chained (prevents drop back to neutral)
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      const minExt = isComboChainActive ? 12.5 : 9;
      const extX = bodyDx + minExt + rec * (maxReach - minExt);
      const fistY = isComboChainActive ? torsoTopY + 2.6 + rec * 0.9 : torsoTopY + 3.5;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.8, bodyDx + 7 + rec * 4, torsoTopY + 4.2, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 7.5 + rec * 4, torsoTopY + 4.2, -0.25 * (1 - rec), 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 8 + rec * 4, torsoTopY + 4.2, extX, fistY, 4.5, skinTone, skinShade);
      celFist(ctx, extX + 1, fistY - 0.3, 5.8, skinTone, skinShade);
    }
  } else if (anim === 'punch2') {
    // 2nd hit: rotated shoulder power cross/hook flowing smoothly out of jab or kick
    const maxReach = 26.5;
    if (animProgress < 0.20) {
      // Coil rear/power shoulder back seamlessly from punch1/kick forward stance
      const pull = animProgress / 0.20;
      const startX = prevComboAnim === 'punch1' ? bodyDx + 11 : bodyDx + 6;
      const elbowX = startX + (bodyDx - 3.5 - startX) * pull;
      const elbowY = torsoTopY + 5 + pull * 1.5;
      const fistX = startX + (bodyDx + 1 - startX) * pull;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.8, elbowX, elbowY, 5.1, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, -0.2, 5.1, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, fistX, torsoTopY + 4, 4.6, skinTone, skinShade);
      celFist(ctx, fistX + 1, torsoTopY + 3.6, 6.0, skinTone, skinShade);
    } else if (animProgress < 0.68) {
      // Driving power cross with dual white+gold speed streaks and rotated fist
      pxLimb(ctx, bodyDx + 2.5, torsoTopY + 3.2, bodyDx + 13, torsoTopY + 2.8, 5.4, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 13.5, torsoTopY + 2.8, -0.05, 5.3, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 14.5, torsoTopY + 2.8, bodyDx + maxReach, torsoTopY + 2.4, 4.8, skinTone, skinShade);
      celFist(ctx, bodyDx + maxReach + 1.5, torsoTopY + 2.2, 6.8, skinTone, skinShade);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bodyDx + 12, torsoTopY - 0.2, 13, 1.4);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.88)';
      ctx.fillRect(bodyDx + 10, torsoTopY + 4.6, 13, 1.3);
    } else {
      // Torque follow-through recovery ready to wind up heavyPunch or kickFinisher
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      const minExt = isComboChainActive ? 13 : 9.5;
      const extX = bodyDx + minExt + rec * (maxReach - minExt);
      const fistY = isComboChainActive ? torsoTopY + 2.5 : torsoTopY + 3.2;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.6, bodyDx + 7.5 + rec * 5, torsoTopY + 3.8, 5.1, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 8 + rec * 5, torsoTopY + 3.8, -0.2 * (1 - rec), 5.1, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 8.5 + rec * 5, torsoTopY + 3.8, extX, fistY, 4.6, skinTone, skinShade);
      celFist(ctx, extX + 1, fistY - 0.2, 6.0, skinTone, skinShade);
    }
  } else if (anim === 'heavyPunch') {
    if (animProgress < 0.30) {
      // Antecipação: shoulder & fist pulled back deep with crackling kinetic glint
      const pull = Math.min(1, animProgress / 0.30);
      const backX = bodyDx - 4 - pull * 7;
      const fistY = torsoTopY + 5.5;
      pxLimb(ctx, bodyDx + 1, torsoTopY + 4, backX + 2, fistY + 2, 5.3, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, backX + 2, fistY + 2, -0.35, 5.3, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, backX + 2, fistY + 2, backX, fistY, 4.9, skinTone, skinShade);
      celFist(ctx, backX - 1.5, fistY, 6.7, skinTone, skinShade, '#020617');
      if (pull > 0.45) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(px(backX - 3), px(fistY - 6), 2.5, 2.5);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(px(backX - 6), px(fistY + 3), 2, 2);
      }
    } else if (animProgress < 0.68) {
      // Impacto: explosive finisher punch with triple streaks + shockwave arc
      const reach = 30.5;
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(bodyDx + 19, torsoTopY + 3, 13, -0.95, 0.95);
      ctx.stroke();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(bodyDx + 21, torsoTopY + 3, 10, -0.8, 0.8);
      ctx.stroke();

      pxLimb(ctx, bodyDx + 2, torsoTopY + 3.5, bodyDx + 13.5, torsoTopY + 3.4, 5.6, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 14, torsoTopY + 3.4, 0, 5.5, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 15, torsoTopY + 3.4, bodyDx + reach, torsoTopY + 2.8, 5.1, skinTone, skinShade);
      celFist(ctx, bodyDx + reach + 1.5, torsoTopY + 2.6, 7.6, skinTone, skinShade, '#020617');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bodyDx + 9, torsoTopY + 0.2, 18, 1.6);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bodyDx + 7, torsoTopY + 5.6, 17, 1.4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(bodyDx + 11, torsoTopY + 7.6, 11, 1.2);
    } else {
      // Recuo: proud finisher follow-through retracting toward combat guard
      const rec = Math.max(0, 1 - (animProgress - 0.68) / 0.32);
      const extX = bodyDx + 12 + rec * 12;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 8 + rec * 3, torsoTopY + 4.5, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx + 8.5 + rec * 3, torsoTopY + 4.5, 0, 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 9 + rec * 3, torsoTopY + 4.5, extX, torsoTopY + 3, 4.5, skinTone, skinShade);
      celFist(ctx, extX + 1, torsoTopY + 2.8, 6.2, skinTone, skinShade, '#020617');
      ctx.save();
      ctx.globalAlpha = rec * 0.85;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(px(extX + 5 + (1 - rec) * 4), px(torsoTopY - 2 - (1 - rec) * 5), 2, 2);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(px(extX + 2), px(torsoTopY + 7 + (1 - rec) * 3), 2, 2);
      ctx.restore();
    }
  } else if (anim === 'kick') {
    if (animProgress < 0.70) {
      // Snappy counterbalance whip during ground kick
      const whip = animProgress >= 0.24 ? 1 : animProgress / 0.24;
      const elbowX = bodyDx + 4 - whip * 9;
      const elbowY = torsoTopY + 5 + whip * 2;
      const fistX = bodyDx + 8 - whip * 15;
      const fistY = torsoTopY + 3 + whip * 3;
      pxLimb(ctx, bodyDx + 1, torsoTopY + 4, elbowX, elbowY, 4.8, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, -0.35, 4.8, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, fistX, fistY, 4.4, skinTone, skinShade);
      celFist(ctx, fistX, fistY, 5.4, skinTone, skinShade);
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.70) / 0.30);
      const targetX = isComboChainActive ? bodyDx + 12 : bodyDx + 9;
      const fistX = targetX - rec * 16;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 6 - rec * 11, torsoTopY + 6, 4.8, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 6 - rec * 11, torsoTopY + 6, fistX, torsoTopY + 2.5, 4.4, skinTone, skinShade);
      celFist(ctx, fistX, torsoTopY + 2.2, 5.4, skinTone, skinShade);
    }
  } else if (anim === 'kickFinisher') {
    if (animProgress < 0.26) {
      // Coiled spring crouch arms pulled across chest ready to whip at contact frame
      pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 6, torsoTopY + 7, 4.9, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 6, torsoTopY + 7, bodyDx + 10, torsoTopY + 3, 4.5, skinTone, skinShade);
      celFist(ctx, bodyDx + 10.5, torsoTopY + 2.8, 5.6, skinTone, skinShade);
    } else if (animProgress < 0.72) {
      // Expressive wide martial-arts counterbalance fling during high roundhouse finisher
      pxLimb(ctx, bodyDx, torsoTopY + 3.5, bodyDx - 8, torsoTopY + 2, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, bodyDx - 8, torsoTopY + 2, -2.7, 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx - 8, torsoTopY + 2, bodyDx - 13, torsoTopY + 0.5, 4.5, skinTone, skinShade);
      celFist(ctx, bodyDx - 13.5, torsoTopY + 0.5, 5.8, skinTone, skinShade);
    } else {
      const rec = Math.max(0, 1 - (animProgress - 0.72) / 0.28);
      const fistX = bodyDx + 11 - rec * 24;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 6 - rec * 14, torsoTopY + 5, 4.9, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, bodyDx + 6 - rec * 14, torsoTopY + 5, fistX, torsoTopY + 1.5, 4.5, skinTone, skinShade);
      celFist(ctx, fistX, torsoTopY + 1.2, 5.6, skinTone, skinShade);
    }
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
    const drawCaneShaft = (handX: number, handY: number, angle: number, length = 21) => {
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(angle);
      // Crisp 16-bit dark outline
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(length, 0);
      ctx.arc(length, -3.2, 3.2, Math.PI * 0.5, Math.PI * 1.85, true);
      ctx.stroke();
      // Rich mahogany wood shaft
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(length, 0);
      ctx.arc(length, -3.2, 3.2, Math.PI * 0.5, Math.PI * 1.85, true);
      ctx.stroke();
      // Top amber wood highlight + brass ferrule ring
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -0.7);
      ctx.lineTo(length - 1, -0.7);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(length - 4, -1.3, 2, 2.6);
      ctx.restore();
    };

    if (isFinalCaneSpin) {
      if (animProgress < 0.16) {
        // Quick rotary windup across body
        const ant = animProgress / 0.16;
        const elbowX = bodyDx - 4 * ant;
        const elbowY = torsoTopY + 5;
        const handX = bodyDx - 8 * ant;
        const handY = torsoTopY + 3;
        pxLimb(ctx, bodyDx + 1, torsoTopY + 4, elbowX, elbowY, 4.9, pal.sleeveMain, pal.sleeveShadow);
        celRolledCuff(ctx, elbowX, elbowY, -2.5, 4.9, pal.sleeveMain, pal.sleeveShadow);
        pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
        drawCaneShaft(handX, handY, -2.7, 21);
        celFist(ctx, handX, handY, 5.5, skinTone, skinShade);
      } else if (animProgress < 0.78) {
        // 360-degree tornado rotary cane finisher (purely visual, no extra force)
        const spinPhase = (animProgress - 0.16) / 0.62;
        const spinRad = spinPhase * Math.PI * 2;
        const extProj = Math.cos(spinRad);
        const shoulderX = bodyDx + 2;
        const shoulderY = torsoTopY + 4;
        const handX = shoulderX + extProj * 13;
        const handY = shoulderY + Math.sin(spinRad) * 2.5;
        const elbowX = (shoulderX + handX) * 0.5;
        const elbowY = (shoulderY + handY) * 0.5;

        // 360-degree golden/orange tornado sweep rings
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.ellipse(bodyDx + 2, torsoTopY + 5, 34, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(bodyDx + 2, torsoTopY + 5, 30, 8.2, 0, spinRad - 1.4, spinRad + 1.4);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(bodyDx + 2, torsoTopY + 5, 26, 6.6, 0, spinRad - 0.8, spinRad + 0.8);
        ctx.stroke();

        pxLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 4.9, pal.sleeveMain, pal.sleeveShadow);
        celRolledCuff(ctx, elbowX, elbowY, extProj >= 0 ? 0 : Math.PI, 4.9, pal.sleeveMain, pal.sleeveShadow);
        pxLimb(ctx, elbowX, elbowY, handX, handY, 4.5, skinTone, skinShade);
        drawCaneShaft(handX, handY, extProj >= 0 ? 0.05 : Math.PI - 0.05, Math.max(11, Math.abs(extProj) * 23));
        celFist(ctx, handX, handY, 5.6, skinTone, skinShade);
      } else {
        // Stylish follow-through return to horizontal chest guard
        const rec = Math.min(1, (animProgress - 0.78) / 0.22);
        const elbowX = bodyDx + 2 - rec * 2;
        const elbowY = torsoTopY + 8;
        const handX = bodyDx + 13 - rec * 4;
        const handY = torsoTopY + 7;
        pxLimb(ctx, bodyDx + 2, torsoTopY + 4, elbowX, elbowY, 4.8, pal.sleeveMain, pal.sleeveShadow);
        celRolledCuff(ctx, elbowX, elbowY, 0.2, 4.8, pal.sleeveMain, pal.sleeveShadow);
        pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
        drawCaneShaft(handX, handY, 0.04, 20);
        celFist(ctx, handX, handY, 5.4, skinTone, skinShade);
      }
    } else if (animProgress < 0.22) {
      // Frame 2: Arm cocked high overhead with hooked cane tucked diagonally behind head/back
      const ant = animProgress / 0.22;
      const shoulderX = bodyDx + 1;
      const shoulderY = torsoTopY + 3;
      const elbowX = bodyDx - 2 - ant * 2;
      const elbowY = torsoTopY - 4 - ant * 4.5;
      const handX = bodyDx - 7 - ant * 3.5;
      const handY = torsoTopY - 2 - ant * 3;
      pxLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 4.8, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, -2.1, 4.8, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
      drawCaneShaft(handX, handY, 2.28 - (1 - ant) * 0.35, 19);
      celFist(ctx, handX, handY, 5.4, skinTone, skinShade);
    } else if (animProgress < 0.46) {
      // Frame 3: Snapped high forward diagonal cane slash/thrust
      const t = (animProgress - 0.22) / 0.24;
      const ease = 1 - Math.pow(1 - t, 2);
      const shoulderX = bodyDx + 2;
      const shoulderY = torsoTopY + 3;
      const slashAngle = -0.44 * ease - 1.2 * (1 - ease);
      const handX = shoulderX + Math.cos(slashAngle) * 14;
      const handY = shoulderY + Math.sin(slashAngle) * 14;
      const elbowX = (shoulderX + handX) * 0.5;
      const elbowY = (shoulderY + handY) * 0.5;

      // High diagonal slash smear
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(shoulderX, shoulderY, 27, -1.65, slashAngle + 0.1);
      ctx.stroke();

      pxLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 4.9, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, slashAngle, 4.9, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
      drawCaneShaft(handX, handY, slashAngle, 21);
      celFist(ctx, handX, handY, 5.5, skinTone, skinShade);
    } else if (animProgress < 0.72) {
      // Frame 4: Deep downward-forward lunge sweep with cane parallel/low at knee height
      const t = (animProgress - 0.46) / 0.26;
      const ease = 1 - Math.pow(1 - t, 2.4);
      const shoulderX = bodyDx + 3;
      const shoulderY = torsoTopY + 4;
      const sweepAngle = -0.40 + 0.66 * ease;
      const handX = shoulderX + Math.cos(sweepAngle) * 13.5;
      const handY = shoulderY + Math.sin(sweepAngle) * 13.5 + 1.5;
      const elbowX = shoulderX + Math.cos(sweepAngle) * 6.5;
      const elbowY = shoulderY + Math.sin(sweepAngle) * 6.5 + 0.8;

      // Wide blazing arc from high slash through low forward sweep
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(shoulderX, shoulderY, 29, -0.55, sweepAngle + 0.14);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(shoulderX, shoulderY, 26, -0.45, sweepAngle + 0.08);
      ctx.stroke();

      pxLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 4.9, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, sweepAngle, 4.9, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
      drawCaneShaft(handX, handY, sweepAngle * 0.55, 21);
      celFist(ctx, handX, handY, 5.5, skinTone, skinShade);
    } else {
      // Frames 5-7: Pull cane horizontally back across chest/waist into tight guard recovery
      const rec = Math.min(1, (animProgress - 0.72) / 0.28);
      const shoulderX = bodyDx + 2;
      const shoulderY = torsoTopY + 4;
      const elbowX = bodyDx + 1 - rec * 2;
      const elbowY = torsoTopY + 9;
      const handX = bodyDx + 13 - rec * 4;
      const handY = torsoTopY + 8 - rec * 1;
      pxLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 4.8, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, 0.2, 4.8, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, handX, handY, 4.4, skinTone, skinShade);
      drawCaneShaft(handX, handY, 0.04, 20);
      celFist(ctx, handX, handY, 5.4, skinTone, skinShade);
    }
  } else if (anim === 'finisherPiledriver') {
    if (animProgress < 0.22) {
      pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + 14, torsoTopY + 6, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 15, torsoTopY + 6, 5.8, skinTone, skinShade);
    } else if (animProgress < 0.56) {
      // Arms raised lifting inverted boss overhead
      pxLimb(ctx, bodyDx + 3, torsoTopY + 2, bodyDx + 7, torsoTopY - 8, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 7, torsoTopY - 9, 5.8, skinTone, skinShade);
    } else {
      // Driving arms tight around inverted boss during slam
      pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 11, torsoTopY + 10, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 12, torsoTopY + 10, 5.8, skinTone, skinShade);
    }
  } else if (anim === 'finisherGiantSwing') {
    const reachX = animProgress < 0.20 ? 15 : animProgress < 0.80 ? Math.cos(((animProgress - 0.20) / 0.60) * Math.PI * 4) * 16 : 17;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + reachX, torsoTopY + 6, 5.2, pal.sleeveMain, pal.sleeveShadow);
    celFist(ctx, bodyDx + reachX, torsoTopY + 6, 5.8, skinTone, skinShade);
  } else if (anim === 'finisherGroundPound') {
    if (animProgress >= 0.18 && animProgress < 0.50) {
      const sub = (animProgress - 0.18) / 0.32;
      const strikeY = sub < 0.38 ? torsoTopY - 12 : hipY + 7;
      const strikeX = sub < 0.38 ? bodyDx - 2 : bodyDx + 7;
      pxLimb(ctx, bodyDx + 3, torsoTopY + 3, strikeX, strikeY, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, strikeX, strikeY, 6.4, skinTone, skinShade);
    } else if (animProgress >= 0.50 && animProgress < 0.82) {
      pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 7, torsoTopY + 9, 4.8, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 7, torsoTopY + 10, 5.4, skinTone, skinShade);
    } else {
      pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 9, torsoTopY + 10, 4.8, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 10, torsoTopY + 10, 5.6, skinTone, skinShade);
    }
  } else if (anim === 'finisherCollarKnee') {
    if (animProgress < 0.64) {
      // Grabbing & yanking collar close
      pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + 15, torsoTopY + 1, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + 16, torsoTopY + 1, 5.8, skinTone, skinShade);
    } else {
      // Forward shove pushing boss down
      const sh = Math.sin(((animProgress - 0.64) / 0.36) * Math.PI);
      const reach = 12 + sh * 10;
      pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + reach, torsoTopY + 3, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celFist(ctx, bodyDx + reach + 1, torsoTopY + 3, 6.0, skinTone, skinShade);
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
  } else if (anim === 'victoryTie') {
    // Left arm confident on hip
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 8, torsoTopY + 11, 4.5, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx - 8, torsoTopY + 11, bodyDx - 5, hipY - 1, 4.2, '#e5a97c', '#b46e42');

    // Right arm bent gracefully across chest straightening tie/collar ("Nem suou!")
    const adjustPulse = Math.floor(auraClock * 4.5) % 2 === 0 ? 0 : 0.8;
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY + 7, 4.6, pal.sleeveMain, pal.sleeveShadow);
    celRolledCuff(ctx, bodyDx + 9.5, torsoTopY + 6.5, -0.5, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 9.5, torsoTopY + 6.5, bodyDx + 3.8, torsoTopY + 3.2 - adjustPulse, 4.2, skinTone, skinShade);
    pxRect(ctx, bodyDx + 1.5, torsoTopY + 1.5 - adjustPulse, 4.5, 4, skinTone, '#090d16', 1.0);

    // Crisp golden "bling" glint right off the tie knot / collar
    const bx = px(bodyDx + 2);
    const by = px(torsoTopY - 2);
    const bs = Math.floor(auraClock * 6) % 2 === 0 ? 4 : 2;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(bx - 0.8, by - bs, 1.6, bs * 2);
    ctx.fillRect(bx - bs, by - 0.8, bs * 2, 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 0.6, by - 0.6, 1.2, 1.2);
  } else if (anim === 'victoryBadge') {
    // Left arm fist on hip
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 9, torsoTopY + 11, 4.5, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx - 9, torsoTopY + 11, bodyDx - 5, hipY - 1, 4.2, '#e5a97c', '#b46e42');

    // Right arm thrust diagonally forward holding corporate ID badge ("Ponto Garantido!")
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY - 1, 4.6, pal.sleeveMain, pal.sleeveShadow);
    celRolledCuff(ctx, bodyDx + 10, torsoTopY - 1, -0.35, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 10, torsoTopY - 1, bodyDx + 14, headY - 5, 4.3, skinTone, skinShade);
    pxRect(ctx, bodyDx + 12, headY - 8, 5, 5, skinTone, '#090d16', 1.0);

    // Enlarged 16-bit ID badge held proudly aloft with lanyard strap
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bodyDx + 14.5, headY - 8);
    ctx.lineTo(bodyDx + 15.5, headY - 13);
    ctx.stroke();
    pxRect(ctx, bodyDx + 11.5, headY - 21, 8.5, 10, '#f8fafc', '#090d16', 1.2);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(bodyDx + 13, headY - 19, 3.5, 3.5);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(bodyDx + 13, headY - 14, 5.5, 1.6);

    const sx = px(bodyDx + 20);
    const sy = px(headY - 22);
    const ss = Math.floor(auraClock * 7) % 2 === 0 ? 4 : 2;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(sx - 0.8, sy - ss, 1.6, ss * 2);
    ctx.fillRect(sx - ss, sy - 0.8, ss * 2, 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 0.6, sy - 0.6, 1.2, 1.2);
  } else if (anim === 'victoryCoffee') {
    // Left arm resting casually on hip
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 8, torsoTopY + 11, 4.5, pal.sleeveShadow, '#475569');
    pxLimb(ctx, bodyDx - 8, torsoTopY + 11, bodyDx - 5, hipY - 1, 4.2, '#e5a97c', '#b46e42');

    // Right arm raising a steaming 16-bit coffee cup in a victory toast!
    const sipLift = idleFrame === 1 ? -1 : 0;
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY + 5, 4.6, pal.sleeveMain, pal.sleeveShadow);
    celRolledCuff(ctx, bodyDx + 10, torsoTopY + 5, -0.25, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 10, torsoTopY + 5, bodyDx + 14, torsoTopY + sipLift, 4.3, skinTone, skinShade);
    pxRect(ctx, bodyDx + 12, torsoTopY - 2 + sipLift, 5, 4.5, skinTone, '#090d16', 1.0);

    // 16-bit coffee cup with brown sleeve + hot coffee top
    const cupX = bodyDx + 13;
    const cupY = torsoTopY - 9 + sipLift;
    pxRect(ctx, cupX, cupY, 7, 8, '#f8fafc', '#090d16', 1.1);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cupX + 1, cupY + 3, 5, 3);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cupX + 1, cupY + 0.5, 5, 1.5);

    // Rising animated pixel steam wisps
    const steamTick = Math.floor(auraClock * 6) % 2;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(px(cupX + 1.5 + steamTick), px(cupY - 4), 1.5, 2.5);
    ctx.fillRect(px(cupX + 4.5 - steamTick), px(cupY - 7), 1.5, 2.5);
  } else if (anim === 'fightStance' || isComboHoldGuard) {
    const fBob = isComboHoldGuard ? 0 : Math.sin(auraClock * 9.5) > 0 ? 1 : -1;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, bodyDx + 7, torsoTopY + 5.8 + fBob, 4.8, pal.sleeveMain, pal.sleeveShadow);
    celRolledCuff(ctx, bodyDx + 7.2, torsoTopY + 5.6 + fBob, -0.5, 4.8, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 7.5, torsoTopY + 5.3 + fBob, bodyDx + 12.8, torsoTopY + 1.5 + fBob, 4.4, skinTone, skinShade);
    celFist(ctx, bodyDx + 13.3, torsoTopY + 1 + fBob, 5.6, skinTone, skinShade);
  } else if (anim === 'jumpPunch') {
    if (animProgress < 0.18) {
      // Quick Shoryuken coil prep: lead elbow & fist tucked low by hip/ribs
      const pull = animProgress / 0.18;
      const elbowX = bodyDx - 1 - pull * 1.5;
      const elbowY = torsoTopY + 8 + pull * 2;
      const fistX = bodyDx + 5;
      const fistY = hipY - 1;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 4, elbowX, elbowY, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, 0.25, 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, fistX, fistY, 4.5, skinTone, skinShade);
      celFist(ctx, fistX + 0.5, fistY, 5.8, skinTone, skinShade);
    } else if (animProgress < 0.74) {
      // Rising Shoryuken Dragon Uppercut: vertical skyward punch + blazing crescent & speed streaks
      const sub = Math.min(1, (animProgress - 0.18) / 0.18);
      const fistX = bodyDx + 7.5;
      const fistY = headY - 8 - sub * 8.5;
      const elbowX = bodyDx + 6;
      const elbowY = torsoTopY - 3 - sub * 3;

      // Iconic rising Shoryuken crescent arc (gold core + white flash + cyan edge)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(bodyDx + 1, torsoTopY - 4, 21, -1.55, 0.35);
      ctx.stroke();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(bodyDx + 1, torsoTopY - 4, 18.5, -1.48, 0.28);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bodyDx + 1, torsoTopY - 4, 16.5, -1.4, 0.18);
      ctx.stroke();

      // Vertical 16-bit rising speed streaks
      ctx.fillStyle = 'rgba(254, 240, 138, 0.88)';
      ctx.fillRect(px(fistX - 4), px(fistY + 6), 1.5, 13);
      ctx.fillRect(px(fistX + 4), px(fistY + 4), 1.5, 15);
      ctx.fillStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.fillRect(px(bodyDx - 2), px(torsoTopY - 4), 1.5, 14);

      pxLimb(ctx, bodyDx + 2, torsoTopY + 2, elbowX, elbowY, 5.2, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, -Math.PI * 0.48, 5.1, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, fistX, fistY + 2, 4.7, skinTone, skinShade);
      celFist(ctx, fistX, fistY, 6.6, skinTone, skinShade);
    } else {
      // Natural airborne recovery descending back toward guard
      const rec = Math.max(0, 1 - (animProgress - 0.74) / 0.26);
      const elbowX = bodyDx + 7 - (1 - rec) * 1;
      const elbowY = torsoTopY + 5 - rec * 11;
      const fistX = bodyDx + 10 - rec * 2.5;
      const fistY = torsoTopY - 1 - rec * 15;
      pxLimb(ctx, bodyDx + 2, torsoTopY + 3, elbowX, elbowY, 5.0, pal.sleeveMain, pal.sleeveShadow);
      celRolledCuff(ctx, elbowX, elbowY, -0.9 * rec, 5.0, pal.sleeveMain, pal.sleeveShadow);
      pxLimb(ctx, elbowX, elbowY, fistX, fistY + 1, 4.5, skinTone, skinShade);
      celFist(ctx, fistX, fistY, 5.8, skinTone, skinShade);
    }
  } else if (anim === 'jumpKick' || anim === 'cranePrep' || anim === 'craneKick' || anim === 'trinityFreeze') {
    pxLimb(ctx, bodyDx + 3, torsoTopY + 3, bodyDx + 11, torsoTopY - 3, 4.5, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 11, torsoTopY - 3, bodyDx + 15, torsoTopY - 9, 4.3, skinTone, skinShade);
    celFist(ctx, bodyDx + 15.5, torsoTopY - 9.5, 5.2, skinTone, skinShade);
  } else if (anim === 'stunnerDrop') {
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 8, torsoTopY - 2, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, bodyDx + 8, torsoTopY - 2, bodyDx + 12, headY + 3, 4.4, skinTone, skinShade);
    celFist(ctx, bodyDx + 12, headY + 2.5, 5.4, skinTone, skinShade);
  } else if (anim === 'rkoCatch' || anim === 'rkoSlam') {
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 14, torsoTopY + 3, 4.8, pal.sleeveMain, pal.sleeveShadow);
    celFist(ctx, bodyDx + 15.5, torsoTopY + 3, 5.6, skinTone, skinShade);
  } else if (anim === 'trinityStrike') {
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 12, torsoTopY + 1, 4.5, pal.sleeveMain, pal.sleeveShadow);
    celFist(ctx, bodyDx - 13, torsoTopY + 1, 4.8, skinTone, skinShade);
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 10, torsoTopY + 8, 4.5, skinTone, skinShade);
    celFist(ctx, bodyDx + 11, torsoTopY + 8.5, 5.2, skinTone, skinShade);
  } else if (anim === 'matrixDodge') {
    pxLimb(ctx, bodyDx - 3, torsoTopY + 4, bodyDx - 13, torsoTopY - 2, 4.4, pal.sleeveShadow, '#334155');
    pxLimb(ctx, bodyDx + 3, torsoTopY + 4, bodyDx + 12, torsoTopY - 4, 4.4, skinTone, skinShade);
  } else if (anim === 'burlyFlurry') {
    const f1 = Math.sin(auraClock * 42) * 5;
    const f2 = Math.cos(auraClock * 42) * 5;
    pxLimb(ctx, bodyDx + 2, torsoTopY + 3, bodyDx + 18 + f1, torsoTopY + 1, 4.4, pal.sleeveMain, pal.sleeveShadow);
    celFist(ctx, bodyDx + 19 + f1, torsoTopY + 1, 5.4, skinTone, skinShade);
    pxLimb(ctx, bodyDx + 2, torsoTopY + 6, bodyDx + 16 - f2, torsoTopY + 7, 4.2, skinTone, skinShade);
    celFist(ctx, bodyDx + 17 - f2, torsoTopY + 7, 5.2, '#22c55e', '#15803d');
    pxLimb(ctx, bodyDx - 2, torsoTopY + 4, bodyDx - 16 + f2, torsoTopY + 3, 4.2, pal.sleeveShadow, '#334155');
    celFist(ctx, bodyDx - 17 + f2, torsoTopY + 3, 5.2, '#fde047', '#ca8a04');
  } else {
    // Lead arm synced in opposition to legs across 8-frame walk cycle
    const swing = anim === 'walk' ? [-3.8, -2.5, 0, 2.5, 3.8, 2.5, 0, -2.5][walkFrame] : 0;
    const elbowLift = anim === 'walk' ? [0.4, 0.1, -0.5, 0.2, 0.5, 0.1, -0.5, 0.2][walkFrame] : 0;
    const elbowX = bodyDx + 4.8 + swing * 0.7;
    const elbowY = torsoTopY + 9 + elbowLift;
    const fistX = bodyDx + 9 + swing * 1.15;
    const fistY = torsoTopY + 6 + (swing > 0 ? -0.9 : 0.7);
    pxLimb(ctx, bodyDx + 2, torsoTopY + 4, elbowX, elbowY, 4.7, pal.sleeveMain, pal.sleeveShadow);
    celRolledCuff(ctx, elbowX + 0.2, elbowY - 0.5, -0.35, 4.6, pal.sleeveMain, pal.sleeveShadow);
    pxLimb(ctx, elbowX + 0.5, elbowY - 0.5, fistX, fistY, 4.3, skinTone, skinShade);
    celFist(ctx, fistX + 0.8, fistY - 0.5, 5.2, skinTone, skinShade);

    if (hasCane) {
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(fistX, fistY);
      ctx.lineTo(fistX + 10, fistY - 10);
      ctx.arc(fistX + 11, fistY - 8, 2.5, -Math.PI * 0.75, Math.PI * 0.35, false);
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
  time: number,
  heavyHurt = false,
  finisherKind?: BossFinisherKind,
  finisherProg = 0,
  finisherPhaseAngle = 0,
  renderAlpha = 1,
  bossAttackMode?: BossMotoristaAttackKind,
  bossAnimProg = 0,
  bossEnraged = false,
  reducedMotion = false
) {
  ctx.save();

  const clampedAlpha = Math.max(0.25, Math.min(1, renderAlpha));
  const isOccludedFade = clampedAlpha < 0.96;

  const isLargeBoss = type === 'boss_cobrador_blindado' || type === 'boss_cobrador';
  const shadowW = isLargeBoss ? 22 : 16;
  ctx.fillStyle = `rgba(6, 9, 22, ${(0.66 * clampedAlpha).toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(x + 2 * facing, y + 0.6, shadowW, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(6, 9, 22, ${(0.40 * clampedAlpha).toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(x + 4 * facing, y + 1.2, shadowW + 4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stink aura for Industry Worker (minimal clean 16-bit dots)
  if (type === 'industria' && stinkActive) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.55, clampedAlpha);
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

  const isFinisherVictim = aiState === 'finisherVictim';
  const isAboutToAttack =
    !isFinisherVictim &&
    (aiState === 'windup' || aiState === 'spinWindup' || aiState === 'skateWindup');
  const warnPulse = isAboutToAttack ? 0.42 + (reducedMotion ? 0 : Math.sin(time * 20) * 0.16) : 0;

  // Floor telegraphs: Motorista Furioso has attack-specific floor readability (dash lane / stomp zone / horn / turbo)
  if (type === 'boss_motorista' && isAboutToAttack) {
    const pNorm = Math.max(0, Math.min(1, bossAnimProg));
    ctx.save();
    if (bossAttackMode === 'freada_brusca') {
      const stompRx = 48;
      const stompRy = 16.5;
      const pulseAlpha = reducedMotion ? 0.45 : 0.42 + Math.sin(time * 22) * 0.18;
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.12 + pNorm * 0.14).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(px(x), px(y), stompRx, stompRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulseAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.ellipse(px(x), px(y), stompRx, stompRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!reducedMotion) {
        const innerRx = Math.max(6, stompRx * (0.25 + pNorm * 0.75));
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(px(x), px(y), innerRx, innerRx * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (bossAttackMode === 'acelerada') {
      const laneLen = 58;
      const laneAlpha = 0.45 + pNorm * 0.42;
      ctx.fillStyle = `rgba(250, 204, 21, ${(0.16 + pNorm * 0.14).toFixed(2)})`;
      ctx.fillRect(
        facing > 0 ? px(x + 8) : px(x - 8 - laneLen),
        px(y - 3),
        laneLen,
        6
      );
      ctx.strokeStyle = `rgba(251, 113, 133, ${laneAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.6;
      for (let c = 0; c < 3; c++) {
        const cx = x + facing * (18 + c * 15 + (reducedMotion ? 0 : (time * 32) % 8));
        ctx.beginPath();
        ctx.moveTo(cx - facing * 4, y - 4);
        ctx.lineTo(cx + facing * 3, y);
        ctx.lineTo(cx - facing * 4, y + 4);
        ctx.stroke();
      }
    } else if (aiState === 'spinWindup' || bossAttackMode === 'volante_turbo') {
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.5 + pNorm * 0.38).toFixed(2)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(px(x), px(y), 22, 7.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(250, 204, 21, ${(warnPulse * 0.9).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px(x), px(y), shadowW * 0.65, 4.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (isAboutToAttack) {
    ctx.strokeStyle = `rgba(251, 113, 133, ${(warnPulse * 0.85).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(px(x), px(y), shadowW * 0.56, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(px(x), px(y - z));

  const isKnockdown = aiState === 'knockdown';
  const isSpinning = aiState === 'spinAttack';
  const isHurt = aiState === 'hurt' || isFinisherVictim;
  if (isSpinning && type === 'boss_motorista') {
    const spinFacing = reducedMotion ? facing : Math.cos(time * 20) >= 0 ? 1 : -1;
    ctx.scale(spinFacing, 1);
  } else if (!isSpinning && !isFinisherVictim) {
    ctx.scale(facing, 1);
  } else if (isFinisherVictim) {
    if (finisherKind === 'giant_swing') {
      // Orientation handled cleanly in finisher transform below
      ctx.scale(1, 1);
    } else {
      ctx.scale(facing, 1);
    }
  }
  const knockdownBlink = isKnockdown && Math.floor(time * 20) % 2 === 0;
  const bodyAlpha = clampedAlpha * (knockdownBlink ? 0.65 : 1);

  const isSeatRest = aiState === 'seatRest';
  const isEnemyIdle = aiState === 'idle' || aiState === 'cooldown' || isSeatRest;
  const idleSeed = Math.abs(Math.round(walkPhase * 17)) + type.length * 7;
  const idleCycle = (time + (idleSeed % 11) * 0.43) % 4.4;
  const idleFidgetEnv =
    isEnemyIdle && idleCycle > 1.2 && idleCycle < 2.5
      ? Math.sin(((idleCycle - 1.2) / 1.3) * Math.PI)
      : 0;
  const strideFrame =
    aiState === 'approach' || aiState === 'seatApproach'
      ? ((Math.floor(walkPhase * 8) % 4) + 4) % 4
      : 0;
  const strideMap = [-5, 0, 5, 0];
  const walkSwing = strideMap[strideFrame];
  const bob =
    (aiState === 'approach' || aiState === 'seatApproach') && strideFrame % 2 === 1
      ? -1
      : isEnemyIdle
        ? Math.floor(time * 2.1 + idleSeed * 0.7) % 2 === 0
          ? 0
          : 1
        : 0;

  // Pose transforms for knockdown, finisherVictim, and hurt recoil
  const windupTilt = aiState === 'windup' || aiState === 'spinWindup' ? -0.1 : 0;
  if (isFinisherVictim && finisherKind) {
    if (finisherKind === 'piledriver') {
      if (finisherProg < 0.22) {
        ctx.translate(0, 2);
        ctx.rotate(0.32 * (finisherProg / 0.22));
      } else if (finisherProg < 0.56) {
        const liftT = Math.min(1, (finisherProg - 0.22) / 0.20);
        ctx.translate(0, -28);
        ctx.rotate(Math.PI * liftT);
        ctx.translate(0, 24 * liftT);
      } else if (finisherProg < 0.80) {
        const squash = finisherProg < 0.66 ? 0.84 : 1;
        ctx.translate(0, -14);
        ctx.rotate(Math.PI);
        ctx.scale(1.1, squash);
        ctx.translate(0, 22);
      } else {
        ctx.translate(0, -6);
        ctx.rotate(-1.46);
        ctx.translate(0, 12);
      }
    } else if (finisherKind === 'giant_swing') {
      if (finisherProg < 0.20) {
        ctx.translate(0, -5);
        ctx.rotate(-1.46);
        ctx.translate(0, 14);
      } else if (finisherProg < 0.80) {
        const cosA = Math.cos(finisherPhaseAngle);
        const dirSign = cosA >= 0 ? 1 : -1;
        ctx.translate(0, -22);
        ctx.rotate(dirSign * Math.PI * 0.48);
        ctx.translate(0, 18);
      } else {
        ctx.translate(0, -14);
        ctx.rotate(Math.PI * 0.46);
        ctx.translate(0, 16);
      }
    } else if (finisherKind === 'ground_pound') {
      const impact1 = finisherProg >= 0.30 && finisherProg <= 0.44;
      const impact2 = finisherProg >= 0.62 && finisherProg <= 0.76;
      const squashY = impact1 || impact2 ? 0.84 : 1;
      ctx.translate(0, -5);
      ctx.rotate(Math.PI * 0.48);
      ctx.scale(1, squashY);
      ctx.translate(0, 14);
    } else if (finisherKind === 'collar_knee') {
      if (finisherProg < 0.28) {
        const t = finisherProg / 0.28;
        ctx.translate(-2 * t, 0);
        ctx.rotate(0.14 * t);
      } else if (finisherProg < 0.64) {
        const crunch = Math.sin(((finisherProg - 0.28) / 0.36) * Math.PI);
        ctx.translate(0, 4 * crunch);
        ctx.rotate(0.64 * crunch);
      } else {
        const fall = Math.min(1, (finisherProg - 0.64) / 0.30);
        ctx.translate(0, -6 * fall);
        ctx.rotate(-1.38 * fall);
        ctx.translate(0, 12 * fall);
      }
    }
  } else if (isKnockdown) {
    if (z > 4) {
      ctx.translate(0, -14);
      ctx.rotate(-0.55 - Math.sin(walkPhase * 2) * 0.4);
      ctx.translate(0, 14);
    } else {
      ctx.translate(0, -6);
      ctx.rotate(-Math.PI * 0.48);
      ctx.translate(0, 12);
    }
  } else if (isHurt && heavyHurt) {
    ctx.translate(-6, 1.5);
    ctx.rotate(-0.48 + Math.sin(time * 38) * 0.09);
  } else if (isHurt) {
    ctx.translate(-3.5, 0.5);
    ctx.rotate(-0.30);
  } else if (isSeatRest) {
    ctx.translate(0, 4);
    ctx.rotate(-0.04);
  } else {
    if (type === 'boss_motorista') {
      if (aiState === 'windup' && bossAttackMode === 'acelerada') {
        ctx.translate(-2.5, 1);
        ctx.rotate(-0.16);
      } else if (aiState === 'attack' && bossAttackMode === 'acelerada') {
        ctx.translate(2, 0.5);
        ctx.rotate(0.18);
      } else if (aiState === 'windup' && bossAttackMode === 'freada_brusca') {
        ctx.translate(-1, -1.5);
        ctx.rotate(-0.12);
      } else if (aiState === 'attack' && bossAttackMode === 'freada_brusca') {
        ctx.scale(1.06, 0.92);
      } else if (aiState === 'spinWindup') {
        ctx.translate(0, 1.5);
        ctx.rotate(0.14);
      } else if (aiState === 'cooldown' && bossAttackMode === 'acelerada') {
        ctx.rotate(0.08);
      } else {
        ctx.rotate(windupTilt);
      }
    } else {
      ctx.rotate(windupTilt);
    }
  }

  // Subtle glowing silhouette outline when enemy is about to attack (kept full alpha for readability)
  if (isAboutToAttack) {
    const outW = isLargeBoss ? 26 : 19;
    const outH = isLargeBoss ? 54 : 46;
    const outX = -Math.round(outW / 2);
    const outY = -outH + bob;
    ctx.save();
    ctx.globalAlpha = 1;
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

  ctx.globalAlpha = bodyAlpha;

  const drawShoe = (sx: number, sy: number, col = '#0f172a', accent = '#e2e8f0', angled = false) => {
    celSneaker(ctx, sx, sy, col, '#e2e8f0', accent, angled);
  };

  // Jointed 2-segment arcade legs matching drawVectorPlayer proportions
  const drawEnemyLegs = (
    hipY: number,
    thighCol: string,
    thighDark: string,
    shinCol: string,
    shinDark: string,
    shoeCol: string,
    shoeAccent: string,
    thickness = 5.4,
    stanceSpread = 6,
    useSandals = false,
    sandalSkin = '#d99b6c'
  ) => {
    const rearFootX = isSeatRest ? 4 : -stanceSpread + walkSwing * 0.9;
    const frontFootX = isSeatRest ? 9 : stanceSpread - walkSwing * 0.9;
    const rearKneeX = isSeatRest ? 5.5 : rearFootX * 0.5 + 1.5;
    const frontKneeX = isSeatRest ? 10.5 : frontFootX * 0.55 + 2.2;
    const kneeY = isSeatRest ? hipY + 2 : hipY * 0.52;
    const footY = isSeatRest ? -6 : -2;

    pxLimb(ctx, -2, hipY, rearKneeX, kneeY, thickness + 0.4, thighCol, thighDark);
    pxLimb(ctx, rearKneeX, kneeY, rearFootX, footY, thickness, shinCol, shinDark);
    if (useSandals) {
      celSandal(ctx, rearFootX, footY + 0.5, shoeCol, sandalSkin);
    } else {
      drawShoe(rearFootX, footY, shoeCol, shoeAccent);
    }

    pxLimb(ctx, 2, hipY, frontKneeX, kneeY, thickness + 0.4, thighCol, thighDark);
    pxLimb(ctx, frontKneeX, kneeY, frontFootX, footY, thickness, shinCol, shinDark);
    if (useSandals) {
      celSandal(ctx, frontFootX + 1, footY + 0.5, shoeCol, sandalSkin);
    } else {
      drawShoe(frontFootX + 1, footY, shoeCol, shoeAccent);
    }
  };

  // Tapered cel-shaded torso with angled shadow fold & crisp highlight
  const celEnemyTorso = (
    tx: number,
    ty: number,
    w: number,
    h: number,
    base: string,
    shadow: string,
    hi: string,
    taper = 1.4
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tx, ty + 1);
    ctx.quadraticCurveTo(tx + w * 0.5, ty - 1, tx + w, ty + 1);
    ctx.lineTo(tx + w - taper * 0.4, ty + h);
    ctx.lineTo(tx + taper * 0.4, ty + h);
    ctx.closePath();
    ctx.fillStyle = base;
    ctx.fill();

    // Diagonal cel-shaded torso shadow fold
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.moveTo(tx + 0.4, ty + 2);
    ctx.lineTo(tx + w * 0.34, ty + h * 0.35);
    ctx.lineTo(tx + w * 0.45, ty + h - 2);
    ctx.lineTo(tx + w - taper * 0.5, ty + h - 3);
    ctx.lineTo(tx + w - taper * 0.4, ty + h);
    ctx.lineTo(tx + taper * 0.4, ty + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hi;
    ctx.fillRect(tx + 3, ty + 1, Math.max(2, w - 7), 2.2);

    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(tx, ty + 1);
    ctx.quadraticCurveTo(tx + w * 0.5, ty - 1, tx + w, ty + 1);
    ctx.lineTo(tx + w - taper * 0.4, ty + h);
    ctx.lineTo(tx + taper * 0.4, ty + h);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  // Expressive anime/arcade cel-shaded head matching drawVectorPlayer
  const celEnemyHead = (
    cx: number,
    hy: number,
    w: number,
    h: number,
    skin: string,
    skinShade: string,
    opts?: {
      glasses?: 'round' | 'shades' | 'wire' | 'visor';
      glassesColor?: string;
      mouth?: 'grit' | 'scowl' | 'smirk' | 'shout' | 'lip';
      mustacheColor?: string;
      browColor?: string;
      hideFace?: boolean;
    }
  ) => {
    const halfW = w * 0.5;
    ctx.save();
    // Neck connector
    ctx.fillStyle = skinShade;
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.1;
    ctx.fillRect(cx - 2.2, hy + h - 1, 4.6, 3);
    ctx.strokeRect(cx - 2.2, hy + h - 1, 4.6, 3);

    // Rounded jaw head contour
    ctx.beginPath();
    ctx.moveTo(cx - halfW, hy + 1);
    ctx.lineTo(cx + halfW, hy + 1);
    ctx.quadraticCurveTo(cx + halfW + 1.2, hy + h * 0.55, cx + halfW - 0.3, hy + h - 0.8);
    ctx.quadraticCurveTo(cx + 1.5, hy + h + 1.2, cx - 2.2, hy + h + 0.3);
    ctx.lineTo(cx - halfW - 0.2, hy + h - 2.0);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();

    // Warm jaw/cheek cel shadow
    ctx.fillStyle = skinShade;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, hy + h * 0.6);
    ctx.lineTo(cx - 1.2, hy + h * 0.84);
    ctx.lineTo(cx + halfW - 0.6, hy + h - 0.8);
    ctx.quadraticCurveTo(cx + 1.5, hy + h + 1.2, cx - 2.2, hy + h + 0.3);
    ctx.lineTo(cx - halfW - 0.2, hy + h - 2.0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, hy + 1);
    ctx.lineTo(cx + halfW, hy + 1);
    ctx.quadraticCurveTo(cx + halfW + 1.2, hy + h * 0.55, cx + halfW - 0.3, hy + h - 0.8);
    ctx.quadraticCurveTo(cx + 1.5, hy + h + 1.2, cx - 2.2, hy + h + 0.3);
    ctx.lineTo(cx - halfW - 0.2, hy + h - 2.0);
    ctx.closePath();
    ctx.stroke();

    // Side ear with inner fold
    fillStrokeCircle(ctx, cx - halfW + 0.4, hy + h * 0.52, 1.9, skin, '#090d16', 1.0);
    ctx.fillStyle = skinShade;
    ctx.fillRect(cx - halfW - 0.2, hy + h * 0.48, 1.0, 1.0);

    if (!opts?.hideFace) {
      if (isHurt) {
        // Wincing `>` eye & open hurt mouth
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx + 0.8, hy + 3.6);
        ctx.lineTo(cx + 4.0, hy + 4.6);
        ctx.lineTo(cx + 0.8, hy + 5.6);
        ctx.stroke();
        pxRect(ctx, cx + 1.6, hy + 7.2, 2.8, 2, '#991b1b', '#090d16', 0.6);
      } else {
        // Nose contour tick
        ctx.fillStyle = skinShade;
        ctx.fillRect(cx + halfW - 1.2, hy + h * 0.52, 1.4, 1.4);

        if (opts?.glasses === 'shades') {
          fillStrokeRoundRect(ctx, cx - 0.6, hy + 2.8, 6.8, 3.2, 1.2, opts.glassesColor ?? '#090d16', '#090d16', 1.0);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(cx + 0.8, hy + 3.4, 2.2, 0.9);
        } else if (opts?.glasses === 'visor') {
          fillStrokeRoundRect(ctx, cx - 0.5, hy + 2.8, 7.6, 3.6, 1.4, opts.glassesColor ?? '#ef4444', '#090d16', 1.05);
          ctx.fillStyle = '#fecaca';
          ctx.fillRect(cx + 1.0, hy + 3.6, 3.5, 1.0);
        } else {
          // Crisp anime/arcade eye (white sclera + dark iris + determined brow)
          pxRect(ctx, cx + 1.2, hy + 3.7, 3.1, 2.1, '#ffffff');
          pxRect(ctx, cx + 3.0, hy + 3.9, 1.4, 1.8, '#090d16');
          ctx.strokeStyle = opts?.browColor ?? '#090d16';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(cx + 0.4, hy + 2.5);
          ctx.lineTo(cx + 4.8, hy + 3.3);
          ctx.stroke();

          if (opts?.glasses === 'round' || opts?.glasses === 'wire') {
            ctx.strokeStyle = opts.glasses === 'round' ? '#1e293b' : '#475569';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.roundRect(cx + 0.5, hy + 3.1, 4.4, 3.1, 1.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 3.0, hy + 4.2);
            ctx.lineTo(cx + 0.5, hy + 4.2);
            ctx.stroke();
          }
        }

        if (opts?.mustacheColor) {
          fillStrokeRoundRect(ctx, cx + 0.4, hy + 6.4, 5.2, 2.0, 0.9, opts.mustacheColor, '#090d16', 0.7);
        }

        // Expressive mouth
        const mType = opts?.mouth ?? 'grit';
        if (mType === 'grit') {
          pxRect(ctx, cx + 1.0, hy + 7.4, 3.6, 1.8, '#ffffff', '#090d16', 0.75);
        } else if (mType === 'shout') {
          pxRect(ctx, cx + 1.2, hy + 7.2, 3.2, 2.4, '#7f1d1d', '#090d16', 0.75);
        } else if (mType === 'lip') {
          pxRect(ctx, cx + 1.4, hy + 7.6, 2.8, 1.5, '#db2777', '#090d16', 0.6);
        } else if (mType === 'smirk') {
          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = 1.05;
          ctx.beginPath();
          ctx.moveTo(cx + 1.2, hy + 7.8);
          ctx.quadraticCurveTo(cx + 3.2, hy + 8.3, cx + 4.4, hy + 7.2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#090d16';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(cx + 1.0, hy + 8.2);
          ctx.quadraticCurveTo(cx + 2.8, hy + 7.2, cx + 4.4, hy + 8.3);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  switch (type) {
    case 'idosa': {
      const by = -43 + bob;
      drawEnemyLegs(-15, '#d99b6c', '#b46e42', '#e5a97c', '#c68353', '#78350f', '#d97706', 4.4, 5);

      // Rear guard arm holding purse strap
      pxLimb(ctx, -3, by + 14, -6, by + 20, 3.8, '#a855f7', '#6b21a8');
      celFist(ctx, -6, by + 21, 4.2, '#f5b56e', '#d67d36');

      // Tapered floral purple dress + collar
      celEnemyTorso(-7, by + 11, 15, 19, '#a855f7', '#6b21a8', '#c084fc', 1.0);
      pxRect(ctx, -3, by + 16, 3, 3, '#f472b6');
      pxRect(ctx, 2, by + 22, 3, 3, '#fde047');
      ctx.fillStyle = '#f3e8ff';
      ctx.fillRect(-1, by + 11, 5, 2);

      // Grey hair bun + curly bangs + expressive face + reading glasses
      fillStrokeCircle(ctx, -6.5, by + 3.0, 3.6, '#94a3b8', '#090d16', 1.15);
      celEnemyHead(0.5, by, 10.5, 10.5, '#f5b56e', '#d67d36', {
        glasses: 'round',
        mouth: 'scowl',
        browColor: '#64748b',
      });
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(-5.5, by + 4);
      ctx.quadraticCurveTo(-6, by - 3, 1, by - 3.5);
      ctx.quadraticCurveTo(6.5, by - 2.5, 6, by + 1.8);
      ctx.lineTo(1, by + 1.4);
      ctx.lineTo(-4, by + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lead arm swinging hooked wooden cane
      const caneEx = aiState === 'attack' ? 18 : isHurt ? 10 : 8;
      const caneEy = aiState === 'attack' ? by + 11 : isHurt ? by + 7 : by + 28;
      pxLimb(ctx, 3, by + 14, 7, by + 17, 3.9, '#a855f7', '#6b21a8');
      celRolledCuff(ctx, 7, by + 17, -0.3, 4, '#c084fc', '#6b21a8');
      pxLimb(ctx, 7, by + 17, caneEx, caneEy, 3.6, '#78350f', '#451a03');
      celFist(ctx, 7.5, by + 17.5, 4.4, '#f5b56e', '#d67d36');
      if (aiState === 'attack') {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(6, by + 12, 15, -0.4, 0.4);
        ctx.stroke();
      }
      break;
    }

    case 'vendedor': {
      const by = -45 + bob;
      drawEnemyLegs(-16, '#1e293b', '#0f172a', '#334155', '#1e293b', '#111827', '#f8fafc', 5.2, 6);

      // Rear arm
      pxLimb(ctx, -3, by + 14, -7, by + 19, 4.4, '#0284c7', '#075985');
      celFist(ctx, -7, by + 20, 4.6, '#e5a265', '#b9733b');

      // Blue vendor shirt + rolled sleeve + yellow apron + candy tray
      celEnemyTorso(-7.5, by + 11, 15, 17, '#0284c7', '#075985', '#38bdf8');
      fillStrokeRoundRect(ctx, -4, by + 12, 9.5, 14, 1.8, '#facc15', '#090d16', 1.05);
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(-3, by + 21, 7.5, 4);

      celEnemyHead(0.2, by, 10.5, 10.5, '#e5a265', '#b9733b', { mouth: 'shout' });
      // Red baseball cap + side hair tuft
      ctx.fillStyle = '#334155';
      ctx.fillRect(-5.5, by + 1, 2.5, 3);
      fillStrokeRoundRect(ctx, -6, by - 3.2, 12, 4.4, 2, '#ef4444', '#090d16', 1.15);
      fillStrokeRoundRect(ctx, 1.5, by - 1, 7.8, 2.4, 1.1, '#991b1b', '#090d16', 1.0);

      // Lead arm with rolled cuff holding strapped candy tray
      const trayPush = aiState === 'attack' ? 4 : 0;
      pxLimb(ctx, 3, by + 14, 6, by + 19, 4.4, '#0284c7', '#075985');
      celRolledCuff(ctx, 6, by + 19, -0.2, 4.4, '#38bdf8', '#075985');
      pxLimb(ctx, 6, by + 19, 9 + trayPush, by + 21, 4.0, '#e5a265', '#b9733b');
      fillStrokeRoundRect(ctx, 1 + trayPush, by + 20, 10.5, 6, 1.5, '#be123c', '#090d16', 1.15);
      pxRect(ctx, 3 + trayPush, by + 21, 3, 2, '#f472b6');
      pxRect(ctx, 7 + trayPush, by + 21, 3, 2, '#fde047');
      celFist(ctx, 9.5 + trayPush, by + 21.5, 4.5, '#e5a265', '#b9733b');
      break;
    }

    case 'estudante': {
      const by = -45 + bob;
      drawEnemyLegs(-16, '#1e293b', '#0f172a', '#334155', '#1e293b', '#111827', '#f8fafc', 5.2, 6);

      // Rear guard arm
      pxLimb(ctx, -3, by + 14, -6, by + 19, 4.4, '#047857', '#064e3b');
      celFist(ctx, -6, by + 20, 4.6, '#f5b56e', '#d67d36');

      // Emerald hoodie/polo + collar
      celEnemyTorso(-7, by + 11, 14.5, 17, '#10b981', '#047857', '#34d399');
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(-2, by + 11, 5, 2.5);

      celEnemyHead(0, by, 10.5, 10.5, '#f5b56e', '#d67d36', { mouth: 'grit' });
      // Dark beanie + tousled fringe + orange headphones
      fillStrokeRoundRect(ctx, -6, by - 3.5, 12, 4.8, 2.2, '#1e293b', '#090d16', 1.15);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(1, by + 0.5, 5, 1.5);
      fillStrokeCircle(ctx, -2.5, by + 4.8, 2.8, '#f97316', '#090d16', 1.0);
      ctx.fillStyle = '#fdba74';
      ctx.fillRect(-3.3, by + 4, 1.4, 1.4);

      if (hasFrontBarrier) {
        const pushX = aiState === 'attack' ? 5 : 0;
        pxLimb(ctx, 3, by + 14, 6 + pushX, by + 18, 4.4, '#10b981', '#047857');
        // Sculpted royal-blue front backpack shield
        celEnemyTorso(2 + pushX, by + 8, 12.5, 22, '#2563eb', '#1e3a8a', '#60a5fa', 1.2);
        fillStrokeRoundRect(ctx, 4 + pushX, by + 12, 8.5, 6.5, 1.8, '#f97316', '#090d16', 1.05);
        pxRect(ctx, 3 + pushX, by + 21, 9.5, 2.5, '#facc15');
        celFist(ctx, 6 + pushX, by + 18, 4.5, '#f5b56e', '#d67d36');
      } else {
        const punchReach = aiState === 'attack' ? 14 : 7;
        pxLimb(ctx, 3, by + 14, 6, by + 17, 4.4, '#10b981', '#047857');
        celRolledCuff(ctx, 6, by + 17, -0.3, 4.4, '#34d399', '#047857');
        pxLimb(ctx, 6, by + 17, punchReach, by + 15, 4.2, '#f5b56e', '#d67d36');
        celFist(ctx, punchReach + 1, by + 15, 5.0, '#f5b56e', '#d67d36');
      }
      break;
    }

    case 'patricinha': {
      const by = -45 + bob;
      drawEnemyLegs(-15, '#f5b56e', '#d67d36', '#fcd5b5', '#d99b6c', '#ec4899', '#fdf2f8', 4.3, 5.5);

      // Rear poised arm
      pxLimb(ctx, -3, by + 14, -7, by + 11, 3.8, '#ec4899', '#9d174d');
      celFist(ctx, -7.5, by + 10.5, 4.0, '#fcd5b5', '#d99b6c');

      // Pink cropped top + pleated white skirt
      celEnemyTorso(-6.5, by + 11, 13.5, 13, '#ec4899', '#9d174d', '#f472b6', 1.6);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(-6, by + 23);
      ctx.lineTo(7, by + 23);
      ctx.lineTo(8.5, by + 28.5);
      ctx.lineTo(-7.5, by + 28.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-3, by + 24, 1.4, 4);
      ctx.fillRect(2, by + 24, 1.4, 4);

      // Flowing golden hair behind head + face with sleek sunglasses
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(-5.5, by + 1);
      ctx.quadraticCurveTo(-11, by + 5, -9, by + 14);
      ctx.lineTo(-4.5, by + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      celEnemyHead(0.2, by, 10, 10.2, '#fcd5b5', '#d99b6c', {
        glasses: 'shades',
        glassesColor: '#0f172a',
        mouth: 'lip',
      });
      // Golden hair crown & side fringe
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5.5, by + 3);
      ctx.quadraticCurveTo(-5, by - 3.8, 1.5, by - 3.8);
      ctx.quadraticCurveTo(6.5, by - 2.5, 6, by + 1.5);
      ctx.lineTo(1, by + 1);
      ctx.lineTo(-3.5, by + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lead arm + designer handbag
      const bagIdleLift = isEnemyIdle ? -Math.round(idleFidgetEnv * 2) : 0;
      const bagX = aiState === 'attack' ? 11 : isEnemyIdle && idleFidgetEnv > 0.25 ? 6 : 5;
      pxLimb(ctx, 2.5, by + 14, bagX, by + 16 + bagIdleLift, 3.8, '#fcd5b5', '#d99b6c');
      celFist(ctx, bagX, by + 16 + bagIdleLift, 4.2, '#fcd5b5', '#d99b6c');
      fillStrokeRoundRect(ctx, bagX - 1, by + 17 + bagIdleLift, 8.5, 8, 2.2, '#db2777', '#090d16', 1.15);
      pxRect(ctx, bagX + 2, by + 19 + bagIdleLift, 2.5, 2, '#facc15');
      break;
    }

    case 'industria': {
      const by = -49 + bob;
      drawEnemyLegs(-17, '#1e3a8a', '#0f172a', '#172554', '#090d16', '#451a03', '#b45309', 6.0, 7);

      // Rear heavy guard arm with rolled work sleeve
      pxLimb(ctx, -4, by + 14, -9, by + 20, 5.2, '#1e40af', '#172554');
      celRolledCuff(ctx, -8, by + 19, 0.3, 5.0, '#3b82f6', '#172554');
      pxLimb(ctx, -8, by + 19, -4, by + 17, 4.6, '#e5a97c', '#b46e42');
      celFist(ctx, -3.5, by + 17, 5.2, '#e5a97c', '#b46e42');

      // Broad industrial coveralls + high-vis orange band
      celEnemyTorso(-9, by + 11, 19, 20, '#1e40af', '#172554', '#3b82f6', 1.8);
      pxRect(ctx, -8, by + 19, 17, 3.2, '#f97316', '#090d16', 0.9);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-7, by + 20, 15, 1);

      if (stinkActive) {
        pxRect(ctx, -5, by + 14, 3, 3, '#65a30d', '#365314', 0.8);
        pxRect(ctx, 3, by + 14, 3, 3, '#65a30d', '#365314', 0.8);
      }

      celEnemyHead(0.5, by, 11.2, 11, '#e5a97c', '#b46e42', { mouth: 'grit', browColor: '#451a03' });
      // Sculpted yellow safety hard hat with brim
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(0.5, by + 1.5, 6.8, Math.PI, 0);
      ctx.lineTo(9.2, by + 1.5);
      ctx.lineTo(-7.2, by + 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-2.5, by - 3.5, 5, 2);

      // Lead muscular punching arm with rolled cuff
      const armExt = aiState === 'attack' ? 16 : isHurt ? -5 : 8;
      pxLimb(ctx, 4, by + 15, 7, by + 17, 5.2, '#1e40af', '#172554');
      celRolledCuff(ctx, 7, by + 17, -0.3, 5.0, '#3b82f6', '#172554');
      pxLimb(ctx, 7, by + 17, armExt, by + 15, 4.8, '#e5a97c', '#b46e42');
      celFist(ctx, armExt + (aiState === 'attack' ? 1.5 : 0), by + 15, 5.8, '#e5a97c', '#b46e42');
      break;
    }

    case 'fiscal':
    case 'boss_fiscal_chefe': {
      const isChefe = type === 'boss_fiscal_chefe';
      const by = (isChefe ? -48 : -46) + bob;
      drawEnemyLegs(-16, '#1e293b', '#090d16', '#334155', '#0f172a', '#111827', '#475569', 5.5, 6.5);

      // Rear guard arm
      pxLimb(ctx, -3, by + 14, -7, by + 19, 4.6, isChefe ? '#1e40af' : '#2563eb', '#172554');
      celRolledCuff(ctx, -7, by + 19, 0.3, 4.6, '#60a5fa', '#172554');
      celFist(ctx, -6, by + 20, 4.8, '#f1b586', '#c68353');

      celEnemyTorso(-8, by + 11, 16.5, 18, isChefe ? '#1e40af' : '#2563eb', '#172554', '#60a5fa', 1.5);
      // Dark uniform tie + collar + badge
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-1.5, by + 11, 5, 2.2);
      pxRect(ctx, -0.5, by + 13, 2.8, 11, '#0f172a', '#020617', 0.7);
      pxRect(ctx, 3.2, by + 14.5, 3.8, 2.2, '#facc15', '#090d16', 0.8);
      if (isChefe) {
        fillStrokeRoundRect(ctx, -9, by + 10, 5, 3, 1.2, '#facc15', '#090d16', 1);
        fillStrokeRoundRect(ctx, 4, by + 10, 5, 3, 1.2, '#facc15', '#090d16', 1);
      }

      celEnemyHead(0.3, by, 10.8, 10.8, '#f1b586', '#c68353', {
        mouth: 'scowl',
        mustacheColor: isChefe ? '#334155' : undefined,
      });
      // Peaked inspector cap
      fillStrokeRoundRect(ctx, -6.5, by - 5.2, 13, 3.4, 1.4, isChefe ? '#facc15' : '#38bdf8', '#090d16', 1);
      fillStrokeRoundRect(ctx, -7, by - 3.2, 14, 4.2, 1.8, '#0f172a', '#020617', 1.15);
      fillStrokeRoundRect(ctx, 1.5, by - 0.8, 7.5, 2.2, 1, '#020617', '#090d16', 0.9);

      const clipX = aiState === 'attack' ? 12 : 6;
      pxLimb(ctx, 3, by + 14, 6, by + 17, 4.6, isChefe ? '#1e40af' : '#2563eb', '#172554');
      celRolledCuff(ctx, 6, by + 17, -0.3, 4.6, '#60a5fa', '#172554');
      pxLimb(ctx, 6, by + 17, clipX + 1, by + 18, 4.2, '#f1b586', '#c68353');
      fillStrokeRoundRect(ctx, clipX, by + 13, 8, 10, 1.6, '#7f1d1d', '#090d16', 1.15);
      pxRect(ctx, clipX + 1.5, by + 14.5, 5, 7, '#f8fafc');
      celFist(ctx, clipX + 1.5, by + 18, 4.6, '#f1b586', '#c68353');
      break;
    }

    case 'tio_audio': {
      const by = -46 + bob;
      // Muscular bare jointed legs + purple shorts + flip-flops (matches right rival in reference image!)
      drawEnemyLegs(-14, '#d99b6c', '#b46e42', '#e5a97c', '#b46e42', '#6b21a8', '#d99b6c', 5.2, 6.5, true, '#e5a97c');

      // Rear guard fist
      pxLimb(ctx, -4, by + 15, -7.5, by + 20, 4.4, '#facc15', '#ca8a04');
      pxLimb(ctx, -7.5, by + 20, -4, by + 21, 4.2, '#e5a97c', '#b46e42');
      celFist(ctx, -3.5, by + 21, 4.8, '#e5a97c', '#b46e42');

      // Bright purple/violet shorts with waist fold & hem
      fillStrokeRoundRect(ctx, -9, -22, 18, 10.5, 2.8, '#7e22ce', '#090d16', 1.25);
      ctx.fillStyle = '#581c87';
      ctx.fillRect(-8, -17, 16, 4.8);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-7, -21, 14, 2);

      // Sunny yellow casual shirt + rounded belly peek + sporty chest stripe
      celEnemyTorso(-9, by + 10, 18, 17, '#facc15', '#ca8a04', '#fef08a', 1.2);
      ctx.fillStyle = '#e5a97c';
      ctx.beginPath();
      ctx.roundRect(-4, by + 23, 9, 4, 2);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1;
      ctx.stroke();
      pxRect(ctx, -7, by + 15, 14, 2, '#9a3412');

      // Expressive head + balding grey crown tufts + wire glasses + mustache
      celEnemyHead(0.3, by, 10.5, 10.5, '#e5a97c', '#b46e42', {
        glasses: 'wire',
        mouth: 'shout',
        mustacheColor: '#475569',
        browColor: '#475569',
      });
      fillStrokeRoundRect(ctx, -6, by + 0.8, 3.2, 4.6, 1.4, '#64748b', '#090d16', 0.9);

      // Lead muscular arm holding smartphone
      const phoneCheckDy = isEnemyIdle ? -Math.round(idleFidgetEnv * 2) : 0;
      const phX = aiState === 'attack' || aiState === 'windup' ? 11 : isEnemyIdle && idleFidgetEnv > 0.2 ? 7 : 6;
      pxLimb(ctx, 3, by + 14, 6, by + 17, 4.5, '#facc15', '#ca8a04');
      pxLimb(ctx, 6, by + 17, phX, by + 14 + phoneCheckDy, 4.2, '#e5a97c', '#b46e42');
      fillStrokeRoundRect(ctx, phX, by + 9 + phoneCheckDy, 5, 9, 1.4, '#0f172a', '#020617', 1);
      pxRect(
        ctx,
        phX + 1,
        by + 10 + phoneCheckDy,
        3,
        6,
        aiState === 'windup'
          ? '#ef4444'
          : isEnemyIdle && Math.floor(time * 5) % 2 === 0
            ? '#7dd3fc'
            : '#38bdf8'
      );
      celFist(ctx, phX + 0.5, by + 15 + phoneCheckDy, 4.4, '#e5a97c', '#b46e42');
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
      const by = -44 + (aiState === 'skateDash' ? -2 : bob);
      // Red/gold skateboard beneath feet
      fillStrokeRoundRect(ctx, -15, -5, 30, 4, 2, '#dc2626', '#090d16', 1.2);
      fillStrokeCircle(ctx, -9, -1, 2.3, '#facc15', '#090d16', 1);
      fillStrokeCircle(ctx, 9, -1, 2.3, '#facc15', '#090d16', 1);

      // Bent-knee skate stance
      pxLimb(ctx, -2, -16, -8, -10, 5, '#1e293b', '#0f172a');
      pxLimb(ctx, -8, -10, -7, -5, 4.8, '#1e293b', '#0f172a');
      drawShoe(-7, -5, '#111827', '#f8fafc');
      pxLimb(ctx, 2, -16, 8, -10, 5, '#334155', '#0f172a');
      pxLimb(ctx, 8, -10, 7, -5, 4.8, '#334155', '#0f172a');
      drawShoe(7, -5, '#111827', '#f8fafc');

      // Rear balance arm
      pxLimb(ctx, -3, by + 13, -10, by + 16, 4.2, '#4c1d95', '#2e1065');
      celFist(ctx, -10.5, by + 16, 4.4, '#f1b586', '#c68353');

      // Hooded skater windbreaker
      celEnemyTorso(-7, by + 10, 14.5, 15, '#7c3aed', '#4c1d95', '#a78bfa', 1.4);
      fillStrokeRoundRect(ctx, -2.5, by + 14, 7, 5, 1.5, '#facc15', '#090d16', 0.9);

      celEnemyHead(0.2, by, 10, 10.2, '#f1b586', '#c68353', { mouth: 'smirk' });
      // Front messy hair tuft + backward red snapback cap
      ctx.fillStyle = '#451a03';
      ctx.fillRect(3, by + 0.8, 3, 2);
      fillStrokeRoundRect(ctx, -6, by - 3.2, 12, 4.4, 2, '#ef4444', '#090d16', 1.15);
      fillStrokeRoundRect(ctx, -11.5, by - 1, 6.2, 2.4, 1.2, '#991b1b', '#090d16', 0.95);

      pxLimb(ctx, 3, by + 13, 9, by + 16, 4.2, '#7c3aed', '#4c1d95');
      celFist(ctx, 9.5, by + 16, 4.8, '#f1b586', '#c68353');
      break;
    }

    case 'boss_motorista': {
      const mMode = bossAttackMode;
      const isDashWindup = aiState === 'windup' && mMode === 'acelerada';
      const isDashExec = aiState === 'attack' && mMode === 'acelerada';
      const isStompWindup = aiState === 'windup' && mMode === 'freada_brusca';
      const isStompExec = aiState === 'attack' && mMode === 'freada_brusca';
      const isHornWindup = aiState === 'windup' && mMode === 'buzina';
      const isHornExec = aiState === 'attack' && mMode === 'buzina';
      const isTurboWindup = aiState === 'spinWindup';
      const isTurboSpin = isSpinning;

      const by = (isDashWindup || isTurboWindup ? -50 : isStompExec ? -49 : -52) + bob;

      // Custom legs for Freada Brusca raised stomp foot or dash/spin stance
      if (isStompWindup) {
        const liftH = 6 + Math.min(1, bossAnimProg) * 5;
        pxLimb(ctx, -2, -18, -5, -10, 6.4, '#0f172a', '#020617');
        pxLimb(ctx, -5, -10, -7, -2, 6.2, '#1e293b', '#0f172a');
        drawShoe(-7, -2, '#020617', '#475569');

        pxLimb(ctx, 2, -18, 8, -11 - liftH * 0.5, 6.4, '#0f172a', '#020617');
        pxLimb(ctx, 8, -11 - liftH * 0.5, 7, -2 - liftH, 6.2, '#1e293b', '#0f172a');
        drawShoe(7, -2 - liftH, '#020617', '#facc15');
      } else if (isDashExec) {
        drawEnemyLegs(-18, '#0f172a', '#020617', '#1e293b', '#0f172a', '#020617', '#facc15', 6.2, 9.5);
      } else {
        drawEnemyLegs(-18, '#0f172a', '#020617', '#1e293b', '#0f172a', '#020617', '#475569', 6.2, 7.5);
      }

      // Acelerada heel skid sparks on windup or horizontal speed lines on dash execution
      if (isDashWindup && !reducedMotion) {
        pxRect(ctx, -15, -4, 4, 2, '#facc15');
        pxRect(ctx, -20, -7, 3, 2, '#cbd5e1');
      } else if (isDashExec && !reducedMotion) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.78)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-14, by + 18);
        ctx.lineTo(-27, by + 18);
        ctx.moveTo(-12, by + 26);
        ctx.lineTo(-24, by + 26);
        ctx.stroke();
        ctx.restore();
      }

      // Rear arm gripping steering wheel / horn / brace
      const rearHandX = isHornWindup || isTurboWindup ? 7 : isDashWindup ? -10 : -6;
      const rearHandY = isHornWindup ? by + 19 : isTurboWindup ? by + 17 : by + 22;
      pxLimb(ctx, -4, by + 15, (rearHandX - 4) * 0.5, by + 19, 5.2, '#0284c7', '#075985');
      celRolledCuff(ctx, -6, by + 19, 0.3, 5.0, '#38bdf8', '#075985');
      celFist(ctx, rearHandX, rearHandY, 5.2, '#d99b6c', '#a1623b');

      // Transit driver blue uniform + dark vest + red driver tie (preserved intact)
      celEnemyTorso(-10, by + 12, 21, 21, '#0284c7', '#075985', '#38bdf8', 1.8);
      fillStrokeRoundRect(ctx, -9, by + 12, 6, 19, 1.8, '#1e293b', '#090d16', 1.05);
      fillStrokeRoundRect(ctx, 4, by + 12, 6, 19, 1.8, '#1e293b', '#090d16', 1.05);
      pxRect(ctx, -1, by + 13, 3, 12, '#dc2626', '#090d16', 0.9);

      // Expressive furious driver face + peaked driver cap
      celEnemyHead(0.4, by, 11.8, 11.5, '#d99b6c', '#a1623b', {
        mouth: 'shout',
        mustacheColor: '#1e293b',
        browColor: '#020617',
      });
      fillStrokeRoundRect(ctx, -7, by - 5.2, 14, 5.6, 2.2, '#0f172a', '#020617', 1.2);
      pxRect(ctx, -5, by - 6, 10, 2, '#facc15');
      fillStrokeRoundRect(ctx, 2, by - 1, 7.5, 2.4, 1, '#020617', '#090d16', 0.9);

      // Expressivity boost below 50% HP: fiery brow/anger vein tick & subtle exhaust heat spark
      if (bossEnraged && !isHurt) {
        const sparkJitter = reducedMotion ? 0 : Math.sin(time * 24) * 1.2;
        pxRect(ctx, -9, by - 2 + sparkJitter, 2.5, 2.5, '#f97316', '#090d16', 0.7);
        pxRect(ctx, 7, by - 3 - sparkJitter, 2.5, 2.5, '#facc15', '#090d16', 0.7);
      }

      // Lead arm & detachable Bus Steering Wheel weapon — distinct per attack
      const wheelX = isTurboSpin
        ? Math.cos(time * 22) * 16
        : isTurboWindup
          ? 12
          : isDashExec
            ? 16
            : isDashWindup
              ? 6
              : isHornWindup
                ? 11
                : isHornExec
                  ? 14
                  : aiState === 'attack'
                    ? 13
                    : 10;
      const wheelY = isTurboSpin
        ? by + 20 + Math.sin(time * 22) * 3
        : isTurboWindup
          ? by + 16
          : isDashWindup
            ? by + 24
            : isHornWindup
              ? by + 19
              : isStompWindup
                ? by + 15
                : by + 21;

      pxLimb(ctx, 4, by + 15, 7, by + 18, 5.2, '#0284c7', '#075985');
      celRolledCuff(ctx, 7, by + 18, -0.3, 5.0, '#38bdf8', '#075985');
      pxLimb(ctx, 7, by + 18, wheelX, wheelY, 4.6, '#d99b6c', '#a1623b');

      // Volante Turbo dedicated cyclone arcs (clearly different from Cobrador's turnstile metal arms)
      if (isTurboSpin) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, by + 20, 24, 9.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, by + 20, 19, 6.5, 0, 0.4, Math.PI * 1.65);
        ctx.stroke();
        ctx.restore();
      } else if (isTurboWindup) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(wheelX, wheelY, 15.5, -1.1, 1.1);
        ctx.stroke();
        ctx.restore();
      }

      const wheelSpin = isTurboSpin
        ? time * 24
        : isTurboWindup
          ? time * 9
          : isDashWindup
            ? -0.45
            : isDashExec
              ? 0.45
              : 0;
      ctx.save();
      ctx.translate(wheelX, wheelY);
      ctx.rotate(wheelSpin);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = isTurboSpin || isTurboWindup || bossEnraged ? '#facc15' : '#334155';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      pxRect(ctx, -10, -1.5, 20, 3, '#475569');
      pxRect(ctx, -1.5, 0, 3, 10, '#475569');
      fillStrokeCircle(
        ctx,
        0,
        0,
        isHornWindup || isHornExec ? 4.0 : 3.2,
        isHornWindup || isHornExec ? '#fb923c' : '#facc15',
        '#090d16',
        1
      );
      ctx.restore();

      // Horn visual anticipation rings on Buzina windup / blast cone on execution
      if (isHornWindup) {
        const hornPulse = reducedMotion ? 8 : 6 + ((time * 24) % 9);
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(wheelX, wheelY, hornPulse, -0.95, 0.95);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(wheelX, wheelY, hornPulse + 4, -0.7, 0.7);
        ctx.stroke();
        ctx.restore();
      } else if (isHornExec) {
        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(wheelX + 3, wheelY, 10, -0.85, 0.85);
        ctx.stroke();
        ctx.restore();
      }

      celFist(ctx, wheelX - 2, wheelY, 5.2, '#d99b6c', '#a1623b');
      break;
    }

    case 'boss_cobrador':
    case 'boss_cobrador_blindado': {
      const armored = type === 'boss_cobrador_blindado';
      const by = armored ? -52 : -48;
      const scaleW = armored ? 1.15 : 1;

      ctx.save();
      ctx.scale(scaleW, 1);
      drawEnemyLegs(-18, '#0f172a', '#020617', '#1e293b', '#0f172a', '#334155', '#94a3b8', 6.4, 7.5);

      // Rear armored/uniformed fist
      pxLimb(ctx, -4, by + 15, -8, by + 21, 5.4, armored ? '#475569' : '#1e40af', '#1e293b');
      celFist(ctx, -8, by + 21, 5.4, armored ? '#94a3b8' : '#d99b6c', armored ? '#475569' : '#a1623b');

      celEnemyTorso(
        -10,
        by + 12,
        21,
        22,
        armored ? '#475569' : '#1e40af',
        '#1e293b',
        armored ? '#94a3b8' : '#3b82f6',
        1.8
      );
      if (armored) {
        fillStrokeRoundRect(ctx, -12, by + 10, 25, 6, 2.4, '#94a3b8', '#090d16', 1.25);
        fillStrokeRoundRect(ctx, -3, by + 19, 7, 6, 1.5, '#ef4444', '#090d16', 1.1);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-1, by + 21, 3, 2);
      } else {
        fillStrokeRoundRect(ctx, -5, by + 15, 11, 10, 2, '#facc15', '#090d16', 1.15);
      }

      celEnemyHead(0.3, by, 11.8, 11.8, armored ? '#64748b' : '#d99b6c', '#334155', {
        glasses: armored ? 'visor' : undefined,
        glassesColor: '#ef4444',
        mouth: armored ? undefined : 'grit',
        hideFace: false,
      });
      if (armored) {
        fillStrokeRoundRect(ctx, -7, by - 4.2, 15, 6.2, 2.6, '#334155', '#090d16', 1.2);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-4, by - 3, 8, 1.6);
      } else {
        fillStrokeRoundRect(ctx, -7, by - 4.2, 14, 5, 2, '#0f172a', '#020617', 1.15);
        fillStrokeRoundRect(ctx, 2, by - 0.8, 6.5, 2.2, 1, '#020617', '#090d16', 0.9);
      }
      ctx.restore();

      const spinAngle = isSpinning ? time * 24 : aiState === 'spinWindup' ? time * 6 : 0.4;
      const hubX = isSpinning ? 0 : 11;
      const hubY = by + 22;
      const armCount = armored ? 4 : 3;
      const armLen = armored ? 27 : 21;

      pxLimb(ctx, 5, by + 16, hubX, hubY, 4.8, armored ? '#475569' : '#1e40af', '#1e293b');
      celFist(ctx, hubX - 1, hubY, 5.2, armored ? '#94a3b8' : '#d99b6c', armored ? '#475569' : '#a1623b');

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
        fillStrokeCircle(ctx, ax, ay, 3.2, armored ? '#ef4444' : '#facc15', '#090d16', 1.1);
      }
      fillStrokeCircle(ctx, hubX, hubY, 4.2, '#facc15', '#090d16', 1.2);
      break;
    }
  }

  if (isOccludedFade) {
    // Keep foreground enemy silhouette contour legible while center stays translucent
    const outW = isLargeBoss ? 24 : 18;
    const outH = isLargeBoss ? 50 : 42;
    const outX = -Math.round(outW / 2);
    const outY = -outH + bob;
    ctx.save();
    ctx.globalAlpha = Math.min(0.86, clampedAlpha + 0.38);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.roundRect(outX, outY, outW, outH, 5.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.roundRect(outX + 1, outY + 1, outW - 2, outH - 2, 4.5);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;

  if (hitFlash) {
    const flashW = isLargeBoss ? 22 : 16;
    const flashH = isLargeBoss ? 48 : 40;
    ctx.fillStyle = `rgba(254, 249, 195, ${(0.56 * clampedAlpha).toFixed(2)})`;
    ctx.beginPath();
    ctx.roundRect(-Math.round(flashW / 2), -flashH - 2 + bob, flashW, flashH, 5);
    ctx.fill();
  }

  if (isHurt && heavyHurt) {
    const wobble = Math.sin(time * 32) * 3;
    pxRect(ctx, -11 + wobble, -50, 3, 3, '#fde047', '#020617', 0.9);
    pxRect(ctx, 8 - wobble, -46, 3, 3, '#f8fafc', '#020617', 0.9);
  }

  if (isAboutToAttack) {
    pxRect(ctx, -6, -64, 12, 13, '#ef4444', '#090d16', 1.2);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('!', -2.5, -54);
  }

  ctx.restore();

  if (aiState === 'seatRest') {
    const floatY = reducedMotion ? 0 : Math.sin(time * 5.2) * 2;
    const hx = px(x);
    const hy = px(y - z - 58 + floatY);
    ctx.save();
    fillStrokeRoundRect(ctx, hx - 7, hy - 7, 14, 14, 3, '#065f46', '#090d16', 1.2);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(hx - 1.5, hy - 4.5, 3, 9);
    ctx.fillRect(hx - 4.5, hy - 1.5, 9, 3);
    ctx.restore();
  }

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

  // Multi-stage visual explosion fireball core
  const coreRadius = progress < 0.25 ? 12 + (progress / 0.25) * 34 : 46 * (1 - (progress - 0.25) / 0.75);
  if (coreRadius > 2) {
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(sx, cy, coreRadius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(sx, cy, coreRadius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sx, cy, coreRadius * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, cy, coreRadius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  const outerR = 18 + progress * 86;
  const innerR = 10 + progress * 58;
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = Math.max(1.5, 4.8 * (1 - progress));
  ctx.beginPath();
  ctx.ellipse(sx, cy, outerR, outerR * 0.56, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = Math.max(1.2, 3.6 * (1 - progress));
  ctx.beginPath();
  ctx.ellipse(sx, cy, innerR, innerR * 0.56, 0, 0, Math.PI * 2);
  ctx.stroke();

  const rayCount = 14;
  for (let i = 0; i < rayCount; i++) {
    const a = (i * Math.PI * 2) / rayCount + progress * 0.45;
    const r1 = 10 + progress * 26;
    const r2 = 26 + progress * 72;
    ctx.strokeStyle = i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? '#fef08a' : secondaryColor;
    ctx.lineWidth = 2.6 * (1 - progress * 0.6);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.72);
    ctx.lineTo(sx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.72);
    ctx.stroke();
  }

  for (let d = 0; d < 10; d++) {
    const ang = (d * Math.PI * 2) / 10 + 0.3;
    const dist = 12 + progress * (58 + (d % 3) * 14);
    const dx = sx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist * 0.65 - Math.sin(progress * Math.PI) * 20;
    ctx.save();
    ctx.translate(px(dx), px(dy));
    ctx.rotate(progress * 9 + d);
    if (style === 'tickets') {
      pxRect(ctx, -4, -2, 8, 4, '#f8fafc', '#020617', 1.1);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -1, 6, 1.5);
    } else if (style === 'armor') {
      pxRect(ctx, -4, -3, 8, 6, d % 2 === 0 ? '#94a3b8' : '#ef4444', '#020617', 1.1);
    } else {
      pxRect(ctx, -6, -1.5, 12, 3, d % 2 === 0 ? '#e2e8f0' : '#facc15', '#020617', 1.1);
    }
    ctx.restore();
  }

  if (label) {
    const popScale = progress < 0.18 ? 0.75 + (progress / 0.18) * 0.55 : 1.3 - progress * 0.2;
    ctx.save();
    ctx.translate(sx, cy - 22 - progress * 18);
    ctx.scale(popScale, popScale);
    ctx.font = '900 18px Bungee, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = '#fef08a';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export function drawWeaponKoEffect(
  ctx: CanvasRenderingContext2D,
  sx: number,
  y: number,
  z: number,
  progress: number,
  kind: 'cane' | 'bag' | 'heavy',
  dir: 1 | -1
) {
  const cy = y - z - 20;
  const fade = Math.max(0, Math.pow(1 - progress, 1.55));
  if (fade <= 0.02) return;

  ctx.save();
  ctx.translate(sx, cy);
  ctx.globalAlpha = fade;

  const primary = kind === 'cane' ? '#facc15' : kind === 'bag' ? '#38bdf8' : '#fb923c';
  const secondary = kind === 'cane' ? '#fef08a' : kind === 'bag' ? '#e0f2fe' : '#fef08a';
  const ringR = 10 + progress * 24;

  ctx.strokeStyle = primary;
  ctx.lineWidth = Math.max(1.2, 3.2 * (1 - progress * 0.7));
  ctx.beginPath();
  ctx.arc(0, 0, ringR, 0, Math.PI * 2);
  ctx.stroke();

  if (kind === 'cane') {
    ctx.save();
    ctx.rotate(dir * progress * Math.PI * 2.8);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(10, -8);
    ctx.arc(10, -4, 4, -Math.PI * 0.5, Math.PI * 0.65);
    ctx.stroke();
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 0.72, -0.8, 1.6);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'bag') {
    for (let i = 0; i < 4; i++) {
      const a = progress * 4.5 + (i * Math.PI) / 2;
      const dist = 8 + progress * 18;
      ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(Math.cos(a) * dist - 3, Math.sin(a) * dist * 0.7 - 2, 6, 4, 1);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + dir * 0.3;
      const r1 = 6 + progress * 8;
      const r2 = 16 + progress * 16;
      ctx.strokeStyle = i % 2 === 0 ? secondary : primary;
      ctx.lineWidth = 2.2 * (1 - progress * 0.6);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.75);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * 0.75);
      ctx.stroke();
    }
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
  skinStyle: PlayerSkinStyle = 'classic',
  garageConfig?: GarageConfig
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
    skinStyle,
    garageConfig
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
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.fillRect(dx - 10, px(y - 2), 20, 5);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.58)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(dx, px(y), 11, 3.5, 0, 0, Math.PI * 2);
  ctx.stroke();

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
    words: ['202', 'LARGO', 'OZ', 'TURNO', 'METAL', 'PICO'],
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
  time: number,
  slotSeed = variant
) {
  ctx.save();
  const cx = px(bx + 14);
  const seed = seededHash(slotSeed * 97 + variant * 31 + lineNumber * 13);
  const phase = (seed % 100) * 0.21;
  const period = 3.8 + (seed % 5) * 0.85;
  const cyclePos = time + phase;
  const cycleIdx = Math.floor(cyclePos / period);
  const cycleT = cyclePos % period;
  // Active micro-action window (~1.55s out of each varied cycle)
  const actStart = 0.9 + ((seed % 7) * 0.14);
  const actDur = 1.55;
  const actEnv =
    cycleT >= actStart && cycleT <= actStart + actDur
      ? Math.sin(((cycleT - actStart) / actDur) * Math.PI)
      : 0;
  // Rotates organically between checking phone, adjusting bag, glancing aside, calm breath
  const idleAction = (seed + cycleIdx) % 4;

  // Staggered subtle 1px breathing so passengers don't bob in lockstep
  const breath = Math.floor(time * (1.1 + (seed % 4) * 0.22) + phase) % 2 === 0 ? 0 : 1;
  const skinColors = ['#d99b6c', '#b97b50', '#c98a5b', '#e2ab82', '#9c623b'];
  const shirtColors = ['#7e22ce', '#9a3412', '#475569', '#0f766e', '#991b1b'];
  const hairColors = ['#111528', '#271911', '#334155', '#1e1b4b', '#52525b'];
  const bagColors = ['#78350f', '#9d174d', '#334155', '#854d0e', '#1e293b'];
  const skin = skinColors[variant % skinColors.length];
  const shirt = shirtColors[variant % shirtColors.length];
  const hair = hairColors[variant % hairColors.length];
  const bagColor = bagColors[seed % bagColors.length];
  const archetype = variant % 5;

  const isCheckingPhone = archetype !== 1 && idleAction === 0 && actEnv > 0.08;
  const isAdjustingBag = archetype !== 1 && idleAction === 1 && actEnv > 0.08;
  const isGlancing = idleAction === 2 && actEnv > 0.15;

  const headDx = isGlancing ? (seed % 2 === 0 ? -1 : 1) : 0;
  const headDy = isCheckingPhone ? Math.round(actEnv * 1.6) : 0;
  const shoulderDy = isAdjustingBag ? -Math.round(actEnv * 1.4) : 0;

  // Helper: subtle bag strap & bag resting on lap/shoulder
  const drawCommuterBag = (liftPx: number) => {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 5, 121 + breath + shoulderDy, 2, 11);
    pxRect(
      ctx,
      cx - 8,
      126 + breath - liftPx,
      7,
      7,
      bagColor,
      '#090d16',
      1
    );
  };

  // Helper: small glowing smartphone + gentle thumb tap
  const drawCommuterPhone = (handShiftY: number) => {
    const phoneX = cx + (seed % 2 === 0 ? 1 : -4);
    const phoneY = 123 + breath - handShiftY;
    const scrollFlash = Math.floor(time * 4.5 + seed) % 2 === 0;
    // Soft ambient cyan light onto chin/hands
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fillRect(phoneX - 2, phoneY - 3, 8, 6);
    pxRect(ctx, phoneX, phoneY, 4, 6, '#0f172a', '#020617', 0.9);
    ctx.fillStyle = scrollFlash ? '#7dd3fc' : '#38bdf8';
    ctx.fillRect(phoneX + 1, phoneY + 1, 2, 4);
    // Hand/thumb tapping
    pxRect(ctx, phoneX + (scrollFlash ? 2 : 1), phoneY + 3, 3, 3, skin, '#090d16', 0.8);
  };

  const drawMutedTorso = (tx: number, ty: number, w: number, h: number, base: string, shadow: string) => {
    fillStrokeRoundRect(ctx, tx, ty, w, h, 3, base, '#090d16', 1.05);
    ctx.fillStyle = shadow;
    ctx.fillRect(tx + 1, ty + h - 4.5, w - 2, 3.5);
  };
  const drawMutedHead = (hx: number, hy: number, size: number, base: string) => {
    fillStrokeRoundRect(ctx, hx, hy, size, size, 3, base, '#090d16', 1.05);
    ctx.fillStyle = '#7c4a2d';
    ctx.fillRect(hx + 1, hy + size - 2.4, size - 2, 1.8);
  };

  // Slightly muted background contrast so foreground fighters dominate
  if (archetype === 0) {
    // Woman with crossed arms or checking phone / adjusting purse
    drawMutedTorso(cx - 8, 121 + breath + shoulderDy, 16, 13, shirt, '#3b0764');
    drawMutedHead(cx - 5 + headDx, 110 + breath + headDy, 10, skin);
    fillStrokeRoundRect(ctx, cx - 7 + headDx, 108 + breath + headDy, 14, 6, 2.2, hair, '#090d16', 1);
    pxRect(ctx, cx - 7 + headDx, 112 + breath + headDy, 3, 7, hair);
    pxRect(ctx, cx + 4 + headDx, 112 + breath + headDy, 3, 7, hair);
    if (isAdjustingBag) {
      const lift = Math.round(actEnv * 2);
      drawCommuterBag(lift);
      pxRect(ctx, cx - 7, 124 + breath - lift, 4, 3, skin, '#090d16', 0.9);
    } else if (isCheckingPhone) {
      drawCommuterPhone(Math.round(actEnv * 2));
    } else {
      drawCommuterBag(0);
      pxRect(ctx, cx - 6, 126 + breath, 12, 4, skin, '#090d16', 1);
    }
  } else if (archetype === 1) {
    // Newspaper reader: rustles/tilts paper subtly in idle instead of frozen static
    const paperRustle = idleAction === 0 || idleAction === 1 ? Math.round(actEnv * 1.5) : 0;
    drawMutedTorso(cx - 8, 120 + breath, 16, 14, '#334155', '#1e293b');
    drawMutedHead(cx - 5 + headDx, 110 + breath, 10, skin);
    fillStrokeRoundRect(ctx, cx - 5 + headDx, 109 + breath, 10, 4, 1.8, hair, '#090d16', 1);
    fillStrokeRoundRect(ctx, cx - 10, 122 + breath - paperRustle, 20, 11, 1.5, '#cbd5e1', '#090d16', 1.1);
    ctx.fillStyle = '#475569';
    ctx.fillRect(cx - 8, 124 + breath - paperRustle, 7, 1.5);
    ctx.fillRect(cx - 8, 127 + breath - paperRustle, 7, 1.5);
    ctx.fillRect(cx + 1, 124 + breath - paperRustle, 7, 1.5);
    ctx.fillRect(cx + 1, 127 + breath - paperRustle, 7, 1.5);
    ctx.fillRect(cx, 122 + breath - paperRustle, 1, 11);
  } else if (archetype === 2) {
    // Commuter with glasses + bag / phone variations
    drawMutedTorso(cx - 8, 121 + breath + shoulderDy, 16, 13, '#78350f', '#451a03');
    drawMutedHead(cx - 5 + headDx, 110 + breath + headDy, 10, skin);
    fillStrokeRoundRect(ctx, cx - 6 + headDx, 108 + breath + headDy, 12, 5, 2, hair, '#090d16', 1);
    pxRect(ctx, cx - 4 + headDx, 114 + breath + headDy, 3, 2, '#090d16');
    pxRect(ctx, cx + 1 + headDx, 114 + breath + headDy, 3, 2, '#090d16');
    pxRect(ctx, cx - 1 + headDx, 114 + breath + headDy, 2, 1, '#94a3b8');
    if (isCheckingPhone) {
      drawCommuterPhone(Math.round(actEnv * 2));
    } else if (isAdjustingBag) {
      const lift = Math.round(actEnv * 2);
      drawCommuterBag(lift);
      pxRect(ctx, cx - 7, 125 + breath - lift, 4, 3, skin, '#090d16', 0.9);
    } else {
      pxRect(ctx, cx - 7, 127 + breath, 14, 4, skin, '#090d16', 1);
    }
  } else if (archetype === 3) {
    // Sleepy / helmeted commuter + occasional phone check or sleepy nod
    drawMutedTorso(cx - 8, 121 + shoulderDy, 16, 13, '#475569', '#1e293b');
    const nod = (lineNumber === 1 || idleAction === 3 ? breath : 0) + headDy;
    drawMutedHead(cx - 5 + headDx, 111 + nod, 10, skin);
    if (lineNumber === 2) {
      fillStrokeRoundRect(ctx, cx - 7 + headDx, 107 + nod, 14, 5, 2, '#ca8a04', '#090d16', 1);
    } else {
      fillStrokeRoundRect(ctx, cx - 5 + headDx, 109 + nod, 10, 4, 1.8, hair, '#090d16', 1);
    }
    pxRect(ctx, cx - 3 + headDx, 116 + nod, 2, 1, '#090d16');
    pxRect(ctx, cx + 1 + headDx, 116 + nod, 2, 1, '#090d16');
    if (isCheckingPhone) {
      drawCommuterPhone(Math.round(actEnv * 2));
    } else if (isAdjustingBag) {
      drawCommuterBag(Math.round(actEnv * 2));
    }
  } else {
    // Commuter in coral/amber shirt checking phone or adjusting bag
    drawMutedTorso(cx - 8, 121 + breath + shoulderDy, 16, 13, shirt, '#450a0a');
    drawMutedHead(cx - 5 + headDx, 110 + breath + headDy, 10, skin);
    fillStrokeRoundRect(ctx, cx - 6 + headDx, 108 + breath + headDy, 12, 5, 2, hair, '#090d16', 1);
    pxRect(ctx, cx - 6 + headDx, 112 + breath + headDy, 2, 6, hair);
    pxRect(ctx, cx + 4 + headDx, 112 + breath + headDy, 2, 6, hair);
    if (isCheckingPhone) {
      drawCommuterPhone(Math.round(actEnv * 2));
    } else if (isAdjustingBag) {
      const lift = Math.round(actEnv * 2);
      drawCommuterBag(lift);
      pxRect(ctx, cx - 6, 124 + breath - lift, 4, 3, skin, '#090d16', 0.9);
    } else {
      drawCommuterBag(0);
      pxRect(ctx, cx - 4, 128 + breath, 8, 4, skin, '#090d16', 1);
    }
  }
  ctx.restore();
}

function drawStandingCommuter(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  variant: number,
  time: number,
  mode: 'pole' | 'strap' = 'pole',
  baySeed = variant
) {
  ctx.save();
  const seed = seededHash(baySeed * 73 + variant * 19 + (mode === 'pole' ? 7 : 23));
  const phase = (seed % 100) * 0.19;
  const period = 3.9 + (seed % 4) * 0.9;
  const cyclePos = time + phase;
  const cycleIdx = Math.floor(cyclePos / period);
  const cycleT = cyclePos % period;
  const actStart = 0.75 + ((seed % 5) * 0.18);
  const actDur = 1.65;
  const actEnv =
    cycleT >= actStart && cycleT <= actStart + actDur
      ? Math.sin(((cycleT - actStart) / actDur) * Math.PI)
      : 0;
  const idleAction = (seed + cycleIdx) % 3; // 0: phone, 1: adjust backpack/bag, 2: weight shift/glance

  // Standing behind combat lane (feet around y = 144, tucked against seats/pole)
  const hipShift = idleAction === 2 ? Math.round(Math.sin(time * 1.4 + phase) * 0.85) : 0;
  const pxX = px((mode === 'pole' ? anchorX - 11 : anchorX) + hipShift);
  const breath = Math.floor(time * (1.05 + (seed % 3) * 0.2) + phase) % 2 === 0 ? 0 : 1;
  const headDy = idleAction === 0 ? Math.round(actEnv * 1.4) : 0;
  const headDx = idleAction === 2 ? Math.round(actEnv * (seed % 2 === 0 ? 1 : -1)) : 0;
  const bagAdjustLift = idleAction === 1 ? Math.round(actEnv * 2) : 0;

  const shirts = ['#94a3b8', '#64748b', '#78350f', '#475569'];
  const pantsList = ['#1e3a8a', '#334155', '#1e293b', '#312e81'];
  const skins = ['#d99b6c', '#b97b50', '#c8875a', '#9c623b'];
  const shirt = shirts[Math.abs(variant) % shirts.length];
  const pants = pantsList[Math.abs(variant) % pantsList.length];
  const skin = skins[Math.abs(variant) % skins.length];

  // Muted dark shadow at feet
  ctx.fillStyle = 'rgba(5, 8, 18, 0.42)';
  ctx.beginPath();
  ctx.ellipse(pxX, 144, 9, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs & sneakers
  pxLimb(ctx, pxX - 3, 126, pxX - 3, 142, 4.2, pants, '#0f172a');
  pxLimb(ctx, pxX + 3, 126, pxX + 3, 142, 4.2, pants, '#0f172a');
  celSneaker(ctx, pxX - 3, 142.5, '#334155', '#e2e8f0', '#cbd5e1', false);
  celSneaker(ctx, pxX + 3, 142.5, '#334155', '#e2e8f0', '#cbd5e1', false);

  // Backpack or shoulder bag (nudges up subtly when commuter adjusts it!)
  const hasBackpack = variant % 3 !== 2;
  if (hasBackpack) {
    fillStrokeRoundRect(ctx, pxX - 9, 108 + breath - bagAdjustLift, 5, 13, 2, '#1e293b', '#090d16', 1);
    pxRect(ctx, pxX - 8, 111 + breath - bagAdjustLift, 3, 2, '#475569');
  }

  // Torso
  fillStrokeRoundRect(ctx, pxX - 6, 106 + breath, 13, 20, 3, shirt, '#090d16', 1.1);
  ctx.fillStyle = '#334155';
  ctx.fillRect(pxX - 5, 119 + breath, 11, 6);

  if (mode === 'pole') {
    // Primary arm gripping yellow vertical pole
    pxLimb(ctx, pxX + 4, 110 + breath, anchorX + 2, 103, 3.6, skin, '#7c4a2d');
    pxRect(ctx, anchorX, 101, 4, 4, skin, '#090d16', 1);
  } else {
    // Primary arm gripping overhead yellow strap
    pxLimb(ctx, pxX + 4, 108 + breath, pxX + 5, 88, 3.4, skin, '#7c4a2d');
    pxRect(ctx, pxX + 3, 86, 4, 4, skin, '#090d16', 1);
  }

  // Free arm idle variation: looking at smartphone vs adjusting backpack strap vs resting
  if (idleAction === 0 && actEnv > 0.1) {
    const raise = Math.round(actEnv * 3);
    const phoneX = pxX - 4;
    const phoneY = 115 + breath - raise;
    pxLimb(ctx, pxX - 4, 111 + breath, phoneX + 1, phoneY + 3, 3.2, skin, '#7c4a2d');
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fillRect(phoneX - 2, phoneY - 3, 7, 6);
    pxRect(ctx, phoneX - 1, phoneY - 1, 4, 6, '#0f172a', '#020617', 0.9);
    ctx.fillStyle = Math.floor(time * 4.5 + seed) % 2 === 0 ? '#7dd3fc' : '#38bdf8';
    ctx.fillRect(phoneX, phoneY, 2, 4);
  } else if (idleAction === 1 && actEnv > 0.1) {
    pxLimb(ctx, pxX - 4, 111 + breath, pxX - 7, 109 + breath - bagAdjustLift, 3.2, skin, '#7c4a2d');
  }

  // Head + cap or hair silhouette
  fillStrokeRoundRect(ctx, pxX - 4 + headDx, 95 + breath + headDy, 9, 10, 3, skin, '#090d16', 1.1);
  if (variant % 2 === 0) {
    fillStrokeRoundRect(ctx, pxX - 5 + headDx, 92 + breath + headDy, 11, 4, 1.8, '#334155', '#090d16', 1);
    pxRect(ctx, pxX + 2 + headDx, 95 + breath + headDy, 6, 2, '#1e293b', '#090d16', 1);
  } else {
    fillStrokeRoundRect(ctx, pxX - 5 + headDx, 92 + breath + headDy, 11, 5, 2, '#0f172a', '#090d16', 1);
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
      subline: 'Só R$ 12 no Largo de Oz',
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

  const lineTag = line.code === '202' ? '202 LARGO DE OZ' : `L.${line.code}`;
  const msg = turnstileCleared
    ? 'PARADA SOLICITADA • DESÇA ->   '
    : approachingStop
      ? `ÔNIBUS CHEGANDO • ${lineTag}   `
      : `PRÓXIMO PONTO • ${lineTag}   `;
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

  // 1. EXTERIOR SCENERY THROUGH WINDOWS (Line 101 Pre-Dawn 05:55 / Line 202 Sunrise 06:30 / Line 303 Morning 07:30-08:55)
  const isDawnLine = line.lineNumber === 1;
  const isSunriseLine = line.lineNumber === 2;
  const isMorningLine = line.lineNumber === 3;
  const isBrightExterior = isSunriseLine || isMorningLine;

  if (isDawnLine) {
    // 05:55 Pre-dawn twilight sky (deep indigo to cool morning mist)
    const dawnSky = ctx.createLinearGradient(0, 22, 0, 96);
    dawnSky.addColorStop(0, '#0b1120');
    dawnSky.addColorStop(0.55, '#1e3a5f');
    dawnSky.addColorStop(1, '#6b5b7b');
    ctx.fillStyle = dawnSky;
    ctx.fillRect(0, 22, W, 76);

    // Subtle fading dawn stars
    ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
    for (let sx = 18; sx < W; sx += 58) {
      ctx.fillRect(px((sx - camX * 0.04 + W * 4) % W), 27 + ((sx * 7) % 14), 1.5, 1.5);
    }
  } else if (isSunriseLine) {
    // 06:30 Golden sunrise sky (matching stop_202_largo_de_oz)
    const sunriseSky = ctx.createLinearGradient(0, 22, 0, 96);
    sunriseSky.addColorStop(0, '#3b82f6');
    sunriseSky.addColorStop(0.45, '#fb923c');
    sunriseSky.addColorStop(1, '#fde68a');
    ctx.fillStyle = sunriseSky;
    ctx.fillRect(0, 22, W, 76);

    // Soft glowing rising sun on horizon + warm morning clouds
    const sunX = px(320 - ((camX * 0.03) % 120));
    ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.beginPath();
    ctx.arc(sunX, 76, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(sunX, 76, 12, 0, Math.PI * 2);
    ctx.fill();

    const cloudScroll = (time * 12 + camX * 0.07) % 360;
    ctx.fillStyle = 'rgba(254, 215, 170, 0.65)';
    for (let cx = -cloudScroll; cx < W + 80; cx += 130) {
      ctx.beginPath();
      ctx.roundRect(px(cx), 28, 46, 9, 4.5);
      ctx.roundRect(px(cx + 12), 24, 24, 8, 4);
      ctx.fill();
    }
  } else {
    // 07:30-08:55 Crisp bright morning sky (matching stop_303_barro_fundo)
    const morningSky = ctx.createLinearGradient(0, 22, 0, 96);
    morningSky.addColorStop(0, '#0ea5e9');
    morningSky.addColorStop(0.55, '#7dd3fc');
    morningSky.addColorStop(1, '#bae6fd');
    ctx.fillStyle = morningSky;
    ctx.fillRect(0, 22, W, 76);

    // Fluffy bright morning clouds
    const cloudScroll = (time * 14 + camX * 0.08) % 360;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    for (let cx = -cloudScroll; cx < W + 80; cx += 120) {
      ctx.beginPath();
      ctx.roundRect(px(cx), 27, 44, 10, 5);
      ctx.roundRect(px(cx + 10), 23, 24, 9, 4.5);
      ctx.fill();
    }
  }

  if (isDawnLine) {
    // 05:55 Early dawn city silhouettes + glowing apartment windows + amber streetlamps
    const farScroll = (time * 30 + camX * 0.14) % 480;
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 44 - (farScroll % 44));
      const idx = Math.abs(i + Math.floor(farScroll / 44));
      const bh = 28 + ((idx * 17 + i * 9) % 34);
      ctx.fillStyle = idx % 2 === 0 ? '#172554' : '#1e293b';
      ctx.fillRect(bx, 94 - bh, 40, bh);
    }

    const scroll = (time * 58 + camX * 0.25) % 480;
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 46 - (scroll % 46));
      const idx = Math.abs(i + Math.floor(scroll / 46));
      const bh = 30 + ((idx * 17 + i * 7) % 34);
      const topY = 95 - bh;
      const bColor = idx % 3 === 0 ? '#1e293b' : idx % 3 === 1 ? '#26334d' : '#172554';

      pxRect(ctx, bx, topY, 41, bh + 3, bColor, '#050813', 1);

      for (let wy = topY + 6; wy < 84; wy += 8) {
        for (let wx = bx + 5; wx < bx + 34; wx += 9) {
          const lit = ((idx * 13 + wx * 3 + wy * 7) % 11) < 5;
          ctx.fillStyle = lit ? ((wx + wy) % 2 === 0 ? '#fde047' : '#f59e0b') : '#0f172a';
          ctx.fillRect(wx, wy, 4, 4);
        }
      }

      if (idx % 2 === 0) {
        const lx = bx + 20;
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx, 56, 2, 34);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
        ctx.beginPath();
        ctx.arc(lx + 1, 56, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lx - 1, 55, 4, 2.5);
      }
    }
  } else if (isSunriseLine) {
    // 06:30 Warm sunlit urban neighborhood & Largo de Oz avenue
    const farScroll = (time * 32 + camX * 0.14) % 480;
    const farColors = ['#fdba74', '#fcd34d', '#cbd5e1', '#fca5a5'];
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 44 - (farScroll % 44));
      const idx = Math.abs(i + Math.floor(farScroll / 44));
      const bh = 30 + ((idx * 19 + i * 11) % 34);
      ctx.fillStyle = farColors[idx % farColors.length];
      ctx.fillRect(bx, 94 - bh, 40, bh);
    }

    const scroll = (time * 60 + camX * 0.26) % 480;
    const facadeColors = ['#fed7aa', '#fde68a', '#e2e8f0', '#fca5a5', '#fdba74'];
    const shadeColors = ['#ea580c', '#d97706', '#94a3b8', '#c2410c', '#c2410c'];
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 46 - (scroll % 46));
      const idx = Math.abs(i + Math.floor(scroll / 46));
      const bh = 30 + ((idx * 17 + i * 7) % 36);
      const topY = 95 - bh;

      pxRect(ctx, bx, topY, 42, bh + 2, facadeColors[idx % facadeColors.length], '#431407', 1);
      ctx.fillStyle = shadeColors[idx % shadeColors.length];
      ctx.fillRect(bx + 30, topY + 1, 11, bh);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(bx - 1, topY - 2, 44, 3);

      for (let wy = topY + 6; wy < 82; wy += 9) {
        for (let wx = bx + 5; wx < bx + 35; wx += 9) {
          ctx.fillStyle = (idx + wx + wy) % 4 === 0 ? '#fef08a' : '#475569';
          ctx.fillRect(wx, wy, 5, 5);
          ctx.fillStyle = '#ffedd5';
          ctx.fillRect(wx + 1, wy + 1, 2, 2);
        }
      }

      if (idx % 2 === 1) {
        const tx = bx + 18;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(tx - 2, 74, 4, 18);
        fillStrokeCircle(ctx, tx - 6, 70, 9, '#15803d', '#064e3b', 0.9);
        fillStrokeCircle(ctx, tx + 6, 71, 8.5, '#16a34a', '#064e3b', 0.9);
        fillStrokeCircle(ctx, tx, 64, 11, '#65a30d', '#064e3b', 0.9);
      }
    }
  } else {
    // 07:30-08:55 Crisp morning Brazilian avenue + daytime Rodoviária / Terminal Barro Fundo bays
    const farScroll = (time * 32 + camX * 0.14) % 480;
    const farColors = ['#93c5fd', '#cbd5e1', '#bae6fd', '#a5b4fc'];
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 44 - (farScroll % 44));
      const idx = Math.abs(i + Math.floor(farScroll / 44));
      const bh = 32 + ((idx * 19 + i * 11) % 34);
      ctx.fillStyle = farColors[idx % farColors.length];
      ctx.fillRect(bx, 94 - bh, 40, bh);
    }

    const scroll = (time * 60 + camX * 0.26) % 480;
    const facadeColors = ['#fef3c7', '#f59e0b', '#93c5fd', '#fca5a5', '#e2e8f0'];
    const shadeColors = ['#fde68a', '#d97706', '#60a5fa', '#e07a5f', '#cbd5e1'];
    for (let i = -1; i < 12; i++) {
      const bx = px(i * 46 - (scroll % 46));
      const idx = Math.abs(i + Math.floor(scroll / 46));
      const bh = 30 + ((idx * 17 + i * 7) % 36);
      const topY = 95 - bh;

      pxRect(ctx, bx, topY, 42, bh + 2, facadeColors[idx % facadeColors.length], '#334155', 1);
      ctx.fillStyle = shadeColors[idx % shadeColors.length];
      ctx.fillRect(bx + 30, topY + 1, 11, bh);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(bx - 1, topY - 2, 44, 3);

      for (let wy = topY + 6; wy < 82; wy += 9) {
        for (let wx = bx + 5; wx < bx + 35; wx += 9) {
          ctx.fillStyle = (idx + wx + wy) % 5 === 0 ? '#bae6fd' : '#334155';
          ctx.fillRect(wx, wy, 5, 5);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(wx + 1, wy + 1, 2, 2);
        }
      }

      if (idx % 2 === 0) {
        const tx = bx + 18;
        ctx.fillStyle = '#78350f';
        ctx.fillRect(tx - 2, 74, 4, 18);
        fillStrokeCircle(ctx, tx - 6, 70, 9, '#15803d', '#064e3b', 0.9);
        fillStrokeCircle(ctx, tx + 6, 71, 8.5, '#16a34a', '#064e3b', 0.9);
        fillStrokeCircle(ctx, tx, 64, 11, '#22c55e', '#064e3b', 0.9);
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(tx - 2, 60, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle overhead urban utility wires passing outside
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 34);
    ctx.quadraticCurveTo(W * 0.5, 42, W, 33);
    ctx.stroke();
  }

  // Asphalt street + road dash stripes + arrival totem outside
  ctx.fillStyle = isBrightExterior ? '#475569' : '#0f172a';
  ctx.fillRect(0, 88, W, 9);
  ctx.fillStyle = isBrightExterior ? '#fde047' : '#ca8a04';
  const laneScroll = (time * 145 + camX * 0.5) % 44;
  for (let lx = -laneScroll; lx < W; lx += 44) {
    ctx.fillRect(px(lx), 91, 18, 2);
  }
  const lampScroll = (time * 95 + camX * 0.42) % 320;
  for (let sx = 120 - lampScroll; sx < W + 60; sx += 320) {
    drawRoadsideArrivalSign(ctx, px(sx), line.code, time, approachingStop);
  }

  // Crisp subtle diagonal window glass reflection streaks
  ctx.fillStyle = isMorningLine
    ? 'rgba(255, 255, 255, 0.16)'
    : isSunriseLine
      ? 'rgba(254, 240, 138, 0.16)'
      : 'rgba(147, 197, 253, 0.15)';
  for (let gx = -(camX % 116); gx < W; gx += 116) {
    ctx.beginPath();
    ctx.moveTo(px(gx + 22), 22);
    ctx.lineTo(px(gx + 34), 22);
    ctx.lineTo(px(gx + 16), 96);
    ctx.lineTo(px(gx + 4), 96);
    ctx.closePath();
    ctx.fill();
  }

  // 2. BUS INTERIOR CEILING + FLUORESCENT LIGHT FIXTURES
  const wallBase = isMorningLine ? '#768196' : isSunriseLine ? '#5e6a80' : '#243047';
  const wallDark = isMorningLine ? '#5a657a' : isSunriseLine ? '#444e63' : '#141d2e';
  const wallHi = isMorningLine ? '#94a3b8' : isSunriseLine ? '#7c89a1' : '#394867';

  ctx.fillStyle = isMorningLine ? '#64748b' : isSunriseLine ? '#4e596e' : '#172033';
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = isMorningLine ? '#475569' : isSunriseLine ? '#3b4456' : '#0b101d';
  ctx.fillRect(0, 0, W, 5);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 19, W, 3);

  for (let vx = 42 - (camX % 160); vx < W; vx += 160) {
    // Roof vent
    fillStrokeRoundRect(
      ctx,
      vx,
      3,
      42,
      10,
      2,
      isMorningLine ? '#475569' : isSunriseLine ? '#3b4456' : '#27344f',
      '#090d16',
      1.1
    );

    // Fluorescent ceiling tube between vents
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

    fillStrokeRoundRect(ctx, fx, 4, 52, 9, 2.5, '#0f172a', '#090d16', 1.2);
    const coreColor = tubeDim > 0.4 ? '#64748b' : tubeDim > 0.1 ? '#67e8f9' : '#ecfeff';
    const haloColor = tubeDim > 0.4 ? '#334155' : '#22d3ee';
    pxRect(ctx, fx + 3, 6, 46, 5, haloColor);
    pxRect(ctx, fx + 5, 7, 42, 3, coreColor);

    if (tubeDim < 0.5) {
      const coneAlpha = (isMorningLine ? 0.10 : isSunriseLine ? 0.13 : 0.19 + comboFlicker * 0.09) * (1 - tubeDim);
      const { coneGrad } = getBusInteriorGradients(ctx);
      ctx.save();
      ctx.globalAlpha = coneAlpha;
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(fx + 3, 13);
      ctx.lineTo(fx + 49, 13);
      ctx.lineTo(fx + 86, 146);
      ctx.lineTo(fx - 34, 146);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 3. BUS WINDOW PILLARS, ROUNDED RUBBER WINDOW FRAMES, LOWER WALL & DISPLAYS
  ctx.fillStyle = wallBase;
  ctx.fillRect(0, 93, W, 17);
  ctx.fillStyle = wallHi;
  ctx.fillRect(0, 96, W, 2.5);
  ctx.fillStyle = wallDark;
  ctx.fillRect(0, 105, W, 4);
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 93, W, 2.5);

  const linePosters = LINE_AD_POSTERS[line.lineNumber];
  const firstBayIdx = Math.floor(camX / 116) - 1;
  for (let b = firstBayIdx; b <= firstBayIdx + 6; b++) {
    const wx = px(b * 116 - camX);
    const worldWx = b * 116;

    // Brushed grey-steel window pillar + rounded dark rubber window gasket frame (matching reference!)
    ctx.fillStyle = wallBase;
    ctx.fillRect(wx - 2, 22, 17, 74);
    ctx.fillStyle = wallHi;
    ctx.fillRect(wx + 2, 24, 3, 68);
    ctx.fillStyle = wallDark;
    ctx.fillRect(wx + 10, 24, 3, 68);

    // Top/bottom metal sill headers across bay
    ctx.fillStyle = wallBase;
    ctx.fillRect(wx + 12, 22, 104, 5);
    ctx.fillRect(wx + 12, 91, 104, 5);

    // Rounded-corner window gasket (even-odd outer frame + dark rubber stroke)
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx + 11, 22, 106, 73);
    ctx.roundRect(wx + 14, 26, 98, 66, 9);
    ctx.fillStyle = wallDark;
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.roundRect(wx + 14, 26, 98, 66, 9);
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Red emergency stop button housing on pillar
    fillStrokeRoundRect(ctx, wx + 4, 37, 5, 12, 1.5, '#dc2626', '#090d16', 1);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(wx + 6, 40, 1, 2);

    if (worldWx > line.turnstileX - 95 || worldWx < -40) continue;

    // Dynamic line-themed randomized graffiti on background wall panels, pillars & windows!
    const wallSeed = seededHash(b * 31 + line.lineNumber * 97 + graffitiSeed);
    const densityBoost = line.lineNumber === 1 ? 0.12 : line.lineNumber === 2 ? 0.42 : 0.72;
    const effectiveDensity = Math.min(1, graffitiProgress + densityBoost);

    if ((wallSeed % 100) / 100 < effectiveDensity) {
      const offsetX = 20 + (wallSeed % 44);
      drawWallGraffitiOverlay(ctx, wx + offsetX, 105, line.lineNumber, wallSeed);
    }
    if (line.lineNumber >= 2 && ((wallSeed >>> 8) % 100) / 100 < effectiveDensity) {
      const offsetX2 = 68 + ((wallSeed >>> 5) % 24);
      drawWallGraffitiOverlay(ctx, wx + offsetX2, 104, line.lineNumber, wallSeed + 19);
    }
    if (line.lineNumber === 3 && ((wallSeed >>> 12) % 3) === 0) {
      drawWallGraffitiOverlay(ctx, wx + 2, 74, 3, wallSeed + 41);
    }

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

  // Vivid continuous horizontal top yellow grab bar
  pxBlockShaded(ctx, -4, 21, W + 8, 5, '#facc15', '#ca8a04', '#fef08a');

  // 4. ROYAL BLUE MOQUETTE-SPECKLED SEATS & YELLOW POLES
  ctx.fillStyle = isBrightExterior ? '#4f5b70' : '#111827';
  ctx.fillRect(0, 108, W, 41);
  ctx.fillStyle = isBrightExterior ? '#3b4659' : '#090d16';
  ctx.fillRect(0, 134, W, 15);

  const royalSeatFabric = '#2563eb';
  const royalCushionFabric = '#1d4ed8';
  const prioritySeatFabric = '#eab308';

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
      fillStrokeRoundRect(ctx, bx + 5, 103, 18, 8, 3, '#64748b', '#090d16', 1.2);
      fillStrokeRoundRect(ctx, bx + 9, 105, 10, 3, 1.2, '#0f172a', '#090d16', 0.8);

      // Rounded shaded seat backrest with colorful moquette fabric speckles (matching reference!)
      const backFill = priority ? prioritySeatFabric : royalSeatFabric;
      fillStrokeRoundRect(ctx, bx, 109, 28, 25, 4.5, backFill, '#090d16', 1.4);
      ctx.fillStyle = priority ? '#a16207' : '#1e3a8a';
      ctx.beginPath();
      ctx.roundRect(bx + 1.5, 110.5, 5, 22, 2);
      ctx.fill();
      ctx.fillStyle = priority ? '#fef08a' : '#60a5fa';
      ctx.fillRect(bx + 4, 110.5, 21, 2);

      // Colorful Brazilian bus moquette fabric dots
      const dotColors = priority ? ['#fef08a', '#78350f', '#f97316'] : ['#facc15', '#f472b6', '#93c5fd', '#1e3a8a'];
      for (let m = 0; m < 6; m++) {
        const mh = seededHash(slot * 17 + m * 13);
        ctx.fillStyle = dotColors[m % dotColors.length];
        ctx.fillRect(bx + 5 + (mh % 18), 114 + ((mh >>> 4) % 16), 2, 1.5);
      }

      // Rounded seat cushion base + silver/grey metallic pedestal skirt
      fillStrokeRoundRect(ctx, bx - 1, 131, 30, 9, 3, priority ? '#ca8a04' : royalCushionFabric, '#090d16', 1.4);
      ctx.fillStyle = priority ? '#fef08a' : '#60a5fa';
      ctx.fillRect(bx + 2, 132.5, 24, 1.8);
      fillStrokeRoundRect(ctx, bx + 1, 139, 26, 6, 2, '#94a3b8', '#090d16', 1.2);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(bx + 3, 140, 22, 1.5);

      // Randomized line-themed graffiti tags on seat backs
      const seatSeed = seededHash(slot * 29 + line.lineNumber * 71 + graffitiSeed);
      const seatThreshold = ((seatSeed % 10) / 10) * 0.85;
      const lineDensity = Math.min(1, graffitiProgress + (line.lineNumber - 1) * 0.3);
      if (lineDensity > seatThreshold + 0.12) {
        drawSeatGraffitiTag(ctx, bx, line.lineNumber, seatSeed);
      }

      const occupied = isBusSeatOccupied(line.lineNumber, slot);
      if (occupied) {
        drawSeatedCommuter(
          ctx,
          bx,
          line.lineNumber,
          (slot * 3 + line.lineNumber) % 5,
          time,
          slot
        );
      } else if (!usedSeatSlots?.has(slot)) {
        // Clear emerald empty-seat highlight
        ctx.fillStyle = '#10b981';
        ctx.fillRect(bx + 3, 134, 22, 3);
      }
    };

    // Keep priority yellow seat rare/early (bay 0 left) and make the rest deep royal blue like reference!
    drawSeat(sx + 11, bay === 0, bay * 2);
    drawSeat(sx + 43, false, bay * 2 + 1);

    // Dynamically scale standing commuters per bay by lineNumber without crowding the aisle
    if (worldSx > 90 && worldSx < line.turnstileX - 95) {
      const standingCount = getStandingCommutersAtBay(line.lineNumber, bay);
      if (standingCount >= 1) {
        drawStandingCommuter(ctx, sx + 2, bay * 3 + line.lineNumber, time, 'pole', bay);
      }
      if (standingCount >= 2) {
        drawStandingCommuter(
          ctx,
          sx + 40,
          bay * 5 + line.lineNumber + 1,
          time,
          'strap',
          bay
        );
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

  // 5. GLOSSY REFLECTIVE SPECKLED SLATE-BLUE AISLE FLOOR + DEPTH SHADOWS (y: 148..236)
  const floorGrad = ctx.createLinearGradient(0, 148, 0, 236);
  floorGrad.addColorStop(0, isBrightExterior ? '#475776' : '#334155');
  floorGrad.addColorStop(0.55, isBrightExterior ? '#3e4d69' : '#2c3952');
  floorGrad.addColorStop(1, isBrightExterior ? '#2d3a52' : '#1e293b');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 148, W, 88);

  // Subtle window-bay vertical neon-tinted light reflection columns on the glossy vinyl floor
  const reflAlpha = isBrightExterior ? 0.16 : 0.13;
  for (let b = firstBayIdx; b <= firstBayIdx + 6; b++) {
    const rx = px(b * 116 - camX + 16);
    const reflGrad = ctx.createLinearGradient(0, 148, 0, 234);
    reflGrad.addColorStop(0, `rgba(103, 232, 249, ${reflAlpha})`);
    reflGrad.addColorStop(0.55, `rgba(56, 189, 248, ${(reflAlpha * 0.85).toFixed(2)})`);
    reflGrad.addColorStop(1, `rgba(56, 189, 248, ${(reflAlpha * 0.25).toFixed(2)})`);
    ctx.fillStyle = reflGrad;
    ctx.fillRect(rx, 148, 92, 86);
  }

  // Anti-slip rubber vinyl floor speckle dots
  for (let fx = -(camX % 28); fx < W; fx += 28) {
    for (let fy = 156; fy < 230; fy += 18) {
      ctx.fillStyle = (fx + fy) % 2 === 0 ? 'rgba(226, 232, 240, 0.22)' : 'rgba(15, 23, 42, 0.34)';
      ctx.fillRect(px(fx + (fy % 7)), fy, 1.5, 1.5);
    }
  }

  // Projected shadow cast by the row of bus seats & foreground edge onto the aisle floor
  const { seatCastShadow, fgCastShadow } = getBusInteriorGradients(ctx);
  ctx.fillStyle = seatCastShadow;
  ctx.fillRect(0, 148, W, 30);

  ctx.fillStyle = fgCastShadow;
  ctx.fillRect(0, 210, W, 26);

  // Crisp top/bottom yellow aisle curb strips with subtle neon rim highlight
  pxBlockShaded(ctx, -4, 146, W + 8, 4, '#facc15', '#ca8a04', '#fef08a');
  pxBlockShaded(ctx, -4, 234, W + 8, 4, '#facc15', '#ca8a04', '#fef08a');
  ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
  ctx.fillRect(0, 145, W, 1);

  // Subtle floor inspection hatches
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.52)';
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
    if (!ticketValidated && Math.floor(time * 5) % 2 === 0) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(valX - 15, 94, 30, 46);
    }
    pxRect(ctx, valX - 13, 96, 26, 42, '#020617', '#020617', 1.8);
    pxRect(ctx, valX - 10, 99, 20, 36, '#facc15', '#020617', 1.3);
    pxRect(ctx, valX - 8, 102, 16, 29, '#0f172a', '#020617', 1.2);
    const screenColor = ticketValidated
      ? '#10b981'
      : Math.floor(time * 4) % 2 === 0
        ? '#e0f2fe'
        : '#38bdf8';
    pxRect(ctx, valX - 6, 105, 12, 11, screenColor, '#020617', 1.1);
    pxRect(ctx, valX - 5, 122, 4, 4, ticketValidated ? '#22c55e' : '#ef4444', '#020617', 0.9);
    pxRect(ctx, valX + 1, 122, 4, 4, ticketValidated ? '#22c55e' : '#facc15', '#020617', 0.9);
  }

  // Interactive Mid-Bus STOP Button / Cord ("Sinal de Parada")
  const stopX = px(line.stopCordX - camX);
  if (stopX > -40 && stopX < W + 40) {
    pxBlockShaded(ctx, stopX - 2.5, 22, 5, 126, '#facc15', '#ca8a04', '#fef08a');
    if (stopButtonReady && Math.floor(time * 6) % 2 === 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(stopX - 9, 92, 18, 26);
    }
    pxRect(ctx, stopX - 7, 94, 14, 22, '#020617', '#020617', 1.6);
    const btnBlink = stopButtonReady && Math.floor(time * 5) % 2 === 0;
    pxRect(
      ctx,
      stopX - 4,
      98,
      8,
      9,
      stopButtonReady ? (btnBlink ? '#ef4444' : '#f97316') : '#475569',
      '#020617',
      1.2
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

  // 7. Express Bus Wind Streaks (mid-combat air streaks)
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

/**
 * Primeiro Plano (Foreground Plane): barras, bancos, silhuetas próximas da câmera e
 * detalhes de teto/rodapé com paralaxe acelerada (1.22x) para sensação real de profundidade.
 */
export function drawVectorForegroundLayer(
  ctx: CanvasRenderingContext2D,
  line: LineDefinition,
  camX: number,
  time: number
) {
  const W = 480;
  const fgParallax = camX * 1.22;

  ctx.save();

  // A. Close-to-camera upper ceiling edge rail & swaying foreground grab straps
  ctx.fillStyle = '#050814';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 6, W, 2);

  const strapStep = 92;
  for (let s = -((fgParallax * 1.05) % strapStep); s < W + 40; s += strapStep) {
    const sx = px(s + 26);
    const sway = Math.round(Math.sin(time * 2.2 + s * 0.04));
    ctx.save();
    ctx.globalAlpha = 0.72;
    pxRect(ctx, sx - 2, 0, 5, 7, '#020617');
    pxRect(ctx, sx - 1, 7, 2.5, 5, '#1e293b');
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, 12);
    ctx.lineTo(sx - 4 + sway, 19);
    ctx.lineTo(sx + 4 + sway, 19);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // B. Foreground vertical yellow grab poles ("barras próximas da câmera") with faster parallax
  const poleStep = 246;
  for (let fp = -(fgParallax % poleStep); fp < W + 40; fp += poleStep) {
    const poleX = px(fp + 48);
    // Top ceiling clamp (opaque)
    pxRect(ctx, poleX - 2, 0, 12, 12, '#020617');
    pxBlockShaded(ctx, poleX, 0, 8, 20, '#eab308', '#854d0e', '#fef08a', '#020617');

    // Mid-span across combat lane (semi-translucent so depth reads clearly without hiding fighters)
    ctx.save();
    ctx.globalAlpha = 0.56;
    pxBlockShaded(ctx, poleX + 0.5, 20, 7, 214, '#ca8a04', '#713f12', '#fde047', '#020617');
    ctx.restore();

    // Bottom floor mount & clamp (opaque)
    pxBlockShaded(ctx, poleX, 232, 8, 38, '#eab308', '#854d0e', '#fef08a', '#020617');
    pxRect(ctx, poleX - 2, 232, 12, 6, '#020617');
  }

  // C. Bottom foreground edge: dark skirt, close-to-camera rounded seats ("bancos"), handrails & passengers
  ctx.fillStyle = '#050814';
  ctx.fillRect(0, 236, W, 34);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 236, W, 2);

  const fgStep = line.lineNumber === 1 ? 178 : line.lineNumber === 2 ? 126 : 92;
  for (let fg = -(fgParallax % fgStep); fg < W + 90; fg += fgStep) {
    const fx = px(fg);
    const fgIdx = Math.abs(Math.floor((fg + fgParallax) / fgStep));

    // Close-to-camera rounded seat backrest, headrest grip & metal armrest rail
    fillStrokeRoundRect(ctx, fx + 20, 239, 38, 31, 6, '#1e3a8a', '#020617', 1.8);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(fx + 23, 241, 32, 3);
    fillStrokeRoundRect(ctx, fx + 25, 234, 28, 7, 3, '#334155', '#020617', 1.4);
    ctx.fillStyle = '#475569';
    ctx.fillRect(fx + 27, 235, 24, 2);
    // Yellow metallic seat grab handle on corner
    fillStrokeRoundRect(ctx, fx + 53, 235, 6, 15, 2.2, '#eab308', '#020617', 1.3);

    // Foreground passenger silhouettes (close to camera, rounded cel-shaded shapes + subtle phone glow)
    const fgSeed = seededHash(fgIdx * 43 + line.lineNumber * 17);
    const fgSway = Math.round(Math.sin(time * 1.4 + (fgSeed % 17)) * 0.7);
    const fgPhoneActive = (time + (fgSeed % 9) * 0.7) % 5.2 < 1.8;
    const fgNod = fgPhoneActive ? 1 : 0;

    if (fgIdx % 2 === 0) {
      fillStrokeRoundRect(ctx, fx + 4, 241 + fgNod, 16, 17, 5, '#7c4a2d', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx + 3, 236 + fgNod, 18, 9, 4, '#0b101d', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx, 255 + fgSway, 25, 16, 5, '#0f172a', '#020617', 1.3);
      if (fgPhoneActive) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(fx + 8, 251, 8, 5);
      }
    } else {
      fillStrokeRoundRect(ctx, fx + 64, 244 + fgNod, 15, 15, 5, '#6b3e26', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx + 63, 240 + fgNod, 18, 7, 3.5, '#172554', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx + 74, 244 + fgNod, 10, 3, 1.4, '#0f172a', '#020617', 1);
      fillStrokeRoundRect(ctx, fx + 59, 256 + fgSway, 26, 15, 5, '#1e293b', '#020617', 1.3);
    }

    if (line.lineNumber === 3 && fgIdx % 2 === 0) {
      const fg3Nod = (time + (fgSeed % 7)) % 4.5 < 1.6 ? 1 : 0;
      fillStrokeRoundRect(ctx, fx + 46, 242 + fg3Nod, 15, 15, 5, '#8c583a', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx + 45, 238 + fg3Nod, 17, 7, 3.5, '#1e293b', '#020617', 1.3);
      fillStrokeRoundRect(ctx, fx + 42, 255, 23, 15, 5, '#090d16', '#020617', 1.3);
    }
  }

  ctx.restore();
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
  skinStyle: PlayerSkinStyle = 'classic',
  garageConfig?: GarageConfig
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 1. Exterior sky matching the route's time of day (05:55 Dawn -> 06:30 Sunrise -> 07:30-08:55 Morning)
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, width, height);

  const skyTop =
    lineNumber === 3 ? '#0ea5e9' : lineNumber === 2 ? '#3b82f6' : '#0b1120';
  const skyBot =
    lineNumber === 3 ? '#bae6fd' : lineNumber === 2 ? '#fde047' : '#334155';
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
    const bFill =
      lineNumber === 3
        ? idx % 2 === 0
          ? '#64748b'
          : '#94a3b8'
        : lineNumber === 2
          ? idx % 2 === 0
            ? '#9a3412'
            : '#b45309'
          : idx % 2 === 0
            ? '#0b1122'
            : '#131d38';
    pxRect(ctx, bx, 76 - bh, 32, bh + 4, bFill, '#020617', 1);
    for (let wy = 76 - bh + 5; wy < 68; wy += 7) {
      for (let wx = bx + 4; wx < bx + 26; wx += 7) {
        if ((idx + wx + wy) % 3 === 0) {
          ctx.fillStyle =
            lineNumber === 3 ? '#e0f2fe' : (wx + wy) % 2 === 0 ? '#f59e0b' : '#fde047';
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
    Exclude<PlayerSkinStyle, 'custom'>,
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
  const customCfg = skinStyle === 'custom' ? (garageConfig ?? DEFAULT_GARAGE_CONFIG) : null;
  const pal: (typeof skinMap)['classic'] = customCfg
    ? {
        ...skinMap.classic,
        tie: getGarageSwatchDef(customCfg.tieColor, 'crimson').main,
        bag: getGarageSwatchDef(customCfg.backpackColor, 'royal_blue').main,
        bagSh: getGarageSwatchDef(customCfg.backpackColor, 'royal_blue').dark,
      }
    : skinMap[skinStyle === 'custom' ? 'classic' : skinStyle];
  const hairSwatch = customCfg
    ? getGarageSwatchDef(customCfg.hairColor, 'dark_navy')
    : { main: '#0f1326', highlight: '#475569' };
  const activeHair = customCfg ? customCfg.hairStyle : 'pompadour';
  const isFemale = Boolean(customCfg && customCfg.gender === 'female');

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

  // Head tilted slightly back onto the pole, eyes peacefully closed + hair style!
  const headY = -43 + breath;
  pxBlockShaded(ctx, -8, headY, 11, 11, '#f1b586', '#c68353');
  if (pal.ninja) {
    pxRect(ctx, -8, headY + 6, 11, 5, '#1e293b', '#090d16', 0.9);
  }
  ctx.fillStyle = hairSwatch.main;
  if (activeHair === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(-9, headY + 4);
    ctx.lineTo(-10, headY - 4);
    ctx.lineTo(-5, headY - 2);
    ctx.lineTo(-2, headY - 7);
    ctx.lineTo(1, headY - 2);
    ctx.lineTo(5, headY - 5);
    ctx.lineTo(4, headY + 1);
    ctx.lineTo(-7, headY + 2);
    ctx.closePath();
    ctx.fill();
  } else if (activeHair === 'afro') {
    ctx.beginPath();
    ctx.arc(-2.5, headY - 1, 8.5, Math.PI * 0.85, Math.PI * 2.08);
    ctx.lineTo(4, headY + 2);
    ctx.lineTo(-7, headY + 2);
    ctx.closePath();
    ctx.fill();
  } else if (activeHair === 'ponytail') {
    pxRect(ctx, -13, headY + 2, 5, 9, hairSwatch.main, '#090d16', 0.8);
    pxRect(ctx, -9, headY + 1, 2, 3, pal.tie);
    ctx.beginPath();
    ctx.moveTo(-9, headY + 4);
    ctx.lineTo(-9, headY - 2);
    ctx.lineTo(3, headY - 3);
    ctx.lineTo(4, headY + 1);
    ctx.lineTo(-7, headY + 2);
    ctx.closePath();
    ctx.fill();
  } else {
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
  }
  ctx.fillStyle = hairSwatch.highlight;
  ctx.fillRect(-5, headY - 3, 6, 2);

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
    if (isFemale) {
      ctx.fillRect(-4, headY + 4, 1, 1);
    }
  }
  if (!pal.ninja) {
    ctx.fillStyle = isFemale ? '#f43f5e' : '#991b1b';
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
  skinStyle: PlayerSkinStyle = 'classic',
  garageConfig?: GarageConfig
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
    Exclude<PlayerSkinStyle, 'custom'>,
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
  const customCfg = skinStyle === 'custom' ? (garageConfig ?? DEFAULT_GARAGE_CONFIG) : null;
  const pal: (typeof skinColors)['classic'] = customCfg
    ? {
        ...skinColors.classic,
        tie: getGarageSwatchDef(customCfg.tieColor, 'crimson').main,
        bag: getGarageSwatchDef(customCfg.backpackColor, 'royal_blue').main,
      }
    : skinColors[skinStyle === 'custom' ? 'classic' : skinStyle];
  const hairSwatch = customCfg
    ? getGarageSwatchDef(customCfg.hairColor, 'dark_navy')
    : { main: '#0f1326', highlight: '#475569' };
  const activeHair = customCfg ? customCfg.hairStyle : 'pompadour';
  const isFemale = Boolean(customCfg && customCfg.gender === 'female');

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

  // Head tilted down with selected hair
  const hy = cy - 26;
  pxBlockShaded(ctx, cx - 6, hy, 12, 11, '#f1b586', '#c68353');
  if (pal.ninja) {
    pxRect(ctx, cx - 6, hy + 6, 12, 5, '#1e293b', '#090d16', 0.9);
  }
  ctx.fillStyle = hairSwatch.main;
  if (activeHair === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(cx - 7, hy + 4);
    ctx.lineTo(cx - 8, hy - 3);
    ctx.lineTo(cx - 3, hy - 1);
    ctx.lineTo(cx, hy - 6);
    ctx.lineTo(cx + 3, hy - 1);
    ctx.lineTo(cx + 7, hy - 4);
    ctx.lineTo(cx + 7, hy + 1);
    ctx.lineTo(cx - 5, hy + 2);
    ctx.closePath();
    ctx.fill();
  } else if (activeHair === 'afro') {
    ctx.beginPath();
    ctx.arc(cx, hy - 1, 8.5, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(cx + 6, hy + 2);
    ctx.lineTo(cx - 6, hy + 2);
    ctx.closePath();
    ctx.fill();
  } else if (activeHair === 'ponytail') {
    pxRect(ctx, cx - 10, hy + 2, 4, 8, hairSwatch.main, '#090d16', 0.8);
    pxRect(ctx, cx - 7, hy + 1, 2, 3, pal.tie);
    ctx.beginPath();
    ctx.moveTo(cx - 7, hy + 4);
    ctx.lineTo(cx - 7, hy - 2);
    ctx.lineTo(cx + 6, hy - 3);
    ctx.lineTo(cx + 7, hy + 1);
    ctx.lineTo(cx - 5, hy + 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 7, hy + 4);
    ctx.lineTo(cx - 7, hy - 1);
    ctx.lineTo(cx - 3, hy - 4);
    ctx.lineTo(cx + 5, hy - 5);
    ctx.lineTo(cx + 7, hy + 1);
    ctx.lineTo(cx - 5, hy + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = hairSwatch.highlight;
  ctx.fillRect(cx - 3, hy - 3, 6, 2);

  if (pal.ninja) {
    pxRect(ctx, cx - 7, hy + 1, 14, 2.5, '#dc2626', '#090d16', 0.8);
  }

  // Tightly shut crying eyes (`><` / squinted shut) + trembling frown
  pxRect(ctx, cx - 4, hy + 4, 3, 1.5, '#090d16');
  pxRect(ctx, cx + 1, hy + 4, 3, 1.5, '#090d16');
  if (!pal.ninja) {
    pxRect(ctx, cx - 2, hy + 8, 4, 2, isFemale ? '#f43f5e' : '#991b1b');
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
