import { Award, CheckCircle2, Lock, Trophy, X } from 'lucide-react';
import { useEffect } from 'react';
import {
  ALLOWED_BADGE_IDS,
  AchievementProgressState,
  BADGE_META,
} from '../game/badges';

interface AchievementsModalProps {
  progress: AchievementProgressState;
  onClose: () => void;
}

export function AchievementsModal({ progress, onClose }: AchievementsModalProps) {
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

  const unlockedSet = new Set(progress.unlockedIds);
  const unlockedCount = unlockedSet.size;
  const totalCount = ALLOWED_BADGE_IDS.length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d16]/85 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0f172a] border-4 border-[#facc15] shadow-[0_10px_0_#020617] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-3 min-w-0">
            <Trophy className="w-5 h-5 text-[#facc15] shrink-0" />
            <h2 className="font-arcade-display text-sm sm:text-base text-[#facc15] truncate">
              CONQUISTAS DO BUSÃO
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono-num text-xs sm:text-sm font-bold text-emerald-400 whitespace-nowrap">
              {unlockedCount}/{totalCount} Desbloqueadas
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar conquistas"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Milestone Strip */}
        <div className="px-5 py-3 bg-slate-900/75 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num text-slate-300">
          <span>
            Passageiros derrotados:{' '}
            <strong className="text-[#facc15]">{progress.totalDefeated}</strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>
            Linha máxima:{' '}
            <strong className="text-sky-300">{progress.highestLineReached}/3</strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>
            Melhor Hora do Rush:{' '}
            <strong className="text-purple-300">
              {progress.highestRushWave > 0 ? `Onda ${progress.highestRushWave}` : '—'}
            </strong>
          </span>
        </div>

        {/* Achievement List */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALLOWED_BADGE_IDS.map((id) => {
            const meta = BADGE_META[id];
            const unlocked = unlockedSet.has(id);

            let currentVal = 0;
            if (id === 'derrotar_50') currentVal = Math.min(50, progress.totalDefeated);
            else if (id === 'chegar_linha_3')
              currentVal = Math.min(3, progress.highestLineReached);
            else if (id === 'rush_onda_5') currentVal = Math.min(5, progress.highestRushWave);

            const hasProgressBar = Boolean(meta.target);
            const pct =
              meta.target && meta.target > 0
                ? Math.min(100, Math.round(((unlocked ? meta.target : currentVal) / meta.target) * 100))
                : 0;

            return (
              <div
                key={id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                  unlocked
                    ? 'bg-slate-800/90 border-[#facc15]/70'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        unlocked
                          ? 'bg-[#facc15]/20 border-[#facc15] text-[#facc15]'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {unlocked ? <Award className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold truncate ${
                          unlocked ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {meta.label}
                      </div>
                      <p className="text-xs text-slate-400 leading-snug mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {unlocked && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                </div>

                {hasProgressBar && meta.target && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono-num">
                      <span className="text-slate-400">Progresso</span>
                      <span className={unlocked ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                        {unlocked ? meta.target : currentVal}/{meta.target}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-200 ${
                          unlocked ? 'bg-emerald-400' : 'bg-[#facc15]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
