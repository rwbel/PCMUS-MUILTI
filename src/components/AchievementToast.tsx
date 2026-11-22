import React from 'react';
import { AchievementDefinition } from '../utils/achievements';

interface AchievementToastProps {
  achievement: AchievementDefinition | null;
  onDismiss: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss,
}) => {
  if (!achievement) return null;

  return (
    <div
      role="status"
      onClick={onDismiss}
      className="fixed bottom-4 right-4 z-[70] max-w-xs w-[calc(100%-2rem)] bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 border-2 border-amber-400 rounded-2xl p-3 shadow-[0_12px_32px_rgba(0,0,0,0.85)] flex items-center gap-3 cursor-pointer animate-in fade-in slide-in-from-bottom duration-300"
    >
      <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/70 flex items-center justify-center text-2xl shrink-0">
        {achievement.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
          🏆 ¡Logro desbloqueado!
        </div>
        <div className="text-xs font-black text-amber-100 truncate">
          {achievement.title}
        </div>
        <div className="text-[10px] text-stone-300 leading-tight line-clamp-2 mt-0.5">
          {achievement.description}
        </div>
      </div>
    </div>
  );
};
