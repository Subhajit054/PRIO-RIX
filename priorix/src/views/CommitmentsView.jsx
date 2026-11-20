import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  ShieldCheck,
  Plus,
  Calendar,
  User,
  Trash2,
  CheckCircle2,
  Clock,
  Flame,
  Mail,
  Users,
  FileText,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { calculateAttentionScore } from '../lib/attentionEngine.js';

export function CommitmentsView() {
  const {
    commitments,
    toggleCommitmentStatus,
    deleteCommitment,
    setIsQuickAddOpen,
    setQuickAddType,
    isGoogleConnected,
    syncCommitmentToGoogleCalendar
  } = useApp();

  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'open', 'fulfilled'
  const [syncingId, setSyncingId] = useState(null);
  const [calendarError, setCalendarError] = useState(null);

  const enrichedCommitments = commitments.map(comm => ({
    ...comm,
    attention: calculateAttentionScore(comm, 'commitment')
  })).sort((a, b) => {
    if (a.status === 'fulfilled' && b.status !== 'fulfilled') return 1;
    if (b.status === 'fulfilled' && a.status !== 'fulfilled') return -1;
    return b.attention.score - a.attention.score;
  });

  const filtered = enrichedCommitments.filter(c => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const getSourceIcon = (source) => {
    switch (source) {
      case 'meeting': return Users;
      case 'email': return Mail;
      default: return FileText;
    }
  };

  const handleSyncCommitment = async (commId) => {
    setSyncingId(commId);
    setCalendarError(null);
    try {
      await syncCommitmentToGoogleCalendar(commId);
    } catch (err) {
      setCalendarError(`Google Calendar Sync Error: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            External Commitments & Pledges
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Promises made to recruiters, clients, professors, and stakeholders
          </p>
        </div>

        <button
          id="btn-create-commitment-page"
          onClick={() => {
            setQuickAddType('commitment');
            setIsQuickAddOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Commitment</span>
        </button>
      </div>

      {calendarError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center justify-between gap-2">
          <span>{calendarError}</span>
          <button
            onClick={() => setCalendarError(null)}
            className="text-[11px] text-rose-200 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 text-xs w-fit">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({commitments.length})
        </button>
        <button
          onClick={() => setStatusFilter('open')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            statusFilter === 'open' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Open ({commitments.filter(c => c.status === 'open').length})
        </button>
        <button
          onClick={() => setStatusFilter('fulfilled')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            statusFilter === 'fulfilled' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Fulfilled ({commitments.filter(c => c.status === 'fulfilled').length})
        </button>
      </div>

      {/* Commitments List */}
      <div className="space-y-3.5">
        {filtered.map((comm) => {
          const isFulfilled = comm.status === 'fulfilled';
          const SourceIcon = getSourceIcon(comm.source);
          const hasGoogleSync = Boolean(comm.google_event_id);
          const isSyncing = syncingId === comm.id;

          return (
            <div
              key={comm.id}
              id={`comm-card-${comm.id}`}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isFulfilled
                  ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  : 'bg-slate-900 border-slate-800 shadow-xs hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isFulfilled}
                    onChange={() => toggleCommitmentStatus(comm.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className={`text-sm font-bold ${isFulfilled ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {comm.title}
                      </h3>
                      {!isFulfilled && <RiskBadge risk={comm.attention.risk} score={comm.attention.score} />}
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {comm.importance}
                      </span>

                      {hasGoogleSync && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Google Calendar Synced</span>
                        </span>
                      )}
                    </div>

                    {comm.notes && (
                      <p className="text-xs text-slate-400 mb-2 leading-relaxed">{comm.notes}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        Pledged to: {comm.recipient}
                      </span>

                      <span className="flex items-center gap-1 text-slate-500">
                        <SourceIcon className="w-3.5 h-3.5" />
                        Source: {comm.source}
                      </span>

                      <span className="flex items-center gap-1 text-slate-400 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Due: {new Date(comm.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {/* Google Calendar Action */}
                  {isGoogleConnected && comm.due_date && !isFulfilled && (
                    <div>
                      {hasGoogleSync ? (
                        <div className="flex items-center gap-1.5">
                          {comm.google_event_link && (
                            <a
                              href={comm.google_event_link}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors"
                              title="Open in Google Calendar"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleSyncCommitment(comm.id)}
                            disabled={isSyncing}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>Update</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSyncCommitment(comm.id)}
                          disabled={isSyncing}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{isSyncing ? 'Syncing...' : 'Add to Calendar'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {!isFulfilled && <AttentionMeter score={comm.attention.score} />}
                  <button
                    onClick={() => deleteCommitment(comm.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete Commitment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
