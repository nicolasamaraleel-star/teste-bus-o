import { Award, Clock, Flame, LogIn, LogOut, Trophy, UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { BADGE_META } from '../game/badges';
import { AchievementBadgeId, GameMode } from '../game/types';

interface LeaderboardModalProps {
  initialTab?: GameMode;
  onClose: () => void;
}

function BadgeRow({
  badges,
  compact = false,
}: {
  badges?: AchievementBadgeId[];
  compact?: boolean;
}) {
  const list = (badges ?? []).filter((b) => Boolean(BADGE_META[b]));
  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {list.map((badgeId) => {
        const meta = BADGE_META[badgeId];
        return (
          <span
            key={badgeId}
            title={meta.description}
            className={`inline-flex items-center gap-1 rounded border font-semibold ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
            } ${meta.pillClass}`}
          >
            <Award className="w-3 h-3 shrink-0" />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

export function LeaderboardModal({
  initialTab = 'campaign',
  onClose,
}: LeaderboardModalProps) {
  const {
    user,
    authBusy,
    authError,
    profile,
    runs,
    leaderboard,
    rushLeaderboard,
    signIn,
    logOut,
  } = useFirebase();
  const [activeTab, setActiveTab] = useState<GameMode>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d16]/85 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#0f172a] border-4 border-[#38bdf8] p-5 md:p-6 space-y-4 shadow-[0_10px_0_#020617] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-5 h-5 text-[#facc15] shrink-0" />
            <h2 className="font-arcade-display text-base md:text-lg text-white truncate">
              CARTEIRINHA & PLACAR
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar placar"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!user ? (
          <div className="rounded-xl bg-slate-900 border-2 border-slate-700 p-5 text-center space-y-4">
            <p className="text-sm text-slate-200">
              Entre com sua conta Google para salvar seus recordes da Campanha e da Hora do Rush no ranking online.
            </p>
            {authError && <p className="text-xs text-red-400">{authError}</p>}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void signIn()}
              className="px-5 py-2.5 rounded-xl bg-[#facc15] bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0f172a] font-arcade-display text-xs border-2 border-[#020617] inline-flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {authBusy ? 'CONECTANDO...' : 'ENTRAR COM GOOGLE'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Player Profile Summary */}
            <div className="rounded-xl bg-slate-900 border-2 border-slate-700 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {user.displayName || 'Estagiário'}
                    </div>
                    <div className="text-xs text-slate-400 font-mono-num">
                      Campanha: {profile?.bestScore ?? 0} pts · L.{profile?.highestLine ?? 1}/3 ·{' '}
                      {profile?.gamesPlayed ?? 0} viagens
                      {(profile?.bestHitChain ?? 0) > 0 && (
                        <> · Combo máx: {profile?.bestHitChain} hits</>
                      )}
                    </div>
                    {(profile?.bestRushScore ?? 0) > 0 && (
                      <div className="text-xs text-sky-300 font-mono-num">
                        Hora do Rush: {profile?.bestRushScore ?? 0} pts · Onda{' '}
                        {profile?.bestRushWave ?? 1}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void logOut()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
              <BadgeRow badges={profile?.badges} />
            </div>

            {/* Segmented Mode Tabs: Campanha vs Hora do Rush */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-arcade-display text-xs text-[#facc15]">
                {activeTab === 'campaign'
                  ? 'TOP CAMPANHA (3 LINHAS)'
                  : 'TOP HORA DO RUSH (INFINITO)'}
              </h3>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090d16] border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('campaign')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'campaign'
                      ? 'bg-[#facc15] text-[#090d16]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  Campanha
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('infinite')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'infinite'
                      ? 'bg-[#38bdf8] text-[#090d16]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Hora do Rush
                </button>
              </div>
            </div>

            {/* Leaderboard List */}
            {activeTab === 'campaign' ? (
              <div className="rounded-xl bg-slate-900 border border-slate-700 divide-y divide-slate-800">
                {leaderboard.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center">
                    Nenhum recorde na Campanha registrado ainda. Complete uma corrida!
                  </p>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <div key={entry.uid} className="px-3.5 py-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-arcade-display text-[#facc15] w-6 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-white font-semibold truncate">
                            {entry.playerName}
                          </span>
                        </div>
                        <div className="font-mono-num text-slate-300 shrink-0">
                          <span className="text-emerald-400 font-bold">
                            {entry.bestScore.toLocaleString('pt-BR')}
                          </span>{' '}
                          pts · L.{entry.highestLine}
                          {(entry.bestHitChain ?? 0) > 0 && (
                            <span className="text-amber-300"> · {entry.bestHitChain} hits</span>
                          )}
                        </div>
                      </div>
                      <BadgeRow badges={entry.badges} compact />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-900 border border-sky-500/40 divide-y divide-slate-800">
                {rushLeaderboard.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center">
                    Nenhum recorde na Hora do Rush ainda. Encare o modo infinito!
                  </p>
                ) : (
                  rushLeaderboard.map((entry, idx) => (
                    <div key={entry.uid} className="px-3.5 py-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-arcade-display text-[#38bdf8] w-6 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-white font-semibold truncate">
                            {entry.playerName}
                          </span>
                        </div>
                        <div className="font-mono-num text-slate-300 shrink-0">
                          <span className="text-[#facc15] font-bold">
                            {entry.bestScore.toLocaleString('pt-BR')}
                          </span>{' '}
                          pts · <span className="text-sky-300 font-semibold">Onda {entry.bestWave}</span>
                          {(entry.bestHitChain ?? 0) > 0 && (
                            <span className="text-amber-300"> · {entry.bestHitChain} hits</span>
                          )}
                        </div>
                      </div>
                      <BadgeRow badges={entry.badges} compact />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Recent Match History */}
            {runs.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-arcade-display text-xs text-sky-400">
                  SUAS ÚLTIMAS VIAGENS
                </h3>
                <div className="rounded-xl bg-slate-900 border border-slate-700 divide-y divide-slate-800">
                  {runs.slice(0, 4).map((run) => {
                    const isRush = run.gameMode === 'infinite';
                    return (
                      <div
                        key={run.id}
                        className="px-3.5 py-2 space-y-1 text-xs font-mono-num"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={
                              isRush
                                ? 'text-sky-300 font-semibold'
                                : run.victory
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-amber-300'
                            }
                          >
                            {isRush
                              ? `HORA DO RUSH · ONDA ${run.waveReached ?? 1}`
                              : run.victory
                                ? 'PONTO BATIDO'
                                : `LINHA ${run.lineReached}/3`}
                          </span>
                          <span className="text-slate-200 shrink-0">
                            {run.score.toLocaleString('pt-BR')} pts · {run.enemiesDefeated} KOs
                            {(run.bestHitChain ?? 0) > 0 && ` · ${run.bestHitChain} hits`}
                          </span>
                        </div>
                        <BadgeRow badges={run.badges} compact />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
