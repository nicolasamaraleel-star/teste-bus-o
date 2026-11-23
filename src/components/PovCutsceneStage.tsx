import { useEffect, useRef } from 'react';
import { mountPovCutscene, PovCutsceneMode } from '../game/povThreeScene';

interface PovCutsceneStageProps {
  mode: PovCutsceneMode;
  nextLineCode?: string;
  fiscalChasing?: boolean;
  className?: string;
  onPhaseText?: (caption: string) => void;
  onComplete?: () => void;
}

export function PovCutsceneStage({
  mode,
  nextLineCode = '202',
  fiscalChasing = false,
  className = '',
  onPhaseText,
  onComplete,
}: PovCutsceneStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const phaseCbRef = useRef(onPhaseText);
  const completeCbRef = useRef(onComplete);

  phaseCbRef.current = onPhaseText;
  completeCbRef.current = onComplete;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const cleanup = mountPovCutscene(el, {
      mode,
      nextLineCode,
      fiscalChasing,
      onPhaseText: (msg) => phaseCbRef.current?.(msg),
      onComplete: () => completeCbRef.current?.(),
    });

    return cleanup;
  }, [mode, nextLineCode, fiscalChasing]);

  return (
    <div
      ref={mountRef}
      className={`w-full overflow-hidden bg-[#090d16] ${className}`}
    />
  );
}
