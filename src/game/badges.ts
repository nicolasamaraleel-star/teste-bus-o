import { AchievementBadgeId } from './types';

export type AchievementCategory = 'combate' | 'trajeto' | 'desafio';

export interface AchievementMeta {
  label: string;
  description: string;
  category: AchievementCategory;
  target?: number;
  pillClass: string;
}

export interface AchievementProgressState {
  unlockedIds: AchievementBadgeId[];
  totalDefeated: number;
  highestLineReached: number;
  highestRushWave: number;
}

const ACHIEVEMENTS_STORAGE_KEY = 'horariodepico_achievements_v1';

export const ALLOWED_BADGE_IDS: readonly AchievementBadgeId[] = [
  'derrotar_50',
  'chegar_linha_3',
  'validar_sem_dano',
  'rage_10x',
  'all_validated',
  'zero_damage_line',
  'boss_rage_ko',
  'ninja_mochila',
  'acrobata_busao',
  'rush_onda_5',
] as const;

export const BADGE_META: Record<AchievementBadgeId, AchievementMeta> = {
  derrotar_50: {
    label: 'Rei do Corredor',
    description: 'Derrotar 50 passageiros no total',
    category: 'combate',
    target: 50,
    pillClass: 'bg-orange-500/20 border-orange-400 text-orange-200',
  },
  chegar_linha_3: {
    label: 'Rumo ao Barro Fundo',
    description: 'Chegar à Linha 3 · Barro Fundo',
    category: 'trajeto',
    target: 3,
    pillClass: 'bg-indigo-500/20 border-indigo-400 text-indigo-200',
  },
  validar_sem_dano: {
    label: 'Embarque Limpo',
    description: 'Validar o bilhete antes de sofrer dano na linha',
    category: 'trajeto',
    pillClass: 'bg-teal-500/20 border-teal-400 text-teal-200',
  },
  rage_10x: {
    label: 'Fúria 10x',
    description: 'Alcançar combo 10x sem sofrer dano',
    category: 'combate',
    pillClass: 'bg-rose-500/20 border-rose-400 text-rose-200',
  },
  all_validated: {
    label: 'Pagou Tudo',
    description: 'Validar o bilhete em todas as linhas',
    category: 'trajeto',
    pillClass: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
  },
  zero_damage_line: {
    label: 'Intocável',
    description: 'Completar uma linha inteira sem levar dano',
    category: 'desafio',
    pillClass: 'bg-sky-500/20 border-sky-400 text-sky-200',
  },
  boss_rage_ko: {
    label: 'Chefe em Fúria',
    description: 'Derrotar um chefe durante o modo Rage',
    category: 'combate',
    pillClass: 'bg-amber-500/20 border-amber-400 text-amber-200',
  },
  ninja_mochila: {
    label: 'Ninja da Mochila',
    description: 'Executar 3 contra-ataques perfeitos com a mochila',
    category: 'combate',
    pillClass: 'bg-cyan-500/20 border-cyan-400 text-cyan-200',
  },
  acrobata_busao: {
    label: 'Acrobata do Busão',
    description: 'Nocautear 2+ inimigos no giro da alça amarela',
    category: 'desafio',
    pillClass: 'bg-yellow-500/20 border-yellow-400 text-yellow-200',
  },
  rush_onda_5: {
    label: 'Sobrevivente do Rush',
    description: 'Alcançar a Onda 5 no modo Hora do Rush',
    category: 'desafio',
    target: 5,
    pillClass: 'bg-purple-500/20 border-purple-400 text-purple-200',
  },
};

function createDefaultProgress(): AchievementProgressState {
  return {
    unlockedIds: [],
    totalDefeated: 0,
    highestLineReached: 1,
    highestRushWave: 0,
  };
}

