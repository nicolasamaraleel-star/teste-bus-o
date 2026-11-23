import {
  Backpack,
  Coffee,
  DoorOpen,
  Flame,
  Hammer,
  Pause,
  Shield,
  Smartphone,
  Sparkles,
  Ticket,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { ActionKey } from '../game/engine';
import { musicManager } from '../game/music';
import { HudSnapshot } from '../game/types';

function TeamsInspiredLogo() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="w-10 h-10 shrink-0 drop-shadow-[0_2px_4px_rgba(15,23,42,0.55)]"
      aria-hidden="true"
    >
      <circle cx="35.5" cy="14" r="4.5" fill="#5059C9" />
      <path d="M29 21h10a3 3 0 0 1 3 3v8.5a7 7 0 0 1-13 3.5V21z" fill="#5059C9" />
      <circle cx="24" cy="11.5" r="5.5" fill="#7B83EB" />
      <path d="M16 19.5h14.5a3 3 0 0 1 3 3v10.5a8.5 8.5 0 0 1-17.5 1V19.5z" fill="#7B83EB" />
      <rect x="4" y="13" width="21" height="21" rx="3.2" fill="#464EB8" />
      <path d="M9.5 18.2h10v2.6h-3.6V29h-2.8v-8.2H9.5v-2.6z" fill="#ffffff" />
    </svg>
  );
}

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchAction: (action: ActionKey) => void;
}

