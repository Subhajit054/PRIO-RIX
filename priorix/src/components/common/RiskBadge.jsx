import React from 'react';
import { RISK_LEVELS } from '../../lib/attentionEngine.js';
import { AlertCircle, Clock, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

export function RiskBadge({ risk, score }) {
  switch (risk) {
    case RISK_LEVELS.OVERDUE:
      return (
        <span
          id={`badge-risk-overdue-${score || '0'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
        >
          <Flame className="w-3 h-3" />
          Overdue
        </span>
      );
    case RISK_LEVELS.AT_RISK:
      return (
        <span
          id={`badge-risk-at-risk-${score || '0'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20"
        >
          <AlertTriangle className="w-3 h-3" />
          At Risk
        </span>
      );
    case RISK_LEVELS.NEGLECTED:
      return (
        <span
          id={`badge-risk-neglected-${score || '0'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20"
        >
          <Clock className="w-3 h-3" />
          Neglected
        </span>
      );
    case RISK_LEVELS.NEEDS_ATTENTION:
      return (
        <span
          id={`badge-risk-attention-${score || '0'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
        >
          <AlertCircle className="w-3 h-3" />
          Needs Attention
        </span>
      );
    case RISK_LEVELS.NORMAL:
    default:
      return (
        <span
          id={`badge-risk-normal-${score || '0'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50"
        >
          <CheckCircle2 className="w-3 h-3" />
          On Track
        </span>
      );
  }
}