export function loadAchievementProgress(): AchievementProgressState {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<AchievementProgressState>;
    const allow = new Set<AchievementBadgeId>(ALLOWED_BADGE_IDS);
    const unlockedIds = Array.isArray(parsed.unlockedIds)
      ? Array.from(new Set(parsed.unlockedIds.filter((id): id is AchievementBadgeId => allow.has(id))))
      : [];
    return {
      unlockedIds,
      totalDefeated:
        typeof parsed.totalDefeated === 'number' && Number.isFinite(parsed.totalDefeated)
          ? Math.max(0, Math.floor(parsed.totalDefeated))
          : 0,
      highestLineReached:
        typeof parsed.highestLineReached === 'number' && Number.isFinite(parsed.highestLineReached)
          ? Math.max(1, Math.min(3, Math.floor(parsed.highestLineReached)))
          : 1,
      highestRushWave:
        typeof parsed.highestRushWave === 'number' && Number.isFinite(parsed.highestRushWave)
          ? Math.max(0, Math.floor(parsed.highestRushWave))
          : 0,
    };
  } catch {
    return createDefaultProgress();
  }
}

export function saveAchievementProgress(state: AchievementProgressState): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in private mode
  }
}

export function unlockPersistentAchievement(id: AchievementBadgeId): {
  unlockedNow: boolean;
  state: AchievementProgressState;
} {
  const state = loadAchievementProgress();
  if (state.unlockedIds.includes(id)) {
    return { unlockedNow: false, state };
  }
  const next: AchievementProgressState = {
    ...state,
    unlockedIds: [...state.unlockedIds, id],
  };
  saveAchievementProgress(next);
  return { unlockedNow: true, state: next };
}

export function recordDefeatedEnemyMilestone(delta = 1): AchievementProgressState {
  const state = loadAchievementProgress();
  const next: AchievementProgressState = {
    ...state,
    totalDefeated: state.totalDefeated + Math.max(0, Math.floor(delta)),
  };
  saveAchievementProgress(next);
  return next;
}

export function recordHighestLineMilestone(lineNumber: number): AchievementProgressState {
  const state = loadAchievementProgress();
  const clamped = Math.max(1, Math.min(3, Math.floor(lineNumber)));
  if (clamped <= state.highestLineReached) return state;
  const next: AchievementProgressState = {
    ...state,
    highestLineReached: clamped,
  };
  saveAchievementProgress(next);
  return next;
}

export function recordRushWaveMilestone(wave: number): AchievementProgressState {
  const state = loadAchievementProgress();
  const clamped = Math.max(0, Math.floor(wave));
  if (clamped <= state.highestRushWave) return state;
  const next: AchievementProgressState = {
    ...state,
    highestRushWave: clamped,
  };
  saveAchievementProgress(next);
  return next;
}

export function syncAchievementsWithProfile(
  profileBadges?: AchievementBadgeId[],
  profileTotalDefeated?: number,
  profileHighestLine?: number
): AchievementProgressState {
  const current = loadAchievementProgress();
  const allow = new Set<AchievementBadgeId>(ALLOWED_BADGE_IDS);
  const merged = new Set<AchievementBadgeId>(current.unlockedIds);
  if (Array.isArray(profileBadges)) {
    for (const b of profileBadges) {
      if (allow.has(b)) merged.add(b);
    }
  }
  const nextTotalDefeated = Math.max(current.totalDefeated, Math.floor(profileTotalDefeated ?? 0));
  const nextHighestLine = Math.max(
    current.highestLineReached,
    Math.min(3, Math.floor(profileHighestLine ?? 1))
  );
  if (nextTotalDefeated >= 50) merged.add('derrotar_50');
  if (nextHighestLine >= 3) merged.add('chegar_linha_3');

  const next: AchievementProgressState = {
    unlockedIds: Array.from(merged),
    totalDefeated: nextTotalDefeated,
    highestLineReached: nextHighestLine,
    highestRushWave: current.highestRushWave,
  };
  saveAchievementProgress(next);
  return next;
}
