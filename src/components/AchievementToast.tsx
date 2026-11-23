import { Trophy } from 'lucide-react';
import { AchievementUnlockNotice } from '../game/types';

interface AchievementToastProps {
  notice: AchievementUnlockNotice | null;
}

export function AchievementToast({ notice }: AchievementToastProps) {
  if (!notice) return null;

  return (
    <aside
      key={notice.uid}
      aria-live="polite"
      aria-label={`Conquista desbloqueada: ${notice.label}`}
      className="animate-achievement-in pointer-events-none fixed top-20 left-4 z-50 w-[calc(100%-2rem)] max-w-[290px] rounded-xl border-2 border-[#facc15] bg-[#0f172a]/96 p-3 shadow-[0_6px_0_#020617] text-white"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-[#facc15] border-2 border-[#020617] flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-[#090d16]" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="font-arcade-display text-[10px] tracking-wide text-[#facc15] leading-tight">
            CONQUISTA DESBLOQUEADA
          </div>
          <div className="text-xs font-bold text-white truncate">{notice.label}</div>
          <p className="text-[11px] text-slate-300 leading-snug">{notice.description}</p>
        </div>
      </div>
    </aside>
  );
}
