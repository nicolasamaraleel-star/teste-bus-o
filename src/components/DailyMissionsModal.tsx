import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Package,
  Shield,
  Swords,
  Ticket,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DailyMissionEventType,
  DailyMissionsState,
  formatMissionResetCountdown,
  loadDailyMissionsState,
} from '../game/dailyMissions';

interface DailyMissionsModalProps {
  missionsState: DailyMissionsState;
  onRefreshState: (next: DailyMissionsState) => void;
  onClose: () => void;
}

function MissionIcon({ type, completed }: { type: DailyMissionEventType; completed: boolean }) {
  const cls = `w-4 h-4 ${completed ? 'text-emerald-300' : 'text-[#38bdf8]'}`;
  switch (type) {
    case 'defeat_passengers':
    case 'land_heavy_punches':
      return <Swords className={cls} />;
    case 'use_special':
    case 'rail_spins':
      return <Zap className={cls} />;
    case 'bag_parries':
      return <Shield className={cls} />;
    case 'validate_tickets':
      return <Ticket className={cls} />;
    case 'defeat_bosses':
      return <Trophy className={cls} />;
    case 'collect_drops':
      return <Package className={cls} />;
    case 'reach_combo':
      return <Flame className={cls} />;
    case 'complete_runs':
    default:
      return <CalendarCheck className={cls} />;
  }
}

export function DailyMissionsModal({
  missionsState,
  onRefreshState,
  onClose,
}: DailyMissionsModalProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= missionsState.expiresAt) {
        onRefreshState(loadDailyMissionsState(current));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [missionsState.expiresAt, onRefreshState]);

  const completedCount = missionsState.missions.filter((m) => m.completed).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d16]/85 p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0f172a] border-4 border-[#38bdf8] shadow-[0_10px_0_#020617] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-3 min-w-0">
            <CalendarCheck className="w-5 h-5 text-[#38bdf8] shrink-0" />
            <h2 className="font-arcade-display text-sm sm:text-base text-[#facc15] truncate">
              MISSÕES DIÁRIAS
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono-num text-xs sm:text-sm font-bold text-emerald-400 tabular-nums whitespace-nowrap">
              {completedCount}/{missionsState.missions.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar missões diárias"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reset Countdown Strip */}
        <div className="px-5 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs font-mono-num text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Renova em</span>
            <strong className="text-white tabular-nums">
              {formatMissionResetCountdown(missionsState.expiresAt, now)}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1 text-[#facc15] font-bold">
            <Coins className="w-3.5 h-3.5" />
            Recompensa automática
          </span>
        </div>

        {/* 3 Daily Tasks */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {missionsState.missions.map((mission) => {
            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`rounded-xl border p-4 space-y-2.5 transition-colors ${
                  mission.completed
                    ? 'bg-emerald-950/35 border-emerald-500/60'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        mission.completed
                          ? 'bg-emerald-500/20 border-emerald-500/60'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <MissionIcon type={mission.type} completed={mission.completed} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{mission.title}</div>
                      <p className="text-xs text-slate-300 mt-0.5">{mission.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono-num text-xs font-bold tabular-nums">
                    {mission.completed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />+{mission.rewardCredits}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#facc15]">
                        <Coins className="w-3.5 h-3.5" />+{mission.rewardCredits}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono-num tabular-nums">
                    <span className="text-slate-400">
                      {mission.completed ? 'Concluída' : 'Progresso'}
                    </span>
                    <span className={mission.completed ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                      {mission.progress}/{mission.target}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ${
                        mission.completed ? 'bg-emerald-400' : 'bg-[#38bdf8]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
