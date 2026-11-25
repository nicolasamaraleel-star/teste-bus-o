import { drawVectorExteriorBus } from './vectorArt';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke = '#0f172a',
  lw = 2.5
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke = '#0f172a',
  lw = 2.5
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/**
 * Circular Brazilian Bus Stop Traffic Sign matching Imagem 1:
 * Red ring, white circle interior, black front-view bus silhouette.
 */
export function drawBusStopSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  poleBottomY?: number
) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (poleBottomY !== undefined) {
    const pw = Math.max(5, radius * 0.2);
    roundRect(ctx, cx - pw / 2, cy + radius * 0.6, pw, poleBottomY - (cy + radius * 0.6), 2, '#94a3b8', '#0f172a', 2.2);
  }

  // Outer red border ring
  circle(ctx, cx, cy, radius, '#ef4444', '#0f172a', 2.6);
  // Inner white circle
  circle(ctx, cx, cy, radius * 0.77, '#ffffff', '#0f172a', 1.5);

  // Black front-view bus icon (matching Imagem 1)
  const bw = radius * 0.86;
  const bh = radius * 0.72;
  const bx = cx - bw / 2;
  const by = cy - bh * 0.54;

  // Main black bus body
  roundRect(ctx, bx, by, bw, bh * 0.8, radius * 0.08, '#090d16', '#090d16', 0);

  // Top destination strip
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - bw * 0.24, by + bh * 0.06, bw * 0.48, bh * 0.07);

  // Two split windshields
  const winW = bw * 0.39;
  const winH = bh * 0.33;
  const winY = by + bh * 0.17;
  roundRect(ctx, bx + bw * 0.07, winY, winW, winH, 2, '#ffffff', '#090d16', 0);
  roundRect(ctx, cx + bw * 0.04, winY, winW, winH, 2, '#ffffff', '#090d16', 0);

  // Two round headlights
  const hlR = radius * 0.072;
  const hlY = by + bh * 0.65;
  circle(ctx, bx + bw * 0.17, hlY, hlR, '#ffffff', '#090d16', 0);
  circle(ctx, bx + bw * 0.83, hlY, hlR, '#ffffff', '#090d16', 0);

  // Bumper bar
  ctx.fillStyle = '#090d16';
  ctx.fillRect(bx - bw * 0.02, by + bh * 0.84, bw * 1.04, bh * 0.1);

  // Dual front tires on left and right
  const tireW = bw * 0.11;
  const tireH = bh * 0.24;
  const tireY = by + bh * 0.94;
  ctx.fillRect(bx + bw * 0.08, tireY, tireW, tireH);
  ctx.fillRect(bx + bw * 0.22, tireY, tireW, tireH);
  ctx.fillRect(bx + bw * 0.67, tireY, tireW, tireH);
  ctx.fillRect(bx + bw * 0.81, tireY, tireW, tireH);

  ctx.restore();
}

/**
 * Bus Stop-Request Button matching Imagem 2:
 * Gray rounded housing on a yellow vertical pole with a red circular "P" button.
 */
