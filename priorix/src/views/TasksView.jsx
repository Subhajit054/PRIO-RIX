import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Trash2,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Link2
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { calculateAttentionScore, RISK_LEVELS } from '../lib/attentionEngine.js';

export function TasksView() {
  const {
    tasks,
    goals,
    toggleTaskStatus,
    deleteTask,
    setIsQuickAddOpen,
    setQuickAddType,
    isGoogleConnected,
    syncTaskToGoogleCalendar,
    removeTaskFromGoogleCalendar
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'completed'
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [goalFilter, setGoalFilter] = useState('all');
  const [syncingTaskId, setSyncingTaskId] = useState(null);
  const [calendarError, setCalendarError] = useState(null);
  const [confirmRemoveCalendarId, setConfirmRemoveCalendarId] = useState(null);

  // Compute attention ranking for all tasks
  const enrichedTasks = tasks.map(task => ({
    ...task,
    attention: calculateAttentionScore(task, 'task')
  })).sort((a, b) => {
    // Completed tasks to the bottom, then sorted by attention score
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return b.attention.score - a.attention.score;
  });

  const filteredTasks = enrichedTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesGoal = goalFilter === 'all' || task.goal_id === goalFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesGoal;
  });

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const handleSyncToCalendar = async (taskId) => {
    setSyncingTaskId(taskId);
    setCalendarError(null);
    try {
      await syncTaskToGoogleCalendar(taskId);
    } catch (err) {
      setCalendarError(`Google Calendar Sync Error: ${err.message}`);
    } finally {
      setSyncingTaskId(null);
    }
  };

  const handleRemoveFromCalendar = async (taskId) => {
    setSyncingTaskId(taskId);
    setCalendarError(null);
    try {
      await removeTaskFromGoogleCalendar(taskId);
      setConfirmRemoveCalendarId(null);
    } catch (err) {
      console.error(err);
      setCalendarError(err.message || 'Could not remove task from Google Calendar.');
    } finally {
      setSyncingTaskId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Actionable Tasks
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {pendingCount} active task{pendingCount === 1 ? '' : 's'} • {completedCount} completed
          </p>
        </div>

        <button
          id="btn-create-task-page"
          onClick={() => {
            setQuickAddType('task');
            setIsQuickAddOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
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

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Goal Filter */}
        <select
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
        >
          <option value="all">All Linked Goals</option>
          {goals.map(g => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      </div>

      {/* Task List / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-400">No tasks found matching your filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isSyncing = syncingTaskId === task.id;
              const hasGoogleSync = Boolean(task.google_event_id);

              return (
                <div
                  key={task.id}
                  id={`task-row-${task.id}`}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isCompleted ? 'bg-slate-950/40 opacity-70' : 'hover:bg-slate-850/40'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={() => toggleTaskStatus(task.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                          {task.title}
                        </span>
                        {!isCompleted && <RiskBadge risk={task.attention.risk} score={task.attention.score} />}
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                          {task.priority}
                        </span>

                        {hasGoogleSync && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Google Calendar Synced</span>
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 mb-1.5 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {task.goal_title && (
                          <span className="text-indigo-400 font-medium">Goal: {task.goal_title}</span>
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            Due: {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.attention.reasons?.map((reason, idx) => (
                          <span key={idx} className="text-rose-300/80">• {reason}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {/* Google Calendar Action */}
                    {isGoogleConnected && task.due_date && !isCompleted && (
                      <div>
                        {hasGoogleSync ? (
                          <div className="flex items-center gap-1.5">
                            {task.google_event_link && (
                              <a
                                href={task.google_event_link}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors"
                                title="Open in Google Calendar"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleSyncToCalendar(task.id)}
                              disabled={isSyncing}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-colors flex items-center gap-1"
                              title="Update Google Calendar Event"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              <span>Update</span>
                            </button>
                            {confirmRemoveCalendarId === task.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRemoveFromCalendar(task.id)}
                                  disabled={isSyncing}
                                  className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold"
                                >
                                  Remove
                                </button>
                                <button
                                  onClick={() => setConfirmRemoveCalendarId(null)}
                                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRemoveCalendarId(task.id)}
                                disabled={isSyncing}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors text-[10px]"
                                title="Remove from Calendar"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSyncToCalendar(task.id)}
                            disabled={isSyncing}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            title="Add this task to your Google Calendar"
                          >
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{isSyncing ? 'Syncing...' : 'Add to Calendar'}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {!isCompleted && <AttentionMeter score={task.attention.score} />}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
