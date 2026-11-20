import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Target,
  ShieldCheck,
  Send,
  Calendar as CalendarIcon,
  ChevronRight,
  Sparkles,
  Info,
  CheckSquare,
  AlertCircle,
  Loader2,
  Mail,
  Briefcase,
  ExternalLink,
  RefreshCw,
  Mic
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { AttentionEngineDashboard } from '../components/attention/AttentionEngineDashboard.jsx';
import { RISK_LEVELS } from '../lib/attentionEngine.js';

export function DashboardView() {
  const {
    user,
    unifiedAttentionQueue,
    goals,
    tasks,
    commitments,
    followUps,
    activityLogs,
    overdueCount,
    atRiskCount,
    neglectedCount,
    criticalGmailCount,
    gmailFollowUps,
    isGoogleConnected,
    scanGmail,
    isScanningGmail,
    toggleTaskStatus,
    toggleCommitmentStatus,
    setIsQuickAddOpen,
    setQuickAddType,
    setIsVoiceModalOpen,
    navigate,
    isDataLoading
  } = useApp();

  const { currentUser } = useAuth();
  const [queueFilter, setQueueFilter] = useState('all'); // 'all', 'overdue', 'at_risk', 'neglected'

  // Filter the attention queue
  const filteredQueue = unifiedAttentionQueue.filter(item => {
    if (queueFilter === 'overdue') return item.attention.risk === RISK_LEVELS.OVERDUE;
    if (queueFilter === 'at_risk') return item.attention.risk === RISK_LEVELS.AT_RISK;
    if (queueFilter === 'neglected') return item.attention.risk === RISK_LEVELS.NEGLECTED;
    return true;
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getItemTypeIcon = (type) => {
    switch (type) {
      case 'goal': return Target;
      case 'commitment': return ShieldCheck;
      case 'follow_up': return Send;
      case 'task':
      default: return CheckSquare;
    }
  };

  const displayName = user?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Greeting & Executive Today Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-indigo-400 tracking-wider font-semibold">
            <span>Execution Workspace</span>
            <span>•</span>
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight mt-1">
            {getGreeting()}, {displayName.split(' ')[0]}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            What needs your attention right now?
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            id="btn-voice-schedule-dash"
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 font-semibold text-xs border border-slate-800 hover:border-indigo-500/40 flex items-center gap-1.5 transition-colors"
            title="Voice Scheduling Assistant"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            <span>Voice Schedule</span>
          </button>

          <button
            id="btn-quick-add-task-dash"
            onClick={() => {
              setQuickAddType('task');
              setIsQuickAddOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>

          <button
            id="btn-quick-add-followup-dash"
            onClick={() => {
              setQuickAddType('follow_up');
              setIsQuickAddOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/80 flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Follow-up</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Pulse Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          id="card-kpi-overdue"
          onClick={() => setQueueFilter(queueFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            queueFilter === 'overdue'
              ? 'bg-rose-950/30 border-rose-500/50 shadow-xs ring-1 ring-rose-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Overdue Items</span>
            <Flame className={`w-4 h-4 ${overdueCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{overdueCount}</div>
          <p className="text-[11px] text-rose-400 mt-1">Requires immediate resolution</p>
        </div>

        <div
          id="card-kpi-at-risk"
          onClick={() => setQueueFilter(queueFilter === 'at_risk' ? 'all' : 'at_risk')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            queueFilter === 'at_risk'
              ? 'bg-amber-950/30 border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">At-Risk Deadlines</span>
            <AlertTriangle className={`w-4 h-4 ${atRiskCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{atRiskCount}</div>
          <p className="text-[11px] text-amber-300 mt-1">High attention score (&gt;80)</p>
        </div>

        <div
          id="card-kpi-neglected"
          onClick={() => setQueueFilter(queueFilter === 'neglected' ? 'all' : 'neglected')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            queueFilter === 'neglected'
              ? 'bg-orange-950/30 border-orange-500/50 shadow-xs ring-1 ring-orange-500/30'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Neglected Work</span>
            <Clock className={`w-4 h-4 ${neglectedCount > 0 ? 'text-orange-400' : 'text-slate-500'}`} />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">{neglectedCount}</div>
          <p className="text-[11px] text-orange-400 mt-1">Untouched &gt;7-14 days</p>
        </div>

        <div
          id="card-kpi-commitments"
          onClick={() => navigate('/commitments')}
          className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Open Commitments</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {commitments.filter(c => c.status === 'open').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">External promises tracked</p>
        </div>
      </div>

      {/* Main Grid: Attention Queue (Left 2 cols) & Goals / Activity (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Attention Queue & Gmail Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          {/* Priorix Attention Engine Section with 6 priority tabs */}
          <AttentionEngineDashboard />

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-100">The Attention Queue</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ranked by multi-signal priority model (Deadline, Deficit, Neglect)
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80 text-xs">
                <button
                  id="filter-queue-all"
                  onClick={() => setQueueFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    queueFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({unifiedAttentionQueue.length})
                </button>
                <button
                  id="filter-queue-overdue"
                  onClick={() => setQueueFilter('overdue')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    queueFilter === 'overdue' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Overdue ({overdueCount})
                </button>
                <button
                  id="filter-queue-at-risk"
                  onClick={() => setQueueFilter('at_risk')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    queueFilter === 'at_risk' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  At Risk ({atRiskCount})
                </button>
                <button
                  id="filter-queue-neglected"
                  onClick={() => setQueueFilter('neglected')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    queueFilter === 'neglected' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Neglected ({neglectedCount})
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div className="divide-y divide-slate-800/80 mt-1">
              {filteredQueue.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-400">No items match this attention filter.</p>
                  <p className="mt-1">Use the "New Task" or "Quick Add" button above to track your upcoming work.</p>
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const TypeIcon = getItemTypeIcon(item.itemType);
                  return (
                    <div
                      key={`${item.itemType}-${item.id}`}
                      id={`queue-item-${item.itemType}-${item.id}`}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/40 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.itemType === 'task' ? (
                          <input
                            type="checkbox"
                            checked={item.status === 'completed'}
                            onChange={() => toggleTaskStatus(item.id)}
                            className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        ) : item.itemType === 'commitment' ? (
                          <input
                            type="checkbox"
                            checked={item.status === 'fulfilled'}
                            onChange={() => toggleCommitmentStatus(item.id)}
                            className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        ) : (
                          <div className="mt-1 w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-slate-400">
                            <TypeIcon className="w-3 h-3" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-100 truncate">
                              {item.title}
                            </span>
                            <RiskBadge risk={item.attention.risk} score={item.attention.score} />
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                              {item.itemType}
                            </span>
                          </div>

                          {/* Rationale & Entity context */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            {item.recipient && <span>To: <strong className="text-slate-300">{item.recipient}</strong></span>}
                            {item.contact_person && <span>With: <strong className="text-slate-300">{item.contact_person}</strong></span>}
                            {item.goal_title && <span>Goal: <strong className="text-slate-300">{item.goal_title}</strong></span>}
                            
                            {item.attention.reasons?.map((reason, idx) => (
                              <span key={idx} className="text-rose-300/90 font-medium">
                                • {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Score Meter & Quick Action */}
                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <AttentionMeter score={item.attention.score} />
                        <button
                          onClick={() => {
                            if (item.itemType === 'task') navigate('/tasks');
                            else if (item.itemType === 'commitment') navigate('/commitments');
                            else if (item.itemType === 'follow_up') navigate('/follow-ups');
                            else if (item.itemType === 'goal') navigate('/goals');
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Deadlines Agenda */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Upcoming Deadlines & Pledges (Next 7 Days)</h3>
              </div>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <span>Full Calendar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unifiedAttentionQueue
                .filter(i => i.attention.daysUntilDue !== null && i.attention.daysUntilDue >= 0 && i.attention.daysUntilDue <= 7)
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={`upcoming-${item.itemType}-${item.id}`}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                          {item.itemType}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {item.attention.daysUntilDue === 0
                          ? 'Due Today'
                          : item.attention.daysUntilDue === 1
                          ? 'Due Tomorrow'
                          : `Due in ${item.attention.daysUntilDue} days`}
                      </p>
                    </div>
                    <AttentionMeter score={item.attention.score} showLabel={false} />
                  </div>
                ))}
              {unifiedAttentionQueue.filter(i => i.attention.daysUntilDue !== null && i.attention.daysUntilDue >= 0 && i.attention.daysUntilDue <= 7).length === 0 && (
                <p className="text-xs text-slate-500 col-span-2 py-4 text-center">No approaching deadlines in the next 7 days.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Goal Progress & Activity Stream */}
        <div className="space-y-6">
          {/* Goal Progress Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Active Outcome Goals</h3>
              </div>
              <button
                onClick={() => navigate('/goals')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Manage ({goals.length})
              </button>
            </div>

            <div className="space-y-3.5">
              {goals.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No goals created yet. Click Quick Add above to create one.</p>
              ) : (
                goals.map((goal) => {
                  const isGoalNeglected = goal.last_progress_date &&
                    Math.abs((new Date() - new Date(goal.last_progress_date)) / (1000 * 60 * 60 * 24)) >= 14;

                  return (
                    <div
                      key={goal.id}
                      id={`goal-widget-${goal.id}`}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-xs font-bold text-slate-200 leading-snug">
                          {goal.title}
                        </h4>
                        <span className="text-xs font-mono font-semibold text-indigo-400">
                          {goal.progress_percentage}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${goal.progress_percentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="capitalize">{goal.category}</span>
                        {isGoalNeglected ? (
                          <span className="text-orange-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Neglected (&gt;14d)
                          </span>
                        ) : (
                          <span>Target: {goal.target_date ? new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No target date'}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Activity Log Audit Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Recent Activity</h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">LIVE</span>
            </div>

            <div className="space-y-2.5">
              {activityLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No recent activity logged yet.</p>
              ) : (
                activityLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-xs p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60">
                    <p className="text-slate-300 font-medium leading-relaxed">{log.summary}</p>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.action_type?.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
