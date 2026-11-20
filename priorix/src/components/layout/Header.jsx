import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { Menu, Plus, ShieldAlert, Sparkles, Plane, Mic } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter.jsx';

export function Header({ setMobileOpen }) {
  const {
    currentRoute,
    overdueCount,
    atRiskCount,
    criticalGmailCount,
    setIsQuickAddOpen,
    setQuickAddType,
    notificationSettings,
    setIsVoiceModalOpen
  } = useApp();

  const getPageTitle = (route) => {
    switch (route) {
      case '/dashboard':
        return { title: 'Executive Dashboard', subtitle: 'Deterministic Attention Queue & Neglect Monitor' };
      case '/tasks':
        return { title: 'Actionable Tasks', subtitle: 'Multi-signal priority ranking and goal-linked execution' };
      case '/goals':
        return { title: 'Outcome Goals', subtitle: 'Target outcome tracking with milestone progress checks' };
      case '/commitments':
        return { title: 'External Commitments', subtitle: 'Promises, deliverables, and client pledges' };
      case '/follow-ups':
        return { title: 'Follow-Up Pipeline & Scanner', subtitle: 'Response tracking, campus placements & deadline monitor' };
      case '/calendar':
        return { title: 'Unified Calendar', subtitle: 'Integrated timeline for deadlines, follow-ups & commitments' };
      case '/settings':
        return { title: 'Settings & Integrations', subtitle: 'Cloud Firestore rules, Google Workspace & Gemini Intelligence' };
      default:
        return { title: 'Priorix Workspace', subtitle: 'Never lose track of what matters' };
    }
  };

  const { title, subtitle } = getPageTitle(currentRoute);
  const totalAttentionAlerts = overdueCount + atRiskCount + (criticalGmailCount || 0);

  const handleQuickAdd = () => {
    let type = 'task';
    if (currentRoute === '/goals') type = 'goal';
    if (currentRoute === '/commitments') type = 'commitment';
    if (currentRoute === '/follow-ups') type = 'follow_up';
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  };

  return (
    <header
      id="app-top-header"
      className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <button
          id="btn-mobile-sidebar-toggle"
          onClick={() => setMobileOpen(prev => !prev)}
          className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            {title}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {notificationSettings?.awayMode && (
          <div
            id="header-away-mode-pill"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700/60 text-amber-300 text-xs font-semibold"
            title="Away Mode active: High priority and deadline alerts are escalated"
          >
            <Plane className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Away Mode</span>
          </div>
        )}

        {totalAttentionAlerts > 0 && (
          <div
            id="header-attention-alert-pill"
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {overdueCount > 0 ? `${overdueCount} overdue` : ''}
              {overdueCount > 0 && (atRiskCount > 0 || criticalGmailCount > 0) ? ', ' : ''}
              {atRiskCount > 0 ? `${atRiskCount} at risk` : ''}
              {atRiskCount > 0 && criticalGmailCount > 0 ? ', ' : ''}
              {criticalGmailCount > 0 ? `${criticalGmailCount} urgent mail` : ''}
            </span>
          </div>
        )}

        {/* Voice Scheduling Assistant */}
        <button
          id="btn-header-voice-assistant"
          onClick={() => setIsVoiceModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold tracking-wide transition-colors"
          title="Voice Scheduling Assistant"
        >
          <Mic className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Voice</span>
        </button>

        {/* Real-Time Notification Center */}
        <NotificationCenter />

        <button
          id="btn-header-quick-add"
          onClick={handleQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold tracking-wide shadow-xs shadow-indigo-600/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Add</span>
        </button>
      </div>
    </header>
  );
}
