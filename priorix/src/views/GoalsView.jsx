import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  Target,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  AlertTriangle,
  Flame,
  TrendingUp,
  Layers
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { calculateAttentionScore, RISK_LEVELS } from '../lib/attentionEngine.js';
import { NaturalLanguageGoalScheduler } from '../components/goals/NaturalLanguageGoalScheduler.jsx';

export function GoalsView() {
  const {
    goals,
    tasks,
    updateGoalProgress,
    deleteGoal,
    setIsQuickAddOpen,
    setQuickAddType
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState('all');

  const enrichedGoals = goals.map(goal => ({
    ...goal,
    attention: calculateAttentionScore(goal, 'goal'),
    linkedTasks: tasks.filter(t => t.goal_id === goal.id)
  }));

  const filteredGoals = enrichedGoals.filter(goal => {
    if (categoryFilter === 'all') return true;
    return goal.category === categoryFilter;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Outcome Goals
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            High-level objectives with milestone tracking and inactivity neglect detection
          </p>
        </div>

        <button
          id="btn-create-goal-page"
          onClick={() => {
            setQuickAddType('goal');
            setIsQuickAddOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Natural Language Goal & Schedule Creator */}
      <NaturalLanguageGoalScheduler />

      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 text-xs overflow-x-auto">
        {['all', 'career', 'education', 'client', 'project', 'personal'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg capitalize font-medium whitespace-nowrap transition-colors ${
              categoryFilter === cat ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat === 'all' ? 'All Goals' : cat}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredGoals.map((goal) => {
          const completedTasksCount = goal.linkedTasks.filter(t => t.status === 'completed').length;
          const totalTasksCount = goal.linkedTasks.length;
          const daysSinceProgress = goal.last_progress_date
            ? Math.abs(Math.round((new Date() - new Date(goal.last_progress_date)) / (1000 * 60 * 60 * 24)))
            : 0;
          const isNeglected = daysSinceProgress >= 14;

          return (
            <div
              key={goal.id}
              id={`goal-card-${goal.id}`}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                      {goal.category}
                    </span>
                    <RiskBadge risk={goal.attention.risk} score={goal.attention.score} />
                  </div>
                  <AttentionMeter score={goal.attention.score} />
                </div>

                <h3 className="text-base font-bold text-slate-100 mb-1.5">
                  {goal.title}
                </h3>
                {goal.description && (
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    {goal.description}
                  </p>
                )}

                {/* Progress bar and control */}
                <div className="space-y-1.5 my-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Progress</span>
                    <span className="font-mono font-bold text-indigo-400">{goal.progress_percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress_percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={goal.progress_percentage}
                      onChange={(e) => updateGoalProgress(goal.id, e.target.value)}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Neglect Diagnostics */}
                {isNeglected && (
                  <div className="p-2.5 rounded-lg bg-orange-950/30 border border-orange-800/40 text-[11px] text-orange-300 flex items-center gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>No progress recorded in {daysSinceProgress} days. Flagged by neglect engine.</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    {totalTasksCount > 0 ? `${completedTasksCount}/${totalTasksCount} tasks` : 'No tasks linked'}
                  </span>
                  {goal.target_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Target: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Delete Goal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
