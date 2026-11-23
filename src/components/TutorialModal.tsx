import {
  AlertTriangle,
  Backpack,
  BookOpen,
  Bus,
  Coffee,
  Flame,
  Gamepad2,
  Play,
  Shield,
  Sparkles,
  Ticket,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface TutorialModalProps {
  onClose: () => void;
  onStartGame: () => void;
}

type TutorialTab = 'controls' | 'combat' | 'bus';

export function TutorialModal({ onClose, onStartGame }: TutorialModalProps) {
  const [tab, setTab] = useState<TutorialTab>('controls');

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d16]/88 p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0f172a] border-4 border-[#38bdf8] shadow-[0_10px_0_#020617] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-[#facc15] shrink-0" />
            <h2 className="font-arcade-display text-xs sm:text-base text-[#facc15] truncate">
              MANUAL DO PASSAGEIRO · TUTORIAL
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('controls')}
            className={`px-3 py-1.5 rounded-lg font-arcade-display text-[10px] sm:text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'controls'
                ? 'bg-[#facc15] text-[#090d16]'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
            CONTROLES & GOLPES
          </button>
          <button
            type="button"
            onClick={() => setTab('combat')}
            className={`px-3 py-1.5 rounded-lg font-arcade-display text-[10px] sm:text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'combat'
                ? 'bg-[#38bdf8] text-[#090d16]'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            INIMIGOS & DEFESA
          </button>
          <button
            type="button"
            onClick={() => setTab('bus')}
            className={`px-3 py-1.5 rounded-lg font-arcade-display text-[10px] sm:text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'bus'
                ? 'bg-emerald-400 text-[#090d16]'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Bus className="w-3.5 h-3.5 shrink-0" />
            ÔNIBUS & ITENS
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {tab === 'controls' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    keys: 'WASD / Setas',
                    title: 'Movimentação 2.5D',
                    desc: 'Ande pelo corredor e troque de faixa vertical para desviar de ataques.',
                    color: 'text-sky-300 border-sky-500/40',
                  },
                  {
                    keys: 'J ou Z',
                    title: 'Soco / Combo / Bengala',
                    desc: 'Sequência J-J-J fecha com gancho. No Combo x7 libera o Chicote de Fone!',
                    color: 'text-[#facc15] border-[#facc15]/40',
                  },
                  {
                    keys: 'K ou X',
                    title: 'Chute & Chute Voador',
                    desc: 'Quebra guardas. No ar (Espaço + K) ativa o Chute Voador de Trinity — em câmera lenta contra Chefes!',
                    color: 'text-emerald-300 border-emerald-500/40',
                  },
                  {
                    keys: 'C ou L',
                    title: 'Chute Especial Suspenso / ESP!',
                    desc: 'Suspende no ar antes do chute especial (custa 8 HP). Com 100% ESP dispara a Explosão Sonora!',
                    color: 'text-amber-300 border-amber-500/40',
                  },
                  {
                    keys: 'Espaço',
                    title: 'Pulo & Barra Superior',
                    desc: 'Pule obstáculos e aperte Espaço de novo no ar para pendurar no ferro amarelo e girar (J/K).',
                    color: 'text-purple-300 border-purple-500/40',
                  },
                  {
                    keys: 'Q ou Shift',
                    title: 'Escudo de Mochila & Giro',
                    desc: 'Bloqueia golpes frontais. Defender no instante certo gera Contra-Ataque! Aperte J/K para girar.',
                    color: 'text-cyan-300 border-cyan-500/40',
                  },
                  {
                    keys: 'E ou U',
                    title: 'Interagir & Desodorante',
                    desc: 'Valida bilhete no validador, puxa a cordinha STOP ou borrifa Desodorante.',
                    color: 'text-rose-300 border-rose-500/40',
                  },
                  {
                    keys: 'Touch (Celular/Tablet)',
                    title: 'Controles na Tela',
                    desc: 'Use o joystick esquerdo para mover e os botões de ação à direita (jogue em paisagem).',
                    color: 'text-slate-200 border-slate-600/60',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-xl bg-slate-900/90 border p-3 flex flex-col gap-1.5 ${item.color}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arcade-display text-[11px] sm:text-xs">
                        {item.title}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-[#090d16] border border-slate-600 font-mono-num text-[10px] font-bold text-slate-100 whitespace-nowrap">
                        {item.keys}
                      </kbd>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'combat' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-rose-950/35 border border-rose-500/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>CONTORNO BRILHANTE (!)</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Passageiros com contorno brilhante e sinal <strong className="text-[#facc15]">!</strong> estão prestes a atacar. Defenda com <strong className="text-cyan-300">Mochila (Q/Shift)</strong> para aparar ou troque de faixa!
                </p>
              </div>

              <div className="rounded-xl bg-sky-950/35 border border-sky-500/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-sky-300">
                  <Backpack className="w-4 h-4 shrink-0" />
                  <span>ESTUDANTE COM MOCHILA</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Bloqueia socos frontais! Quebre a guarda com <strong className="text-[#facc15]">Chute (K)</strong>, <strong className="text-emerald-300">Voadora</strong> ou golpes especiais. Derrotar garante Escudo de Mochila temporário.
                </p>
              </div>

              <div className="rounded-xl bg-lime-950/35 border border-lime-500/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-lime-300">
                  <Wind className="w-4 h-4 shrink-0" />
                  <span>AURA TÓXICA DA INDÚSTRIA</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Causa dano contínuo de perto e bloqueia socos comuns. Use <strong className="text-sky-300">Desodorante (E)</strong> ou <strong className="text-[#facc15]">Explosão Sonora (C 100%)</strong> para dissipar o odor!
                </p>
              </div>

              <div className="rounded-xl bg-amber-950/35 border border-amber-500/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-[#facc15]">
                  <Flame className="w-4 h-4 shrink-0" />
                  <span>COMBO LIMPO & MODO RAGE</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  O contador contabiliza apenas golpes sem ser interrompido. Ao derrotar <strong className="text-rose-300">10 inimigos seguidos</strong>, você ativa o <strong className="text-[#facc15]">Modo Rage</strong> (+velocidade e +50% de dano)!
                </p>
              </div>

              <div className="sm:col-span-2 rounded-xl bg-emerald-950/30 border border-emerald-500/45 p-3.5 flex items-start gap-3">
                <Zap className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-arcade-display text-xs text-emerald-300">
                    CHEFES DE LINHA & CÂMERA LENTA
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Chefes como o Cobrador Blindado possuem barra de armadura azul. Ataque com chutes voadores (<strong className="text-[#facc15]">Espaço + K</strong>) para ativar câmera lenta estilo Matrix e quebrar a blindagem!
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'bus' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-900/90 border border-[#facc15]/45 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-[#facc15]">
                  <Ticket className="w-4 h-4 shrink-0" />
                  <span>VALIDADOR & CATRACA</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Colete cartões de crédito caídos dos passageiros e aperte <strong className="text-slate-100">E</strong> no validador antes da catraca para ganhar bônus e evitar que o Fiscal apareça na próxima linha.
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-rose-500/45 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-rose-300">
                  <Bus className="w-4 h-4 shrink-0" />
                  <span>CORDINHA STOP & POLTRONAS</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Puxe a cordinha <strong className="text-rose-300">STOP (E)</strong> para frear o busão e derrubar inimigos! Em poltronas livres na Linha 1, segure <strong className="text-emerald-300">↑/W</strong> parado para recuperar HP.
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-sky-500/45 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-sky-300">
                  <Coffee className="w-4 h-4 shrink-0" />
                  <span>CONSUMÍVEIS DE BORDO</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-300">Cafezinho</strong> recupera HP e dá velocidade; <strong className="text-pink-300">Chocolate</strong> cura vida; <strong className="text-orange-300">Bengala</strong> equipa arma de longo alcance com 5 cargas.
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/90 border border-purple-500/45 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 font-arcade-display text-xs text-purple-300">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>LOJINHA & BILHETE DOURADO</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chefes derrubam o <strong className="text-[#facc15]">Bilhete Dourado</strong> (cura + força dupla). Suas pontuações viram Fichas para desbloquear skins e melhorias permanentes na Lojinha!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 bg-[#090d16] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-num text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
            <span>Dica: O contador no topo só conta golpes limpos sem interrupção.</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-arcade-display text-xs border border-slate-600 cursor-pointer"
            >
              FECHAR
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartGame();
              }}
              className="px-5 py-2 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-[#090d16] font-arcade-display text-xs border-2 border-[#020617] shadow-[0_3px_0_#020617] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              EMBARCAR AGORA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
