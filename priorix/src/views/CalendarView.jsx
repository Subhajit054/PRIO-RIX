import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Target,
  ShieldCheck,
  Send,
  CheckSquare,
  Clock,
  Plus,
  List,
  Grid,
  Columns3,
  CalendarDays,
  User,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Link2,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { calculateAttentionScore } from '../lib/attentionEngine.js';

export function CalendarView() {
  const {
    tasks,
    goals,
    commitments,
    followUps,
    emailAnalyses,
    isGoogleConnected,
    googleCalendarEvents,
    refreshGoogleCalendarEvents,
    isFetchingCalendar,
    showGoogleCalendarInTimeline,
    setShowGoogleCalendarInTimeline,
    navigate,
    toggleTaskStatus,
    toggleCommitmentStatus,
    setIsQuickAddOpen,
    setQuickAddType
  } = useApp();

  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'agenda'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  // Auto-refresh Google Calendar events on component mount if connected
  useEffect(() => {
    if (isGoogleConnected) {
      refreshGoogleCalendarEvents();
    }
  }, [isGoogleConnected, refreshGoogleCalendarEvents]);

  // Aggregate opportunity deadlines and auto-scheduled email reminders from emailAnalyses
  const opportunityEvents = (emailAnalyses || [])
    .filter(opp => !opp.dismissed && (opp.deadline || opp.deadlineDate || opp.calendarEventId))
    .map(opp => {
      const rawDeadline = opp.deadline || opp.deadlineDate || opp.lastCalendarSyncAt;
      const deadlineDate = new Date(rawDeadline);
      const isPassed = (opp.deadline || opp.deadlineDate)
        ? (!isNaN(deadlineDate.getTime()) && deadlineDate.getTime() <= Date.now())
        : false;
      const score = opp.priorityScore ?? opp.score ?? 75;

      return {
        id: opp.id || opp.gmailMessageId || opp.priorixRecordId || `opp-${rawDeadline}`,
        title: opp.originalSubject || opp.subject || 'Opportunity Deadline',
        description: opp.whyThisMatters || opp.geminiReason || opp.summary || '',
        date: isNaN(deadlineDate.getTime()) ? new Date() : deadlineDate,
        endDate: isNaN(deadlineDate.getTime()) ? null : new Date(deadlineDate.getTime() + 30 * 60 * 1000),
        itemType: 'opportunity',
        isOpportunity: true,
        calendarEventId: opp.calendarEventId || null,
        htmlLink: opp.calendarEventLink || null,
        applicationUrl: opp.applicationUrl || opp.actionLink || null,
        roles: opp.roles || [],
        company: opp.company || opp.jobOrCompanyName || opp.organization || '',
        priorityScore: isPassed ? Math.min(score, 30) : score,
        priorityLevel: isPassed ? 'LOW' : (opp.priorityLevel || (score >= 90 ? 'CRITICAL' : 'HIGH')),
        isPassed,
        status: isPassed ? 'EXPIRED' : (opp.status || 'ACTIVE'),
        urgencyStatus: isPassed ? 'EXPIRED' : (opp.deadlineStatus || 'SCHEDULED'),
        attention: {
          score: isPassed ? 20 : Math.min(100, score),
          risk: isPassed ? 'EXPIRED' : (score >= 90 ? 'HIGH_RISK' : 'MODERATE_RISK'),
          reasons: isPassed ? ['Deadline passed'] : [opp.whyThisMatters || `Priority ${score}/100 opportunity`]
        }
      };
    });

  // Aggregate all dated items from Priorix core entities
  const priorixEntityEvents = [
    ...tasks.filter(t => t.due_date).map(t => ({
      ...t,
      date: new Date(t.due_date),
      itemType: 'task',
      attention: calculateAttentionScore(t, 'task')
    })),
    ...goals.filter(g => g.target_date).map(g => ({
      ...g,
      date: new Date(g.target_date),
      itemType: 'goal',
      attention: calculateAttentionScore(g, 'goal')
    })),
    ...commitments.filter(c => c.due_date).map(c => ({
      ...c,
      date: new Date(c.due_date),
      itemType: 'commitment',
      attention: calculateAttentionScore(c, 'commitment')
    })),
    ...followUps.filter(f => f.follow_up_due_date).map(f => ({
      ...f,
      date: new Date(f.follow_up_due_date),
      itemType: 'follow_up',
      attention: calculateAttentionScore(f, 'follow_up')
    })),
  ];

  // Aggregate Google Calendar external events if connected and enabled
  // Merge or deduplicate with opportunityEvents matching calendarEventId or title
  const externalGoogleEvents = (isGoogleConnected && showGoogleCalendarInTimeline)
    ? (googleCalendarEvents || []).map(ev => {
        // Check if this Google Calendar event corresponds to a known Priorix opportunity
        const matchedOpp = opportunityEvents.find(
          opp => (opp.calendarEventId && opp.calendarEventId === ev.id) ||
                 (opp.title && ev.title && opp.title.toLowerCase().trim() === ev.title.toLowerCase().trim())
        );

        return {
          id: ev.id,
          title: ev.title || matchedOpp?.title || 'Google Calendar Event',
          description: ev.description || matchedOpp?.description || '',
          date: new Date(ev.start),
          endDate: ev.end ? new Date(ev.end) : null,
          itemType: matchedOpp ? 'opportunity' : 'google_calendar_event',
          isGoogleCalendarEvent: true,
          matchedOpportunity: matchedOpp || null,
          applicationUrl: matchedOpp?.applicationUrl || null,
          htmlLink: ev.htmlLink,
          isAllDay: ev.isAllDay,
          organizer: ev.organizer,
          priorityScore: matchedOpp ? matchedOpp.priorityScore : 50,
          priorityLevel: matchedOpp ? matchedOpp.priorityLevel : 'MEDIUM',
          isPassed: matchedOpp ? matchedOpp.isPassed : (new Date(ev.start).getTime() < Date.now()),
          attention: matchedOpp ? matchedOpp.attention : { score: 50, risk: 'LOW_RISK', reasons: ['Google Calendar Scheduled Event'] }
        };
      })
    : [];

  // Deduplicate: If an opportunity is already represented in externalGoogleEvents, don't duplicate it
  const standaloneOpportunities = opportunityEvents.filter(
    opp => !externalGoogleEvents.some(gev => gev.matchedOpportunity?.id === opp.id || gev.id === opp.calendarEventId)
  );

  const allEvents = [...priorixEntityEvents, ...standaloneOpportunities, ...externalGoogleEvents];

  // Helper date functions
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Month navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevPeriod = () => {
    if (viewMode === 'week') {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentDate(prev);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  // Week View Days calculation
  const getWeekDays = () => {
    const current = new Date(currentDate);
    const dayOfWeek = current.getDay();
    const startSunday = new Date(current);
    startSunday.setDate(current.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, idx) => {
      const day = new Date(startSunday);
      day.setDate(startSunday.getDate() + idx);
      return day;
    });
  };

  // Agenda View sorted items
  const agendaEvents = [...allEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedDayEvents = allEvents.filter(e => isSameDay(e.date, selectedDay));

  const getItemTypeBadgeClass = (itemType, isPassed) => {
    if (isPassed) return 'bg-slate-900 text-slate-500 border-slate-800';
    switch (itemType) {
      case 'opportunity': return 'bg-rose-950/80 text-rose-300 border-rose-800/50';
      case 'task': return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/50';
      case 'commitment': return 'bg-purple-950/80 text-purple-300 border-purple-800/50';
      case 'goal': return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/50';
      case 'follow_up': return 'bg-amber-950/80 text-amber-300 border-amber-800/50';
      case 'google_calendar_event': return 'bg-emerald-950/90 text-emerald-300 border-emerald-800/60';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Integrated Execution Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized calendar of Priorix opportunity deadlines, commitments, and Google Calendar events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Google Calendar Controls */}
          {isGoogleConnected ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={showGoogleCalendarInTimeline}
                  onChange={(e) => setShowGoogleCalendarInTimeline(e.target.checked)}
                  className="accent-emerald-500 rounded"
                />
                <span className="text-[11px] font-semibold">Google Calendar ({googleCalendarEvents.length})</span>
              </label>
              <button
                onClick={() => refreshGoogleCalendarEvents()}
                disabled={isFetchingCalendar}
                title="Sync Google Calendar Events"
                className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingCalendar ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Connect Google Calendar</span>
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>

            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'agenda' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          <button
            onClick={() => {
              setQuickAddType('task');
              setIsQuickAddOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Matrix (2 Cols) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-100">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevPeriod}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDay(new Date());
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={nextPeriod}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono font-semibold text-slate-500 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-20 sm:h-24 bg-slate-950/20 rounded-xl border border-transparent" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNumber = idx + 1;
                const dateObj = new Date(year, month, dayNumber);
                const dayEvents = allEvents.filter(e => isSameDay(e.date, dateObj));
                const isSelected = isSameDay(dateObj, selectedDay);
                const isToday = isSameDay(dateObj, new Date());

                return (
                  <div
                    key={`day-${dayNumber}`}
                    onClick={() => setSelectedDay(dateObj)}
                    className={`h-20 sm:h-24 p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-xs ring-1 ring-indigo-500/50'
                        : isToday
                        ? 'bg-slate-850 border-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
                        {dayNumber}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1">
                          {dayEvents.some(e => e.isGoogleCalendarEvent) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Google Calendar Event" />
                          )}
                          {dayEvents.some(e => e.itemType === 'opportunity') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Opportunity Deadline" />
                          )}
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[10px] truncate px-1 py-0.5 rounded font-medium border ${
                            ev.isPassed
                              ? 'bg-slate-900/90 text-slate-500 border-slate-800 line-through'
                              : ev.isGoogleCalendarEvent
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                              : ev.itemType === 'opportunity'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                              : 'bg-slate-800/90 text-slate-300 border-slate-700/60'
                          }`}
                        >
                          {ev.isGoogleCalendarEvent ? `📅 ${ev.title}` : ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-slate-500 font-mono block pl-1">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Inspector (1 Col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'} scheduled
                  </p>
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-400">No events on this day.</p>
                  <p className="mt-1">Scheduled opportunities and tasks will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {selectedDayEvents.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border space-y-2 ${
                        item.isPassed
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-75'
                          : item.isGoogleCalendarEvent
                          ? 'bg-emerald-950/20 border-emerald-800/40'
                          : item.itemType === 'opportunity'
                          ? 'bg-rose-950/20 border-rose-800/40'
                          : 'bg-slate-950/70 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${getItemTypeBadgeClass(item.itemType, item.isPassed)}`}>
                            {item.isPassed ? 'Expired' : item.isGoogleCalendarEvent ? 'Google Calendar' : item.itemType}
                          </span>
                          {item.isGoogleCalendarEvent && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                              Synced
                            </span>
                          )}
                          <h4 className={`text-xs font-bold text-slate-200 truncate ${item.isPassed ? 'line-through text-slate-400' : ''}`}>
                            {item.title}
                          </h4>
                        </div>
                        {!item.isGoogleCalendarEvent && (
                          <RiskBadge risk={item.isPassed ? 'LOW_RISK' : item.attention.risk} score={item.isPassed ? 20 : item.attention.score} />
                        )}
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 italic">{item.description}</p>
                      )}

                      {item.company && (
                        <p className="text-[11px] text-slate-300">Company: <strong>{item.company}</strong></p>
                      )}

                      {item.roles && item.roles.length > 0 && (
                        <p className="text-[10px] text-slate-400 font-mono">Roles: {item.roles.join(', ')}</p>
                      )}

                      {item.applicationUrl && (
                        <div className="pt-1">
                          <a
                            href={item.applicationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            <span>Application Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {item.htmlLink && (
                        <div className="pt-0.5">
                          <a
                            href={item.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            <span>Open in Google Calendar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {item.recipient && (
                        <p className="text-[11px] text-slate-400">Promised to: <strong className="text-slate-300">{item.recipient}</strong></p>
                      )}
                      {item.contact_person && (
                        <p className="text-[11px] text-slate-400">Follow-up with: <strong className="text-slate-300">{item.contact_person}</strong></p>
                      )}

                      {!item.isGoogleCalendarEvent && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                          <span className="text-slate-500 font-mono">Attention: {item.isPassed ? 20 : item.attention.score}/100</span>
                          <AttentionMeter score={item.isPassed ? 20 : item.attention.score} showLabel={false} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => {
                  setQuickAddType('task');
                  setIsQuickAddOpen(true);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Item for This Day</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100">
              Week of {getWeekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {getWeekDays()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={prevPeriod}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                This Week
              </button>
              <button
                onClick={nextPeriod}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {getWeekDays().map((day) => {
              const isToday = isSameDay(day, new Date());
              const dayEvents = allEvents.filter(e => isSameDay(e.date, day));

              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 rounded-xl border flex flex-col min-h-[300px] ${
                    isToday
                      ? 'bg-slate-850 border-indigo-500/50 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                    <span className="text-xs font-bold text-slate-300">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayEvents.length === 0 ? (
                      <p className="text-[11px] text-slate-600 italic text-center pt-8">No events</p>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`p-2 rounded-lg border space-y-1 text-xs ${
                            ev.isPassed
                              ? 'bg-slate-950/60 border-slate-800 text-slate-500'
                              : ev.isGoogleCalendarEvent
                              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                              : ev.itemType === 'opportunity'
                              ? 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded border ${getItemTypeBadgeClass(ev.itemType, ev.isPassed)}`}>
                              {ev.isPassed ? 'Expired' : ev.isGoogleCalendarEvent ? 'Google' : ev.itemType}
                            </span>
                            {!ev.isGoogleCalendarEvent && (
                              <RiskBadge risk={ev.isPassed ? 'LOW_RISK' : ev.attention.risk} score={ev.isPassed ? 20 : ev.attention.score} />
                            )}
                          </div>
                          <p className={`font-semibold text-slate-200 text-[11px] leading-tight line-clamp-2 ${ev.isPassed ? 'line-through text-slate-500' : ''}`}>
                            {ev.title}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA / LIST VIEW */}
      {viewMode === 'agenda' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100">
              Chronological Execution Agenda ({agendaEvents.length} scheduled items)
            </h3>
          </div>

          {agendaEvents.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-400">No scheduled events or deadlines found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {agendaEvents.map((ev) => {
                const isPast = ev.date < new Date() && !isSameDay(ev.date, new Date());
                const isToday = isSameDay(ev.date, new Date());

                return (
                  <div
                    key={ev.id}
                    className={`py-3.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      ev.isPassed || isPast ? 'bg-slate-950/40 opacity-75' : isToday ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-14 text-center shrink-0">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">
                          {ev.date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className={`text-sm font-bold font-mono ${isToday ? 'text-indigo-400' : 'text-slate-200'}`}>
                          {ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${getItemTypeBadgeClass(ev.itemType, ev.isPassed)}`}>
                            {ev.isPassed ? 'Expired' : ev.isGoogleCalendarEvent ? 'Google Calendar' : ev.itemType}
                          </span>
                          <span className={`text-xs sm:text-sm font-bold text-slate-100 truncate ${ev.isPassed ? 'line-through text-slate-500' : ''}`}>
                            {ev.title}
                          </span>
                          {!ev.isGoogleCalendarEvent && (
                            <RiskBadge risk={ev.isPassed ? 'LOW_RISK' : ev.attention.risk} score={ev.isPassed ? 20 : ev.attention.score} />
                          )}
                        </div>

                        {ev.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">{ev.description}</p>
                        )}
                        {ev.company && (
                          <p className="text-[11px] text-slate-300">Company: {ev.company}</p>
                        )}
                        {ev.roles && ev.roles.length > 0 && (
                          <p className="text-[10px] text-slate-400 font-mono">Roles: {ev.roles.join(', ')}</p>
                        )}
                        {ev.recipient && (
                          <p className="text-[11px] text-indigo-300">Pledged to: {ev.recipient}</p>
                        )}
                        {ev.contact_person && (
                          <p className="text-[11px] text-indigo-300">Contact: {ev.contact_person}</p>
                        )}
                        {ev.applicationUrl && (
                          <a
                            href={ev.applicationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold mr-3"
                          >
                            <span>Application Link</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            <span>Open Google Calendar Event</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      {!ev.isGoogleCalendarEvent && (
                        <AttentionMeter score={ev.isPassed ? 20 : ev.attention.score} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