export function GameHUD({
  hud,
  muted,
  onToggleMute,
  onPause,
  onTouchMove,
  onTouchAction,
}: GameHUDProps) {
  const hudRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = hudRootRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hud.gameState !== 'PLAYING' || prefersReducedMotion) {
      el.style.setProperty('--beat', '0');
      return;
    }

    let rafId = 0;
    let smoothed = 0;

    const tick = () => {
      const { energy, active } = musicManager.getBeatPulse();
      const target = active ? energy : 0;
      smoothed = target > smoothed ? smoothed + (target - smoothed) * 0.55 : smoothed * 0.86;
      el.style.setProperty('--beat', smoothed.toFixed(3));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [hud.gameState]);

  const hpRatio = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const hpPct = Math.max(0, Math.min(100, Math.round(hpRatio * 100)));
  const isLowHp = hud.gameState === 'PLAYING' && hud.hp > 0 && hpRatio < 0.2;
  const hpColor =
    hpPct > 55
      ? 'from-emerald-500 to-green-400'
      : hpPct > 25
        ? 'from-amber-500 to-yellow-400'
        : 'from-red-600 to-rose-400';

  const specialPct = Math.min(100, Math.max(0, Math.floor(hud.specialEnergy)));
  const specialReady = specialPct >= 100;
  const routePct = Math.round(Math.max(0, Math.min(1, hud.routeProgress)) * 100);
  const turnstilePct = Math.round(Math.max(0, Math.min(1, hud.turnstileProgress)) * 100);

  const hasActionPrompt =
    hud.nearValidator ||
    hud.nearStopButton ||
    hud.seatRestProgress > 0 ||
    (hud.nearEmptySeat && hud.lineNumber === 1);

  const bindDirectionButton = (dx: number, dy: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      onTouchMove(dx, dy);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onTouchMove(0, 0);
    },
    onPointerCancel: () => onTouchMove(0, 0),
    onLostPointerCapture: () => onTouchMove(0, 0),
  });

  const bindActionButton = (action: ActionKey, disabled = false) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!disabled) {
        onTouchAction(action);
      }
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.code === 'Enter' || e.code === 'Space') && !disabled) {
        e.preventDefault();
        onTouchAction(action);
      }
    },
  });

  const notificationToneClass = (tone: HudSnapshot['screenNotifications'][number]['tone']) => {
    switch (tone) {
      case 'gold':
        return 'text-[#fde047]';
      case 'cyan':
        return 'text-[#38bdf8]';
      case 'rose':
        return 'text-[#fb7185]';
      case 'emerald':
        return 'text-[#34d399]';
    }
  };

  return (
    <div
      ref={hudRootRef}
      className="absolute inset-0 pointer-events-none flex flex-col justify-between px-3 py-2.5 md:px-5 md:py-3"
    >
      {/* Pulsating Red Border Urgency Vignette (<20% HP) */}
      {isLowHp && <div aria-hidden="true" className="low-hp-border" />}

      {/* Screen-Space Ephemeral Notifications Layer */}
      <div className="notification-layer" aria-live="polite">
        {hud.screenNotifications.map((notice) => (
          <div
            key={notice.id}
            style={{ left: `${notice.xPct}%`, top: `${notice.yPct}%` }}
            className={`notification-item font-arcade-display text-xs sm:text-sm tracking-wide whitespace-nowrap ${notificationToneClass(
              notice.tone
            )}`}
          >
            {notice.text}
          </div>
        ))}
      </div>
      {/* Top Floating Corner Clusters (Minimalist Translucent Corners) */}
      <div className="relative flex items-start justify-between gap-2 md:gap-4">
        {/* Top-Left Cluster: HP, Special Meter & Core Resources */}
        <section
          aria-label="Status do jogador"
          className="bg-[#080d18]/45 backdrop-blur-[2px] border border-white/8 rounded-xl px-2.5 py-1.5 w-[150px] sm:w-[204px] md:w-[238px] shrink-0 space-y-1 text-slate-100"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#facc15] leading-none">
              ESTAGIÁRIO
            </span>
            <span
              className={`font-mono-num text-[10px] font-bold leading-none ${
                specialReady
                  ? 'text-[#fde047] drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] animate-arcade-blink'
                  : 'text-sky-300/90'
              }`}
            >
              {specialReady ? 'ESP PRONTO' : `ESP ${specialPct}%`}
            </span>
          </div>

          <div className="hud-beat-hp-bar w-full h-2 rounded-full bg-slate-900/80 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-150 ${hpColor}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div
            className={`w-full h-1 rounded-full overflow-hidden ${
              specialReady
                ? 'bg-slate-900 ring-1 ring-[#facc15]/80 shadow-[0_0_8px_rgba(56,189,248,0.65)]'
                : 'bg-slate-900/80'
            }`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${
                specialReady
                  ? 'bg-gradient-to-r from-[#38bdf8] via-[#fde047] to-[#38bdf8]'
                  : 'bg-[#38bdf8]'
              }`}
              style={{ width: `${specialPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 font-mono-num text-[10px] sm:text-[11px] leading-none pt-0.5">
            <span className={`font-semibold ${isLowHp ? 'text-red-400 animate-arcade-blink' : 'text-slate-200'}`}>
              {hud.hp}/{hud.maxHp}
              {isLowHp ? ' CRÍTICO' : ''}
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5 text-[#facc15] font-semibold">
                <Ticket className="w-3 h-3 shrink-0" aria-hidden="true" />
                {hud.credits}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  hud.deodorantCount > 0 ? 'text-[#7dd3fc]' : 'text-slate-400'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                {hud.deodorantCount}
              </span>
            </div>
          </div>
        </section>

        {/* Top-Center Floating Strip: Route Progress to Exit (Campaign) or Rush Wave/Timer */}
        <section
          aria-label={hud.gameMode === 'infinite' ? 'Status Hora do Rush' : 'Progresso da linha'}
          className="hud-beat-line bg-[#080d18]/42 backdrop-blur-[2px] border border-white/8 rounded-xl px-2.5 py-1 min-w-0 max-w-[190px] sm:max-w-[260px] flex flex-col items-center text-center"
        >
          {hud.gameMode === 'infinite' ? (
            <>
              <span className="text-[10px] sm:text-xs font-bold tracking-wider text-[#38bdf8] whitespace-nowrap leading-tight">
                HORA DO RUSH · ONDA {hud.infiniteWave}
              </span>
              <span
                className={`font-mono-num text-sm sm:text-base font-bold whitespace-nowrap leading-tight ${
                  hud.infiniteTimeLeft <= 15
                    ? 'text-red-400 animate-arcade-blink'
                    : 'text-[#facc15]'
                }`}
              >
                {String(Math.floor(Math.ceil(hud.infiniteTimeLeft) / 60)).padStart(2, '0')}:
                {String(Math.ceil(hud.infiniteTimeLeft) % 60).padStart(2, '0')}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 whitespace-nowrap leading-tight">
                <span className="text-[11px] sm:text-xs font-bold tracking-wide text-[#facc15]">
                  LINHA {hud.lineCode}
                </span>
                <span className="text-slate-500 text-[10px]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    hud.ticketValidated ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {hud.ticketValidated ? 'VALIDADO' : 'SEM BILHETE'}
                </span>
              </div>

              {/* Line Route Progress Track toward Exit Door */}
              <div className="w-32 sm:w-44 md:w-52 flex items-center gap-1.5 mt-1.5">
                <div
                  className="relative flex-1 h-1.5 rounded-full bg-slate-800/95 overflow-visible"
                  title={`Progresso até a saída: ${routePct}%`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-100 ${
                      hud.turnstileCleared
                        ? 'bg-gradient-to-r from-emerald-400 to-[#facc15]'
                        : 'bg-gradient-to-r from-[#38bdf8] to-[#facc15]'
                    }`}
                    style={{ width: `${routePct}%` }}
                  />
                  {/* Turnstile Checkpoint Tick */}
                  <span
                    aria-hidden="true"
                    style={{ left: `${turnstilePct}%` }}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3 rounded-full border border-[#080d18] ${
                      hud.turnstileCleared ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {/* Player Position Indicator */}
                  <span
                    aria-hidden="true"
                    style={{ left: `${routePct}%` }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#facc15] border border-[#020617] shadow-sm transition-[left] duration-100"
                  />
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 text-[9px] font-mono-num font-bold leading-none whitespace-nowrap ${
                    hud.turnstileCleared ? 'text-emerald-300' : 'text-slate-300'
                  }`}
                >
                  <DoorOpen className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  {routePct}%
                </span>
              </div>

              {hud.fiscalChasing && (
                <span className="mt-1 text-[10px] text-red-400 font-bold animate-arcade-blink whitespace-nowrap leading-none">
                  FISCAL NA ÁREA!
                </span>
              )}
            </>
          )}
        </section>

        {/* Top-Right Cluster: Score + Audio/Pause Controls + Floating SoR Hit Counter, Combo & Buff Icons */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#080d18]/45 backdrop-blur-[2px] border border-white/8 rounded-xl px-2 py-1">
            <div className="hud-beat-score flex flex-col items-end leading-none pr-1">
              <span className="font-mono-num text-sm sm:text-base md:text-lg font-bold text-[#facc15] whitespace-nowrap">
                {hud.score.toLocaleString('pt-BR')}
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold tracking-wider text-slate-300 mt-0.5">
                PONTOS
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Ativar som' : 'Silenciar som'}
                className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-slate-950/55 hover:bg-slate-800/80 border border-white/10 text-slate-100 inline-flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#facc15]"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-label="Pausar jogo"
                className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-slate-950/55 hover:bg-slate-800/80 border border-white/10 text-slate-100 inline-flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#facc15]"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Streets of Rage 4-Inspired Floating Hit Counter (Uninterrupted Hits + Tier Escalation) */}
          {(() => {
            const hits = hud.hitsLanded;
            const tierClass =
              hits >= 50
                ? 'sor-hit-tier-4 scale-110'
                : hits >= 25
                  ? 'sor-hit-tier-3 scale-105'
                  : hits >= 10
                    ? 'sor-hit-tier-2 scale-[1.03]'
                    : 'sor-hit-tier-1 scale-100';
            const barColorClass =
              hits >= 50
                ? 'bg-gradient-to-r from-[#38bdf8] to-[#fde047]'
                : hits >= 25
                  ? 'bg-[#fb7185]'
                  : hits >= 10
                    ? 'bg-[#fb923c]'
                    : 'bg-[#f6ea8c]';

            return (
              <div
                aria-label={`Contador de golpes: ${hits}`}
                className={`pointer-events-none select-none flex flex-col items-end pr-1 transition-all duration-200 ${
                  hits > 0 ? `opacity-100 ${tierClass}` : 'opacity-0 scale-90'
                }`}
              >
                <div className="sor-hit-counter flex items-baseline justify-end">
                  <span
                    key={hits}
                    className={`sor-hit-num font-arcade-display tabular-nums ${
                      hits > 0 ? 'inline-block animate-combo-pop' : 'inline-block'
                    }`}
                  >
                    {hits}
                  </span>
                  <span className="sor-hit-word">{hits === 1 ? 'golpe' : 'golpes'}</span>
                </div>
                {hits > 0 && (
                  <div className="sor-hit-timer-track mt-0.5">
                    <div
                      key={`timer-${hits}`}
                      className={`sor-hit-timer-fill ${barColorClass}`}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Floating Combo Badge (Right-Aligned Below Score — Never Pushes Center) */}
          {hud.comboStreak >= 2 && (
            <div className="hud-beat-combo">
              <div
                key={hud.comboStreak}
                className={
                  hud.comboMultiplier >= 10
                    ? 'animate-rage-combo px-2.5 py-1 rounded-lg bg-gradient-to-b from-[#f43f5e] via-[#7c3aed] to-[#464EB8] border border-[#facc15] flex items-center gap-1'
                    : 'animate-combo-pop px-2.5 py-1 rounded-lg bg-[#8a330c]/90 backdrop-blur-sm border border-[#fb923c]/60 flex items-center gap-1 shadow-sm'
                }
              >
                {hud.comboMultiplier >= 10 && (
                  <Flame className="w-3.5 h-3.5 text-[#fde047] shrink-0" aria-hidden="true" />
                )}
                <span
                  className={`font-bold tracking-wide font-mono-num whitespace-nowrap ${
                    hud.comboMultiplier >= 10
                      ? 'text-xs text-[#fef08a]'
                      : 'text-[11px] text-[#fef3c7]'
                  }`}
                >
                  COMBO ×{hud.comboMultiplier}
                </span>
              </div>
            </div>
          )}

          {/* Floating Minimal Buff Gadgets (Only Active/Cooling Effects — Uncluttered) */}
          {(hud.bagSkillCooldown > 0 ||
            hud.speedBoostTimer > 0 ||
            hud.strengthBuffTimer > 0 ||
            hud.caneCharges > 0 ||
            (hud.makeupShieldTimer > 0 && hud.shieldHits > 0) ||
            hud.rageTimer > 0 ||
            hud.expressWindTimer > 0) && (
            <div
              aria-label="Habilidades e buffs ativos"
              className="flex flex-wrap justify-end gap-1.5 max-w-[180px] sm:max-w-[240px]"
            >
              {hud.bagSkillCooldown > 0 && (
                <div
                  title={`Mochila recarregando (${hud.bagSkillCooldown.toFixed(1)}s)`}
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-slate-300 text-[10px] font-mono-num font-bold"
                >
                  <Backpack className="w-3 h-3 shrink-0 text-sky-300" aria-hidden="true" />
                  <span>{hud.bagSkillCooldown.toFixed(1)}s</span>
                </div>
              )}

              {hud.speedBoostTimer > 0 && (
                <div
                  title="Café: velocidade aumentada"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-amber-300 text-[10px] font-mono-num font-bold"
                >
                  <Coffee className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{Math.ceil(hud.speedBoostTimer)}s</span>
                </div>
              )}

              {hud.strengthBuffTimer > 0 && (
                <div
                  title="Força extra nos golpes"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-[#facc15] text-[10px] font-mono-num font-bold"
                >
                  <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{Math.ceil(hud.strengthBuffTimer)}s</span>
                </div>
              )}

              {hud.caneCharges > 0 && (
                <div
                  title="Bengala equipada"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-orange-300 text-[10px] font-mono-num font-bold"
                >
                  <Hammer className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>×{hud.caneCharges}</span>
                </div>
              )}

              {hud.makeupShieldTimer > 0 && hud.shieldHits > 0 && (
                <div
                  title="Escudo ativo"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-cyan-300 text-[10px] font-mono-num font-bold"
                >
                  <Shield className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{hud.shieldHits}/5</span>
                </div>
              )}

              {hud.rageTimer > 0 && (
                <div
                  title="Modo Rage ativo"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#232668]/75 backdrop-blur-[2px] text-[#fda4af] text-[10px] font-mono-num font-bold"
                >
                  <Flame className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{Math.ceil(hud.rageTimer)}s</span>
                </div>
              )}

              {hud.expressWindTimer > 0 && (
                <div
                  title="Vento expresso"
                  className="hud-beat-card inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#080d18]/45 backdrop-blur-[2px] text-sky-300 text-[10px] font-mono-num font-bold"
                >
                  <Wind className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>+35%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle Playfield Layer: Separated Top Travel Alerts vs. Bottom Action Prompts */}
      <div className="relative flex-1 flex flex-col items-center justify-between py-1.5">
        {/* Channel 1 (Top-Center): General Travel / Hazard Alerts & Centered 5s Rage Notification */}
        <div className="pointer-events-none flex flex-col items-center gap-1.5 w-full px-2">
          {hud.rageNotificationTimer > 0 && (
            <aside
              aria-label="Notificação do buff de rage"
              className="animate-phone-notify pointer-events-none flex items-center gap-2.5 max-w-[340px] rounded-xl border border-[#7B83EB]/85 bg-[#1b1e54]/78 backdrop-blur-sm px-3 py-1.5 shadow-[0_4px_14px_rgba(2,6,23,0.55)] text-white"
            >
              <TeamsInspiredLogo />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-2 leading-none">
                  <span className="inline-flex items-center gap-1 font-arcade-display text-[10px] text-[#a5abff] tracking-wide">
                    <Smartphone className="w-3 h-3 text-[#7B83EB] shrink-0" aria-hidden="true" />
                    BUFF: RAGE!
                  </span>
                  <span className="text-[10px] font-mono-num font-bold text-[#c7cbff] tabular-nums">
                    {Math.ceil(hud.rageTimer)}s
                  </span>
                </div>
                <p className="text-[11px] font-semibold leading-tight text-white/95 truncate mt-0.5">
                  Reunião com o cliente 09:05, não atrase!
                </p>
              </div>
            </aside>
          )}

          {hud.alertMessage && (
            <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-sm border border-[#facc15]/70 px-3.5 py-1 text-center shadow-sm">
              <span className="font-arcade-display text-[11px] md:text-xs text-[#facc15] tracking-wide">
                {hud.alertMessage}
              </span>
            </div>
          )}

          {hud.stickySlowTimer > 0 && (
            <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-sm border border-pink-400/75 px-3 py-0.5 text-center">
              <span className="font-arcade-display text-[10px] text-pink-300">
                NO CHICLETE (LENTO)
              </span>
            </div>
          )}
        </div>

        {/* Channel 2 (Bottom): Dedicated Interactive Prompts (No Keycap Instructions) + Boss Health Bars */}
        <div className="w-full flex flex-col items-center gap-2">
          {hasActionPrompt && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hud.nearValidator && (
                <div className="rounded-lg bg-[#080d18]/75 backdrop-blur-[2px] border border-emerald-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[11px] text-emerald-300">
                    VALIDAR ({hud.ticketCost} CRÉD)
                  </span>
                </div>
              )}

              {hud.nearStopButton && (
                <div className="rounded-lg bg-[#080d18]/75 backdrop-blur-[2px] border border-red-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[11px] text-amber-300">
                    PUXAR STOP
                  </span>
                </div>
              )}

              {hud.seatRestProgress > 0 ? (
                <div className="rounded-lg bg-[#080d18]/75 backdrop-blur-[2px] border border-emerald-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[10px] text-emerald-300">
                    DESCANSANDO... {Math.round(hud.seatRestProgress * 100)}%
                  </span>
                </div>
              ) : (
                hud.nearEmptySeat &&
                hud.lineNumber === 1 && (
                  <div className="rounded-lg bg-[#080d18]/75 backdrop-blur-[2px] border border-emerald-500/75 px-3 py-1 text-center">
                    <span className="font-arcade-display text-[10px] text-emerald-300">
                      SENTAR (+18 HP)
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {hud.bosses.length > 0 && (
            <div className="hud-beat-boss w-full max-w-xl rounded-xl bg-[#0b1120]/75 backdrop-blur-[2px] border border-red-500/80 px-3.5 py-2 space-y-1.5">
              {hud.bosses.map((boss) => {
                const pct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));
                const hasGuard = (boss.guardMax ?? 0) > 0;
                const guardPct = hasGuard
                  ? Math.max(0, Math.round(((boss.guardHp ?? 0) / (boss.guardMax ?? 1)) * 100))
                  : 0;

                return (
                  <div key={boss.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-arcade-display text-red-400">{boss.name}</span>
                      <span className="font-mono-num text-slate-200">
                        {boss.hp}/{boss.maxHp}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-b from-red-400 to-red-600 transition-[width] duration-100"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {hasGuard && (
                      <div className="space-y-0.5 pt-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono-num">
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              boss.guardBroken ? 'text-[#fde047] animate-arcade-blink' : 'text-sky-300'
                            }`}
                          >
                            <Shield className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {boss.guardBroken
                              ? 'BLINDAGEM QUEBRADA · +35% DANO!'
                              : 'BLINDAGEM'}
                          </span>
                          {!boss.guardBroken && (
                            <span className="text-sky-300 font-semibold">
                              {boss.guardHp}/{boss.guardMax}
                            </span>
                          )}
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] duration-100 ${
                              boss.guardBroken
                                ? 'bg-[#fde047]/40'
                                : 'bg-gradient-to-r from-[#38bdf8] to-cyan-300'
                            }`}
                            style={{ width: `${boss.guardBroken ? 100 : guardPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Translucent Non-Obstructive Bottom-Left Combat & Bus Event Log */}
      {hud.gameState === 'PLAYING' && hud.combatLog.length > 0 && (
        <div
          aria-live="polite"
          aria-label="Log de eventos de combate"
          className="combat-event-log pointer-events-none select-none flex flex-col gap-1 max-w-[205px] sm:max-w-[250px]"
        >
          {hud.combatLog.map((entry, idx) => {
            const total = hud.combatLog.length;
            const ageFromNewest = total - 1 - idx;
            const opacityClass =
              ageFromNewest === 0
                ? 'opacity-95'
                : ageFromNewest === 1
                  ? 'opacity-75'
                  : ageFromNewest === 2
                    ? 'opacity-55'
                    : 'opacity-40';
            const toneStyle =
              entry.tone === 'emerald'
                ? 'border-emerald-400/75 text-emerald-200'
                : entry.tone === 'gold'
                  ? 'border-amber-300/75 text-amber-100'
                  : entry.tone === 'rose'
                    ? 'border-rose-400/80 text-rose-200'
                    : 'border-sky-300/75 text-sky-100';

            return (
              <div
                key={entry.id}
                className={`combat-log-entry ${opacityClass} ${toneStyle} bg-[#060a14]/35 backdrop-blur-[1px] border-l-2 rounded-r px-2 py-0.5 text-[10px] sm:text-[11px] font-medium leading-tight tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate`}
              >
                {entry.text}
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile & Tablet Landscape Translucent Touch Gadgets */}
      <div className="touch-controls-bar pointer-events-auto items-end justify-between pb-0.5 gap-3 touch-none select-none">
        {/* Left Thumb: Compact Translucent Cross Pad */}
        <div className="relative grid grid-cols-3 grid-rows-3 gap-1 w-[108px] h-[108px] sm:w-[120px] sm:h-[120px]">
          <div />
          <button
            type="button"
            aria-label="Mover para cima"
            {...bindDirectionButton(0, -1)}
            className="rounded-lg bg-slate-950/35 active:bg-slate-700/65 backdrop-blur-[2px] border border-white/15 text-white/90 font-arcade-display text-xs touch-none select-none flex items-center justify-center"
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            aria-label="Mover para esquerda"
            {...bindDirectionButton(-1, 0)}
            className="rounded-lg bg-slate-950/35 active:bg-slate-700/65 backdrop-blur-[2px] border border-white/15 text-white/90 font-arcade-display text-xs touch-none select-none flex items-center justify-center"
          >
            ◀
          </button>
          <div className="rounded-full bg-slate-950/20 border border-white/10" aria-hidden="true" />
          <button
            type="button"
            aria-label="Mover para direita"
            {...bindDirectionButton(1, 0)}
            className="rounded-lg bg-slate-950/35 active:bg-slate-700/65 backdrop-blur-[2px] border border-white/15 text-white/90 font-arcade-display text-xs touch-none select-none flex items-center justify-center"
          >
            ▶
          </button>
          <div />
          <button
            type="button"
            aria-label="Mover para baixo"
            {...bindDirectionButton(0, 1)}
            className="rounded-lg bg-slate-950/35 active:bg-slate-700/65 backdrop-blur-[2px] border border-white/15 text-white/90 font-arcade-display text-xs touch-none select-none flex items-center justify-center"
          >
            ▼
          </button>
          <div />
        </div>

        {/* Right Thumb: Compact Translucent Arcade Action Gadgets */}
        <div className="flex flex-col items-end gap-1.5">
          {/* Secondary Utility Row */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Mochila"
              disabled={hud.bagSkillCooldown > 0}
              {...bindActionButton('bagGuard', hud.bagSkillCooldown > 0)}
              className={`h-9 min-w-[44px] px-2.5 rounded-full backdrop-blur-[2px] border font-arcade-display text-[9px] inline-flex items-center justify-center gap-1 touch-none select-none ${
                hud.bagSkillCooldown <= 0
                  ? 'bg-sky-600/40 active:bg-sky-500/70 border-sky-300/55 text-white'
                  : 'bg-slate-900/40 border-white/10 text-slate-400'
              }`}
            >
              <Backpack className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {hud.bagSkillCooldown > 0 && (
                <span className="font-mono-num">{hud.bagSkillCooldown.toFixed(1)}</span>
              )}
            </button>

            <button
              type="button"
              aria-label={specialReady ? 'Especial pronto' : `Especial ${specialPct}%`}
              {...bindActionButton('special')}
              className={`h-9 min-w-[56px] px-2.5 rounded-full backdrop-blur-[2px] border font-arcade-display text-[10px] inline-flex items-center justify-center touch-none select-none transition-all ${
                specialReady
                  ? 'bg-gradient-to-b from-[#fde047]/85 to-[#38bdf8]/85 border-white text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.85)] animate-arcade-blink'
                  : 'bg-purple-700/35 active:bg-purple-600/60 border-purple-300/40 text-purple-100'
              }`}
            >
              {specialReady ? 'ESP!' : `${specialPct}%`}
            </button>

            <button
              type="button"
              aria-label="Usar ou validar"
              {...bindActionButton('use')}
              className="h-9 min-w-[44px] px-2.5 rounded-full bg-cyan-600/40 active:bg-cyan-500/70 backdrop-blur-[2px] border border-cyan-300/55 text-white font-arcade-display text-[9px] inline-flex items-center justify-center gap-1 touch-none select-none"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>USAR</span>
            </button>
          </div>

          {/* Primary Combat Row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Soco"
              {...bindActionButton('punch')}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-red-600/45 active:bg-red-500/75 backdrop-blur-[2px] border border-red-300/60 text-white font-arcade-display text-[10px] touch-none select-none flex items-center justify-center"
            >
              SOCO
            </button>
            <button
              type="button"
              aria-label="Chute"
              {...bindActionButton('kick')}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-amber-500/45 active:bg-amber-400/75 backdrop-blur-[2px] border border-amber-200/65 text-white font-arcade-display text-[10px] touch-none select-none flex items-center justify-center"
            >
              CHUTE
            </button>
            <button
              type="button"
              aria-label="Pular"
              {...bindActionButton('jump')}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-blue-600/45 active:bg-blue-500/75 backdrop-blur-[2px] border border-blue-300/60 text-white font-arcade-display text-[10px] touch-none select-none flex items-center justify-center"
            >
              PULO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
