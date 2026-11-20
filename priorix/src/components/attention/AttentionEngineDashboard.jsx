import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronRight,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Mail,
  ShieldCheck,
  Send,
  CheckSquare,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Zap,
  Archive,
  FileText,
  UserCheck,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Bell
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export function AttentionEngineDashboard() {
  const {
    gmailFollowUps,
    emailAnalyses,
    notificationSettings,
    triggerAutonomousSync,
    syncEmailToGoogleCalendar,
    updateEmailAnalysisStatus,
    isScanningGmail,
    isGoogleConnected
  } = useApp();

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'URGENT', 'CAREER', 'EDUCATION', 'ACTION_REQUIRED', 'EXPIRED'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showExpiredSection, setShowExpiredSection] = useState(false);
  const [syncingCalendarId, setSyncingCalendarId] = useState(null);
  const [calendarFeedback, setCalendarFeedback] = useState(null);

  // Live 1-second clock ticker for accurate dynamic countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live real-time countdown string
  const formatCountdown = (dateString) => {
    if (!dateString) return null;
    const target = new Date(dateString).getTime();
    const now = currentTime.getTime();
    const diff = target - now;

    if (isNaN(target)) return null;
    if (diff <= 0) return { label: 'Deadline Passed', isPassed: true, isCritical: false, isImminent: false, text: 'Passed' };

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (diff <= 60 * 60 * 1000) {
      // Under 1 hour: Show MM:SS pulsing
      return {
        label: `${pad(mins)}m ${pad(secs)}s left`,
        isPassed: false,
        isCritical: true,
        isImminent: true,
        hoursRemaining: diff / (1000 * 3600),
      };
    }

    if (diff <= 3 * 60 * 60 * 1000) {
      // Under 3 hours
      return {
        label: `${hours}h ${pad(mins)}m ${pad(secs)}s left`,
        isPassed: false,
        isCritical: true,
        isImminent: true,
        hoursRemaining: diff / (1000 * 3600),
      };
    }

    if (days === 0) {
      // Due Today
      return {
        label: `Today (${hours}h ${pad(mins)}m left)`,
        isPassed: false,
        isCritical: false,
        isImminent: true,
        hoursRemaining: diff / (1000 * 3600),
      };
    }

    if (days === 1) {
      return {
        label: `Tomorrow (${hours}h left)`,
        isPassed: false,
        isCritical: false,
        isImminent: false,
        hoursRemaining: diff / (1000 * 3600),
      };
    }

    return {
      label: `${days}d ${hours}h left`,
      isPassed: false,
      isCritical: false,
      isImminent: false,
      hoursRemaining: diff / (1000 * 3600),
    };
  };

  // Consolidate email analyses and live opportunity items
  const consolidatedItems = (() => {
    const itemsMap = new Map();

    for (const analysis of emailAnalyses) {
      const scoring = analysis.scoring || {};
      const ana = analysis.analysis || {};
      const score = scoring.score ?? analysis.priorityScore ?? 50;
      const level = scoring.priorityLevel || analysis.priorityLevel || (score >= 90 ? 'CRITICAL' : score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW');
      
      const category = analysis.category || ana.category || (
        (ana.isCareerRelated || ana.isHiringOrRecruitment) ? 'CAREER' :
        ana.isExamOrEducation ? 'EDUCATION' :
        ana.isPersonalAction ? 'PERSONAL_ACTION' :
        ana.isFinancialAdmin ? 'FINANCIAL_ADMIN' : 'GENERAL_IMPORTANT'
      );

      const deadlineDate = analysis.deadline || ana.deadlineDate;
      const dlMs = deadlineDate ? new Date(deadlineDate).getTime() : NaN;
      const isDeadlinePassed = (!isNaN(dlMs) && dlMs <= currentTime.getTime()) || analysis.status === 'EXPIRED' || analysis.isExpired === true;

      itemsMap.set(analysis.id || analysis.gmailMessageId, {
        id: analysis.id || analysis.gmailMessageId,
        type: 'email',
        originalSubject: analysis.originalSubject || analysis.subject || 'Opportunity',
        sender: analysis.sender || analysis.from || '',
        receivedAt: analysis.receivedAt || '',
        score,
        priorityLevel: level,
        status: isDeadlinePassed ? 'EXPIRED' : (analysis.status || 'ACTIVE'),
        category,
        isCareer: category === 'CAREER',
        isEducation: category === 'EDUCATION',
        isPersonalAction: category === 'PERSONAL_ACTION',
        isFinancialAdmin: category === 'FINANCIAL_ADMIN',
        roles: analysis.roles || ana.detectedRoles || [],
        compensation: analysis.compensation || ana.compensation || ana.stipend || '',
        applicationUrl: analysis.applicationUrl || analysis.actionLink || ana.actionLink || ana.applicationUrl || ana.registrationUrl || '',
        actionType: analysis.actionType || ana.actionType || ana.requiredAction || '',
        requiresAction: !isDeadlinePassed && Boolean(analysis.requiresAction || ana.requiresAction || analysis.applicationUrl || ana.actionLink),
        deadline: deadlineDate,
        deadlineDisplay: ana.deadlineDisplay || (deadlineDate ? new Date(deadlineDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null),
        reason: analysis.geminiReason || analysis.whyThisMatters || ana.reason || ana.summary || (ana.keyReasons || []).join('. '),
        calendarEventId: analysis.calendarEventId || null,
        calendarEventLink: analysis.calendarEventLink || null,
        calendarScheduleKind: analysis.calendarScheduleKind || null,
        completed: Boolean(analysis.completed),
        dismissed: Boolean(analysis.dismissed),
        isDeadlinePassed,
        rawAnalysis: ana,
        rawScoring: scoring
      });
    }

    // Add Gmail follow-ups if not already present
    for (const g of gmailFollowUps) {
      if (!itemsMap.has(g.id)) {
        const dlMs = g.deadlineDate ? new Date(g.deadlineDate).getTime() : NaN;
        const isDeadlinePassed = (!isNaN(dlMs) && dlMs <= currentTime.getTime()) || g.status === 'EXPIRED' || g.isExpired === true;

        itemsMap.set(g.id, {
          id: g.id,
          type: 'email',
          originalSubject: g.subject,
          sender: g.fromName ? `${g.fromName} <${g.fromEmail}>` : g.from,
          receivedAt: g.receivedDate,
          score: g.score || 50,
          priorityLevel: g.priorityLevel || 'MEDIUM',
          status: isDeadlinePassed ? 'EXPIRED' : (g.status || 'ACTIVE'),
          category: g.isPlacementDrive || g.isRecruitment ? 'CAREER' : (g.isAcademicNotice ? 'EDUCATION' : 'GENERAL_IMPORTANT'),
          isCareer: Boolean(g.isPlacementDrive || g.isRecruitment),
          isEducation: Boolean(g.isAcademicNotice),
          isPersonalAction: false,
          isFinancialAdmin: false,
          roles: g.roles || [],
          compensation: g.compensation || g.stipend || '',
          applicationUrl: g.applicationLink || '',
          actionType: g.applicationLink ? 'Complete Application' : '',
          requiresAction: !isDeadlinePassed && Boolean(g.applicationLink),
          deadline: g.deadlineDate || null,
          deadlineDisplay: g.deadlineDisplay || null,
          reason: g.urgencyReason || g.subject,
          calendarEventId: null,
          calendarEventLink: null,
          calendarScheduleKind: null,
          completed: false,
          dismissed: false,
          isDeadlinePassed,
          rawAnalysis: {},
          rawScoring: {}
        });
      }
    }

    return Array.from(itemsMap.values()).filter(i => !i.dismissed && !i.completed);
  })();

  // Separate Active Items vs Expired Items (Expired items strictly excluded from active queues)
  const activeItems = consolidatedItems.filter(i => !i.isDeadlinePassed && i.status !== 'EXPIRED');
  const expiredItems = consolidatedItems.filter(i => i.isDeadlinePassed || i.status === 'EXPIRED');

  // Sort Active Items by Actionable Urgency
  activeItems.sort((a, b) => {
    const levelWeight = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, IGNORE: 1 };
    const weightDiff = (levelWeight[b.priorityLevel] || 1) - (levelWeight[a.priorityLevel] || 1);
    if (weightDiff !== 0) return weightDiff;

    const nowMs = currentTime.getTime();
    const aDl = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bDl = b.deadline ? new Date(b.deadline).getTime() : Infinity;

    if (aDl !== bDl) return aDl - bDl; // earlier deadline first
    if (b.score !== a.score) return b.score - a.score;

    const aRec = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
    const bRec = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
    return bRec - aRec;
  });

  // Hierarchy Sections:
  // 1. Urgent & Expiring: Must be active, deadline in future (0 < diff <= 24h) OR active Critical item with future deadline
  const urgentAndExpiringItems = activeItems.filter(i => {
    if (i.isDeadlinePassed || i.status === 'EXPIRED') return false;
    if (!i.deadline) return i.priorityLevel === 'CRITICAL' && i.requiresAction;
    const diffHours = (new Date(i.deadline).getTime() - currentTime.getTime()) / (1000 * 3600);
    return diffHours > 0 && (diffHours <= 24 || i.priorityLevel === 'CRITICAL');
  });

  // 2. Today / 24 Hours
  const todayItems = activeItems.filter(i => {
    if (!i.deadline) return false;
    const diffHours = (new Date(i.deadline).getTime() - currentTime.getTime()) / (1000 * 3600);
    return diffHours > 0 && diffHours <= 24;
  });

  // 3. High Priority
  const highPriorityItems = activeItems.filter(i => i.priorityLevel === 'HIGH' || (i.score >= 75 && i.score < 90));

  // 4. Career Opportunities
  const careerItems = activeItems.filter(i => i.category === 'CAREER' || i.isCareer);

  // 5. Education & Exams
  const educationItems = activeItems.filter(i => i.category === 'EDUCATION' || i.isEducation);

  // 6. Action Required
  const actionRequiredItems = activeItems.filter(i => i.requiresAction || i.category === 'PERSONAL_ACTION' || Boolean(i.applicationUrl));

  // Filter based on active tab
  const displayItems = (() => {
    switch (activeTab) {
      case 'URGENT': return urgentAndExpiringItems;
      case 'CAREER': return careerItems;
      case 'EDUCATION': return educationItems;
      case 'ACTION_REQUIRED': return actionRequiredItems;
      case 'EXPIRED': return expiredItems;
      default: return activeItems;
    }
  })();

  const handleMarkDone = async (item) => {
    try {
      await updateEmailAnalysisStatus(item, 'COMPLETED');
    } catch (e) {
      console.warn('Failed to mark item done:', e);
    }
  };

  const handleDismiss = async (item) => {
    try {
      await updateEmailAnalysisStatus(item, 'DISMISSED');
    } catch (e) {
      console.warn('Failed to dismiss item:', e);
    }
  };

  const handleSyncToCalendar = async (item) => {
    setSyncingCalendarId(item.id);
    setCalendarFeedback(null);
    try {
      await syncEmailToGoogleCalendar(item);
      setCalendarFeedback({
        type: 'success',
        message: `Added "${item.originalSubject}" to Google Calendar with reminders.`
      });
    } catch (err) {
      setCalendarFeedback({
        type: 'error',
        message: err.message || 'Could not sync reminder to Google Calendar.'
      });
    } finally {
      setSyncingCalendarId(null);
    }
  };

  const renderItemCard = (item, isExpiredCard = false) => {
    const countdown = formatCountdown(item.deadline);

    return (
      <div
        key={item.id}
        id={`attention-card-${item.id}`}
        className={`p-4 rounded-xl border transition-all ${
          isExpiredCard
            ? 'bg-slate-950/40 border-slate-800/60 opacity-75'
            : item.priorityLevel === 'CRITICAL'
            ? 'bg-slate-950/95 border-rose-500/40 shadow-xs shadow-rose-950/30'
            : item.priorityLevel === 'HIGH'
            ? 'bg-slate-950/90 border-amber-500/30 hover:border-amber-500/50'
            : item.isCareer
            ? 'bg-slate-950/80 border-indigo-500/30 hover:border-indigo-500/50'
            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          {/* Left Content */}
          <div className="space-y-2 min-w-0 flex-1">
            {/* Header Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {item.priorityLevel === 'CRITICAL' && (
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400 animate-pulse" />
                  CRITICAL • {item.score}/100
                </span>
              )}
              {item.priorityLevel === 'HIGH' && (
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  HIGH PRIORITY • {item.score}/100
                </span>
              )}
              {item.priorityLevel === 'MEDIUM' && (
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                  MEDIUM • {item.score}/100
                </span>
              )}
              {item.priorityLevel === 'LOW' && (
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/40">
                  LOW • {item.score}/100
                </span>
              )}

              {/* Dynamic Live Countdown */}
              {countdown && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 border ${
                    countdown.isPassed
                      ? 'bg-slate-900 text-slate-500 border-slate-800'
                      : countdown.isCritical
                      ? 'bg-rose-950 text-rose-200 border-rose-700/60 font-bold animate-pulse'
                      : countdown.isImminent
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700/50 font-bold'
                      : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {countdown.label}
                </span>
              )}

              {/* Category Badges */}
              {item.category === 'CAREER' && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-blue-400" />
                  CAREER
                </span>
              )}

              {item.category === 'EDUCATION' && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-purple-400" />
                  EDUCATION & EXAMS
                </span>
              )}

              {item.category === 'PERSONAL_ACTION' && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-800/40 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-teal-400" />
                  PERSONAL ACTION
                </span>
              )}

              {item.category === 'FINANCIAL_ADMIN' && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-emerald-400" />
                  FINANCIAL & ADMIN
                </span>
              )}

              {item.requiresAction && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3 text-amber-400" />
                  ACTION REQUIRED
                </span>
              )}

              {item.calendarEventId ? (
                <a
                  href={item.calendarEventLink || 'https://calendar.google.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1 transition-colors"
                  title="Open reminder event in Google Calendar"
                >
                  <CalendarIcon className="w-3 h-3 text-emerald-400" />
                  <span>{item.calendarScheduleKind === 'FOLLOW_UP_REMINDER' ? 'Reminder in Calendar' : 'Synced to Calendar'}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : null}
            </div>

            {/* Verbatim Original Subject */}
            <h4 className={`text-sm font-bold leading-snug ${isExpiredCard ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
              {item.originalSubject}
            </h4>

            {/* Sender & Source Info */}
            <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-500" />
                From: <strong className="text-slate-300">{item.sender}</strong>
              </span>
              {item.deadlineDisplay && (
                <span className="text-amber-300 font-medium">
                  • Deadline: <strong className="text-amber-200">{item.deadlineDisplay}</strong>
                </span>
              )}
            </p>

            {/* Detected Roles & Compensation */}
            {(item.roles.length > 0 || item.compensation) && (
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
                {item.roles.length > 0 && (
                  <div>
                    <span className="text-slate-400 text-[11px]">Roles: </span>
                    <strong className="text-indigo-300 font-semibold">{item.roles.join(' • ')}</strong>
                  </div>
                )}
                {item.compensation && (
                  <div>
                    <span className="text-slate-400 text-[11px]">Compensation: </span>
                    <strong className="text-emerald-300 font-semibold">{item.compensation}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Grounded Why This Matters / Reason */}
            {item.reason && (
              <p className="text-xs text-slate-300/90 leading-relaxed bg-slate-900/40 p-2 rounded-lg border border-slate-800/40">
                <span className="font-semibold text-slate-200">Why this matters: </span>
                {item.reason}
              </p>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 self-start sm:self-center">
            {item.applicationUrl && (
              <a
                href={item.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors"
              >
                <span>{item.actionType || 'Open Portal'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {isGoogleConnected && !item.calendarEventId && !isExpiredCard && (
              <button
                onClick={() => handleSyncToCalendar(item)}
                disabled={syncingCalendarId === item.id}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/70 text-indigo-300 text-xs font-semibold border border-indigo-700/50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Add this email to Google Calendar with popup reminders"
              >
                <Bell className={`w-3.5 h-3.5 text-indigo-400 ${syncingCalendarId === item.id ? 'animate-pulse' : ''}`} />
                <span>{syncingCalendarId === item.id ? 'Adding...' : 'Add Reminder'}</span>
              </button>
            )}

            <button
              onClick={() => handleMarkDone(item)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-1 transition-colors"
              title="Mark as completed/applied"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Done</span>
            </button>

            <button
              onClick={() => handleDismiss(item)}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-xs transition-colors"
              title="Dismiss from attention queue"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Top Header & Categorized Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">Priorix Opportunity &amp; Attention Engine</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
              URGENCY RANKED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Decides what you need to know right now and what action to take before it is too late.
          </p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'ALL', label: 'All Active', count: activeItems.length, color: 'text-slate-300' },
            { key: 'URGENT', label: 'Urgent & Expiring', count: urgentAndExpiringItems.length, color: 'text-rose-400' },
            { key: 'CAREER', label: 'Career', count: careerItems.length, color: 'text-indigo-400' },
            { key: 'EDUCATION', label: 'Education & Exams', count: educationItems.length, color: 'text-purple-400' },
            { key: 'ACTION_REQUIRED', label: 'Action Required', count: actionRequiredItems.length, color: 'text-amber-400' },
            { key: 'EXPIRED', label: 'Expired', count: expiredItems.length, color: 'text-slate-500' }
          ].map(tab => (
            <button
              key={tab.key}
              id={`tab-attention-${tab.key.toLowerCase()}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${activeTab === tab.key ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Autonomous Ingestion Status Strip */}
      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">Autonomous Monitoring Engine</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active (3-min loop)
              </span>
              {notificationSettings?.autoCalendarSync && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                  Calendar Auto-Sync ON
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Continuously processes Gmail opportunities and synchronizes deadlines independently of browser state.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            id="btn-manual-scan-now"
            onClick={triggerAutonomousSync}
            disabled={isScanningGmail || !isGoogleConnected}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Scan Gmail inbox and sync calendar reminders now"
          >
            <RefreshCw className={`w-3 h-3 text-indigo-400 ${isScanningGmail ? 'animate-spin' : ''}`} />
            <span>{isScanningGmail ? 'Scanning...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {calendarFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            calendarFeedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
          }`}
        >
          <span>{calendarFeedback.message}</span>
          <button
            onClick={() => setCalendarFeedback(null)}
            className="text-[11px] opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: URGENT & EXPIRING HERO BLOCK (Shown when in 'ALL' or 'URGENT' tab) */}
      {(activeTab === 'ALL' || activeTab === 'URGENT') && urgentAndExpiringItems.length > 0 && (
        <div className="space-y-3 p-4 rounded-2xl bg-gradient-to-b from-rose-950/30 to-slate-950 border border-rose-500/30 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
              <h4 className="text-sm font-bold text-rose-200">URGENT &amp; EXPIRING SOON</h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
                {urgentAndExpiringItems.length} ACTION REQUIRED
              </span>
            </div>
            <span className="text-[11px] text-rose-300/80 font-mono">
              Live countdown active
            </span>
          </div>

          <div className="space-y-3">
            {urgentAndExpiringItems.map((item) => renderItemCard(item))}
          </div>
        </div>
      )}

      {/* SECTION 2: ACTIVE QUEUE */}
      {activeTab !== 'URGENT' && activeTab !== 'EXPIRED' && (
        <div className="space-y-3">
          {activeTab === 'ALL' && urgentAndExpiringItems.length > 0 && (
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 pt-2">
              All Active Opportunities &amp; Deadlines ({activeItems.length})
            </h4>
          )}

          {displayItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-400">No items in the {activeTab.replace('_', ' ')} queue.</p>
              <p className="mt-1">Priorix automatically scans your connected Gmail inbox in the background.</p>
            </div>
          ) : (
            displayItems.map((item) => renderItemCard(item))
          )}
        </div>
      )}

      {/* Specific Tab View when in URGENT or EXPIRED */}
      {(activeTab === 'URGENT' || activeTab === 'EXPIRED') && (
        <div className="space-y-3">
          {displayItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-400">No items in {activeTab.replace('_', ' ')}.</p>
            </div>
          ) : (
            displayItems.map((item) => renderItemCard(item, activeTab === 'EXPIRED'))
          )}
        </div>
      )}

      {/* SECTION 9: EXPIRED OPPORTUNITIES SEPARATE ARCHIVE BLOCK */}
      {activeTab === 'ALL' && expiredItems.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => setShowExpiredSection(!showExpiredSection)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-800/80 text-xs font-semibold transition-all"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-500" />
              <span>Expired Opportunities ({expiredItems.length})</span>
              <span className="text-[10px] font-mono text-slate-500">
                (Deadlines passed — removed from active queue)
              </span>
            </div>
            {showExpiredSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showExpiredSection && (
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-slate-800">
              {expiredItems.map((item) => renderItemCard(item, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
