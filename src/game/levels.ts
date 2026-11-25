import { LineDefinition } from './types';

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;
export const RENDER_SCALE = 2;
export const AISLE_MIN_Y = 148;
export const AISLE_MAX_Y = 232;
export const GRAVITY = 780;

export interface LineDifficultyConfig {
  hpMult: number;
  bossHpMult: number;
  speedMult: number;
  damageMult: number;
  windupMult: number;
  cooldownMult: number;
}

export const LINE_DIFFICULTY: Record<1 | 2 | 3, LineDifficultyConfig> = {
  1: {
    hpMult: 0.62,
    bossHpMult: 0.72,
    speedMult: 0.72,
    damageMult: 0.62,
    windupMult: 1.45,
    cooldownMult: 1.35,
  },
  2: {
    hpMult: 0.9,
    bossHpMult: 0.95,
    speedMult: 0.92,
    damageMult: 0.9,
    windupMult: 1.1,
    cooldownMult: 1.05,
  },
  3: {
    hpMult: 1.15,
    bossHpMult: 1.15,
    speedMult: 1.08,
    damageMult: 1.12,
    windupMult: 0.92,
    cooldownMult: 0.88,
  },
};

export const BUS_LINES: LineDefinition[] = [
  {
    lineNumber: 1,
    code: '101',
    title: 'Linha 101 · Alphavella',
    subtitle: '05:55 · Madrugada na avenida principal',
    skyTop: '#0f172a',
    skyBottom: '#475569',
    buildingPalette: ['#1e293b', '#334155', '#172554', '#0f172a'],
    accentColor: '#facc15',
    busLength: 1920,
    validatorX: 1505,
    turnstileX: 1600,
    stopCordX: 780,
    exitDoorX: 1845,
    ticketCost: 2,
    waves: [
      {
        id: 1,
        triggerX: 140,
        lockMinX: 0,
        lockMaxX: 540,
        spawns: [
          { type: 'idosa', offsetX: 390, y: 175, guaranteedDrop: 'bengala' },
          { type: 'estudante', offsetX: 445, y: 205 },
          { type: 'vendedor', offsetX: 490, y: 162 },
        ],
      },
      {
        id: 2,
        triggerX: 620,
        lockMinX: 500,
        lockMaxX: 1060,
        spawns: [
          { type: 'estudante', offsetX: 880, y: 185, guaranteedDrop: 'creditos' },
          { type: 'vendedor', offsetX: 935, y: 158 },
          { type: 'idosa', offsetX: 985, y: 214 },
          { type: 'vendedor', offsetX: 1025, y: 218 },
        ],
      },
      {
        id: 3,
        triggerX: 1120,
        lockMinX: 1020,
        lockMaxX: 1580,
        spawns: [
          { type: 'idosa', offsetX: 1380, y: 166 },
          { type: 'skatista', offsetX: 1445, y: 202 },
          { type: 'vendedor', offsetX: 1510, y: 184 },
        ],
      },
      {
        id: 4,
        triggerX: 1420,
        lockMinX: 1360,
        lockMaxX: 1890,
        isBossWave: true,
        bossBanner: 'MINI-BOSS: COBRADOR DA CATRACA!',
        spawns: [
          { type: 'boss_cobrador', offsetX: 1700, y: 190 },
          { type: 'estudante', offsetX: 1775, y: 164 },
        ],
      },
    ],
  },
  {
    lineNumber: 2,
    code: '202',
    title: 'Linha 202 · Largo de Oz',
    subtitle: '06:30 · Nascer do sol na via expressa',
    skyTop: '#38bdf8',
    skyBottom: '#fde047',
    buildingPalette: ['#9a3412', '#b45309', '#475569', '#334155'],
    accentColor: '#fb923c',
    busLength: 2050,
    validatorX: 1635,
    turnstileX: 1730,
    stopCordX: 880,
    exitDoorX: 1975,
    ticketCost: 2,
    waves: [
      {
        id: 1,
        triggerX: 140,
        lockMinX: 0,
        lockMaxX: 560,
        spawns: [
          { type: 'patricinha', offsetX: 400, y: 174, guaranteedDrop: 'desodorante' },
          { type: 'skatista', offsetX: 460, y: 212 },
          { type: 'estudante', offsetX: 505, y: 188 },
        ],
      },
      {
        id: 2,
        triggerX: 640,
        lockMinX: 540,
        lockMaxX: 1120,
        spawns: [
          { type: 'patricinha', offsetX: 910, y: 162 },
          { type: 'industria', offsetX: 975, y: 195 },
          { type: 'tio_audio', offsetX: 1030, y: 216 },
          { type: 'estudante', offsetX: 1075, y: 182, guaranteedDrop: 'creditos' },
        ],
      },
      {
        id: 3,
        triggerX: 1160,
        lockMinX: 1080,
        lockMaxX: 1660,
        spawns: [
          { type: 'patricinha', offsetX: 1420, y: 165 },
          { type: 'skatista', offsetX: 1485, y: 216 },
          { type: 'industria', offsetX: 1555, y: 182 },
          { type: 'tio_audio', offsetX: 1610, y: 214 },
        ],
      },
      {
        id: 4,
        triggerX: 1520,
        lockMinX: 1480,
        lockMaxX: 2020,
        isBossWave: true,
        bossBanner: 'MINI-BOSS: MOTORISTA FURIOSO & COBRADOR!',
        spawns: [
          { type: 'boss_motorista', offsetX: 1800, y: 178 },
          { type: 'boss_cobrador', offsetX: 1875, y: 210 },
          { type: 'patricinha', offsetX: 1920, y: 164 },
        ],
      },
    ],
  },
  {
    lineNumber: 3,
    code: '303',
    title: 'Linha 303 · Barro Fundo',
    subtitle: '07:30 · Manhã clara rumo ao terminal Barro Fundo!',
    skyTop: '#0ea5e9',
    skyBottom: '#bae6fd',
    buildingPalette: ['#1e3a8a', '#334155', '#475569', '#0f766e'],
    accentColor: '#38bdf8',
    busLength: 2180,
    validatorX: 1765,
    turnstileX: 1860,
    stopCordX: 960,
    exitDoorX: 2100,
    ticketCost: 2,
    waves: [
      {
        id: 1,
        triggerX: 150,
        lockMinX: 0,
        lockMaxX: 580,
        spawns: [
          { type: 'idosa', offsetX: 400, y: 168 },
          { type: 'skatista', offsetX: 455, y: 212 },
          { type: 'estudante', offsetX: 500, y: 188, guaranteedDrop: 'creditos' },
          { type: 'patricinha', offsetX: 540, y: 158 },
        ],
      },
      {
        id: 2,
        triggerX: 680,
        lockMinX: 580,
        lockMaxX: 1180,
        spawns: [
          { type: 'patricinha', offsetX: 940, y: 164, guaranteedDrop: 'desodorante' },
          { type: 'industria', offsetX: 1005, y: 192 },
          { type: 'tio_audio', offsetX: 1055, y: 216 },
          { type: 'patricinha', offsetX: 1105, y: 170 },
          { type: 'skatista', offsetX: 1145, y: 210 },
        ],
      },
      {
        id: 3,
        triggerX: 1240,
        lockMinX: 1140,
        lockMaxX: 1740,
        spawns: [
          { type: 'tio_audio', offsetX: 1500, y: 160 },
          { type: 'industria', offsetX: 1565, y: 184 },
          { type: 'industria', offsetX: 1625, y: 218 },
          { type: 'skatista', offsetX: 1680, y: 194 },
        ],
      },
      {
        id: 4,
        triggerX: 1620,
        lockMinX: 1560,
        lockMaxX: 2150,
        isBossWave: true,
        bossBanner: 'FINAL BOSS: COBRADOR BLINDADO & FISCAL!',
        spawns: [
          { type: 'boss_cobrador_blindado', offsetX: 1935, y: 180 },
          { type: 'boss_fiscal_chefe', offsetX: 2005, y: 214 },
        ],
      },
    ],
  },
];
