import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { X, CheckSquare, Target, ShieldCheck, Send, Calendar, Clock, User, Sparkles } from 'lucide-react';

export function QuickAddModal() {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    quickAddType,
    setQuickAddType,
    goals,
    addTask,
    addGoal,
    addCommitment,
    addFollowUp
  } = useApp();

  // Task Form State
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    goal_id: '',
    priority: 'high',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    estimated_minutes: 60,
  });

  // Goal Form State
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'career',
    priority: 'high',
    progress_percentage: 0,
    target_date: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
  });

  // Commitment Form State
  const [commForm, setCommForm] = useState({
    title: '',
    recipient: '',
    source: 'manual',
    importance: 'high',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    notes: '',
  });

  // Follow-Up Form State
  const [followUpForm, setFollowUpForm] = useState({
    title: '',
    contact_person: '',
    contact_channel: 'email',
    context: '',
    sent_date: new Date().toISOString().split('T')[0],
    follow_up_due_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
  });

  if (!isQuickAddOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (quickAddType === 'task') {
      if (!taskForm.title.trim()) return;
      addTask(taskForm);
      setTaskForm({
        title: '',
        description: '',
        goal_id: '',
        priority: 'high',
        due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        estimated_minutes: 60,
      });
    } else if (quickAddType === 'goal') {
      if (!goalForm.title.trim()) return;
      addGoal(goalForm);
      setGoalForm({
        title: '',
        description: '',
        category: 'career',
        priority: 'high',
        progress_percentage: 0,
        target_date: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
      });
    } else if (quickAddType === 'commitment') {
      if (!commForm.title.trim()) return;
      addCommitment(commForm);
      setCommForm({
        title: '',
        recipient: '',
        source: 'manual',
        importance: 'high',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        notes: '',
      });
    } else if (quickAddType === 'follow_up') {
      if (!followUpForm.title.trim() || !followUpForm.contact_person.trim()) return;
      addFollowUp(followUpForm);
      setFollowUpForm({
        title: '',
        contact_person: '',
        contact_channel: 'email',
        context: '',
        sent_date: new Date().toISOString().split('T')[0],
        follow_up_due_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      });
    }
    setIsQuickAddOpen(false);
  };

  return (
    <div
      id="quick-add-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => setIsQuickAddOpen(false)}
    >
      <div
        id="quick-add-modal-container"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Quick Record Creation</h2>
          </div>
          <button
            id="btn-close-quick-add"
            onClick={() => setIsQuickAddOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Entity Type Tabs */}
        <div className="p-2 bg-slate-950/60 border-b border-slate-800 grid grid-cols-4 gap-1">
          <button
            type="button"
            id="tab-quick-task"
            onClick={() => setQuickAddType('task')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              quickAddType === 'task'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Task</span>
          </button>

          <button
            type="button"
            id="tab-quick-goal"
            onClick={() => setQuickAddType('goal')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              quickAddType === 'goal'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Goal</span>
          </button>

          <button
            type="button"
            id="tab-quick-commitment"
            onClick={() => setQuickAddType('commitment')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              quickAddType === 'commitment'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Commitment</span>
          </button>

          <button
            type="button"
            id="tab-quick-follow-up"
            onClick={() => setQuickAddType('follow_up')}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              quickAddType === 'follow_up'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Follow-up</span>
          </button>
        </div>

        {/* Dynamic Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {quickAddType === 'task' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement authentication middleware & RLS check"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Link to Goal (Optional)</label>
                  <select
                    value={taskForm.goal_id}
                    onChange={(e) => setTaskForm({ ...taskForm, goal_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">No parent goal (Stand-alone)</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Priority Level</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="critical">Critical (High Attention)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Estimated Duration</label>
                  <select
                    value={taskForm.estimated_minutes}
                    onChange={(e) => setTaskForm({ ...taskForm, estimated_minutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value={15}>15 mins (Quick)</option>
                    <option value={30}>30 mins</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>Half day</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Details / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Context, blockers, or acceptance criteria..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {quickAddType === 'goal' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Goal Outcome *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pass AWS Solutions Architect Certification"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category</label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="career">Career & Job Search</option>
                    <option value="education">Education & Academics</option>
                    <option value="client">Client & Freelance</option>
                    <option value="project">Startup & Projects</option>
                    <option value="personal">Personal & Health</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Completion Date</label>
                  <input
                    type="date"
                    required
                    value={goalForm.target_date}
                    onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Progress ({goalForm.progress_percentage}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={goalForm.progress_percentage}
                  onChange={(e) => setGoalForm({ ...goalForm, progress_percentage: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description & Scope</label>
                <textarea
                  rows={2}
                  placeholder="Define what success looks like for this outcome..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {quickAddType === 'commitment' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Commitment Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Send proposal document to Acme VP"
                  value={commForm.title}
                  onChange={(e) => setCommForm({ ...commForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Promised To (Recipient)</label>
                  <input
                    type="text"
                    placeholder="e.g. David (Client), Prof. Vance"
                    value={commForm.recipient}
                    onChange={(e) => setCommForm({ ...commForm, recipient: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Source / Origin</label>
                  <select
                    value={commForm.source}
                    onChange={(e) => setCommForm({ ...commForm, source: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="meeting">Meeting / Call</option>
                    <option value="email">Email Thread</option>
                    <option value="manual">Personal Promise</option>
                    <option value="slack">Slack / Chat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={commForm.due_date}
                    onChange={(e) => setCommForm({ ...commForm, due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Importance</label>
                  <select
                    value={commForm.importance}
                    onChange={(e) => setCommForm({ ...commForm, importance: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="critical">Critical (Non-negotiable)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notes & Context</label>
                <textarea
                  rows={2}
                  placeholder="Where and why this promise was made..."
                  value={commForm.notes}
                  onChange={(e) => setCommForm({ ...commForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {quickAddType === 'follow_up' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Follow-Up Item *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check on job application status at Stripe"
                  value={followUpForm.title}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Elena Vance (Recruiter)"
                    value={followUpForm.contact_person}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, contact_person: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Channel</label>
                  <select
                    value={followUpForm.contact_channel}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, contact_channel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="phone">Phone / Direct Message</option>
                    <option value="in_person">In Person</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Original Interaction Date</label>
                  <input
                    type="date"
                    required
                    value={followUpForm.sent_date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, sent_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Follow-Up Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpForm.follow_up_due_date}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, follow_up_due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Background Context</label>
                <textarea
                  rows={2}
                  placeholder="What was sent or agreed upon? What are we waiting for?"
                  value={followUpForm.context}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, context: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="btn-cancel-quick-add"
              onClick={() => setIsQuickAddOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-quick-add"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs shadow-indigo-500/20 transition-colors"
            >
              Add {quickAddType === 'task' ? 'Task' : quickAddType === 'goal' ? 'Goal' : quickAddType === 'commitment' ? 'Commitment' : 'Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
