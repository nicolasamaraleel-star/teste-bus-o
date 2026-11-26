import {
  Backpack,
  Coffee,
  Flame,
  Hammer,
  Pause,
  Shield,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { ActionKey } from '../game/engine';
import { musicManager } from '../game/music';
import {
  DEFAULT_GARAGE_CONFIG,
  GarageConfig,
  getGarageSwatchDef,
  PlayerSkinStyle,
} from '../game/shop';
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

function EstagiarioPortrait({
  skin = 'classic',
  garageConfig,
}: {
  skin?: PlayerSkinStyle;
  garageConfig?: GarageConfig;
}) {
  const palette: Record<
    Exclude<PlayerSkinStyle, 'custom'>,
    { shirt: string; tie: string; hair: string; bg: string; visor?: string }
  > = {
    classic: { shirt: '#f8fafc', tie: '#dc2626', hair: '#78350f', bg: '#1e3a5f' },
    menor_aprendiz: { shirt: '#e0f2fe', tie: '#0284c7', hair: '#78350f', bg: '#1e293b' },
    estagiario_chefe: { shirt: '#1e293b', tie: '#facc15', hair: '#451a03', bg: '#1e1b4b' },
    estagiario_ninja: { shirt: '#0f172a', tie: '#ef4444', hair: '#3b0764', bg: '#1e1b4b' },
    motoboy_turbinado: { shirt: '#2563eb', tie: '#facc15', hair: '#1e293b', bg: '#172554' },
    golden_exec: { shirt: '#fef08a', tie: '#ca8a04', hair: '#78350f', bg: '#312e81' },
    night_brawler: { shirt: '#1e293b', tie: '#fb7185', hair: '#0f172a', bg: '#111827' },
    cyber_rush: {
      shirt: '#0f172a',
      tie: '#22d3ee',
      hair: '#0284c7',
      bg: '#082f49',
      visor: '#38bdf8',
    },
  };
  const customCfg = skin === 'custom' ? (garageConfig ?? DEFAULT_GARAGE_CONFIG) : null;
  const p = customCfg
    ? {
        shirt: '#f8fafc',
        tie: getGarageSwatchDef(customCfg.tieColor, 'crimson').main,
        hair: getGarageSwatchDef(customCfg.hairColor, 'dark_navy').main,
        bg: '#1e3a5f',
        visor: undefined,
      }
    : (palette[skin === 'custom' ? 'classic' : skin] ?? palette.classic);
  const hairStyle = customCfg?.hairStyle ?? 'pompadour';
  const isFemale = Boolean(customCfg && customCfg.gender === 'female');

  return (
    <svg viewBox="0 0 48 48" className="w-full h-full block" aria-hidden="true">
      <rect width="48" height="48" fill={p.bg} />
      <rect x="0" y="34" width="48" height="14" fill="#090d16" opacity="0.35" />
      {/* Shirt & Tie */}
      <path d="M8 48 L12 35 L36 35 L40 48 Z" fill={p.shirt} stroke="#090d16" strokeWidth="2.2" />
      <path d="M21 37 L27 37 L26 48 L22 48 Z" fill={p.tie} stroke="#090d16" strokeWidth="1.4" />
      <path d="M16 35 L24 41 L32 35" fill="none" stroke="#090d16" strokeWidth="1.8" />
      {/* Neck */}
      <rect x="20" y="29" width="8" height="8" fill="#d99b6c" stroke="#090d16" strokeWidth="1.6" />
      {/* Ponytail rear lock */}
      {hairStyle === 'ponytail' && (
        <>
          <path
            d="M13 17 Q6 21 8 33 L14 31 Q13 24 15 19 Z"
            fill={p.hair}
            stroke="#090d16"
            strokeWidth="1.8"
          />
          <circle cx="13" cy="18" r="2.2" fill={p.tie} stroke="#090d16" strokeWidth="1.2" />
        </>
      )}
      {/* Head */}
      <path
        d="M14 14 L34 14 L35 28 L29 33 L19 33 L13 27 Z"
        fill="#f1b586"
        stroke="#090d16"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Hair style */}
      {hairStyle === 'spiky' ? (
        <path
          d="M11 19 L9 11 L15 12 L16 4 L23 10 L27 3 L31 9 L38 6 L37 18 L34 14 L14 14 Z"
          fill={p.hair}
          stroke="#090d16"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : hairStyle === 'afro' ? (
        <path
          d="M10 20 C7 8 15 2 24 2 C33 2 41 8 38 20 L34 15 L14 15 Z"
          fill={p.hair}
          stroke="#090d16"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : hairStyle === 'ponytail' ? (
        <path
          d="M12 19 L12 10 Q24 6 36 11 L36 18 L32 14 L15 14 Z"
          fill={p.hair}
          stroke="#090d16"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M11 18 L10 10 L16 11 L18 5 L25 9 L31 4 L33 10 L39 9 L37 18 L34 14 L14 14 Z"
          fill={p.hair}
          stroke="#090d16"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {isFemale && hairStyle !== 'afro' && (
        <path d="M13 15 L16 15 L15 26 L12.5 24 Z" fill={p.hair} stroke="#090d16" strokeWidth="1.2" />
      )}
      {/* Glasses & Determined Brows */}
      <rect x="17" y="18" width="8" height="5.5" rx="1" fill="#e0f2fe" stroke="#090d16" strokeWidth="2" />
      <rect x="27" y="18" width="8" height="5.5" rx="1" fill="#e0f2fe" stroke="#090d16" strokeWidth="2" />
      <line x1="25" y1="20" x2="27" y2="20" stroke="#090d16" strokeWidth="2" />
      <line x1="13" y1="20" x2="17" y2="20" stroke="#090d16" strokeWidth="2" />
      {p.visor ? (
        <rect x="17" y="18.5" width="18" height="4.5" fill={p.visor} opacity="0.72" />
      ) : (
        <>
          <rect x="20.5" y="19.5" width="2.2" height="2.6" fill="#090d16" />
          <rect x="30.5" y="19.5" width="2.2" height="2.6" fill="#090d16" />
        </>
      )}
      {isFemale && (
        <>
          <line x1="16" y1="18" x2="18" y2="19" stroke="#090d16" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="35" y1="18" x2="36.5" y2="19" stroke="#090d16" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      <path d="M17 16 L24 17.5 M28 17.5 L34 16" stroke="#090d16" strokeWidth="2" strokeLinecap="round" />
      {/* Mouth */}
      {isFemale ? (
        <path d="M22 27.5 L29.5 27.5 L28 29.2 L23.5 29.2 Z" fill="#f43f5e" stroke="#090d16" strokeWidth="1.2" />
      ) : (
        <path d="M22 27.5 L30 26.8 L29 29 L23 29 Z" fill="#ffffff" stroke="#090d16" strokeWidth="1.3" />
      )}
    </svg>
  );
}

function BusGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="14" rx="2.5" fill="#facc15" stroke="#090d16" strokeWidth="1.8" />
      <rect x="4" y="4.5" width="7" height="5.5" rx="0.8" fill="#1e293b" />
      <rect x="13" y="4.5" width="7" height="5.5" rx="0.8" fill="#1e293b" />
      <rect x="4.5" y="12" width="3" height="2" rx="0.5" fill="#fef08a" />
      <rect x="16.5" y="12" width="3" height="2" rx="0.5" fill="#fef08a" />
      <rect x="4" y="16" width="3.5" height="2.2" rx="0.6" fill="#090d16" />
      <rect x="16.5" y="16" width="3.5" height="2.2" rx="0.6" fill="#090d16" />
    </svg>
  );
}

function TicketGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} aria-hidden="true">
      <path
        d="M2 3 H22 V7 A2 2 0 0 0 22 11 V15 H2 V11 A2 2 0 0 0 2 7 Z"
        fill="#facc15"
        stroke="#090d16"
        strokeWidth="1.7"
      />
      <line x1="9" y1="4" x2="9" y2="14" stroke="#92400e" strokeWidth="1.4" strokeDasharray="2 2" />
      <rect x="12" y="6.5" width="7" height="5" rx="0.8" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
    </svg>
  );
}

function SprayGlyph({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" className={className} aria-hidden="true">
      <rect x="7" y="2" width="6" height="4" rx="1" fill="#e2e8f0" stroke="#090d16" strokeWidth="1.4" />
      <rect x="5" y="6" width="10" height="16" rx="2.5" fill="#38bdf8" stroke="#090d16" strokeWidth="1.6" />
      <rect x="7" y="10" width="6" height="7" rx="1" fill="#e0f2fe" />
    </svg>
  );
}

function PunchFistGlyph({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path
        d="M6 12 C6 9 8 7 10.5 7 C11.5 7 12.2 7.4 12.6 8 C13 7 14 6.5 15.2 6.5 C16.4 6.5 17.3 7.1 17.7 8 C18.2 7.2 19.2 6.8 20.3 7 C21.8 7.3 22.8 8.7 22.8 10.4 V16 C22.8 19.8 19.8 22.5 15.8 22.5 H11.5 C8.3 22.5 6 20 6 16.5 Z"
        fill="#f8fafc"
        stroke="#090d16"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 12.5 H19.5 M10.5 7.5 V12.5 M14.2 7 V12.5 M18 7.5 V12.5" stroke="#090d16" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8.5 15.5 H15.5 C16.6 15.5 17.2 16.3 17.2 17.2 C17.2 18.1 16.5 18.8 15.5 18.8 H10" fill="none" stroke="#090d16" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function KickBootGlyph({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path
        d="M11 5 L18 7 L15.5 16 L22.5 18.5 C23.6 18.9 24.2 20.1 23.8 21.2 L23.2 23 L7.5 18.5 L11 5 Z"
        fill="#f8fafc"
        stroke="#090d16"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line x1="8.5" y1="19.5" x2="22.5" y2="23.5" stroke="#090d16" strokeWidth="1.5" />
    </svg>
  );
}

function ExitFlagGlyph({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <line x1="4" y1="2" x2="4" y2="18" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 3 H16 L13.5 6.5 L16 10 H5 Z" fill="#f8fafc" stroke="#090d16" strokeWidth="1.1" />
    </svg>
  );
}

function CompactBossHpList({
  bosses,
  className = '',
}: {
  bosses: HudSnapshot['bosses'];
  className?: string;
}) {
  if (bosses.length === 0) return null;

  return (
    <aside
      aria-label="HP do chefe"
      className={`hud-beat-boss rounded-lg bg-[#090d16]/58 backdrop-blur-sm border border-red-500/45 px-2.5 py-1.5 shadow-[0_2px_8px_rgba(2,6,23,0.45)] space-y-1.5 ${className}`}
    >
      {bosses.map((boss) => {
        const pct = Math.max(0, Math.min(100, Math.round((boss.hp / Math.max(1, boss.maxHp)) * 100)));
        const hasGuard = (boss.guardMax ?? 0) > 0;
        const guardPct = hasGuard
          ? Math.max(0, Math.min(100, Math.round(((boss.guardHp ?? 0) / (boss.guardMax ?? 1)) * 100)))
          : 0;

        return (
          <div key={boss.name} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 leading-none">
              <span className="font-arcade-display text-[10px] text-red-300 truncate drop-shadow-[0_1px_1px_#020617]">
                {boss.name}
              </span>
              <span className="font-mono-num text-[10px] font-bold text-slate-100 tabular-nums shrink-0">
                {boss.hp}/{boss.maxHp}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-900/85 border border-slate-700/75 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-[width] duration-100"
                style={{ width: `${pct}%` }}
              />
            </div>
            {hasGuard && (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-1 text-[9px] font-mono-num leading-none">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold truncate ${
                      boss.guardBroken ? 'text-[#fde047] animate-arcade-blink' : 'text-sky-300'
                    }`}
                  >
                    <Shield className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                    {boss.guardBroken ? 'QUEBRADA · +35%' : 'BLINDAGEM'}
                  </span>
                  {!boss.guardBroken && (
                    <span className="text-sky-300 font-semibold tabular-nums shrink-0">
                      {boss.guardHp}/{boss.guardMax}
                    </span>
                  )}
                </div>
                <div className="w-full h-1 rounded-full bg-slate-900/85 border border-slate-700/75 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-100 ${
                      boss.guardBroken
                        ? 'bg-[#fde047]/45'
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
    </aside>
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
  const dpadRef = useRef<HTMLDivElement | null>(null);

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

  const desktopHpGradient =
    hpPct > 55
      ? 'from-[#16a34a] via-[#22c55e] to-[#4ade80]'
      : hpPct > 25
        ? 'from-[#d97706] via-[#f59e0b] to-[#fde047]'
        : 'from-[#b91c1c] via-[#ef4444] to-[#fb7185]';

  const mobileHpGradient =
    hpPct > 30
      ? 'from-[#dc2626] via-[#ef4444] to-[#f87171]'
      : 'from-[#991b1b] via-[#dc2626] to-[#fb7185]';

  const specialPct = Math.min(100, Math.max(0, Math.floor(hud.specialEnergy)));
  const specialReady = specialPct >= 100;
  const routePct = Math.round(Math.max(0, Math.min(1, hud.routeProgress)) * 100);
  const turnstilePct = Math.round(Math.max(0, Math.min(1, hud.turnstileProgress)) * 100);
  const espSegments = 12;
  const filledSegments = Math.round((specialPct / 100) * espSegments);

  const lineDestination = hud.lineTitle.includes('·')
    ? hud.lineTitle.split('·')[1].trim().toUpperCase()
    : hud.lineTitle.toUpperCase();

  const formattedTimeLeft = `${String(Math.floor(Math.ceil(hud.infiniteTimeLeft) / 60)).padStart(2, '0')}:${String(Math.ceil(hud.infiniteTimeLeft) % 60).padStart(2, '0')}`;
  const displayHits = hud.hitsLanded > 0 ? hud.hitsLanded : 0;

  const hasActionPrompt =
    hud.nearValidator ||
    hud.nearStopButton ||
    hud.seatRestProgress > 0 ||
    (hud.nearEmptySeat && hud.lineNumber === 1);

  const updateCircularDpad = (clientX: number, clientY: number) => {
    const pad = dpadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dxRaw = clientX - cx;
    const dyRaw = clientY - cy;
    const dist = Math.hypot(dxRaw, dyRaw);
    const deadZone = rect.width * 0.1;
    if (dist < deadZone) {
      onTouchMove(0, 0);
      return;
    }
    const nx = dxRaw / dist;
    const ny = dyRaw / dist;
    const snapX = Math.abs(nx) > 0.36 ? Math.sign(nx) : 0;
    const snapY = Math.abs(ny) > 0.36 ? Math.sign(ny) : 0;
    onTouchMove(snapX, snapY);
  };

  const bindCircularDpad = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      updateCircularDpad(e.clientX, e.clientY);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId) || e.pointerType !== 'mouse') {
        updateCircularDpad(e.clientX, e.clientY);
      }
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      onTouchMove(0, 0);
    },
    onPointerCancel: () => onTouchMove(0, 0),
    onLostPointerCapture: () => onTouchMove(0, 0),
  };

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

  return (
    <div
      ref={hudRootRef}
      className="absolute inset-0 pointer-events-none flex flex-col justify-between px-3 py-2.5 md:px-5 md:py-3"
    >
      {/* Pulsating Red Border Urgency Vignette (<20% HP) */}
      {isLowHp && <div aria-hidden="true" className="low-hp-border" />}

      {/* ===================================================================== */}
      {/* DESKTOP HUD TOP BAR (Beveled Dark-Navy Capsules — Screenshot 1)       */}
      {/* ===================================================================== */}
      <div className="hud-desktop-only relative w-full items-start justify-between gap-3">
        {/* Subtle horizontal steel rail connecting Left -> Center -> Right modules */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute left-[240px] right-[185px] top-[34px] h-[5px] bg-gradient-to-b from-[#64748b] via-[#334155] to-[#0f172a] border-y border-[#090d16] -z-10 opacity-90"
        />

        {/* Desktop Left: Chamfered Hex Portrait + Name + HP & ESPECIAL Bars */}
        <section aria-label="Status do jogador" className="flex items-start gap-1.5 shrink-0">
          {/* Chamfered Portrait Bezel */}
          <div className="w-[62px] h-[62px] xl:w-[68px] xl:h-[68px] p-[2px] bg-[#090d16] hud-chamfer-portrait shrink-0 drop-shadow-[0_3px_0_#020617]">
            <div className="w-full h-full p-[2px] bg-gradient-to-b from-[#cbd5e1] to-[#475569] hud-chamfer-portrait">
              <div className="w-full h-full bg-[#0b1326] hud-chamfer-portrait overflow-hidden">
                <EstagiarioPortrait skin={hud.skinStyle} garageConfig={hud.garageConfig} />
              </div>
            </div>
          </div>

          <div className="flex flex-col pt-0.5 w-[186px] xl:w-[218px]">
            <div className="flex items-center justify-between gap-2 pl-1">
              <span className="font-arcade-display text-sm xl:text-[15px] tracking-wide text-[#facc15] arcade-text-outline leading-none">
                {hud.skinStyle === 'custom' && hud.garageConfig?.gender === 'female'
                  ? 'ESTAGIÁRIA'
                  : 'ESTAGIÁRIO'}
              </span>
              {isLowHp && (
                <span className="text-[10px] font-arcade-display text-red-400 animate-arcade-blink">
                  CRÍTICO
                </span>
              )}
            </div>

            {/* Chamfered HP Bar */}
            <div className="hud-beat-hp-bar mt-1 p-[2px] bg-[#090d16] hud-chamfer-bar">
              <div className="p-[1.5px] bg-gradient-to-b from-[#94a3b8] to-[#334155] hud-chamfer-bar">
                <div className="relative h-[18px] xl:h-[20px] bg-[#0f172a] hud-chamfer-bar overflow-hidden flex items-center">
                  <div
                    className={`h-full bg-gradient-to-b ${desktopHpGradient} transition-[width] duration-150`}
                    style={{ width: `${hpPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 gap-2 font-arcade-display text-[10px] xl:text-[11px] text-white drop-shadow-[0_1.5px_0_#090d16]">
                    <span>HP</span>
                    <span className="font-mono-num font-extrabold">
                      {hud.hp}/{hud.maxHp}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chamfered ESPECIAL Bar */}
            <div className="mt-1 p-[2px] bg-[#090d16] hud-chamfer-bar">
              <div className="p-[1.5px] bg-gradient-to-b from-[#94a3b8] to-[#334155] hud-chamfer-bar">
                <div className="relative h-[16px] xl:h-[18px] bg-[#0f172a] hud-chamfer-bar overflow-hidden flex items-center">
                  <div
                    className={`h-full transition-[width] duration-150 ${
                      specialReady
                        ? 'bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#fde047]'
                        : 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7]'
                    }`}
                    style={{ width: `${specialPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 gap-1.5 font-arcade-display text-[9px] xl:text-[10px] text-white drop-shadow-[0_1.5px_0_#090d16]">
                    <span>ESPECIAL</span>
                    <span className="font-mono-num font-extrabold">{specialPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact unobtrusive resources row beneath bars */}
            <div className="flex items-center gap-2.5 pl-1.5 pt-1 text-[10px] font-mono-num font-bold leading-none text-slate-200 drop-shadow-[0_1px_2px_#020617]">
              <span className="inline-flex items-center gap-1 text-[#facc15]">
                <TicketGlyph className="w-3.5 h-3" />
                {String(hud.credits).padStart(2, '0')}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  hud.deodorantCount > 0 ? 'text-sky-300' : 'text-slate-400'
                }`}
              >
                <SprayGlyph className="w-3 h-3.5" />
                {String(hud.deodorantCount).padStart(2, '0')}
              </span>
              {hud.gameMode === 'campaign' && (
                <span
                  className={`text-[9px] font-arcade-display ${
                    hud.ticketValidated ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {hud.ticketValidated ? '✓ VALIDADO' : 'VALIDAR'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Desktop Center: Gold-Framed Bus Line Capsule + Destination Tab */}
        <section
          aria-label={hud.gameMode === 'infinite' ? 'Status Hora do Rush' : 'Progresso da linha'}
          className="hud-beat-line flex flex-col items-center shrink-0 pt-1"
        >
          <div className="p-[2px] bg-[#090d16] hud-chamfer-capsule drop-shadow-[0_3px_0_#020617]">
            <div className="p-[2px] bg-gradient-to-b from-[#fde047] via-[#facc15] to-[#ca8a04] hud-chamfer-capsule">
              <div className="bg-[#0b1326] hud-chamfer-capsule px-5 py-1.5 flex items-center gap-2.5 min-w-[185px] justify-center">
                <BusGlyph className="w-6 h-5 shrink-0" />
                <span className="font-arcade-display text-sm xl:text-base tracking-wider text-[#facc15] drop-shadow-[0_2px_0_#090d16] whitespace-nowrap">
                  {hud.gameMode === 'infinite' ? 'HORA DO RUSH' : `LINHA ${hud.lineCode}`}
                </span>
              </div>
            </div>
          </div>

          {/* Lower Inset Destination / Wave Tab */}
          <div className="-mt-[2px] p-[2px] bg-[#090d16] hud-chamfer-tab-down">
            <div className="p-[1.5px] bg-[#64748b] hud-chamfer-tab-down">
              <div className="bg-[#0f172a] hud-chamfer-tab-down px-4 py-0.5 flex flex-col items-center">
                <span className="font-arcade-display text-[10px] tracking-widest text-slate-100 whitespace-nowrap">
                  {hud.gameMode === 'infinite'
                    ? `ONDA ${hud.infiniteWave} · ${formattedTimeLeft}`
                    : lineDestination}
                </span>
                {hud.gameMode === 'campaign' && (
                  <div className="w-24 h-[3px] rounded-full bg-slate-800 mt-0.5 overflow-hidden relative">
                    <div
                      className={`h-full transition-[width] duration-100 ${
                        hud.turnstileCleared ? 'bg-emerald-400' : 'bg-[#facc15]'
                      }`}
                      style={{ width: `${routePct}%` }}
                    />
                    <span
                      style={{ left: `${turnstilePct}%` }}
                      className="absolute top-0 bottom-0 w-[2px] bg-white/80"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {hud.fiscalChasing && (
            <span className="mt-1 text-[10px] font-arcade-display text-red-400 animate-arcade-blink whitespace-nowrap drop-shadow-[0_1px_2px_#020617]">
              FISCAL NA ÁREA!
            </span>
          )}
        </section>

        {/* Desktop Right: Chamfered Score Capsule + Mute/Pause + Active Buff Chips */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
          <div className="flex items-center gap-2">
            <div className="hud-beat-score p-[2px] bg-[#090d16] hud-chamfer-capsule drop-shadow-[0_3px_0_#020617]">
              <div className="p-[2px] bg-gradient-to-b from-[#cbd5e1] to-[#475569] hud-chamfer-capsule">
                <div className="bg-[#0b1326] hud-chamfer-capsule px-5 py-1 flex flex-col items-end leading-none min-w-[140px]">
                  <span className="font-arcade-display italic text-lg xl:text-[22px] text-[#facc15] drop-shadow-[0_2px_0_#090d16] tabular-nums whitespace-nowrap">
                    {hud.score.toLocaleString('pt-BR')}
                  </span>
                  <span className="font-arcade-display text-[9px] tracking-widest text-slate-100 mt-0.5">
                    PONTOS
                  </span>
                </div>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Ativar som' : 'Silenciar som'}
                className="w-9 h-9 bg-[#0b1326] hover:bg-[#1e293b] border-2 border-[#64748b] rounded-lg text-slate-100 inline-flex items-center justify-center cursor-pointer shadow-[0_2px_0_#090d16] focus-visible:outline-2 focus-visible:outline-[#facc15]"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-label="Pausar jogo"
                className="w-9 h-9 bg-[#0b1326] hover:bg-[#1e293b] border-2 border-[#64748b] rounded-lg text-slate-100 inline-flex items-center justify-center cursor-pointer shadow-[0_2px_0_#090d16] focus-visible:outline-2 focus-visible:outline-[#facc15]"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Buff Gadgets on Desktop */}
          {(hud.bagSkillCooldown > 0 ||
            hud.speedBoostTimer > 0 ||
            hud.strengthBuffTimer > 0 ||
            hud.caneCharges > 0 ||
            (hud.makeupShieldTimer > 0 && hud.shieldHits > 0) ||
            hud.rageTimer > 0 ||
            hud.expressWindTimer > 0) && (
            <div className="flex flex-wrap justify-end gap-1.5 max-w-[230px]">
              {hud.bagSkillCooldown > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-sky-400/50 text-sky-200 text-[10px] font-mono-num font-bold">
                  <Backpack className="w-3 h-3" aria-hidden="true" />
                  <span>{hud.bagSkillCooldown.toFixed(1)}s</span>
                </div>
              )}
              {hud.speedBoostTimer > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-amber-400/70 text-amber-300 text-[10px] font-mono-num font-bold">
                  <Coffee className="w-3 h-3" aria-hidden="true" />
                  <span>{Math.ceil(hud.speedBoostTimer)}s</span>
                </div>
              )}
              {hud.strengthBuffTimer > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-[#facc15]/80 text-[#facc15] text-[10px] font-mono-num font-bold">
                  <Zap className="w-3 h-3" aria-hidden="true" />
                  <span>{Math.ceil(hud.strengthBuffTimer)}s</span>
                </div>
              )}
              {hud.caneCharges > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-orange-400/70 text-orange-300 text-[10px] font-mono-num font-bold">
                  <Hammer className="w-3 h-3" aria-hidden="true" />
                  <span>×{hud.caneCharges}</span>
                </div>
              )}
              {hud.makeupShieldTimer > 0 && hud.shieldHits > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-cyan-400/70 text-cyan-300 text-[10px] font-mono-num font-bold">
                  <Shield className="w-3 h-3" aria-hidden="true" />
                  <span>{hud.shieldHits}/5</span>
                </div>
              )}
              {hud.rageTimer > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#232668]/90 border border-rose-400/80 text-rose-200 text-[10px] font-mono-num font-bold">
                  <Flame className="w-3 h-3" aria-hidden="true" />
                  <span>{Math.ceil(hud.rageTimer)}s</span>
                </div>
              )}
              {hud.expressWindTimer > 0 && (
                <div className="hud-beat-card inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b1326]/85 border border-sky-400/70 text-sky-300 text-[10px] font-mono-num font-bold">
                  <Wind className="w-3 h-3" aria-hidden="true" />
                  <span>+35%</span>
                </div>
              )}
            </div>
          )}

          <CompactBossHpList bosses={hud.bosses} className="w-[196px] xl:w-[216px]" />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MOBILE & TABLET HUD TOP BAR (Skewed Cyan Arcade Cards — Screenshot 2) */}
      {/* ===================================================================== */}
      <div className="hud-mobile-only relative w-full items-start justify-between gap-1.5 sm:gap-3">
        {/* Mobile/Tablet Top-Left: Skewed Portrait Card + HP Bar + Segmented ESP + Gold Resource Strip */}
        <section aria-label="Status do jogador" className="flex flex-col items-start shrink-0">
          <div className="flex items-stretch -skew-x-6 rounded-md bg-[#091224]/88 border-2 border-[#22d3ee] shadow-[0_3px_0_#020617,0_0_10px_rgba(34,211,238,0.28)] overflow-hidden p-1 gap-1.5">
            {/* Square Framed Portrait */}
            <div className="w-[46px] h-[46px] sm:w-[54px] sm:h-[54px] rounded border-2 border-[#e2e8f0] bg-[#0b1326] overflow-hidden shrink-0 skew-x-6">
              <EstagiarioPortrait skin={hud.skinStyle} garageConfig={hud.garageConfig} />
            </div>

            <div className="flex flex-col justify-between min-w-[118px] sm:min-w-[146px] pr-1">
              <span className="font-arcade-display italic text-[11px] sm:text-xs tracking-wide text-[#facc15] drop-shadow-[0_1.5px_0_#090d16] leading-none">
                {hud.skinStyle === 'custom' && hud.garageConfig?.gender === 'female'
                  ? 'ESTAGIÁRIA'
                  : 'ESTAGIÁRIO'}
              </span>

              {/* Red/Crimson Skewed HP Bar + Pill Counter */}
              <div className="relative h-[13px] sm:h-[15px] rounded-sm bg-[#0f172a] border border-slate-300/70 overflow-hidden flex items-center mt-0.5">
                <div
                  className={`h-full bg-gradient-to-r ${mobileHpGradient} transition-[width] duration-150`}
                  style={{ width: `${hpPct}%` }}
                />
                <span className="absolute right-0.5 px-1 rounded bg-[#090d16]/85 font-mono-num text-[9px] sm:text-[10px] font-bold text-white leading-tight">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>

              {/* ESP % + 12 Segmented Cyan Blocks */}
              <div className="flex items-center gap-1 mt-0.5">
                <span className="font-arcade-display italic text-[9px] sm:text-[10px] text-white leading-none whitespace-nowrap">
                  ESP <span className="text-[#38bdf8]">{specialPct}%</span>
                </span>
                <div className="flex items-center gap-[2px] flex-1">
                  {Array.from({ length: espSegments }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-[9px] sm:h-[11px] flex-1 rounded-[1px] border ${
                        idx < filledSegments
                          ? specialReady
                            ? 'bg-[#fde047] border-[#fef08a] shadow-[0_0_4px_rgba(250,204,21,0.85)]'
                            : 'bg-[#22d3ee] border-[#67e8f9]'
                          : 'bg-[#0f172a]/90 border-slate-600/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Attached Gold-Bordered Resource Pill (PASSAGENS & DESODORANTE) */}
          <div className="-mt-[1px] ml-1 -skew-x-6 rounded-b-md bg-[#091224]/92 border-2 border-[#facc15] px-2 py-0.5 flex items-center gap-2 text-[9px] sm:text-[10px] font-arcade-display shadow-[0_2px_0_#020617]">
            <span className="inline-flex items-center gap-1 text-white whitespace-nowrap">
              <TicketGlyph className="w-3.5 h-2.5" />
              PASSAGENS:{' '}
              <span className="text-[#facc15] font-mono-num">
                {String(hud.credits).padStart(2, '0')}
              </span>
            </span>
            <span className="text-slate-500" aria-hidden="true">
              /
            </span>
            <span className="inline-flex items-center gap-1 text-white whitespace-nowrap">
              <SprayGlyph className="w-2.5 h-3" />
              DESODORANTE:{' '}
              <span className="text-[#38bdf8] font-mono-num">
                {String(hud.deodorantCount).padStart(2, '0')}
              </span>
            </span>
          </div>
        </section>

        {/* Mobile/Tablet Top-Center: Cyan-Rimmed Bus Route Progress Card */}
        <section
          aria-label={hud.gameMode === 'infinite' ? 'Status Hora do Rush' : 'Progresso da linha'}
          className="hud-beat-line flex flex-col justify-between rounded-lg bg-[#091224]/88 border-2 border-[#22d3ee] shadow-[0_3px_0_#020617,0_0_10px_rgba(34,211,238,0.25)] px-2.5 py-1 min-w-[165px] sm:min-w-[230px] max-w-[270px]"
        >
          {hud.gameMode === 'infinite' ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <BusGlyph className="w-5 h-4 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="font-arcade-display italic text-[11px] sm:text-xs text-[#facc15]">
                    HORA DO RUSH
                  </span>
                  <span className="font-arcade-display text-[9px] text-sky-300">
                    ONDA {hud.infiniteWave}
                  </span>
                </div>
              </div>
              <span
                className={`font-mono-num text-sm font-bold ${
                  hud.infiniteTimeLeft <= 15
                    ? 'text-red-400 animate-arcade-blink'
                    : 'text-[#facc15]'
                }`}
              >
                {formattedTimeLeft}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <BusGlyph className="w-5 h-4 shrink-0" />
                  <div className="flex flex-col leading-none min-w-0">
                    <span className="font-arcade-display italic text-[11px] sm:text-xs text-[#facc15] whitespace-nowrap">
                      LINHA {hud.lineCode}
                    </span>
                    <span className="font-arcade-display italic text-[8px] sm:text-[9px] text-slate-100 truncate">
                      {lineDestination}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded border text-[8px] sm:text-[9px] font-arcade-display leading-none whitespace-nowrap ${
                    hud.ticketValidated
                      ? 'bg-emerald-950/85 border-emerald-400 text-emerald-300'
                      : 'bg-amber-950/85 border-amber-400 text-amber-300'
                  }`}
                >
                  {hud.ticketValidated ? '✓ VALIDADO' : 'PENDENTE'}
                </span>
              </div>

              {/* Horizontal Route Track with Bus Silhouette & SAÍDA Flag */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="relative flex-1 h-4 flex items-center">
                  <div className="w-full h-[3px] rounded-full bg-slate-600/85 overflow-hidden">
                    <div
                      className="h-full bg-[#facc15] transition-[width] duration-100"
                      style={{ width: `${routePct}%` }}
                    />
                  </div>
                  {/* Start & Turnstile Checkpoint Dots */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#facc15] border border-[#090d16]"
                  />
                  <span
                    aria-hidden="true"
                    style={{ left: `${turnstilePct}%` }}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-[#090d16] ${
                      hud.turnstileCleared ? 'bg-emerald-400' : 'bg-[#facc15]'
                    }`}
                  />
                  {/* Moving Yellow Bus + % Beneath */}
                  <div
                    style={{ left: `${Math.max(8, Math.min(92, routePct))}%` }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center transition-[left] duration-100"
                  >
                    <BusGlyph className="w-4 h-3.5 drop-shadow-[0_1px_1px_#020617]" />
                  </div>
                </div>
                <div className="flex flex-col items-center leading-none shrink-0">
                  <ExitFlagGlyph className="w-3 h-3" />
                  <span className="text-[7px] font-arcade-display text-slate-200">SAÍDA</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-arcade-display italic leading-none -mt-0.5">
                <span className="text-[#facc15] mx-auto">{routePct}%</span>
                {hud.fiscalChasing && (
                  <span className="text-red-400 animate-arcade-blink">FISCAL!</span>
                )}
              </div>
            </>
          )}
        </section>

        {/* Mobile/Tablet Top-Right: Skewed Score + Cyan Buttons + Cyan/Magenta Combo & Buff Pills */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="hud-beat-score -skew-x-6 rounded-md bg-[#091224]/90 border-2 border-[#22d3ee] px-2.5 py-0.5 flex flex-col items-end leading-none shadow-[0_3px_0_#020617]">
              <span className="font-arcade-display italic text-[8px] text-slate-100">PONTOS</span>
              <span className="font-arcade-display italic text-sm sm:text-base text-[#facc15] drop-shadow-[0_1.5px_0_#090d16] tabular-nums whitespace-nowrap">
                {hud.score.toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Ativar som' : 'Silenciar som'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#091224]/92 border-2 border-[#22d3ee] text-[#38bdf8] inline-flex items-center justify-center shadow-[0_2px_0_#020617]"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-label="Pausar jogo"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#091224]/92 border-2 border-[#22d3ee] text-[#38bdf8] inline-flex items-center justify-center shadow-[0_2px_0_#020617]"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Dynamic Cyan/Magenta Combo Burst (Screenshot 2) */}
          {displayHits > 0 && (
            <div
              key={displayHits}
              className="animate-combo-pop pointer-events-none select-none flex flex-col items-end pr-0.5 mt-0.5 -skew-x-6"
            >
              <div className="flex items-baseline gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-[#06b6d4]/90 to-[#0284c7]/85 border border-[#67e8f9] shadow-[0_2px_0_#090d16]">
                <span className="font-arcade-display text-lg sm:text-2xl leading-none text-[#facc15] drop-shadow-[0_2px_0_#090d16] tabular-nums">
                  {displayHits}
                </span>
                <span className="font-arcade-display text-xs sm:text-sm text-white drop-shadow-[0_1.5px_0_#090d16]">
                  HITS
                </span>
              </div>
              <div className="-mt-1 mr-1 px-2 py-0.5 rounded bg-gradient-to-r from-[#ec4899] to-[#db2777] border border-[#090d16] shadow-[0_2px_0_#090d16]">
                <span className="font-arcade-display italic text-[10px] sm:text-xs text-white leading-none">
                  {hud.comboMultiplier >= 10 ? `COMBO ×${hud.comboMultiplier}!` : 'COMBO!'}
                </span>
              </div>
            </div>
          )}

          {/* Stacked Pill Buff Badges Matching Screenshot 2 */}
          {(hud.strengthBuffTimer > 0 ||
            hud.speedBoostTimer > 0 ||
            hud.bagSkillCooldown > 0 ||
            hud.caneCharges > 0 ||
            (hud.makeupShieldTimer > 0 && hud.shieldHits > 0) ||
            hud.rageTimer > 0 ||
            hud.expressWindTimer > 0) && (
            <div className="flex flex-col items-end gap-1 mt-0.5">
              {(hud.strengthBuffTimer > 0 || hud.caneCharges > 0) && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#091224]/92 border border-[#facc15] text-[#facc15] text-[9px] font-arcade-display shadow-sm">
                  <Hammer className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  <span>
                    {hud.caneCharges > 0 ? `BENGALA ×${hud.caneCharges}` : `ATQ +25%`}
                  </span>
                </div>
              )}
              {(hud.speedBoostTimer > 0 || hud.expressWindTimer > 0) && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#091224]/92 border border-[#22d3ee] text-[#38bdf8] text-[9px] font-arcade-display shadow-sm">
                  <Wind className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  <span>{hud.expressWindTimer > 0 ? 'VEL +35%' : 'ESP + RÁPIDA'}</span>
                </div>
              )}
              {hud.rageTimer > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#232668]/92 border border-rose-400 text-rose-200 text-[9px] font-arcade-display shadow-sm">
                  <Flame className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  <span>RAGE {Math.ceil(hud.rageTimer)}s</span>
                </div>
              )}
              {hud.makeupShieldTimer > 0 && hud.shieldHits > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#091224]/92 border border-cyan-300 text-cyan-200 text-[9px] font-arcade-display shadow-sm">
                  <Shield className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  <span>ESCUDO {hud.shieldHits}/5</span>
                </div>
              )}
              {hud.bagSkillCooldown > 0 && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#091224]/92 border border-slate-500 text-slate-300 text-[9px] font-mono-num font-bold">
                  <Backpack className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  <span>{hud.bagSkillCooldown.toFixed(1)}s</span>
                </div>
              )}
            </div>
          )}

          <CompactBossHpList bosses={hud.bosses} className="w-[162px] sm:w-[192px]" />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MIDDLE PLAYFIELD LAYER (Travel Alerts, Interactive Prompts & Bosses)  */}
      {/* ===================================================================== */}
      <div className="relative flex-1 flex flex-col items-center justify-between py-1.5">
        <div className="pointer-events-none flex flex-col items-center gap-1.5 w-full px-2">
          {hud.rageNotificationTimer > 0 && (
            <aside
              aria-label="Notificação do buff de rage"
              className="animate-phone-notify pointer-events-none flex items-center gap-2.5 max-w-[340px] rounded-xl border border-[#7B83EB]/85 bg-[#1b1e54]/82 backdrop-blur-sm px-3 py-1.5 shadow-[0_4px_14px_rgba(2,6,23,0.55)] text-white"
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
            <div className="rounded-lg bg-[#080d18]/80 backdrop-blur-sm border border-[#facc15]/75 px-3.5 py-1 text-center shadow-sm">
              <span className="font-arcade-display text-[11px] md:text-xs text-[#facc15] tracking-wide">
                {hud.alertMessage}
              </span>
            </div>
          )}

          {hud.stickySlowTimer > 0 && (
            <div className="rounded-lg bg-[#080d18]/80 backdrop-blur-sm border border-pink-400/75 px-3 py-0.5 text-center">
              <span className="font-arcade-display text-[10px] text-pink-300">
                NO CHICLETE (LENTO)
              </span>
            </div>
          )}
        </div>

        <div className="w-full flex flex-col items-center gap-2">
          {hasActionPrompt && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hud.nearValidator && (
                <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-[2px] border border-emerald-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[11px] text-emerald-300">
                    VALIDAR ({hud.ticketCost} CRÉD)
                  </span>
                </div>
              )}

              {hud.nearStopButton && (
                <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-[2px] border border-red-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[11px] text-amber-300">
                    PUXAR STOP
                  </span>
                </div>
              )}

              {hud.seatRestProgress > 0 ? (
                <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-[2px] border border-emerald-400/80 px-3 py-1 text-center">
                  <span className="font-arcade-display text-[10px] text-emerald-300">
                    DESCANSANDO... {Math.round(hud.seatRestProgress * 100)}%
                  </span>
                </div>
              ) : (
                hud.nearEmptySeat &&
                hud.lineNumber === 1 && (
                  <div className="rounded-lg bg-[#080d18]/78 backdrop-blur-[2px] border border-emerald-500/75 px-3 py-1 text-center">
                    <span className="font-arcade-display text-[10px] text-emerald-300">
                      SENTAR (+18 HP)
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DESKTOP BOTTOM CORNERS (Red Splash Combo + Especial Capsule — Shot 1) */}
      {/* ===================================================================== */}
      <div className="hud-desktop-only items-end justify-between w-full pt-1">
        {/* Bottom-Left: Jagged Red Comic Combo Burst */}
        <div className="min-h-[46px] flex items-end">
          {displayHits > 0 && (
            <div
              key={displayHits}
              className="animate-combo-pop pointer-events-none select-none relative flex flex-col items-start pl-1 pb-0.5"
            >
              {/* Red Comic Jagged Splash Backing */}
              <div
                aria-hidden="true"
                className="absolute -inset-x-2 -inset-y-1 bg-[#dc2626] border-2 border-[#090d16] -skew-x-12 -rotate-3 rounded-sm shadow-[0_4px_0_#090d16]"
              />
              <div className="relative flex items-baseline gap-1.5 -skew-x-6 -rotate-2 px-1">
                <span className="font-arcade-display text-3xl xl:text-[34px] leading-none text-[#facc15] arcade-text-outline tabular-nums">
                  {displayHits}
                </span>
                <span className="font-arcade-display text-lg xl:text-xl leading-none text-[#facc15] arcade-text-outline">
                  HITS
                </span>
              </div>
              <span className="relative font-arcade-display italic text-xs xl:text-sm leading-none text-white arcade-text-outline pl-3 -mt-0.5 -skew-x-6 -rotate-2">
                {hud.comboMultiplier >= 10 ? `COMBO ×${hud.comboMultiplier}!` : 'COMBO!'}
              </span>
            </div>
          )}
        </div>

        {/* Bottom-Right: Glowing Cyan Chamfered ESPECIAL Capsule */}
        <button
          type="button"
          onClick={() => onTouchAction('special')}
          aria-label={specialReady ? 'Usar Especial' : `Especial ${specialPct}%`}
          className={`pointer-events-auto cursor-pointer p-[2px] bg-[#090d16] hud-chamfer-capsule transition-transform active:scale-95 ${
            specialReady
              ? 'drop-shadow-[0_0_12px_rgba(34,211,238,0.85)]'
              : 'opacity-90 drop-shadow-[0_3px_0_#020617]'
          }`}
        >
          <div
            className={`p-[2px] hud-chamfer-capsule ${
              specialReady
                ? 'bg-gradient-to-r from-[#38bdf8] via-[#67e8f9] to-[#fde047]'
                : 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7]'
            }`}
          >
            <div className="bg-[#081529] hud-chamfer-capsule px-5 py-1.5 flex items-center gap-2">
              <Zap
                className={`w-4 h-4 shrink-0 ${
                  specialReady
                    ? 'text-[#fde047] fill-[#fde047] animate-arcade-blink'
                    : 'text-[#facc15] fill-[#facc15]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`font-arcade-display italic text-sm xl:text-base tracking-wide whitespace-nowrap drop-shadow-[0_2px_0_#090d16] ${
                  specialReady ? 'text-[#67e8f9]' : 'text-[#38bdf8]'
                }`}
              >
                ESPECIAL {specialPct}%
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* MOBILE & TABLET TOUCH CONTROLS (Circular D-Pad + 3 Slate Buttons)     */}
      {/* ===================================================================== */}
      <div className="touch-controls-bar pointer-events-auto items-end justify-between pb-1 gap-3 touch-none select-none">
        {/* Bottom-Left: Sleek Circular Dark-Slate D-Pad (Screenshot 2) */}
        <div
          ref={dpadRef}
          role="group"
          aria-label="Direcional"
          {...bindCircularDpad}
          className="relative w-[114px] h-[114px] sm:w-[128px] sm:h-[128px] rounded-full bg-[#1f2937]/72 active:bg-[#334155]/78 backdrop-blur-[2px] border-[2.5px] border-slate-200/85 shadow-[0_4px_14px_rgba(2,6,23,0.75)] flex items-center justify-center touch-none select-none"
        >
          <span
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 -translate-x-1/2 text-slate-200/90 text-sm leading-none pointer-events-none"
          >
            ▲
          </span>
          <span
            aria-hidden="true"
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-slate-200/90 text-sm leading-none pointer-events-none"
          >
            ▼
          </span>
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-200/90 text-sm leading-none pointer-events-none"
          >
            ◀
          </span>
          <span
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200/90 text-sm leading-none pointer-events-none"
          >
            ▶
          </span>
          <span
            aria-hidden="true"
            className="w-4 h-4 rounded-full bg-slate-900/50 border border-white/15 pointer-events-none"
          />
        </div>

        {/* Bottom-Right: Secondary Utility Mini-Row + 3 Iconic Dark-Slate Action Circles */}
        <div className="flex flex-col items-end gap-2">
          {/* Compact Secondary Actions (Mochila, Usar, Pulo) */}
          <div className="flex items-center gap-1.5 pr-1">
            <button
              type="button"
              aria-label="Mochila"
              disabled={hud.bagSkillCooldown > 0}
              {...bindActionButton('bagGuard', hud.bagSkillCooldown > 0)}
              className={`h-8 min-w-[38px] px-2 rounded-full backdrop-blur-[2px] border text-[9px] font-arcade-display inline-flex items-center justify-center gap-1 touch-none select-none ${
                hud.bagSkillCooldown <= 0
                  ? 'bg-[#1f2937]/72 active:bg-slate-600/80 border-slate-300/70 text-slate-100'
                  : 'bg-slate-900/50 border-white/15 text-slate-400'
              }`}
            >
              <Backpack className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {hud.bagSkillCooldown > 0 && (
                <span className="font-mono-num">{hud.bagSkillCooldown.toFixed(0)}</span>
              )}
            </button>

            <button
              type="button"
              aria-label="Usar ou validar"
              {...bindActionButton('use')}
              className={`h-8 px-2.5 rounded-full backdrop-blur-[2px] border font-arcade-display text-[9px] inline-flex items-center justify-center gap-1 touch-none select-none ${
                hasActionPrompt
                  ? 'bg-emerald-700/80 border-[#fde047] text-white animate-arcade-blink'
                  : 'bg-[#1f2937]/72 active:bg-slate-600/80 border-slate-300/70 text-slate-100'
              }`}
            >
              <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>USAR</span>
            </button>

            <button
              type="button"
              aria-label="Pular"
              {...bindActionButton('jump')}
              className="h-8 px-2.5 rounded-full bg-[#1f2937]/72 active:bg-slate-600/80 backdrop-blur-[2px] border border-slate-300/70 text-slate-100 font-arcade-display text-[9px] inline-flex items-center justify-center touch-none select-none"
            >
              PULO
            </button>
          </div>

          {/* 3 Iconic Dark-Slate Circular Combat Buttons Matching Screenshot 2 */}
          <div className="relative w-[132px] h-[112px] sm:w-[144px] sm:h-[122px]">
            {/* Punch Fist (Top-Right) */}
            <button
              type="button"
              aria-label="Soco"
              {...bindActionButton('punch')}
              className="absolute right-0 top-0 w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-full bg-[#1f2937]/78 active:bg-slate-600/85 backdrop-blur-[2px] border-[2.5px] border-slate-200/90 text-white shadow-[0_4px_12px_rgba(2,6,23,0.75)] flex items-center justify-center touch-none select-none active:scale-95"
            >
              <PunchFistGlyph className="w-8 h-8" />
            </button>

            {/* Kick Boot (Middle-Left) */}
            <button
              type="button"
              aria-label="Chute"
              {...bindActionButton('kick')}
              className="absolute left-0 top-[26px] w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-full bg-[#1f2937]/78 active:bg-slate-600/85 backdrop-blur-[2px] border-[2.5px] border-slate-200/90 text-white shadow-[0_4px_12px_rgba(2,6,23,0.75)] flex items-center justify-center touch-none select-none active:scale-95"
            >
              <KickBootGlyph className="w-7 h-7" />
            </button>

            {/* ESP Burst (Bottom-Right) */}
            <button
              type="button"
              aria-label={specialReady ? 'Especial pronto' : `Especial ${specialPct}%`}
              {...bindActionButton('special')}
              className={`absolute right-1 bottom-0 w-[56px] h-[56px] sm:w-[60px] sm:h-[60px] rounded-full backdrop-blur-[2px] border-[2.5px] shadow-[0_4px_12px_rgba(2,6,23,0.75)] flex flex-col items-center justify-center touch-none select-none active:scale-95 transition-colors ${
                specialReady
                  ? 'bg-[#0284c7]/85 border-[#fde047] text-[#fef08a] shadow-[0_0_14px_rgba(56,189,248,0.9)] animate-arcade-blink'
                  : 'bg-[#1f2937]/78 active:bg-slate-600/85 border-slate-200/90 text-white'
              }`}
            >
              <Zap className="w-5 h-5 fill-current -mb-0.5" aria-hidden="true" />
              <span className="font-arcade-display italic text-[10px] leading-none">ESP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
