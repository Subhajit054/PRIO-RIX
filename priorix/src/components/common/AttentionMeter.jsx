import React from 'react';

export function AttentionMeter({ score = 0, showLabel = true, size = 'md' }) {
  const getScoreColor = (s) => {
    if (s >= 85) return 'text-rose-400 bg-rose-500';
    if (s >= 65) return 'text-amber-400 bg-amber-500';
    if (s >= 40) return 'text-blue-400 bg-blue-500';
    return 'text-slate-400 bg-slate-500';
  };

  const colorClass = getScoreColor(score);

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass.split(' ')[1]}`}
          style={{ width: `${Math.min(Math.max(score, 4), 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-medium ${colorClass.split(' ')[0]}`}>
          {score}
        </span>
      )}
    </div>
  );
}