export function drawStopButtonP(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  pressed: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Gray rounded oval housing mounted on the yellow pole
  roundRect(ctx, -28, -58, 56, 118, 24, '#64748b', '#0f172a', 3);
  // Subtle front bevel highlight
  roundRect(ctx, -20, -52, 40, 106, 18, '#94a3b8', '#475569', 1.5);

  // Small top speaker/indicator circle (matching Imagem 2)
  circle(ctx, 2, -31, 9, '#94a3b8', '#475569', 1.6);

  // Red circular "P" push button
  const btnX = 2;
  const btnY = 16;
  if (pressed) {
    // Comic impact star behind button
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6;
      const rad = i % 2 === 0 ? 38 : 25;
      const px = btnX + Math.cos(ang) * rad;
      const py = btnY + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  circle(ctx, btnX, btnY, 21, '#ef4444', '#0f172a', 2.8);
  circle(ctx, btnX - 2, btnY - 2, 17, '#f87171', '#dc2626', 0);

  // Bold black "P" letter
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', btnX, btnY + 1);

  ctx.restore();
}

function drawPerspectiveBusBackdrop(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  skyTop = '#0f172a',
  skyBot = '#475569'
) {
  // Sky outside left & right windows
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Simple stylized city blocks in windows
  const bCols = ['#334155', '#1e3a8a', '#475569', '#0f766e'];
  for (let i = 0; i < 12; i++) {
    const bx = i * 84;
    const bh = 95 + ((i * 37) % 85);
    roundRect(ctx, bx + 4, H * 0.56 - bh, 74, bh + 15, 4, bCols[i % bCols.length], '#0f172a', 2);
  }

  // Light bus ceiling & side walls framing windows
  const ceil = ctx.createLinearGradient(0, 0, 0, 78);
  ceil.addColorStop(0, '#f8fafc');
  ceil.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = ceil;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W * 0.68, 92);
  ctx.lineTo(W * 0.32, 92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Roof vents
  roundRect(ctx, W * 0.44, 18, W * 0.12, 22, 4, '#94a3b8', '#0f172a', 2);
  roundRect(ctx, W * 0.46, 54, W * 0.08, 16, 3, '#94a3b8', '#0f172a', 1.8);

  // Slate-blue aisle floor in perspective
  const fl = ctx.createLinearGradient(0, H * 0.58, 0, H);
  fl.addColorStop(0, '#475569');
  fl.addColorStop(1, '#334155');
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.moveTo(W * 0.35, H * 0.56);
  ctx.lineTo(W * 0.65, H * 0.56);
  ctx.lineTo(W * 0.86, H);
  ctx.lineTo(W * 0.14, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Floor hatch lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(W * 0.43, H * 0.72, W * 0.14, H * 0.14);

  // Window mullions & side panels
  roundRect(ctx, 0, H * 0.52, W * 0.36, H * 0.48, 0, '#1e293b', '#0f172a', 3);
  roundRect(ctx, W * 0.64, H * 0.52, W * 0.36, H * 0.48, 0, '#1e293b', '#0f172a', 3);

  // Windshield at far front of bus
  roundRect(ctx, W * 0.34, 92, W * 0.32, H * 0.35, 8, '#bae6fd', '#0f172a', 3);
  // Single front/exit door frame at far right
  roundRect(ctx, W * 0.66, 96, 48, 130, 4, '#334155', '#0f172a', 2.5);
  roundRect(ctx, W * 0.668, 104, 18, 86, 2, '#bae6fd', '#0f172a', 1.8);
  roundRect(ctx, W * 0.692, 104, 18, 86, 2, '#bae6fd', '#0f172a', 1.8);

  // Alternating Yellow & Royal Blue seats along both sides
  const rows = [
    { scale: 0.48, y: 205, lx: 315, rx: 605 },
    { scale: 0.66, y: 238, lx: 248, rx: 648 },
    { scale: 0.88, y: 282, lx: 158, rx: 710 },
    { scale: 1.12, y: 340, lx: 46, rx: 790 },
  ];

  rows.forEach((row, idx) => {
    const drawSideSeat = (sx: number, isYellow: boolean) => {
      const w = 112 * row.scale;
      const h = 118 * row.scale;
      const bodyCol = isYellow ? '#facc15' : '#2563eb';
      const baseCol = isYellow ? '#eab308' : '#1d4ed8';
      // Gray headrest grab handle
      roundRect(ctx, sx + w * 0.2, row.y - 16 * row.scale, w * 0.6, 22 * row.scale, 8, '#64748b', '#0f172a', 2.4);
      roundRect(ctx, sx + w * 0.3, row.y - 11 * row.scale, w * 0.4, 10 * row.scale, 4, '#0f172a', '#0f172a', 0);
      // High backrest
      roundRect(ctx, sx, row.y, w, h * 0.72, 10, bodyCol, '#0f172a', 2.8);
      // Seat cushion
      roundRect(ctx, sx - 4, row.y + h * 0.64, w + 8, h * 0.34, 8, baseCol, '#0f172a', 2.8);
    };
    drawSideSeat(row.lx, idx % 2 === 0);
    drawSideSeat(row.rx, idx % 2 === 1);
  });

  // Yellow vertical & overhead grab poles
  roundRect(ctx, W * 0.25, 16, 13, H - 16, 4, '#facc15', '#0f172a', 2.8);
  roundRect(ctx, W * 0.73, 16, 13, H - 16, 4, '#facc15', '#0f172a', 2.8);
  roundRect(ctx, W * 0.33, 72, 9, 250, 3, '#facc15', '#0f172a', 2.4);
  roundRect(ctx, W * 0.66, 72, 9, 250, 3, '#facc15', '#0f172a', 2.4);
  // Overhead yellow rails
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(W * 0.22, 0);
  ctx.lineTo(W * 0.36, 95);
  ctx.moveTo(W * 0.78, 0);
  ctx.lineTo(W * 0.64, 95);
  ctx.stroke();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6.5;
  ctx.stroke();
}

export function drawIntroStoryboardFrame(
  ctx: CanvasRenderingContext2D,
  frameId: string,
  W = 960,
  H = 540
) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (frameId === 'sleep') {
    drawPerspectiveBusBackdrop(ctx, W, H);

    // Prominent Bus Stop Sign (matching Imagem 1) passing outside left window!
    drawBusStopSign(ctx, 175, 195, 58, 285);

    // "SEU PONTO!" comic callout pointing to the sign
    roundRect(ctx, 244, 128, 128, 40, 10, '#facc15', '#0f172a', 3);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SEU PONTO!', 308, 154);

    // Subtle sleepy dark eyelids vignette at top & bottom edges
    const vig = ctx.createLinearGradient(0, 0, 0, H);
    vig.addColorStop(0, 'rgba(9, 13, 22, 0.78)');
    vig.addColorStop(0.24, 'rgba(9, 13, 22, 0.0)');
    vig.addColorStop(0.76, 'rgba(9, 13, 22, 0.0)');
    vig.addColorStop(1, 'rgba(9, 13, 22, 0.82)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Cartoon "Zzz..." bubble
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.strokeText('Zzz...?!', W - 46, 92);
    ctx.fillText('Zzz...?!', W - 46, 92);
  } else if (frameId === 'rush') {
    drawPerspectiveBusBackdrop(ctx, W, H);

    // Startled cartoon passengers peeking over seats
    const drawHead = (hx: number, hy: number, hair: string, skin: string) => {
      circle(ctx, hx, hy, 22, skin, '#0f172a', 2.5);
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(hx, hy - 8, 22, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      circle(ctx, hx - 7, hy + 2, 4.5, '#ffffff', '#0f172a', 1.5);
      circle(ctx, hx + 7, hy + 2, 4.5, '#ffffff', '#0f172a', 1.5);
      circle(ctx, hx - 7, hy + 2, 2, '#0f172a', '#0f172a', 0);
      circle(ctx, hx + 7, hy + 2, 2, '#0f172a', '#0f172a', 0);
      circle(ctx, hx, hy + 12, 4.5, '#0f172a', '#0f172a', 0);
    };
    drawHead(308, 224, '#e2e8f0', '#f5c29b');
    drawHead(655, 228, '#1e293b', '#d99b72');

    // Comic radial speed lines
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(ang) * 190, H / 2 + Math.sin(ang) * 130);
      ctx.lineTo(W / 2 + Math.cos(ang) * 480, H / 2 + Math.sin(ang) * 320);
      ctx.stroke();
    }

    // Foreground outstretched arm in smart-casual light-blue dress shirt reaching forward!
    ctx.fillStyle = '#dbeafe';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(W * 0.78, H);
    ctx.lineTo(W * 0.56, H * 0.63);
    ctx.lineTo(W * 0.65, H * 0.55);
    ctx.lineTo(W * 0.94, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hand reaching for the stop button
    circle(ctx, W * 0.57, H * 0.56, 28, '#f5c29b', '#0f172a', 3.2);
    roundRect(ctx, W * 0.51, H * 0.49, 24, 14, 6, '#f5c29b', '#0f172a', 2.5);
    roundRect(ctx, W * 0.49, H * 0.53, 28, 13, 6, '#f5c29b', '#0f172a', 2.5);
  } else if (frameId === 'button') {
    // Close-up framing matching Imagem 2!
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#bae6fd');
    bg.addColorStop(1, '#475569');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft window & blue/yellow seat shapes in background (matching Imagem 2)
    roundRect(ctx, 180, -20, 720, 210, 18, '#e0f2fe', '#0f172a', 4);
    roundRect(ctx, 370, 165, 520, 320, 36, '#1e3a8a', '#0f172a', 4);
    // Yellow grab rail along seat top
    roundRect(ctx, 375, 160, 505, 34, 16, '#facc15', '#0f172a', 3.5);
    // Royal blue seat cushions in foreground right
    roundRect(ctx, 110, 355, 290, 195, 28, '#2563eb', '#0f172a', 4);
    roundRect(ctx, 415, 390, 290, 175, 28, '#1d4ed8', '#0f172a', 4);

    // Big yellow vertical handrail pole on left-center (matching Imagem 2)
    roundRect(ctx, 215, 0, 58, H, 8, '#facc15', '#0f172a', 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(228, 0, 10, H);

    // Exact Imagem 2 gray oval housing + red "P" button!
    drawStopButtonP(ctx, 268, 250, 1.85, true);

    // Estagiário's fist in light-blue dress shirt sleeve slamming the red "P" button
    roundRect(ctx, 455, 235, 520, 96, 18, '#dbeafe', '#0f172a', 4);
    roundRect(ctx, 435, 230, 44, 106, 10, '#f8fafc', '#0f172a', 3.5);
    // Wristwatch
    roundRect(ctx, 424, 238, 16, 90, 6, '#1e293b', '#0f172a', 3);
    // Fist
    roundRect(ctx, 315, 224, 118, 104, 28, '#f5c29b', '#0f172a', 4);
    // Knuckle lines
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(352, 235);
    ctx.lineTo(352, 275);
    ctx.moveTo(382, 235);
    ctx.lineTo(382, 275);
    ctx.stroke();

    // Comic "PLIM!" badge
    roundRect(ctx, 560, 64, 175, 52, 14, '#facc15', '#0f172a', 3.5);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLIM!!', 648, 98);
  } else {
    // Frame 4: "ready" — Estagiário in fighting stance inside the bus!
    drawPerspectiveBusBackdrop(ctx, W, H);

    const px = W * 0.5;
    const py = H * 0.62;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(2.6, 2.6);

    // Commuter backpack behind shoulders
    roundRect(ctx, -36, -54, 72, 74, 12, '#1e3a8a', '#0f172a', 2.4);
    roundRect(ctx, -32, -32, 64, 34, 8, '#0284c7', '#0f172a', 1.8);

    // Legs (dark navy trousers)
    roundRect(ctx, -22, 16, 18, 48, 6, '#1e293b', '#0f172a', 2.2);
    roundRect(ctx, 4, 16, 18, 48, 6, '#334155', '#0f172a', 2.2);

    // Torso (light-blue casual dress shirt)
    roundRect(ctx, -26, -48, 52, 68, 10, '#dbeafe', '#0f172a', 2.4);
    // Backpack front straps
    roundRect(ctx, -20, -48, 7, 56, 3, '#1d4ed8', '#0f172a', 1.6);
    roundRect(ctx, 13, -48, 7, 56, 3, '#1d4ed8', '#0f172a', 1.6);

    // Collar + Red Necktie
    roundRect(ctx, -12, -50, 24, 10, 3, '#f8fafc', '#0f172a', 1.6);
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-4, -42);
    ctx.lineTo(4, -42);
    ctx.lineTo(7, -6);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head + spiky hair
    circle(ctx, 0, -72, 22, '#f5c29b', '#0f172a', 2.4);
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-22, -74);
    ctx.lineTo(-24, -92);
    ctx.lineTo(-10, -88);
    ctx.lineTo(0, -104);
    ctx.lineTo(10, -88);
    ctx.lineTo(24, -92);
    ctx.lineTo(22, -74);
    ctx.quadraticCurveTo(0, -82, -22, -74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Determined eyes & brows
    circle(ctx, -8, -71, 4.2, '#ffffff', '#0f172a', 1.5);
    circle(ctx, 8, -71, 4.2, '#ffffff', '#0f172a', 1.5);
    circle(ctx, -7, -71, 2, '#0f172a', '#0f172a', 0);
    circle(ctx, 7, -71, 2, '#0f172a', '#0f172a', 0);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-14, -79);
    ctx.lineTo(-3, -76);
    ctx.moveTo(14, -79);
    ctx.lineTo(3, -76);
    ctx.stroke();

    // Raised fists in rolled dress-shirt sleeves
    roundRect(ctx, -44, -26, 22, 18, 6, '#dbeafe', '#0f172a', 2.2);
    circle(ctx, -32, -28, 12, '#f5c29b', '#0f172a', 2.2);
    roundRect(ctx, 22, -26, 22, 18, 6, '#dbeafe', '#0f172a', 2.2);
    circle(ctx, 32, -28, 12, '#f5c29b', '#0f172a', 2.2);

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Clean 2D Cartoon Bus Stop Transition Frame (same style as intro frames)
 * Featuring the circular Bus Stop Sign matching Imagem 1!
 */
export function drawBusStopTransitionFrame(
  ctx: CanvasRenderingContext2D,
  nextLineCode: string,
  fiscalChasing: boolean,
  W = 960,
  H = 420
) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const isLine3 = nextLineCode === '303';
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  if (isLine3) {
    sky.addColorStop(0, '#0ea5e9');
    sky.addColorStop(1, '#bae6fd');
  } else {
    sky.addColorStop(0, '#f97316');
    sky.addColorStop(1, '#fde047');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stylized urban skyline
  const buildings = isLine3
    ? ['#64748b', '#475569', '#3b82f6']
    : ['#9a3412', '#b45309', '#475569'];
  for (let i = 0; i < 11; i++) {
    const bh = 80 + ((i * 43) % 90);
    roundRect(ctx, i * 92 - 10, H * 0.58 - bh, 82, bh + 15, 4, buildings[i % buildings.length], '#0f172a', 2.5);
  }

  // Asphalt street & sidewalk
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, H * 0.58, W, H * 0.42);
  // Sidewalk slab
  roundRect(ctx, -6, H * 0.68, W + 12, H * 0.34, 0, '#64748b', '#0f172a', 3);
  roundRect(ctx, -6, H * 0.67, W + 12, 12, 0, '#facc15', '#0f172a', 2.5);

  // Arriving Next Bus on the road (2D vector bus)
  ctx.save();
  ctx.translate(310, 265);
  ctx.scale(2.15, 2.15);
  drawVectorExteriorBus(ctx, 0, 0, nextLineCode, 1.2);
  ctx.restore();

  // Prominent Imagem 1 Bus Stop Sign on sidewalk pole!
  drawBusStopSign(ctx, 790, 125, 46, H * 0.78);
  // Small line number tag on pole below sign
  roundRect(ctx, 744, 188, 92, 26, 5, '#0f172a', '#facc15', 2.2);
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`LINHA ${nextLineCode}`, 790, 206);

  // Estagiário standing at the bus stop raising his hand to signal
  ctx.save();
  ctx.translate(655, 295);
  ctx.scale(1.6, 1.6);
  // Backpack
  roundRect(ctx, -18, -32, 14, 28, 4, '#1e3a8a', '#0f172a', 2);
  // Legs
  roundRect(ctx, -10, 0, 10, 26, 3, '#1e293b', '#0f172a', 2);
  roundRect(ctx, 2, 0, 10, 26, 3, '#334155', '#0f172a', 2);
  // Dress shirt
  roundRect(ctx, -14, -32, 28, 34, 6, '#dbeafe', '#0f172a', 2);
  // Red tie
  roundRect(ctx, 2, -29, 5, 18, 2, '#dc2626', '#0f172a', 1.4);
  // Head
  circle(ctx, 0, -45, 13, '#f5c29b', '#0f172a', 2);
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(0, -49, 13, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  // Raised signaling arm
  roundRect(ctx, -28, -56, 10, 28, 4, '#dbeafe', '#0f172a', 2);
  circle(ctx, -23, -59, 6, '#f5c29b', '#0f172a', 1.8);
  ctx.restore();

  // If unvalidated ticket -> Fiscal in blue shirt with notebook spotting Estagiário from behind!
  if (fiscalChasing) {
    ctx.save();
    ctx.translate(885, 305);
    ctx.scale(1.55, 1.55);
    roundRect(ctx, -10, 0, 10, 26, 3, '#0f172a', '#0f172a', 2);
    roundRect(ctx, 2, 0, 10, 26, 3, '#1e293b', '#0f172a', 2);
    // Blue shirt
    roundRect(ctx, -14, -32, 28, 34, 6, '#2563eb', '#0f172a', 2);
    // Red notebook (caderneta)
    roundRect(ctx, -24, -22, 13, 17, 2, '#ef4444', '#0f172a', 1.8);
    // Head + cap
    circle(ctx, 0, -45, 12, '#f5c29b', '#0f172a', 2);
    roundRect(ctx, -13, -57, 24, 9, 3, '#1e3a8a', '#0f172a', 1.8);
    // Alert bubble
    roundRect(ctx, -14, -84, 28, 22, 6, '#ef4444', '#0f172a', 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -68);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Clean 2D Cartoon Office Victory Frame (same style as intro frames)
 */
export function drawOfficeVictoryFrame(
  ctx: CanvasRenderingContext2D,
  W = 960,
  H = 420
) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Office wall & bright morning window
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 70, 24, W - 140, 210, 12, '#7dd3fc', '#0f172a', 4);
  for (let i = 0; i < 8; i++) {
    roundRect(ctx, 90 + i * 95, 110, 78, 120, 4, '#334155', '#0f172a', 2.5);
  }

  // Office desk
  roundRect(ctx, -10, 232, W + 20, H - 220, 0, '#92400e', '#0f172a', 4);

  // Tablet stand & crisp check-in tablet
  roundRect(ctx, W / 2 - 28, 215, 56, 46, 6, '#475569', '#0f172a', 3);
  roundRect(ctx, W / 2 - 145, 76, 290, 175, 16, '#0f172a', '#020617', 4);
  roundRect(ctx, W / 2 - 130, 90, 260, 147, 10, '#059669', '#0f172a', 2.5);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PONTO BATIDO!', W / 2, 152);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('08:59', W / 2, 198);

  // Estagiário's hand tapping the tablet
  roundRect(ctx, W / 2 + 45, 210, 240, 76, 16, '#dbeafe', '#0f172a', 3.5);
  circle(ctx, W / 2 + 32, 224, 24, '#f5c29b', '#0f172a', 3.5);

  ctx.restore();
}
