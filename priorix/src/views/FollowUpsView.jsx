import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  Send,
  Plus,
  Calendar,
  Clock,
  User,
  Trash2,
  CheckCircle2,
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Eye,
  ExternalLink,
  Check,
  AlertCircle,
  AlertTriangle,
  Flame,
  Building,
  Briefcase,
  DollarSign,
  FileText,
  Filter,
  GraduationCap,
  Bell
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { AttentionMeter } from '../components/common/AttentionMeter.jsx';
import { calculateAttentionScore } from '../lib/attentionEngine.js';

export function FollowUpsView() {
  const {
    followUps,
    emailAnalyses,
    addFollowUp,
    updateFollowUpStatus,
    deleteFollowUp,
    setIsQuickAddOpen,
    setQuickAddType,
    isGoogleConnected,
    gmailFollowUps,
    scanGmail,
    isScanningGmail,
    convertGmailToPriorixFollowUp,
    syncEmailToGoogleCalendar,
    navigate
  } = useApp();

  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'gmail'
  const [pipelineCategoryFilter, setPipelineCategoryFilter] = useState('all'); // 'all', 'career', 'deadlines', 'direct'
  const [gmailCategoryFilter, setGmailCategoryFilter] = useState('all'); // 'all', 'critical', 'career', 'deadlines'
  const [convertingId, setConvertingId] = useState(null);
  const [syncingCalendarId, setSyncingCalendarId] = useState(null);
  const [calendarFeedback, setCalendarFeedback] = useState(null);

  // Build unified priority opportunities list from analyzed emails & detected gmail follow-ups
  const emailOpportunities = (() => {
    const map = new Map();

    for (const ea of emailAnalyses) {
      const scoring = ea.scoring || {};
      const ana = ea.analysis || {};
      const score = scoring.score ?? ea.priorityScore ?? 50;
      const level = scoring.priorityLevel || ea.priorityLevel || (score >= 90 ? 'CRITICAL' : score >= 75 ? 'HIGH' : 'MEDIUM');
      const isCareer = ea.category === 'CAREER' || ana.isCareerRelated || ana.isHiringOrRecruitment;
      const isEducation = ea.category === 'EDUCATION' || ana.isExamOrEducation;
      const deadline = ea.deadline || ana.deadlineDate;
      const isPassed = deadline ? new Date(deadline).getTime() < Date.now() : false;

      // Only include active opportunities that meet priority criteria
      if (!ea.dismissed && !ea.completed && !isPassed && (score >= 75 || level === 'CRITICAL' || level === 'HIGH' || isCareer || isEducation)) {
        map.set(ea.id || ea.gmailMessageId, {
          id: ea.id || ea.gmailMessageId,
          itemType: 'opportunity',
          title: ea.originalSubject || ea.subject || 'Actionable Opportunity',
          sender: ea.sender || ea.from || '',
          score,
          priorityLevel: level,
          category: isCareer ? 'CAREER' : isEducation ? 'EDUCATION' : 'GENERAL',
          isCareer,
          isEducation,
          roles: ea.roles || ana.detectedRoles || [],
          compensation: ea.compensation || ana.compensation || '',
          applicationUrl: ea.applicationUrl || ea.actionLink || ana.actionLink || '',
          deadline,
          deadlineDisplay: ana.deadlineDisplay || (deadline ? new Date(deadline).toLocaleDateString() : null),
          reason: ea.geminiReason || ea.whyThisMatters || ana.reason || '',
          receivedAt: ea.receivedAt || '',
          calendarEventId: ea.calendarEventId || null,
          calendarEventLink: ea.calendarEventLink || null,
          rawAnalysis: ana,
          rawScoring: scoring,
        });
      }
    }

    for (const g of gmailFollowUps) {
      if (!map.has(g.id)) {
        const isPassed = g.deadlineDate ? new Date(g.deadlineDate).getTime() < Date.now() : false;
        const isPriority = g.score >= 75 || g.priorityLevel === 'CRITICAL' || g.priorityLevel === 'HIGH' || g.isPlacementDrive || g.isAcademicNotice;
        if (!isPassed && isPriority) {
          map.set(g.id, {
            id: g.id,
            itemType: 'opportunity',
            title: g.subject,
            sender: g.fromName ? `${g.fromName} <${g.fromEmail}>` : g.from,
            score: g.score || 75,
            priorityLevel: g.priorityLevel || 'HIGH',
            category: g.isPlacementDrive ? 'CAREER' : g.isAcademicNotice ? 'EDUCATION' : 'GENERAL',
            isCareer: Boolean(g.isPlacementDrive),
            isEducation: Boolean(g.isAcademicNotice),
            roles: g.roles || [],
            compensation: g.compensation || '',
            applicationUrl: g.applicationLink || '',
            deadline: g.deadlineDate || null,
            deadlineDisplay: g.deadlineDisplay || null,
            reason: g.urgencyReason || g.subject,
            receivedAt: g.receivedDate || '',
          });
        }
      }
    }

    return Array.from(map.values());
  })();

  // Direct manual follow-ups
  const directFollowUps = followUps.map(f => {
    const daysWaiting = f.sent_date
      ? Math.abs(Math.round((new Date() - new Date(f.sent_date)) / (1000 * 60 * 60 * 24)))
      : 0;
    return {
      ...f,
      itemType: 'follow_up',
      daysWaiting,
      attention: calculateAttentionScore(f, 'follow_up')
    };
  });

  const activeDirectFollowUps = directFollowUps.filter(f => f.status === 'waiting' || f.status === 'follow_up_due');

  // Unified Priority Pipeline
  const unifiedPipeline = [
    ...emailOpportunities,
    ...activeDirectFollowUps
  ].sort((a, b) => {
    const scoreA = a.score ?? a.attention?.score ?? 50;
    const scoreB = b.score ?? b.attention?.score ?? 50;
    return scoreB - scoreA;
  });

  const filteredPipeline = unifiedPipeline.filter(item => {
    if (pipelineCategoryFilter === 'career') return item.category === 'CAREER' || item.isCareer;
    if (pipelineCategoryFilter === 'deadlines') return item.deadline || item.isEducation;
    if (pipelineCategoryFilter === 'direct') return item.itemType === 'follow_up';
    return true;
  });

  const filteredGmail = gmailFollowUps.filter(item => {
    if (gmailCategoryFilter === 'critical') return item.priorityLevel === 'CRITICAL' || item.score >= 80;
    if (gmailCategoryFilter === 'career') return item.badges?.includes('CAREER OPPORTUNITY') || item.detectedRoles?.length > 0;
    if (gmailCategoryFilter === 'deadlines') return item.deadlineDate !== null;
    return true;
  });

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'linkedin': return Linkedin;
      case 'phone': return Phone;
      case 'in_person': return User;
      case 'email':
      default: return Mail;
    }
  };

  const handleConvertGmail = async (item) => {
    setConvertingId(item.id);
    try {
      await convertGmailToPriorixFollowUp(item);
    } catch (err) {
      console.error('Error converting Gmail item:', err);
    } finally {
      setConvertingId(null);
    }
  };

  const handleSyncEmailToCalendar = async (item) => {
    setSyncingCalendarId(item.id);
    setCalendarFeedback(null);
    try {
      await syncEmailToGoogleCalendar(item);
      setCalendarFeedback({
        type: 'success',
        message: `Added "${item.title || item.subject}" to Google Calendar with reminders.`
      });
    } catch (err) {
      setCalendarFeedback({
        type: 'error',
        message: err.message || 'Could not add reminder to Google Calendar.'
      });
    } finally {
      setSyncingCalendarId(null);
    }
  };

  const totalScannedCount = Math.max(gmailFollowUps.length, emailAnalyses.length);
  const criticalCount = unifiedPipeline.filter(i => (i.score >= 90 || i.priorityLevel === 'CRITICAL')).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Follow-Up Pipeline & Scanner
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track high-priority inbox opportunities, campus placement drives, explicit deadlines, and outbound client follow-ups
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isGoogleConnected && (
            <button
              id="btn-scan-gmail-header"
              onClick={() => {
                setActiveTab('gmail');
                scanGmail();
              }}
              disabled={isScanningGmail}
              className="px-3.5 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningGmail ? 'animate-spin' : ''}`} />
              <span>{isScanningGmail ? 'Scanning Gmail...' : 'Scan Gmail'}</span>
            </button>
          )}

          <button
            id="btn-create-followup-page"
            onClick={() => {
              setQuickAddType('follow_up');
              setIsQuickAddOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shadow-indigo-600/30 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Follow-Up</span>
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
          <div className="flex items-center gap-2">
            {calendarFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{calendarFeedback.message}</span>
          </div>
          <button
            onClick={() => setCalendarFeedback(null)}
            className="text-[11px] opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Scanned Inbound</span>
            <Mail className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-slate-100 font-mono">{totalScannedCount}</p>
          <p className="text-[11px] text-slate-500">Inbox messages analyzed</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-indigo-900/40 space-y-1">
          <div className="flex items-center justify-between text-indigo-300 text-xs">
            <span>Priority Pipeline</span>
            <Send className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-indigo-200 font-mono">{unifiedPipeline.length}</p>
          <p className="text-[11px] text-slate-500">Actionable items waiting</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-900/40 space-y-1">
          <div className="flex items-center justify-between text-rose-300 text-xs">
            <span>Critical / Urgent</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-300 font-mono">{criticalCount}</p>
          <p className="text-[11px] text-slate-500">Score &ge; 90 / Imminent</p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-blue-900/40 space-y-1">
          <div className="flex items-center justify-between text-blue-300 text-xs">
            <span>Career &amp; Placement</span>
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-blue-200 font-mono">{emailOpportunities.filter(i => i.isCareer).length}</p>
          <p className="text-[11px] text-slate-500">Hiring &amp; drive notices</p>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          id="tab-btn-pipeline"
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'pipeline'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Priority Pipeline</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950/80 text-[10px] font-mono font-bold text-indigo-300">
            {unifiedPipeline.length}
          </span>
        </button>

        <button
          id="tab-btn-gmail"
          onClick={() => setActiveTab('gmail')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'gmail'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-amber-400" />
          <span>Gmail Scanner &amp; Inbox Analysis</span>
          {totalScannedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/40 text-[10px] font-mono font-bold flex items-center gap-1">
              <span>{totalScannedCount} scanned</span>
              {criticalCount > 0 && (
                <span className="text-[9px] bg-rose-500/80 text-white px-1 rounded-full">
                  {criticalCount} urgent
                </span>
              )}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: UNIFIED PRIORITY PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Sub-filter pills */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 text-xs w-fit flex-wrap">
            <button
              onClick={() => setPipelineCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                pipelineCategoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Priority Items ({unifiedPipeline.length})
            </button>
            <button
              onClick={() => setPipelineCategoryFilter('career')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                pipelineCategoryFilter === 'career' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Career &amp; Placement ({unifiedPipeline.filter(i => i.category === 'CAREER' || i.isCareer).length})
            </button>
            <button
              onClick={() => setPipelineCategoryFilter('deadlines')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                pipelineCategoryFilter === 'deadlines' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deadlines &amp; Academic ({unifiedPipeline.filter(i => i.deadline || i.isEducation).length})
            </button>
            <button
              onClick={() => setPipelineCategoryFilter('direct')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                pipelineCategoryFilter === 'direct' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Direct Follow-Ups ({activeDirectFollowUps.length})
            </button>
          </div>

          {/* Cards */}
          {filteredPipeline.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
              <Send className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-400 text-xs">No active pipeline items in this view.</p>
              <p className="text-[11px] text-slate-500 mt-1">Scan Gmail or add manual follow-ups to populate your priority pipeline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPipeline.map((item) => {
                if (item.itemType === 'opportunity') {
                  return (
                    <div
                      key={item.id}
                      id={`pipeline-card-${item.id}`}
                      className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                        item.priorityLevel === 'CRITICAL'
                          ? 'bg-slate-900/95 border-rose-500/40 shadow-xs shadow-rose-950/30'
                          : item.priorityLevel === 'HIGH'
                          ? 'bg-slate-900/90 border-amber-500/30'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                              item.priorityLevel === 'CRITICAL'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                                : item.priorityLevel === 'HIGH'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                                : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40'
                            }`}>
                              {item.priorityLevel === 'CRITICAL' && <Flame className="w-3 h-3 text-rose-400 animate-pulse" />}
                              {item.priorityLevel} • {item.score}/100
                            </span>

                            {item.isCareer && (
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-blue-400" />
                                Career Drive
                              </span>
                            )}

                            {item.isEducation && (
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-purple-400" />
                                Academic
                              </span>
                            )}
                          </div>

                          {item.deadline && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Due: {item.deadlineDisplay || new Date(item.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-100 line-clamp-2">
                          {item.title}
                        </h3>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-mono text-slate-300 truncate">{item.sender}</span>
                        </p>

                        {item.reason && (
                          <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                            {item.reason}
                          </p>
                        )}

                        {item.roles?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.roles.map((r, idx) => (
                              <span key={idx} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.applicationUrl && (
                            <a
                              href={item.applicationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs shadow-indigo-600/30"
                            >
                              <span>Open Portal</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {isGoogleConnected && (
                            item.calendarEventId ? (
                              <a
                                href={item.calendarEventLink || 'https://calendar.google.com'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                <span>In Calendar</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <button
                                onClick={() => handleSyncEmailToCalendar(item)}
                                disabled={syncingCalendarId === item.id}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700/50 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                <Bell className={`w-3.5 h-3.5 text-indigo-400 ${syncingCalendarId === item.id ? 'animate-pulse' : ''}`} />
                                <span>{syncingCalendarId === item.id ? 'Adding...' : 'Add Reminder'}</span>
                              </button>
                            )
                          )}
                        </div>

                        <button
                          onClick={() => handleConvertGmail(item)}
                          disabled={convertingId === item.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{convertingId === item.id ? 'Tracking...' : 'Track Follow-Up'}</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // Direct manual follow-up item
                const ChannelIcon = getChannelIcon(item.contact_channel);
                const isResolved = item.status === 'received_response' || item.status === 'closed';

                return (
                  <div
                    key={item.id}
                    id={`followup-card-${item.id}`}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <RiskBadge risk={item.attention.risk} score={item.attention.score} />
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                            {item.status.replace('_', ' ')}
                          </span>
                          {item.source === 'gmail' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                              Gmail Origin
                            </span>
                          )}
                        </div>
                        {!isResolved && <AttentionMeter score={item.attention.score} />}
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 mb-1">
                        {item.title}
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium mb-3">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item.contact_person}</span>
                        <span className="text-slate-500">•</span>
                        <span className="flex items-center gap-1 text-slate-400 capitalize">
                          <ChannelIcon className="w-3 h-3 text-slate-400" />
                          {item.contact_channel}
                        </span>
                      </div>

                      {item.context && (
                        <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 mb-3 leading-relaxed whitespace-pre-line">
                          {item.context}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                        <span className="flex items-center gap-1 text-amber-300/90 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {item.daysWaiting} days waiting
                        </span>
                        <span className="font-mono text-slate-300">
                          Due: {new Date(item.follow_up_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {!isResolved ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateFollowUpStatus(item.id, 'received_response')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold border border-emerald-800/50 transition-colors"
                          >
                            Mark Responded
                          </button>
                          <button
                            onClick={() => updateFollowUpStatus(item.id, 'closed')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolved
                        </span>
                      )}

                      <button
                        onClick={() => deleteFollowUp(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete Follow-up"
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
      )}

      {/* TAB 2: GMAIL DETECTED INQUIRIES & OPPORTUNITIES */}
      {activeTab === 'gmail' && (
        <div className="space-y-6">
          {!isGoogleConnected ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">Connect Gmail (Read-Only)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Priorix scans your inbox metadata using strict read-only permissions (<code className="text-amber-300">gmail.readonly</code>) to surface career opportunities, university placement drives, explicit deadlines, and action forms.
                </p>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
              >
                Go to Settings & Connect Google
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scan Status & Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>Deterministic Gmail Priority & Opportunity Scanner</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        Multi-Factor Scoring
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Scans candidate inbox messages for placement drives, SDE/DevRel roles, explicit deadlines, and application links.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    id="btn-scan-inbox-now"
                    onClick={() => scanGmail()}
                    disabled={isScanningGmail}
                    className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs shadow-amber-600/30"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningGmail ? 'animate-spin' : ''}`} />
                    <span>{isScanningGmail ? 'Scanning (50+ msgs)...' : 'Scan Inbox Now'}</span>
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setGmailCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    gmailCategoryFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  All Scanned ({gmailFollowUps.length})
                </button>
                <button
                  onClick={() => setGmailCategoryFilter('critical')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    gmailCategoryFilter === 'critical'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-900 text-rose-300 hover:text-rose-200 border border-slate-800'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Critical Priority ({gmailFollowUps.filter(i => i.priorityLevel === 'CRITICAL' || i.score >= 80).length})</span>
                </button>
                <button
                  onClick={() => setGmailCategoryFilter('career')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    gmailCategoryFilter === 'career'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900 text-indigo-300 hover:text-indigo-200 border border-slate-800'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Career / Placement ({gmailFollowUps.filter(i => i.badges?.includes('CAREER OPPORTUNITY') || i.detectedRoles?.length > 0).length})</span>
                </button>
                <button
                  onClick={() => setGmailCategoryFilter('deadlines')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    gmailCategoryFilter === 'deadlines'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-900 text-amber-300 hover:text-amber-200 border border-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>With Deadlines ({gmailFollowUps.filter(i => i.deadlineDate !== null).length})</span>
                </button>
              </div>

              {/* Scanned Items List */}
              {filteredGmail.length === 0 ? (
                <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-200">
                    {gmailFollowUps.length === 0
                      ? 'Click "Scan Inbox Now" to fetch and prioritize opportunities from your Gmail inbox'
                      : 'No emails match the selected filter.'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Priorix uses read-only Gmail access to analyze deadlines, CTC, job roles, and application forms.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGmail.map((item) => {
                    const isCritical = item.priorityLevel === 'CRITICAL' || item.score >= 80;
                    const isHigh = item.priorityLevel === 'HIGH' || (item.score >= 55 && item.score < 80);

                    return (
                      <div
                        key={item.id}
                        id={`gmail-item-card-${item.id}`}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                          isCritical
                            ? 'bg-slate-900/95 border-rose-500/40 shadow-xs shadow-rose-950/20 ring-1 ring-rose-500/20'
                            : isHigh
                            ? 'bg-slate-900 border-amber-500/30'
                            : 'bg-slate-900/80 border-slate-800'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Top Badges & Priority Score Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Exact Priority Badges */}
                              {isCritical && (
                                <span className="px-2.5 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-700/60 text-[11px] font-bold font-mono uppercase flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-rose-400" />
                                  CRITICAL
                                </span>
                              )}
                              {isHigh && !isCritical && (
                                <span className="px-2.5 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-700/60 text-[11px] font-bold font-mono uppercase">
                                  HIGH PRIORITY
                                </span>
                              )}

                              {item.isDeadlinePassed && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-900/40 text-rose-300 border border-rose-800/50 text-[10px] font-bold font-mono uppercase">
                                  DEADLINE PASSED
                                </span>
                              )}

                              {item.isDeadlineToday && !item.isDeadlinePassed && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-900/50 text-amber-300 border border-amber-700/50 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  DEADLINE TODAY
                                </span>
                              )}

                              {item.badges?.includes('CAREER OPPORTUNITY') && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 text-[10px] font-bold font-mono uppercase">
                                  CAREER OPPORTUNITY
                                </span>
                              )}

                              {item.hasApplicationForm && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-700/50 text-[10px] font-bold font-mono uppercase">
                                  APPLICATION REQUIRED
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-300">
                                Priority Score: <strong className={isCritical ? 'text-rose-400' : isHigh ? 'text-amber-400' : 'text-slate-400'}>{item.score}/100</strong>
                              </span>
                              <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isCritical
                                      ? 'bg-rose-500'
                                      : isHigh
                                      ? 'bg-amber-500'
                                      : 'bg-slate-500'
                                  }`}
                                  style={{ width: `${item.score}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* EXACT ORIGINAL EMAIL SUBJECT (Never rewritten or invented) */}
                          <div>
                            <h3 className="text-base font-extrabold text-slate-100 leading-snug tracking-tight">
                              {item.subject}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                              <span>From: <strong className="text-slate-200">{item.fromName || item.fromEmail}</strong></span>
                              <span>•</span>
                              <span>Received: {new Date(item.receivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span>•</span>
                              <span className="text-slate-400">{item.daysAgo} {item.daysAgo === 1 ? 'day' : 'days'} ago</span>
                            </div>
                          </div>

                          {/* Deadline Banner Block */}
                          {item.deadlineDisplay && (
                            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                              item.isDeadlinePassed
                                ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                                : item.isDeadlineToday
                                ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}>
                              <div className="flex items-center gap-2">
                                <Clock className={`w-4 h-4 shrink-0 ${item.isDeadlinePassed ? 'text-rose-400' : 'text-amber-400'}`} />
                                <div>
                                  <span className="font-semibold">Deadline: </span>
                                  <span className="font-bold text-slate-100">{item.deadlineDisplay}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                <span className="font-semibold">Status: </span>
                                <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                  item.isDeadlinePassed
                                    ? 'bg-rose-900/60 text-rose-200 border border-rose-700/50'
                                    : item.isDeadlineToday
                                    ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50'
                                    : 'bg-slate-800 text-slate-200'
                                }`}>
                                  {item.deadlineStatusLabel}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Extracted Metadata Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                            {item.forwardedFromName && (
                              <div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">Original Sender:</span>
                                <span className="font-semibold text-indigo-300">{item.forwardedFromName}</span>
                              </div>
                            )}

                            {item.sourceDepartment && (
                              <div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">Source Institution:</span>
                                <span className="font-semibold text-slate-200">{item.sourceDepartment}</span>
                              </div>
                            )}

                            {item.detectedCompany && (
                              <div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">Company / Entity:</span>
                                <span className="font-semibold text-slate-100 flex items-center gap-1">
                                  <Building className="w-3 h-3 text-amber-400" />
                                  {item.detectedCompany}
                                </span>
                              </div>
                            )}

                            {item.detectedRoles?.length > 0 && (
                              <div className="sm:col-span-2">
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">Roles / Opportunities:</span>
                                <span className="font-semibold text-emerald-300 flex items-center gap-1 flex-wrap">
                                  <Briefcase className="w-3 h-3 text-emerald-400" />
                                  {item.detectedRoles.join(', ')}
                                </span>
                              </div>
                            )}

                            {(item.detectedCTC || item.detectedStipend) && (
                              <div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">CTC / Stipend:</span>
                                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-emerald-400" />
                                  {[item.detectedCTC, item.detectedStipend].filter(Boolean).join(' • ')}
                                </span>
                              </div>
                            )}

                            {item.applicationLink && (
                              <div className="sm:col-span-2 lg:col-span-3 pt-1 border-t border-slate-800/60">
                                <span className="text-[10px] font-mono text-slate-500 uppercase block">Application Form:</span>
                                <a
                                  href={item.applicationLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 font-mono font-medium underline flex items-center gap-1 mt-0.5 break-all"
                                >
                                  <span>{item.applicationLink}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Email Body / Snippet Context */}
                          {item.snippet && (
                            <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 italic leading-relaxed line-clamp-2">
                              "{item.snippet}"
                            </p>
                          )}

                          {/* "Why this matters" Diagnostic Reasons */}
                          {item.reasons?.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[10px] uppercase font-mono text-slate-500 font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                Why this matters:
                              </p>
                              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                                {item.reasons.map((reason, rIdx) => (
                                  <li key={rIdx} className="leading-relaxed">
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons Footer */}
                        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {(() => {
                            const matchedAnalysis = emailAnalyses?.find(
                              (ea) => ea.id === item.id || ea.gmailMessageId === item.id
                            );
                            const syncedEventId = matchedAnalysis?.calendarEventId || item.calendarEventId || null;
                            const syncedEventLink = matchedAnalysis?.calendarEventLink || item.calendarEventLink || null;

                            if (syncedEventId) {
                              return (
                                <a
                                  href={syncedEventLink || 'https://calendar.google.com'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1.5"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Synced to Google Calendar</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              );
                            }

                            return (
                              <button
                                onClick={() => handleSyncEmailToCalendar(item)}
                                disabled={syncingCalendarId === item.id}
                                className="px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700/50 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 w-fit"
                              >
                                <Bell className={`w-3.5 h-3.5 text-indigo-400 ${syncingCalendarId === item.id ? 'animate-pulse' : ''}`} />
                                <span>{syncingCalendarId === item.id ? 'Adding to Calendar...' : 'Add Reminder to Calendar'}</span>
                              </button>
                            );
                          })()}

                          <div className="flex items-center gap-2 flex-wrap">
                            {item.applicationLink && (
                              <a
                                href={item.applicationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700/60"
                              >
                                <span>Open Form</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {(() => {
                              const isAlreadyTracked =
                                (item.score >= 75 && Boolean(item.deadlineDate)) ||
                                (followUps && followUps.some(f => f.source_id === item.id || f.title === item.subject)) ||
                                (emailAnalyses && emailAnalyses.some(ea => (ea.id === item.id || ea.gmailMessageId === item.id) && ((ea.priorityScore >= 75 || ea.priorityLevel === 'CRITICAL' || ea.priorityLevel === 'HIGH') && ea.deadline)));

                              if (isAlreadyTracked) {
                                return (
                                  <div
                                    id={`badge-tracked-gmail-${item.id}`}
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>In Priority Pipeline</span>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  id={`btn-import-gmail-${item.id}`}
                                  onClick={() => handleConvertGmail(item)}
                                  disabled={convertingId === item.id}
                                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{convertingId === item.id ? 'Importing...' : 'Add to Priority Pipeline'}</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
