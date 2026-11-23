import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { IntroFrame } from '../game/introFrames';

interface IntroStoryboardProps {
  frames: IntroFrame[];
  onComplete: () => void;
  skipLabel?: string;
  autoAdvanceMs?: number;
}

export function IntroStoryboard({
  frames,
  onComplete,
  skipLabel = 'PULAR INTRO',
  autoAdvanceMs = 1850,
}: IntroStoryboardProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const activeFrame = frames[frameIdx] ?? frames[0];

  const handleNext = useCallback(() => {
    if (frameIdx >= frames.length - 1) {
      onComplete();
    } else {
      setFrameIdx((prev) => prev + 1);
    }
  }, [frameIdx, frames.length, onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (frameIdx >= frames.length - 1) {
        onComplete();
      } else {
        setFrameIdx((prev) => prev + 1);
      }
    }, autoAdvanceMs);
    return () => window.clearTimeout(timer);
  }, [frameIdx, frames.length, autoAdvanceMs, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, onComplete]);

  return (
    <div className="relative w-full h-full bg-[#090d16] flex items-center justify-center p-3 md:p-6">
      <div className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border-4 border-[#0f172a] shadow-[0_10px_0_#020617] bg-[#0f172a]">
        <img
          src={activeFrame.imageSrc}
          alt={activeFrame.caption}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover select-none"
        />

        {/* Top Bar: Skip & Next Controls */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleNext}
            className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 font-arcade-display text-[11px] border-2 border-slate-600 shadow-[0_3px_0_#020617] cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
          >
            PRÓXIMO
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0f172a] font-arcade-display text-[11px] border-2 border-[#0f172a] shadow-[0_3px_0_#0f172a] cursor-pointer whitespace-nowrap"
          >
            {skipLabel}
          </button>
        </div>

        {/* Bottom Frame Progress Indicators */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-center">
          <div className="flex items-center gap-2">
            {frames.map((frame, idx) => (
              <button
                key={frame.id}
                type="button"
                aria-label={`Ir para ${frame.label}`}
                onClick={() => setFrameIdx(idx)}
                className={`h-2.5 rounded-full border border-[#0f172a] transition-all cursor-pointer ${
                  idx === frameIdx
                    ? 'w-8 bg-[#facc15]'
                    : idx < frameIdx
                      ? 'w-3 bg-emerald-400'
                      : 'w-3 bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
