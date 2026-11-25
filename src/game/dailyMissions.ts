import { awardBonusCoins } from './shop';

export type DailyMissionEventType =
  | 'defeat_passengers'
  | 'use_special'
  | 'land_heavy_punches'
  | 'bag_parries'
  | 'rail_spins'
  | 'validate_tickets'
  | 'defeat_bosses'
  | 'collect_drops'
  | 'reach_combo'
  | 'complete_runs';

export interface DailyMissionTemplate {
  type: DailyMissionEventType;
  title: string;
  description: string;
  target: number;
  rewardCredits: number;
  mode: 'add' | 'max';
}

export interface DailyMission {
  id: string;
  type: DailyMissionEventType;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardCredits: number;
  mode: 'add' | 'max';
  completed: boolean;
  claimed: boolean;
}

export interface DailyMissionsState {
  generatedAt: number;
  expiresAt: number;
  missions: DailyMission[];
}

const DAILY_MISSIONS_STORAGE_KEY = 'horariodepico_daily_missions_v1';
const CYCLE_DURATION_MS = 24 * 60 * 60 * 1000;

export const DAILY_MISSION_POOL: readonly DailyMissionTemplate[] = [
  {
    type: 'defeat_passengers',
    title: 'Abrir Caminho',
    description: 'Derrote 20 passageiros no busão',
    target: 20,
    rewardCredits: 150,
    mode: 'add',
  },
  {
    type: 'use_special',
    title: 'Explosão no Corredor',
    description: 'Use o golpe Especial 5 vezes',
    target: 5,
    rewardCredits: 130,
    mode: 'add',
  },
  {
    type: 'land_heavy_punches',
    title: 'Mão Pesada',
    description: 'Acerte 12 socos potentes nos inimigos',
    target: 12,
    rewardCredits: 140,
    mode: 'add',
  },
  {
    type: 'bag_parries',
    title: 'Mochila de Aço',
    description: 'Faça 3 contra-ataques perfeitos com a mochila',
    target: 3,
    rewardCredits: 170,
    mode: 'add',
  },
  {
    type: 'rail_spins',
    title: 'Acrobata da Barra',
    description: 'Execute 4 ataques na barra amarela',
    target: 4,
    rewardCredits: 135,
    mode: 'add',
  },
  {
    type: 'validate_tickets',
    title: 'Passageiro Exemplar',
    description: 'Valide o bilhete na catraca 3 vezes',
    target: 3,
    rewardCredits: 145,
    mode: 'add',
  },
  {
    type: 'defeat_bosses',
    title: 'Fim de Turno',
    description: 'Derrote 2 chefes de linha',
    target: 2,
    rewardCredits: 220,
    mode: 'add',
  },
  {
    type: 'collect_drops',
    title: 'Achados do Busão',
    description: 'Colete 10 itens pelo corredor',
    target: 10,
    rewardCredits: 115,
    mode: 'add',
  },
  {
    type: 'reach_combo',
    title: 'Sequência Imparável',
    description: 'Alcance um combo de 12 hits em uma partida',
    target: 12,
    rewardCredits: 180,
    mode: 'max',
  },
  {
    type: 'complete_runs',
    title: 'Rotina de Estagiário',
    description: 'Conclua 3 viagens (vitória ou fim de linha)',
    target: 3,
    rewardCredits: 125,
    mode: 'add',
  },
];

function createThreeRandomMissions(now: number): DailyMissionsState {
  const pool = [...DAILY_MISSION_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, 3).map((tpl, idx) => ({
    id: `${tpl.type}_${now}_${idx}`,
    type: tpl.type,
    title: tpl.title,
    description: tpl.description,
    target: tpl.target,
    progress: 0,
    rewardCredits: tpl.rewardCredits,
    mode: tpl.mode,
    completed: false,
    claimed: false,
  }));
  return {
    generatedAt: now,
    expiresAt: now + CYCLE_DURATION_MS,
    missions: chosen,
  };
}

function saveDailyMissionsState(state: DailyMissionsState): DailyMissionsState {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DAILY_MISSIONS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }
  return state;
}

function isValidMission(raw: unknown): raw is DailyMission {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Partial<DailyMission>;
  return (
    typeof m.id === 'string' &&
    typeof m.type === 'string' &&
    typeof m.title === 'string' &&
    typeof m.description === 'string' &&
    typeof m.target === 'number' &&
    m.target > 0 &&
    typeof m.progress === 'number' &&
    typeof m.rewardCredits === 'number' &&
    (m.mode === 'add' || m.mode === 'max') &&
    typeof m.completed === 'boolean' &&
    typeof m.claimed === 'boolean'
  );
}

export function loadDailyMissionsState(now = Date.now()): DailyMissionsState {
  if (typeof window === 'undefined') {
    return createThreeRandomMissions(now);
  }
  try {
    const raw = window.localStorage.getItem(DAILY_MISSIONS_STORAGE_KEY);
    if (!raw) {
      return saveDailyMissionsState(createThreeRandomMissions(now));
    }
    const parsed = JSON.parse(raw) as Partial<DailyMissionsState>;
    if (
      typeof parsed.generatedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      now >= parsed.expiresAt ||
      !Array.isArray(parsed.missions) ||
      parsed.missions.length !== 3 ||
      !parsed.missions.every(isValidMission)
    ) {
      return saveDailyMissionsState(createThreeRandomMissions(now));
    }
    return parsed as DailyMissionsState;
  } catch {
    return saveDailyMissionsState(createThreeRandomMissions(now));
  }
}

export function recordDailyMissionEvent(
  eventType: DailyMissionEventType,
  value = 1,
  now = Date.now()
): {
  state: DailyMissionsState;
  newlyCompleted: DailyMission[];
  creditsAwarded: number;
} {
  const safeValue = Math.max(0, Math.floor(value));
  const state = loadDailyMissionsState(now);
  if (safeValue <= 0) {
    return { state, newlyCompleted: [], creditsAwarded: 0 };
  }

  let changed = false;
  let creditsAwarded = 0;
  const newlyCompleted: DailyMission[] = [];

  const updatedMissions = state.missions.map((mission) => {
    if (mission.type !== eventType || mission.completed) {
      return mission;
    }

    const nextProgress =
      mission.mode === 'max'
        ? Math.min(mission.target, Math.max(mission.progress, safeValue))
        : Math.min(mission.target, mission.progress + safeValue);

    if (nextProgress === mission.progress) {
      return mission;
    }

    changed = true;
    const isNowComplete = nextProgress >= mission.target;
    const updated: DailyMission = {
      ...mission,
      progress: nextProgress,
      completed: isNowComplete,
      claimed: isNowComplete ? true : mission.claimed,
    };

    if (isNowComplete && !mission.claimed) {
      awardBonusCoins(mission.rewardCredits);
      creditsAwarded += mission.rewardCredits;
      newlyCompleted.push(updated);
    }

    return updated;
  });

  if (!changed) {
    return { state, newlyCompleted, creditsAwarded };
  }

  const nextState = saveDailyMissionsState({
    ...state,
    missions: updatedMissions,
  });

  return { state: nextState, newlyCompleted, creditsAwarded };
}

export function formatMissionResetCountdown(expiresAt: number, now = Date.now()): string {
  const remaining = Math.max(0, expiresAt - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}
