import { Award, Coffee, Music, Shield, Sparkles, Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { audio } from '../game/audio';
import { BADGE_META } from '../game/badges';
import { STOP_FRAME_BY_LINE, VICTORY_OFFICE_FRAME } from '../game/introFrames';
import { PlayerSkinStyle } from '../game/shop';
import { AchievementBadgeId, HudSnapshot } from '../game/types';
import {
  drawGameOverCryingCanvas,
  drawPauseSleepingCanvas,
  drawVectorPlayer,
} from '../game/vectorArt';

function RunBadgesSummary({ badges }: { badges: AchievementBadgeId[] }) {
  const valid = badges.filter((b) => Boolean(BADGE_META[b]));
  if (valid.length === 0) return null;

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-700 p-3 space-y-1.5 text-left">
      <div className="font-arcade-display text-[10px] text-[#facc15]">
        MEDALHAS CONQUISTADAS
      </div>
      <div className="flex flex-wrap gap-1.5">
        {valid.map((id) => {
          const meta = BADGE_META[id];
          return (
            <span
              key={id}
              title={meta.description}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${meta.pillClass}`}
            >
              <Award className="w-3 h-3 shrink-0" />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PauseSleepingCanvas({
  lineNumber,
  skinStyle = 'classic',
}: {
  lineNumber: 1 | 2 | 3;
  skinStyle?: PlayerSkinStyle;
}) {
  const pauseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = pauseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPauseSleepingCanvas(ctx, canvas.width, canvas.height, t, lineNumber, skinStyle);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [lineNumber, skinStyle]);

  return (
    <canvas
      ref={pauseCanvasRef}
      width={220}
      height={128}
      aria-label="Personagem dormindo apoiado na barra do ônibus durante a pausa"
      style={{ imageRendering: 'pixelated' }}
      className="w-full max-w-[320px] mx-auto aspect-[220/128] rounded-xl border-2 border-[#334155] bg-[#090d16] shadow-[0_4px_0_#020617]"
    />
  );
}

function GameOverCryingCanvas({
  lineNumber,
  skinStyle = 'classic',
}: {
  lineNumber: 1 | 2 | 3;
  skinStyle?: PlayerSkinStyle;
}) {
  const cryingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = cryingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGameOverCryingCanvas(ctx, canvas.width, canvas.height, t, lineNumber, skinStyle);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [lineNumber, skinStyle]);

  return (
    <canvas
      ref={cryingCanvasRef}
      width={220}
      height={128}
      aria-label="Personagem chorando no ponto de ônibus na tela de derrota"
      style={{ imageRendering: 'pixelated' }}
      className="w-full max-w-[320px] mx-auto aspect-[220/128] rounded-xl border-2 border-red-500/70 bg-[#040711] shadow-[0_4px_0_#020617]"
    />
  );
}

function VictoryStandPodium({
  lineNumber,
  score,
  skinStyle = 'classic',
}: {
  lineNumber: 1 | 2 | 3;
  score: number;
  skinStyle?: PlayerSkinStyle;
}) {
  const standCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = standCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const drawStand = (now: number) => {
      const t = (now - start) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Nocturnal arcade spotlight backdrop
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle vertical spotlight beam
      const grad = ctx.createLinearGradient(0, 0, 0, 96);
      grad.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
      grad.addColorStop(0.7, 'rgba(52, 211, 153, 0.12)');
      grad.addColorStop(1, 'rgba(9, 13, 22, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(74, 0);
      ctx.lineTo(106, 94);
      ctx.lineTo(14, 94);
      ctx.closePath();
      ctx.fill();

      // 16-bit Pixel Victory Stand / Podium
      const podX = 28;
      const podY = 74;
      const podW = 64;
      const podH = 20;
      ctx.fillStyle = '#020617';
      ctx.fillRect(podX - 2, podY - 2, podW + 4, podH + 4);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(podX, podY, podW, podH);
      ctx.fillStyle = '#172554';
      ctx.fillRect(podX, podY + 10, podW, podH - 10);
      // Golden top trim & rank plaque
      ctx.fillStyle = '#facc15';
      ctx.fillRect(podX - 2, podY - 2, podW + 4, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(podX, podY - 2, podW, 1);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1º LUGAR', 60, podY + 11);

      // Celebratory pixel confetti
      const colors = ['#fde047', '#34d399', '#38bdf8', '#f97316'];
      for (let i = 0; i < 10; i++) {
        const cx = Math.round(12 + ((i * 23 + t * (16 + (i % 3) * 6)) % 96));
        const cy = Math.round(6 + ((i * 19 + t * (28 + (i % 4) * 5)) % 70));
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(cx, cy, 2, 2);
      }

      // Heroic player sprite in 'victory' stand pose atop the podium
      drawVectorPlayer(
        ctx,
        60,
        podY - 1,
        0,
        1,
        'victory',
        t,
        false,
        false,
        false,
        lineNumber >= 2,
        lineNumber === 3,
        t,
        skinStyle
      );

      rafId = requestAnimationFrame(drawStand);
    };

    rafId = requestAnimationFrame(drawStand);
    return () => cancelAnimationFrame(rafId);
  }, [lineNumber, skinStyle]);

  const title =
    lineNumber === 3
      ? 'LENDA DO HORÁRIO DE PICO'
      : lineNumber === 2
        ? 'HERÓI DO EXPRESSO'
        : 'VENCEDOR DA LINHA';

  return (
    <div className="flex items-center gap-3 bg-slate-900/95 rounded-xl border-2 border-[#facc15]/60 p-3 text-left">
      <canvas
        ref={standCanvasRef}
        width={120}
        height={98}
        style={{ imageRendering: 'pixelated' }}
        className="w-[104px] h-[85px] shrink-0 rounded-lg border-2 border-[#020617] bg-[#090d16]"
      />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-[11px] font-bold text-[#facc15] tracking-wide">
          PÓDIO DE VITÓRIA · LINHA {lineNumber}/3
        </div>
        <div className="font-arcade-display text-xs sm:text-sm text-white truncate">
          {title}
        </div>
        <div className="text-xs text-slate-300 font-mono-num">
          Pontuação Final: <span className="text-[#facc15] font-bold">{score}</span>
        </div>
        <button
          type="button"
          onClick={() => audio.playVictory(lineNumber)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-[11px] font-semibold text-amber-300 cursor-pointer whitespace-nowrap"
        >
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          Tocar Fanfarra
        </button>
      </div>
    </div>
  );
}

interface GameModalsProps {
  hud: HudSnapshot;
  musicVolume: number;
  sfxVolume: number;
  onMusicVolumeChange: (vol: number) => void;
  onSfxVolumeChange: (vol: number) => void;
  onResume: () => void;
  onNextLine: () => void;
  onBuyPerk: (perk: 'coffee' | 'deodorant' | 'shield') => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameModals({
  hud,
  musicVolume,
  sfxVolume,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onResume,
  onNextLine,
  onBuyPerk,
  onRestart,
  onReturnTitle,
}: GameModalsProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (hud.gameState === 'LINE_TRANSITION') {
          e.preventDefault();
          onNextLine();
        } else if (hud.gameState === 'VICTORY' || hud.gameState === 'GAME_OVER') {
          e.preventDefault();
          onRestart();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hud.gameState, onNextLine, onRestart]);

  if (
    hud.gameState === 'PLAYING' ||
    hud.gameState === 'TITLE_MENU' ||
    hud.gameState === 'INTRO_SCENE' ||
    hud.gameState === 'VICTORY_SCENE'
  ) {
    return null;
  }

  const nextLineCode = hud.lineSummary?.nextLine === 2 ? '202' : '303';
  const stopFrameSrc = STOP_FRAME_BY_LINE[nextLineCode] ?? STOP_FRAME_BY_LINE['202'];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090d16]/85 p-4">
      {hud.gameState === 'PAUSED' && (
        <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0f172a] border-4 border-[#facc15] p-5 md:p-6 text-center space-y-3.5 shadow-[0_8px_0_#020617]">
          <PauseSleepingCanvas lineNumber={hud.lineNumber} skinStyle={hud.skinStyle} />
          <p className="text-sm text-slate-300">
            {hud.lineTitle} · Pontuação:{' '}
            <span className="font-mono-num text-white font-bold">{hud.score}</span>
          </p>

          {/* Separate Music & SFX Volume Controls */}
          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700 space-y-3 text-left">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="pause-music-volume"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-200"
                >
                  <Music className="w-3.5 h-3.5 text-[#facc15]" aria-hidden="true" />
                  Música
                </label>
                <span className="font-mono-num text-[#facc15] font-bold">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <input
                id="pause-music-volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(musicVolume * 100)}
                onChange={(e) => onMusicVolumeChange(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-lg accent-[#facc15] cursor-pointer bg-slate-800"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="pause-sfx-volume"
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-200"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
                  Efeitos Sonoros
                </label>
                <span className="font-mono-num text-[#38bdf8] font-bold">
                  {Math.round(sfxVolume * 100)}%
                </span>
              </div>
              <input
                id="pause-sfx-volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(sfxVolume * 100)}
                onChange={(e) => onSfxVolumeChange(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-lg accent-[#38bdf8] cursor-pointer bg-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onResume}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0f172a] font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              CONTINUAR
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              TELA INICIAL
            </button>
          </div>
        </div>
      )}

      {hud.gameState === 'LINE_TRANSITION' && hud.lineSummary && (
        <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0f172a] border-4 border-[#38bdf8] p-5 md:p-6 text-center space-y-3.5 shadow-[0_8px_0_#020617]">
          <div className="font-arcade-display text-xs text-sky-400">
            LINHA {hud.lineSummary.completedLine}/3 CONCLUÍDA ·{' '}
            {hud.lineSummary.completedLine === 1 ? '06:30 · SOL NASCENDO' : '07:30 · PÓS-NASCER DO SOL'}
          </div>
          <h2 className="font-arcade-display text-xl md:text-2xl text-white">
            PRÓXIMO BUSÃO
          </h2>

          <div className="relative w-full aspect-video max-h-48 rounded-xl border-2 border-slate-700 overflow-hidden bg-[#090d16]">
            <img
              src={stopFrameSrc}
              alt={`Ponto de ônibus ${hud.lineSummary.nextLineTitle ?? `Linha ${nextLineCode}`}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/85 to-transparent px-3.5 pt-6 pb-2.5 flex items-center justify-between gap-2 text-left">
              <span className="font-arcade-display text-xs sm:text-sm text-[#facc15] drop-shadow-[0_2px_0_#020617] truncate">
                {(
                  hud.lineSummary.nextLineTitle ??
                  (nextLineCode === '202' ? 'Linha 202 · Largo de Oz' : 'Linha 303 · Barro Fundo')
                ).toUpperCase()}
              </span>
              <span className="shrink-0 font-mono-num text-[11px] font-bold text-sky-300 whitespace-nowrap">
                {nextLineCode === '202' ? '202 · LARGO DE OZ' : '303 · BARRO FUNDO'}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Bilhete</span>
              <span
                className={`font-bold ${
                  hud.lineSummary.ticketValidated ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {hud.lineSummary.ticketValidated ? 'VALIDADO' : 'NÃO VALIDADO'}
              </span>
            </div>

            {hud.lineSummary.fiscalAlert ? (
              <p className="text-xs text-amber-300 text-left">
                Sem bilhete! Fiscal atrás de você na próxima linha.
              </p>
            ) : (
              <p className="text-xs text-emerald-300 text-left">
                Bilhete validado! Viagem tranquila.
              </p>
            )}

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
              <span className="text-slate-400">Pontuação Atual</span>
              <span className="font-mono-num text-[#facc15] font-bold">
                {hud.lineSummary.score}
              </span>
            </div>
          </div>

          {/* Banca do Ponto Entre Linhas */}
          <div className="bg-slate-900/95 rounded-xl border border-slate-700 p-3 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-arcade-display text-[11px] text-[#facc15]">
                BANCA DO PONTO
              </span>
              <span className="font-mono-num text-amber-300 font-bold">
                CRÉDITOS: {hud.credits} · HP {hud.hp}/{hud.maxHp}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(() => {
                const bought = hud.lineSummary?.purchasedPerks ?? [];
                const coffeeBought = bought.includes('coffee');
                const deoBought = bought.includes('deodorant');
                const shieldBought = bought.includes('shield');
                const coffeeDisabled = coffeeBought || hud.credits < 1 || hud.hp >= hud.maxHp;
                const deoDisabled = deoBought || hud.credits < 2 || hud.deodorantCount >= 4;
                const shieldDisabled = shieldBought || hud.credits < 2;

                return (
                  <>
                    <button
                      type="button"
                      disabled={coffeeDisabled}
                      onClick={() => onBuyPerk('coffee')}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        coffeeBought
                          ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                          : coffeeDisabled
                            ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 border-amber-400/70 text-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Coffee className="w-3.5 h-3.5 text-amber-300" />
                          Cafezinho
                        </span>
                        <span className="font-mono-num text-[#facc15]">1 CRÉD</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {coffeeBought ? 'Comprado!' : '+30 HP imediato'}
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={deoDisabled}
                      onClick={() => onBuyPerk('deodorant')}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        deoBought
                          ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                          : deoDisabled
                            ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 border-cyan-400/70 text-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                          Desodorante
                        </span>
                        <span className="font-mono-num text-[#facc15]">2 CRÉD</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {deoBought ? 'Comprado!' : `+1 spray (${hud.deodorantCount}/4)`}
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={shieldDisabled}
                      onClick={() => onBuyPerk('shield')}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        shieldBought
                          ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                          : shieldDisabled
                            ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 border-sky-400/70 text-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-sky-300" />
                          Reforço Mochila
                        </span>
                        <span className="font-mono-num text-[#facc15]">2 CRÉD</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        {shieldBought ? 'Ativado!' : 'Escudo 5 golpes (15s)'}
                      </p>
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          <button
            type="button"
            onClick={onNextLine}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0f172a] font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
          >
            EMBARCAR: {hud.lineSummary.nextLineTitle?.toUpperCase()}
          </button>
        </div>
      )}

      {hud.gameState === 'VICTORY' && (
        <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0f172a] border-4 border-emerald-400 p-5 md:p-6 text-center space-y-3.5 shadow-[0_8px_0_#020617]">
          <div className="font-arcade-display text-xs text-emerald-400">
            BARRO FUNDO SUPERADO · 08:59 NO ESCRITÓRIO
          </div>
          <h2 className="font-arcade-display text-xl md:text-2xl text-[#facc15]">
            PONTO BATIDO NO TABLET!
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            <img
              src={VICTORY_OFFICE_FRAME}
              alt="Estagiário batendo o ponto às 08:59 com o rosto cheio de hematomas"
              referrerPolicy="no-referrer"
              className="w-full h-36 sm:h-full min-h-[120px] rounded-xl border-2 border-slate-700 object-cover bg-[#090d16]"
            />
            <VictoryStandPodium
              lineNumber={hud.lineNumber}
              score={hud.score}
              skinStyle={hud.skinStyle}
            />
          </div>

          <p className="text-sm text-slate-200">
            Barro Fundo superado! Ponto batido às 08:59 no escritório.
          </p>

          <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-1.5 text-sm font-mono-num">
            <div className="flex justify-between">
              <span className="text-slate-400">Pontuação Final</span>
              <span className="text-[#facc15] font-bold">{hud.score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Passageiros Nocauteados</span>
              <span className="text-white font-bold">{hud.enemiesDefeated}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Maior Sequência de Golpes</span>
              <span className="text-amber-300 font-bold">{hud.bestHitChain} hits</span>
            </div>
          </div>

          <RunBadgesSummary badges={hud.badges} />

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onRestart}
              className="px-6 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-slate-950 font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              JOGAR NOVAMENTE
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              TELA INICIAL
            </button>
          </div>
        </div>
      )}

      {hud.gameState === 'GAME_OVER' && (
        <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0f172a] border-4 border-red-500 p-5 md:p-6 text-center space-y-4 shadow-[0_8px_0_#020617]">
          <div className="font-arcade-display text-xs text-red-400">
            {hud.gameMode === 'infinite'
              ? hud.infiniteTimeLeft <= 0
                ? 'TEMPO ESGOTADO · HORA DO RUSH'
                : 'FIM DE TURNO · HORA DO RUSH'
              : 'FIM DA LINHA'}
          </div>
          <h2 className="font-arcade-display text-2xl text-red-400 arcade-text-outline">
            VOCÊ FOI DEMITIDO!
          </h2>

          <GameOverCryingCanvas lineNumber={hud.lineNumber} skinStyle={hud.skinStyle} />

          <p className="text-sm text-slate-300">
            {hud.gameMode === 'infinite'
              ? `Você resistiu até a Onda ${hud.infiniteWave} na ${hud.lineTitle}.`
              : `A lotação venceu na ${hud.lineTitle}.`}
          </p>

          <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5 space-y-2 text-sm font-mono-num">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {hud.gameMode === 'infinite' ? 'Onda Alcançada' : 'Linha Alcançada'}
              </span>
              <span className="text-white font-bold">
                {hud.gameMode === 'infinite' ? `Onda ${hud.infiniteWave}` : `${hud.lineNumber}/3`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pontuação</span>
              <span className="text-[#facc15] font-bold">{hud.score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inimigos Derrotados</span>
              <span className="text-white font-bold">{hud.enemiesDefeated}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Maior Sequência de Golpes</span>
              <span className="text-amber-300 font-bold">{hud.bestHitChain} hits</span>
            </div>
          </div>

          <RunBadgesSummary badges={hud.badges} />

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onRestart}
              className="px-6 py-3 rounded-xl bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0f172a] font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              JOGAR NOVAMENTE
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-arcade-display text-xs border-2 border-[#020617] shadow-[0_4px_0_#020617] cursor-pointer whitespace-nowrap"
            >
              TELA INICIAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
