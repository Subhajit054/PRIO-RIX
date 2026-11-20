import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { calculateAttentionScore, rankByAttention, RISK_LEVELS } from '../lib/attentionEngine.js';
import {
  subscribeToTasks,
  subscribeToGoals,
  subscribeToCommitments,
  subscribeToFollowUps,
  subscribeToActivityLogs,
  subscribeToGoogleIntegration,
  saveGoogleIntegrationInFirestore,
  removeGoogleIntegrationFromFirestore,
  createTaskInFirestore,
  updateTaskInFirestore,
  deleteTaskFromFirestore,
  createGoalInFirestore,
  updateGoalInFirestore,
  deleteGoalFromFirestore,
  createCommitmentInFirestore,
  updateCommitmentInFirestore,
  deleteCommitmentFromFirestore,
  createFollowUpInFirestore,
  updateFollowUpInFirestore,
  deleteFollowUpFromFirestore,
  logActivityInFirestore,
  subscribeToSystemNotifications,
  createSystemNotificationInFirestore,
  markNotificationReadInFirestore,
  subscribeToNotificationSettings,
  saveNotificationSettingsInFirestore,
  subscribeToEmailAnalyses,
  saveEmailAnalysisInFirestore,
  subscribeToDeadlines,
  saveDeadlineToFirestore
} from '../lib/firestore.js';
import {
  requestGoogleAuthorization,
  revokeGoogleAuthorization,
  getStoredGoogleToken,
  clearStoredGoogleToken,
  storeGoogleToken,
  fetchServerGoogleStatus,
  fetchServerGoogleToken
} from '../lib/googleOAuth.js';
import {
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent
} from '../lib/googleCalendar.js';
import { scanGmailFollowUps } from '../lib/googleGmail.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { currentUser, userProfile, isAuthenticated, loading: authLoading } = useAuth();

  // Navigation Route State
  const [currentRoute, setCurrentRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      return path && path !== '/' ? path : '/';
    }
    return '/';
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentRoute(path);
  };

  // Real Firestore Data States
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState({
    minimumPriority: 'CRITICAL',
    minScore: 75,
    criticalIntensity: 'balanced',
    importantIntensity: 'minimal',
    enableTimeCriticalSafetyOverride: true,
    maxStages: 6,
    quietHoursEnabled: false,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    deadlineAlerts: true,
    jobAlerts: true,
    examAlerts: true,
    followUpAlerts: true,
    awayMode: false,
    notificationIntensity: 'Normal',
    autoCalendarSync: true,
  });
  const [emailAnalyses, setEmailAnalyses] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  // Google Integration States
  const [googleIntegration, setGoogleIntegration] = useState(null);
  const [serverGoogleStatus, setServerGoogleStatus] = useState(null);
  const [isCheckingGoogleStatus, setIsCheckingGoogleStatus] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(() => {
    if (currentUser?.uid) return getStoredGoogleToken(currentUser.uid);
    return null;
  });
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [showGoogleCalendarInTimeline, setShowGoogleCalendarInTimeline] = useState(true);

  const [gmailFollowUps, setGmailFollowUps] = useState([]);
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [gmailError, setGmailError] = useState(null);

  // Data Loading & Error States
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  
  // Quick-Add Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('task'); // 'task', 'goal', 'commitment', 'follow_up'
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [workerStatus, setWorkerStatus] = useState({
    active: true,
    lastGlobalSync: null,
    nextScheduledSync: null,
    registeredUsersCount: 0,
    stats: {
      totalEmailsProcessed: 0,
      importantOpportunities: 0,
      criticalCount: 0,
      highCount: 0,
      calendarSynced: 0,
      notificationsCount: 0,
      errorsCount: 0,
    },
  });

  const backgroundSyncTimerRef = useRef(null);
  const sentNotificationStagesRef = useRef(new Set());
  const emailAnalysesRef = useRef([]);
  const notificationSettingsRef = useRef(notificationSettings);
  const isScanningRef = useRef(false);

  useEffect(() => {
    emailAnalysesRef.current = emailAnalyses;
  }, [emailAnalyses]);

  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
  }, [notificationSettings]);

  const getUserTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
      return 'Asia/Kolkata';
    }
  };

  // Check persistent server Google status and restore active access token on load/reload
  useEffect(() => {
    let isMounted = true;

    async function checkGoogleStatusAndRestoreToken() {
      if (!currentUser?.uid) {
        if (isMounted) {
          setGoogleAccessToken(null);
          setServerGoogleStatus(null);
          setGoogleIntegration(null);
          setGoogleCalendarEvents([]);
          setGmailFollowUps([]);
          setIsCheckingGoogleStatus(false);
        }
        return;
      }

      setIsCheckingGoogleStatus(true);

      // 1. Check local session storage token first for instant responsiveness
      const localToken = getStoredGoogleToken(currentUser.uid);
      if (localToken && isMounted) {
        setGoogleAccessToken(localToken);
      }

      try {
        // 2. Query authoritative server-side status
        const serverStatus = await fetchServerGoogleStatus(currentUser.uid);
        if (!isMounted) return;

        setServerGoogleStatus(serverStatus);

        // 3. If connected server-side or in Firestore, ensure we have an active access token
        if (serverStatus.connected || serverStatus.status === 'CONNECTED') {
          if (!localToken) {
            // Restore token from server refresh token vault without user prompt
            const tokenRes = await fetchServerGoogleToken(currentUser.uid);
            if (tokenRes.success && tokenRes.accessToken && isMounted) {
              setGoogleAccessToken(tokenRes.accessToken);
              console.info('Google Workspace session restored from server-side vault.');
            } else if (tokenRes.status === 'NEEDS_REAUTHORIZATION' && isMounted) {
              setServerGoogleStatus(prev => ({ ...(prev || {}), status: 'NEEDS_REAUTHORIZATION', requiresReauth: true }));
            }
          }
        }
      } catch (err) {
        console.warn('Initial Google connection status check error:', err);
      } finally {
        if (isMounted) {
          setIsCheckingGoogleStatus(false);
        }
      }
    }

    checkGoogleStatusAndRestoreToken();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  // Subscribe to real-time Firestore collections when user is authenticated
  useEffect(() => {
    if (!currentUser?.uid) {
      setGoals([]);
      setTasks([]);
      setCommitments([]);
      setFollowUps([]);
      setActivityLogs([]);
      setSystemNotifications([]);
      setEmailAnalyses([]);
      setDeadlines([]);
      setGoogleIntegration(null);
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    setDataError(null);

    const uid = currentUser.uid;

    const unsubTasks = subscribeToTasks(
      uid,
      (data) => {
        setTasks(data);
        setIsDataLoading(false);
      },
      (err) => {
        console.error('Tasks sync error:', err);
        setDataError('Failed to synchronize tasks from Cloud Firestore.');
        setIsDataLoading(false);
      }
    );

    const unsubGoals = subscribeToGoals(
      uid,
      (data) => setGoals(data),
      (err) => console.error('Goals sync error:', err)
    );

    const unsubCommitments = subscribeToCommitments(
      uid,
      (data) => setCommitments(data),
      (err) => console.error('Commitments sync error:', err)
    );

    const unsubFollowUps = subscribeToFollowUps(
      uid,
      (data) => setFollowUps(data),
      (err) => console.error('Follow-ups sync error:', err)
    );

    const unsubActivity = subscribeToActivityLogs(
      uid,
      (data) => setActivityLogs(data),
      (err) => console.error('Activity logs sync error:', err)
    );

    const unsubGoogle = subscribeToGoogleIntegration(
      uid,
      (data) => {
        setGoogleIntegration(data);
      },
      (err) => console.warn('Google integration status listener:', err)
    );

    const unsubNotifications = subscribeToSystemNotifications(
      uid,
      (data) => setSystemNotifications(data),
      (err) => console.warn('System notifications listener:', err)
    );

    const unsubSettings = subscribeToNotificationSettings(
      uid,
      (data) => {
        if (data) setNotificationSettings(prev => ({ ...prev, ...data }));
      },
      (err) => console.warn('Notification settings listener:', err)
    );

    const unsubAnalyses = subscribeToEmailAnalyses(
      uid,
      (data) => setEmailAnalyses(data),
      (err) => console.warn('Email analysis listener:', err)
    );

    const unsubDeadlines = subscribeToDeadlines(
      uid,
      (data) => setDeadlines(data),
      (err) => console.warn('Deadlines listener:', err)
    );

    return () => {
      unsubTasks();
      unsubGoals();
      unsubCommitments();
      unsubFollowUps();
      unsubActivity();
      unsubGoogle();
      unsubNotifications();
      unsubSettings();
      unsubAnalyses();
      unsubDeadlines();
    };
  }, [currentUser?.uid]);

  // Load Google Calendar Events
  const refreshGoogleCalendarEvents = useCallback(async (tokenOverride = null) => {
    let token = tokenOverride || googleAccessToken || (currentUser?.uid ? getStoredGoogleToken(currentUser.uid) : null);
    const connected = Boolean(googleIntegration?.connected || serverGoogleStatus?.connected || token);

    if (!token && currentUser?.uid && (googleIntegration?.connected || serverGoogleStatus?.connected)) {
      try {
        const tokenRes = await fetch('/api/auth/google/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: currentUser.uid })
        });
        if (tokenRes.ok) {
          const tData = await tokenRes.json();
          if (tData.success && tData.accessToken) {
            token = tData.accessToken;
            setGoogleAccessToken(token);
          }
        }
      } catch (vaultErr) {
        console.warn('Could not retrieve token from server vault:', vaultErr);
      }
    }

    if (!token || !connected) {
      setGoogleCalendarEvents([]);
      return;
    }

    setIsFetchingCalendar(true);
    setCalendarError(null);

    try {
      const events = await fetchGoogleCalendarEvents(token, new Date(), 90);
      setGoogleCalendarEvents(events);
    } catch (err) {
      console.error('Failed to load Google Calendar events:', err);
      setCalendarError(err.message || 'Failed to fetch Google Calendar events.');
      if (err.message?.includes('expired')) {
        setGoogleAccessToken(null);
        if (currentUser?.uid) clearStoredGoogleToken(currentUser.uid);
      }
    } finally {
      setIsFetchingCalendar(false);
    }
  }, [googleAccessToken, googleIntegration?.connected, serverGoogleStatus?.connected, currentUser?.uid]);

  // Trigger calendar fetch when connected and token is available
  useEffect(() => {
    if ((googleIntegration?.connected || serverGoogleStatus?.connected) && googleAccessToken) {
      refreshGoogleCalendarEvents(googleAccessToken);
    }
  }, [googleIntegration?.connected, serverGoogleStatus?.connected, googleAccessToken, refreshGoogleCalendarEvents]);

  // Scan Gmail for important emails, analyze with Gemini, and auto-add reminders to Google Calendar
  const scanGmail = useCallback(async (tokenOverride = null) => {
    if (isScanningRef.current) return;

    let token = tokenOverride || googleAccessToken || (currentUser?.uid ? getStoredGoogleToken(currentUser.uid) : null);

    if (!token && currentUser?.uid && (googleIntegration?.connected || serverGoogleStatus?.connected)) {
      try {
        const tokenRes = await fetch('/api/auth/google/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: currentUser.uid })
        });
        if (tokenRes.ok) {
          const tData = await tokenRes.json();
          if (tData.success && tData.accessToken) {
            token = tData.accessToken;
            setGoogleAccessToken(token);
          }
        }
      } catch (vaultErr) {
        console.warn('Could not retrieve token from server vault:', vaultErr);
      }
    }

    if (!token) {
      setGmailFollowUps([]);
      return;
    }

    isScanningRef.current = true;
    setIsScanningGmail(true);
    setGmailError(null);

    const userTimezone = getUserTimezone();
    const settings = notificationSettingsRef.current || {};
    const minScoreThreshold = settings.minScore ?? 75;
    let anyCalendarSynced = false;

    try {
      const detected = await scanGmailFollowUps(token, currentUser?.email || '');
      setGmailFollowUps(detected);

      // Analyze top 25 inbox emails with Gemini & auto-sync important items to Google Calendar with reminders
      if (detected.length > 0 && currentUser?.uid) {
        const candidates = detected.slice(0, 25);
        try {
          const resp = await fetch('/api/gemini/batch-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emails: candidates.map(d => ({
                id: d.id,
                threadId: d.threadId,
                subject: d.subject,
                from: d.from,
                fromName: d.fromName,
                fromEmail: d.fromEmail,
                bodyText: d.bodyText || d.bodyPreview || d.snippet || '',
                snippet: d.snippet,
                receivedDate: d.receivedDate,
              })),
              userTimezone,
              now: new Date().toISOString()
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const existingList = emailAnalysesRef.current || [];

            if (data.results && Array.isArray(data.results)) {
              for (const item of data.results) {
                const sourceEmail = candidates.find(c => c.id === item.id) || {};
                const existingAnalysis = existingList.find(ea => ea.id === item.id || ea.gmailMessageId === item.id);
                let calendarEventId = existingAnalysis?.calendarEventId || null;
                let calendarEventLink = existingAnalysis?.calendarEventLink || null;
                let calendarScheduleKind = existingAnalysis?.calendarScheduleKind || null;
                let lastReminderConfiguration = existingAnalysis?.lastReminderConfiguration || [];
                let lastCalendarSyncAt = existingAnalysis?.lastCalendarSyncAt || null;

                const isCompletedOrDismissed = Boolean(existingAnalysis?.completed || existingAnalysis?.dismissed);
                const score = item.scoring?.score || 0;
                const priorityLevel = item.scoring?.priorityLevel || 'LOW';
                const explicitDate =
                  item.analysis?.deadlineDate ||
                  item.analysis?.interviewDate ||
                  item.analysis?.examDate ||
                  item.analysis?.eventDate ||
                  null;
                const hasActionableDate = Boolean(explicitDate);
                const isPassed =
                  item.scoring?.isDeadlinePassed ||
                  (explicitDate && new Date(explicitDate).getTime() <= Date.now());
                const isPromo = Boolean(item.analysis?.isPromotionalOrNewsletter);

                const qualifiesForCalendar =
                  !isCompletedOrDismissed &&
                  !isPromo &&
                  !isPassed &&
                  score >= minScoreThreshold &&
                  (hasActionableDate ||
                    item.analysis?.requiresAction ||
                    priorityLevel === 'CRITICAL' ||
                    priorityLevel === 'HIGH');

                // Auto-create or update Google Calendar event with reminders (deduplicated 1:1 per Gmail message)
                if (
                  settings.autoCalendarSync !== false &&
                  token &&
                  qualifiesForCalendar
                ) {
                  try {
                    const calResp = await fetch('/api/calendar/create-deadline-event', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        accessToken: token,
                        analysis: item.analysis,
                        scoring: item.scoring,
                        messageId: item.id,
                        eventId: calendarEventId || undefined,
                        appUrl: window.location.origin,
                        userTimezone,
                        options: {
                          minScore: minScoreThreshold,
                          criticalIntensity: settings.criticalIntensity || 'balanced',
                          importantIntensity: settings.importantIntensity || 'balanced',
                          maxStages: Math.min(settings.maxStages || 5, 5),
                          allowFollowUpFallback: true,
                          userTimezone,
                        }
                      })
                    });
                    if (calResp.ok) {
                      const calData = await calResp.json();
                      if (calData.event?.id) {
                        calendarEventId = calData.event.id;
                        calendarEventLink = calData.event.htmlLink || calendarEventLink;
                        calendarScheduleKind = calData.event.scheduleKind || calendarScheduleKind;
                        lastReminderConfiguration = calData.event.reminders?.overrides || [];
                        lastCalendarSyncAt = new Date().toISOString();
                        anyCalendarSynced = true;
                      }
                    }
                  } catch (calSyncErr) {
                    console.warn('Calendar auto-sync notice:', calSyncErr);
                  }
                }

                // Persist analysis & calendar link in Firestore
                await saveEmailAnalysisInFirestore(currentUser.uid, item.id, {
                  gmailMessageId: item.id,
                  priorixRecordId: item.id,
                  threadId: sourceEmail.threadId || '',
                  originalSubject: item.analysis?.subject || sourceEmail.subject || '',
                  sender: item.analysis?.originalSender || item.analysis?.sender || sourceEmail.from || '',
                  receivedAt: sourceEmail.receivedDate || new Date().toISOString(),
                  priorityScore: score,
                  priorityLevel,
                  category: item.analysis?.category || (item.analysis?.isCareerRelated ? 'CAREER' : (item.analysis?.isExamOrEducation ? 'EDUCATION' : 'GENERAL_IMPORTANT')),
                  deadline: item.analysis?.deadlineDate || null,
                  deadlineDisplay: item.analysis?.deadlineDisplay || item.analysis?.deadlineTime || null,
                  deadlineTimezone: item.analysis?.timezone || userTimezone,
                  deadlineStatus: item.scoring?.urgencyStatus || 'NO_DEADLINE',
                  roles: item.analysis?.detectedRoles || [],
                  compensation: [item.analysis?.compensation, item.analysis?.stipend].filter(Boolean).join(' • ') || '',
                  applicationUrl: item.analysis?.actionLink || item.analysis?.applicationUrl || item.analysis?.registrationUrl || '',
                  geminiReason: item.analysis?.reason || item.analysis?.summary || (item.analysis?.keyReasons || []).join('. '),
                  deterministicSignals: item.scoring?.scoreBreakdown || [],
                  calendarEventId: calendarEventId || null,
                  calendarEventLink: calendarEventLink || null,
                  calendarScheduleKind: calendarScheduleKind || null,
                  lastReminderConfiguration,
                  lastCalendarSyncAt,
                  notificationState: {
                    browserNotified: qualifiesForCalendar,
                    lastNotifiedAt: qualifiesForCalendar ? new Date().toISOString() : null,
                    urgencyStage: item.scoring?.urgencyStatus || 'SCHEDULED'
                  },
                  followUpState: existingAnalysis?.followUpState || 'PENDING',
                  completed: existingAnalysis?.completed || false,
                  dismissed: existingAnalysis?.dismissed || false,
                  analysis: item.analysis,
                  scoring: item.scoring,
                  subject: item.analysis?.subject || sourceEmail.subject || '',
                  from: item.analysis?.sender || sourceEmail.from || '',
                });

                if (item.analysis?.deadlineDate) {
                  await saveDeadlineToFirestore(currentUser.uid, item.id, {
                    emailId: item.id,
                    subject: item.analysis.subject || sourceEmail.subject || '',
                    deadlineDate: item.analysis.deadlineDate,
                    timeString: item.analysis.deadlineTime || item.analysis.deadlineDisplay || null,
                    isExplicit: Boolean(item.analysis.deadlineDisplay),
                    company: item.analysis.jobOrCompanyName || null,
                    priorityLevel,
                    score,
                    calendarEventId: calendarEventId || null,
                  });
                }

                // Log notification for newly synced important items
                if (qualifiesForCalendar && !existingAnalysis?.calendarEventId) {
                  await createSystemNotificationInFirestore(currentUser.uid, {
                    type: 'critical_email',
                    title: calendarEventId
                      ? `Added to Calendar: ${item.analysis?.subject || sourceEmail.subject}`
                      : `Important: ${item.analysis?.subject || sourceEmail.subject}`,
                    body: `Priority ${score}/100 • ${item.analysis?.deadlineDisplay ? `Deadline: ${item.analysis.deadlineDisplay}` : (item.analysis?.actionType || 'Reminder scheduled in Google Calendar')}`,
                    priority: priorityLevel,
                    score,
                    emailId: item.id,
                    deadlineDate: item.analysis?.deadlineDate || null,
                  });
                }

                // Stage-deduplicated Browser Notification for upcoming explicit deadlines
                if (
                  qualifiesForCalendar &&
                  explicitDate &&
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'granted'
                ) {
                  const dlTime = new Date(explicitDate).getTime();
                  const diffMinutes = Math.round((dlTime - Date.now()) / (1000 * 60));

                  let currentStage = null;
                  if (diffMinutes > 0 && diffMinutes <= 15) currentStage = '10m';
                  else if (diffMinutes > 15 && diffMinutes <= 45) currentStage = '30m';
                  else if (diffMinutes > 45 && diffMinutes <= 90) currentStage = '1h';
                  else if (diffMinutes > 90 && diffMinutes <= 240) currentStage = '3h';
                  else if (diffMinutes > 240 && diffMinutes <= 24 * 60) currentStage = '24h';

                  if (currentStage) {
                    const stageKey = `${item.id}_${currentStage}_${explicitDate}`;
                    if (!sentNotificationStagesRef.current.has(stageKey)) {
                      sentNotificationStagesRef.current.add(stageKey);
                      try {
                        const notif = new Notification(`Priorix Reminder (${currentStage})`, {
                          body: `${item.analysis?.subject || sourceEmail.subject}\n${item.analysis?.deadlineDisplay || 'Upcoming deadline'}`,
                          tag: stageKey
                        });
                        notif.onclick = () => window.focus();
                      } catch {
                        // non-blocking
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (aiErr) {
          console.warn('Batch AI analysis non-blocking error:', aiErr);
        }
      }

      // Immediately refresh Calendar view when any important email was added/updated in Google Calendar
      if (anyCalendarSynced) {
        await refreshGoogleCalendarEvents(token);
      }

      if (currentUser?.uid) {
        const criticalCount = detected.filter(i => i.priorityLevel === 'CRITICAL' || i.score >= 80).length;
        await logActivityInFirestore(
          currentUser.uid,
          'scanned',
          'gmail',
          `Scanned Gmail inbox: ${detected.length} emails checked (${criticalCount} high-priority)`
        ).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to scan Gmail for follow-ups:', err);
      setGmailError(err.message || 'Failed to scan Gmail.');
      if (err.message?.includes('expired')) {
        setGoogleAccessToken(null);
        if (currentUser?.uid) clearStoredGoogleToken(currentUser.uid);
      }
    } finally {
      isScanningRef.current = false;
      setIsScanningGmail(false);
    }
  }, [googleAccessToken, googleIntegration?.connected, serverGoogleStatus?.connected, currentUser?.email, currentUser?.uid, refreshGoogleCalendarEvents]);

  // Automated initial trigger and recurring background synchronization (every 3 minutes when connected)
  useEffect(() => {
    const connected = Boolean(googleIntegration?.connected || serverGoogleStatus?.connected);
    if (!connected || !googleAccessToken) {
      if (backgroundSyncTimerRef.current) {
        clearInterval(backgroundSyncTimerRef.current);
        backgroundSyncTimerRef.current = null;
      }
      return;
    }

    scanGmail(googleAccessToken);
    refreshGoogleCalendarEvents(googleAccessToken);

    backgroundSyncTimerRef.current = setInterval(() => {
      scanGmail(googleAccessToken);
      refreshGoogleCalendarEvents(googleAccessToken);
    }, 3 * 60 * 1000);

    return () => {
      if (backgroundSyncTimerRef.current) {
        clearInterval(backgroundSyncTimerRef.current);
        backgroundSyncTimerRef.current = null;
      }
    };
  }, [googleIntegration?.connected, serverGoogleStatus?.connected, googleAccessToken, scanGmail, refreshGoogleCalendarEvents]);

  // Google OAuth Connect
  const connectGoogle = async (prompt = 'consent') => {
    if (!currentUser?.uid) throw new Error('You must be logged in to connect Google');

    try {
      const authResult = await requestGoogleAuthorization(currentUser.uid, prompt, currentUser.email || '');
      setGoogleAccessToken(authResult.accessToken);

      await saveGoogleIntegrationInFirestore(currentUser.uid, {
        email: currentUser.email,
        scopes: authResult.scopes,
        calendarSyncEnabled: true,
        gmailSyncEnabled: true,
        connected: true,
        connectedAt: new Date().toISOString(),
        status: 'CONNECTED',
      });

      setServerGoogleStatus({
        connected: true,
        status: 'CONNECTED',
        email: currentUser.email || '',
        scopes: authResult.scopes,
        connectedAt: new Date().toISOString(),
        requiresReauth: false,
        lastError: null,
      });

      // Register with server-side vault
      try {
        await fetch('/api/auth/google/register-client-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: currentUser.uid,
            email: currentUser.email || '',
            accessToken: authResult.accessToken,
            scopes: authResult.scopes,
          }),
        });
      } catch (regErr) {
        console.warn('Could not register client token with server-side vault:', regErr);
      }

      await logActivityInFirestore(
        currentUser.uid,
        'integrated',
        'google',
        'Connected Google Workspace (Calendar + Gmail Read-Only)'
      );

      // Immediately fetch events and scan gmail
      refreshGoogleCalendarEvents(authResult.accessToken);
      scanGmail(authResult.accessToken);

      return true;
    } catch (err) {
      if (
        err?.isCancelled ||
        err?.type === 'popup_closed' ||
        err?.message?.toLowerCase().includes('closed') ||
        err?.message?.toLowerCase().includes('cancelled')
      ) {
        console.info('Google OAuth authorization was cancelled or closed by user.');
        throw err;
      }
      console.error('Google OAuth Connection failed:', err);
      throw err;
    }
  };

  // Reconnect Google (Separate explicit action when reauthorization is necessary)
  const reconnectGoogle = async () => {
    return connectGoogle('consent');
  };

  // Google OAuth Disconnect
  const disconnectGoogle = async () => {
    if (!currentUser?.uid) return;

    try {
      await revokeGoogleAuthorization(currentUser.uid);
      await removeGoogleIntegrationFromFirestore(currentUser.uid);
      setGoogleAccessToken(null);
      setServerGoogleStatus({
        connected: false,
        status: 'DISCONNECTED',
        email: '',
        scopes: [],
        connectedAt: null,
        requiresReauth: false,
        lastError: null,
      });
      setGoogleCalendarEvents([]);
      setGmailFollowUps([]);
      setCalendarError(null);
      setGmailError(null);

      await logActivityInFirestore(
        currentUser.uid,
        'disconnected',
        'google',
        'Disconnected Google Workspace integration'
      );
    } catch (err) {
      console.error('Google Disconnect error:', err);
      throw err;
    }
  };

  // Register user context with Backend Autonomous Worker
  const registerWithAutonomousWorker = useCallback(async (token, customSettings = null) => {
    if (!currentUser?.uid || !token) return;
    const settings = customSettings || notificationSettingsRef.current;
    try {
      await fetch('/api/worker/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email || '',
          accessToken: token,
          userTimezone: getUserTimezone(),
          autoCalendarSync: settings?.autoCalendarSync ?? true,
          minimumPriority: settings?.minimumPriority || 'CRITICAL',
          minScore: settings?.minScore ?? 75,
          criticalIntensity: settings?.criticalIntensity || 'balanced',
          importantIntensity: settings?.importantIntensity || 'balanced',
          enableTimeCriticalSafetyOverride: settings?.enableTimeCriticalSafetyOverride ?? true,
          maxStages: Math.min(settings?.maxStages ?? 5, 5),
          quietHoursEnabled: settings?.quietHoursEnabled ?? false,
          quietHoursStart: settings?.quietHoursStart || '23:00',
          quietHoursEnd: settings?.quietHoursEnd || '07:00',
        }),
      });
    } catch (err) {
      console.warn('Backend worker registration error:', err);
    }
  }, [currentUser?.uid, currentUser?.email]);

  // Fetch autonomous worker status
  const refreshWorkerStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/worker/status');
      if (resp.ok) {
        const data = await resp.json();
        setWorkerStatus(data);
      }
    } catch (err) {
      console.warn('Worker status fetch error:', err);
    }
  }, []);

  // Trigger full end-to-end sync: scan Gmail -> Gemini analyze -> Firestore persist -> auto-add to Google Calendar -> refresh Calendar
  const triggerAutonomousSync = useCallback(async () => {
    if (!currentUser?.uid) return;
    const token = googleAccessToken || getStoredGoogleToken(currentUser.uid);

    try {
      if (token) {
        await scanGmail(token);
      }

      fetch('/api/worker/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email || '',
          accessToken: token || '',
        }),
      })
        .then(() => refreshWorkerStatus())
        .catch(() => {});

      if (token) {
        await refreshGoogleCalendarEvents(token);
      }
    } catch (err) {
      console.error('Trigger autonomous sync error:', err);
    }
  }, [currentUser?.uid, currentUser?.email, googleAccessToken, scanGmail, refreshWorkerStatus, refreshGoogleCalendarEvents]);

  // Manually sync (or re-sync) any important email into Google Calendar with popup reminders
  const syncEmailToGoogleCalendar = useCallback(async (emailItem) => {
    if (!currentUser?.uid) throw new Error('You must be signed in.');
    let token = googleAccessToken || getStoredGoogleToken(currentUser.uid);
    if (!token) {
      const tokenRes = await fetchServerGoogleToken(currentUser.uid);
      if (tokenRes?.success && tokenRes.accessToken) {
        token = tokenRes.accessToken;
        setGoogleAccessToken(token);
      }
    }
    if (!token) {
      throw new Error('Google Calendar is not connected. Please connect your Google account in Settings.');
    }

    const userTimezone = getUserTimezone();
    const messageId = emailItem.gmailMessageId || emailItem.id;
    const analysis = emailItem.analysis || {
      subject: emailItem.originalSubject || emailItem.subject,
      sender: emailItem.sender || emailItem.from || '',
      originalSender: emailItem.sender || emailItem.fromName || emailItem.from || '',
      jobOrCompanyName: emailItem.detectedCompany || emailItem.organization || '',
      detectedRoles: emailItem.roles || emailItem.detectedRoles || [],
      actionLink: emailItem.applicationUrl || emailItem.applicationLink || '',
      deadlineDate: emailItem.deadline || emailItem.deadlineDate || null,
      deadlineDisplay: emailItem.deadlineDisplay || null,
      requiresAction: true,
      isPromotionalOrNewsletter: false,
      reason: emailItem.geminiReason || emailItem.snippet || 'Manually added to Google Calendar from Priorix.',
      timezone: userTimezone,
    };

    const score = Math.max(emailItem.priorityScore || emailItem.score || 80, 75);
    const priorityLevel = emailItem.priorityLevel || (score >= 90 ? 'CRITICAL' : 'HIGH');
    const scoring = emailItem.scoring || {
      score,
      priorityLevel,
      urgencyStatus: emailItem.deadlineStatus || 'SCHEDULED',
    };

    const resp = await fetch('/api/calendar/create-deadline-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        analysis,
        scoring,
        messageId,
        eventId: emailItem.calendarEventId || undefined,
        appUrl: window.location.origin,
        userTimezone,
        options: {
          minScore: 0, // Explicit user action always schedules a reminder
          criticalIntensity: notificationSettingsRef.current?.criticalIntensity || 'balanced',
          importantIntensity: notificationSettingsRef.current?.importantIntensity || 'balanced',
          maxStages: 5,
          allowFollowUpFallback: true,
          userTimezone,
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.event?.id) {
      throw new Error(data.error || 'Could not schedule reminder in Google Calendar.');
    }

    await saveEmailAnalysisInFirestore(currentUser.uid, messageId, {
      gmailMessageId: messageId,
      originalSubject: analysis.subject,
      subject: analysis.subject,
      sender: analysis.originalSender || analysis.sender || '',
      priorityScore: score,
      priorityLevel,
      deadline: analysis.deadlineDate || null,
      deadlineDisplay: analysis.deadlineDisplay || null,
      calendarEventId: data.event.id,
      calendarEventLink: data.event.htmlLink || null,
      calendarScheduleKind: data.event.scheduleKind || null,
      lastReminderConfiguration: data.event.reminders?.overrides || [],
      lastCalendarSyncAt: new Date().toISOString(),
    });

    await refreshGoogleCalendarEvents(token);
    await logActivityInFirestore(
      currentUser.uid,
      'created',
      'calendar',
      `Added email reminder to Google Calendar: "${analysis.subject}"`
    ).catch(() => {});

    return data.event;
  }, [currentUser?.uid, googleAccessToken, refreshGoogleCalendarEvents]);

  // Update email analysis lifecycle (COMPLETED / DISMISSED) and silence linked Google Calendar reminders
  const updateEmailAnalysisStatus = useCallback(async (emailItem, nextStatus) => {
    if (!currentUser?.uid || !emailItem) return;
    const messageId = emailItem.gmailMessageId || emailItem.id;
    const isCompleted = nextStatus === 'COMPLETED';
    const isDismissed = nextStatus === 'DISMISSED';

    await saveEmailAnalysisInFirestore(currentUser.uid, messageId, {
      completed: isCompleted,
      dismissed: isDismissed,
      followUpState: nextStatus,
    });

    const token = googleAccessToken || getStoredGoogleToken(currentUser.uid);
    if (token && emailItem.calendarEventId) {
      fetch('/api/calendar/update-event-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          eventId: emailItem.calendarEventId,
          status: nextStatus,
        }),
      })
        .then(() => refreshGoogleCalendarEvents(token))
        .catch(() => {});
    }

    fetch('/api/worker/transition-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: currentUser.uid,
        messageId,
        status: nextStatus,
        accessToken: token || undefined,
      }),
    }).catch(() => {});
  }, [currentUser?.uid, googleAccessToken, refreshGoogleCalendarEvents]);

  // Register with worker on token change
  useEffect(() => {
    if (currentUser?.uid && googleAccessToken) {
      registerWithAutonomousWorker(googleAccessToken);
      refreshWorkerStatus();
    }
  }, [currentUser?.uid, googleAccessToken, registerWithAutonomousWorker, refreshWorkerStatus]);

  // Poll worker status periodically
  useEffect(() => {
    refreshWorkerStatus();
    const timer = setInterval(refreshWorkerStatus, 30000);
    return () => clearInterval(timer);
  }, [refreshWorkerStatus]);

  // Update Notification Settings in Firestore
  const updateNotificationSettings = async (updates) => {
    if (!currentUser?.uid) return;
    const merged = { ...notificationSettings, ...updates };
    setNotificationSettings(merged);
    await saveNotificationSettingsInFirestore(currentUser.uid, merged);
    if (googleAccessToken) {
      registerWithAutonomousWorker(googleAccessToken, merged);
    }
    await logActivityInFirestore(
      currentUser.uid,
      'updated',
      'settings',
      `Updated notification & alert preferences`
    );
  };

  // Mark a system notification as read
  const markNotificationAsRead = async (notificationId) => {
    if (!currentUser?.uid || !notificationId) return;
    await markNotificationReadInFirestore(currentUser.uid, notificationId);
    setSystemNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  // Synchronize Task to Google Calendar (Explicit User Action)
  const syncTaskToGoogleCalendar = async (taskId) => {
    if (!currentUser?.uid) throw new Error('User not authenticated');
    const token = googleAccessToken || getStoredGoogleToken(currentUser.uid);
    if (!token || !googleIntegration?.connected) {
      throw new Error('Google Calendar is not connected. Please connect Google in Settings.');
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    try {
      if (task.google_event_id) {
        await updateGoogleCalendarEvent(token, task.google_event_id, {
          title: task.title,
          description: task.description,
          dueDate: task.due_date,
          estimatedMinutes: task.estimated_minutes,
          priorixId: task.id,
          itemType: 'task'
        });

        await updateTaskInFirestore(currentUser.uid, taskId, {
          google_event_synced_at: new Date().toISOString(),
        });

        await logActivityInFirestore(
          currentUser.uid,
          'updated',
          'task',
          `Updated task in Google Calendar: "${task.title}"`
        );
      } else {
        const created = await createGoogleCalendarEvent(token, {
          title: task.title,
          description: task.description,
          dueDate: task.due_date,
          estimatedMinutes: task.estimated_minutes,
          priorixId: task.id,
          itemType: 'task'
        });

        await updateTaskInFirestore(currentUser.uid, taskId, {
          google_event_id: created.id,
          google_event_link: created.htmlLink,
          google_event_synced_at: new Date().toISOString(),
        });

        await logActivityInFirestore(
          currentUser.uid,
          'created',
          'task',
          `Added task to Google Calendar: "${task.title}"`
        );
      }

      refreshGoogleCalendarEvents(token);
    } catch (err) {
      console.error('Calendar sync error:', err);
      throw err;
    }
  };

  // Remove Task from Google Calendar
  const removeTaskFromGoogleCalendar = async (taskId) => {
    if (!currentUser?.uid) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.google_event_id) return;

    const token = googleAccessToken || getStoredGoogleToken(currentUser.uid);
    if (token) {
      await deleteGoogleCalendarEvent(token, task.google_event_id);
    }

    await updateTaskInFirestore(currentUser.uid, taskId, {
      google_event_id: null,
      google_event_link: null,
      google_event_synced_at: null,
    });

    await logActivityInFirestore(
      currentUser.uid,
      'updated',
      'task',
      `Removed task from Google Calendar: "${task.title}"`
    );

    if (token) refreshGoogleCalendarEvents(token);
  };

  // Synchronize Commitment to Google Calendar
  const syncCommitmentToGoogleCalendar = async (commId) => {
    if (!currentUser?.uid) throw new Error('User not authenticated');
    const token = googleAccessToken || getStoredGoogleToken(currentUser.uid);
    if (!token || !googleIntegration?.connected) {
      throw new Error('Google Calendar is not connected. Please connect Google in Settings.');
    }

    const comm = commitments.find(c => c.id === commId);
    if (!comm) throw new Error('Commitment not found');

    try {
      if (comm.google_event_id) {
        await updateGoogleCalendarEvent(token, comm.google_event_id, {
          title: `Commitment: ${comm.title}`,
          description: `Pledged to: ${comm.recipient}\n${comm.notes || ''}`,
          dueDate: comm.due_date,
          estimatedMinutes: 60,
          priorixId: comm.id,
          itemType: 'commitment'
        });

        await updateCommitmentInFirestore(currentUser.uid, commId, {
          google_event_synced_at: new Date().toISOString(),
        });
      } else {
        const created = await createGoogleCalendarEvent(token, {
          title: `Commitment: ${comm.title}`,
          description: `Pledged to: ${comm.recipient}\n${comm.notes || ''}`,
          dueDate: comm.due_date,
          estimatedMinutes: 60,
          priorixId: comm.id,
          itemType: 'commitment'
        });

        await updateCommitmentInFirestore(currentUser.uid, commId, {
          google_event_id: created.id,
          google_event_link: created.htmlLink,
          google_event_synced_at: new Date().toISOString(),
        });
      }

      await logActivityInFirestore(
        currentUser.uid,
        'created',
        'commitment',
        `Synced commitment to Google Calendar: "${comm.title}"`
      );

      refreshGoogleCalendarEvents(token);
    } catch (err) {
      console.error('Commitment Calendar sync error:', err);
      throw err;
    }
  };

  // Convert Detected Gmail Follow-Up to Priorix Follow-Up record
  const convertGmailToPriorixFollowUp = async (gmailItem) => {
    if (!currentUser?.uid) throw new Error('User not authenticated');

    const title = gmailItem.subject; // EXACT subject preserved!
    const contact = gmailItem.forwardedFromName || gmailItem.suggestedContact || gmailItem.fromName || gmailItem.fromEmail;
    
    const contextSections = [
      `Original Subject: ${gmailItem.subject}`,
      `From: ${gmailItem.from}`,
      gmailItem.forwardedFromName ? `Forwarded From: ${gmailItem.forwardedFromName} (${gmailItem.forwardedFromEmail || ''})` : null,
      gmailItem.sourceDepartment ? `Source Institution: ${gmailItem.sourceDepartment}` : null,
      gmailItem.detectedCompany ? `Company / Entity: ${gmailItem.detectedCompany}` : null,
      gmailItem.detectedRoles?.length > 0 ? `Roles: ${gmailItem.detectedRoles.join(', ')}` : null,
      gmailItem.detectedCTC || gmailItem.detectedStipend ? `Compensation: ${[gmailItem.detectedCTC, gmailItem.detectedStipend].filter(Boolean).join(' • ')}` : null,
      gmailItem.deadlineDisplay ? `Deadline: ${gmailItem.deadlineDisplay} (${gmailItem.deadlineStatusLabel})` : null,
      gmailItem.applicationLink ? `Application Form: ${gmailItem.applicationLink}` : null,
      gmailItem.reasons?.length > 0 ? `Why this matters:\n${gmailItem.reasons.map(r => `• ${r}`).join('\n')}` : null,
      gmailItem.snippet ? `Snippet: "${gmailItem.snippet}"` : null
    ].filter(Boolean).join('\n\n');

    let followUpDueDate = new Date();
    if (gmailItem.deadlineDate && new Date(gmailItem.deadlineDate) > new Date()) {
      followUpDueDate = new Date(gmailItem.deadlineDate);
    } else {
      followUpDueDate.setDate(followUpDueDate.getDate() + 2); // Default 2 days from now
    }

    const createdId = await createFollowUpInFirestore(currentUser.uid, {
      title,
      contact_person: contact,
      contact_channel: 'email',
      context: contextSections,
      status: 'waiting',
      sent_date: gmailItem.receivedDate,
      follow_up_due_date: followUpDueDate.toISOString(),
      source: 'gmail',
      source_id: gmailItem.id
    });

    // Remove from temporary detected suggestions
    setGmailFollowUps(prev => prev.filter(item => item.id !== gmailItem.id));

    await logActivityInFirestore(
      currentUser.uid,
      'created',
      'follow_up',
      `Imported Gmail opportunity into Priorix: "${title}"`
    );

    return createdId;
  };

  // CRUD for Tasks (Firestore backed)
  const addTask = async (taskData) => {
    if (!currentUser?.uid) throw new Error('You must be logged in to create a task');
    const id = await createTaskInFirestore(currentUser.uid, taskData);
    await logActivityInFirestore(currentUser.uid, 'created', 'task', `Created task: "${taskData.title}"`);
    return id;
  };

  const toggleTaskStatus = async (taskId) => {
    if (!currentUser?.uid) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completed_at = nextStatus === 'completed' ? new Date().toISOString() : null;

    await updateTaskInFirestore(currentUser.uid, taskId, {
      status: nextStatus,
      completed_at,
      last_touched_at: new Date().toISOString()
    });

    await logActivityInFirestore(
      currentUser.uid,
      nextStatus === 'completed' ? 'completed' : 'updated',
      'task',
      `${nextStatus === 'completed' ? 'Completed' : 'Reopened'} task: "${task.title}"`
    );
  };

  const updateTask = async (taskId, updates) => {
    if (!currentUser?.uid) return;
    await updateTaskInFirestore(currentUser.uid, taskId, {
      ...updates,
      last_touched_at: new Date().toISOString()
    });
  };

  const deleteTask = async (taskId) => {
    if (!currentUser?.uid) return;
    const task = tasks.find(t => t.id === taskId);
    
    // If synced with Google Calendar, remove the external event
    if (task?.google_event_id && (googleAccessToken || getStoredGoogleToken(currentUser.uid))) {
      try {
        await deleteGoogleCalendarEvent(googleAccessToken || getStoredGoogleToken(currentUser.uid), task.google_event_id);
      } catch (e) {
        console.warn('Could not remove calendar event during task deletion:', e);
      }
    }

    await deleteTaskFromFirestore(currentUser.uid, taskId);
    if (task) {
      await logActivityInFirestore(currentUser.uid, 'deleted', 'task', `Deleted task: "${task.title}"`);
    }
  };

  // CRUD for Goals (Firestore backed)
  const addGoal = async (goalData) => {
    if (!currentUser?.uid) throw new Error('You must be logged in to create a goal');
    const id = await createGoalInFirestore(currentUser.uid, goalData);
    await logActivityInFirestore(currentUser.uid, 'created', 'goal', `Created goal: "${goalData.title}"`);
    return id;
  };

  const updateGoalProgress = async (goalId, newProgress) => {
    if (!currentUser?.uid) return;
    const progress = Math.min(Math.max(Number(newProgress) || 0, 0), 100);
    const goal = goals.find(g => g.id === goalId);
    
    await updateGoalInFirestore(currentUser.uid, goalId, {
      progress_percentage: progress,
      status: progress === 100 ? 'completed' : (goal?.status === 'completed' ? 'active' : goal?.status || 'active'),
      last_progress_date: new Date().toISOString()
    });

    await logActivityInFirestore(currentUser.uid, 'updated', 'goal', `Updated progress on goal (${progress}%)`);
  };

  const updateGoal = async (goalId, updates) => {
    if (!currentUser?.uid) return;
    await updateGoalInFirestore(currentUser.uid, goalId, updates);
  };

  const deleteGoal = async (goalId) => {
    if (!currentUser?.uid) return;
    const goal = goals.find(g => g.id === goalId);
    await deleteGoalFromFirestore(currentUser.uid, goalId);
    if (goal) {
      await logActivityInFirestore(currentUser.uid, 'deleted', 'goal', `Deleted goal: "${goal.title}"`);
    }
  };

  // CRUD for Commitments (Firestore backed)
  const addCommitment = async (commData) => {
    if (!currentUser?.uid) throw new Error('You must be logged in to create a commitment');
    const id = await createCommitmentInFirestore(currentUser.uid, commData);
    await logActivityInFirestore(currentUser.uid, 'created', 'commitment', `Pledged commitment to ${commData.recipient || 'recipient'}: "${commData.title}"`);
    return id;
  };

  const toggleCommitmentStatus = async (commId) => {
    if (!currentUser?.uid) return;
    const comm = commitments.find(c => c.id === commId);
    if (!comm) return;

    const nextStatus = comm.status === 'fulfilled' ? 'open' : 'fulfilled';
    await updateCommitmentInFirestore(currentUser.uid, commId, {
      status: nextStatus,
      fulfilled_at: nextStatus === 'fulfilled' ? new Date().toISOString() : null
    });

    await logActivityInFirestore(currentUser.uid, 'updated', 'commitment', `Marked commitment as ${nextStatus}: "${comm.title}"`);
  };

  const updateCommitment = async (commId, updates) => {
    if (!currentUser?.uid) return;
    await updateCommitmentInFirestore(currentUser.uid, commId, updates);
  };

  const deleteCommitment = async (commId) => {
    if (!currentUser?.uid) return;
    const comm = commitments.find(c => c.id === commId);

    if (comm?.google_event_id && (googleAccessToken || getStoredGoogleToken(currentUser.uid))) {
      try {
        await deleteGoogleCalendarEvent(googleAccessToken || getStoredGoogleToken(currentUser.uid), comm.google_event_id);
      } catch (e) {
        console.warn('Could not remove calendar event during commitment deletion:', e);
      }
    }

    await deleteCommitmentFromFirestore(currentUser.uid, commId);
    if (comm) {
      await logActivityInFirestore(currentUser.uid, 'deleted', 'commitment', `Deleted commitment: "${comm.title}"`);
    }
  };

  // CRUD for Follow-Ups (Firestore backed)
  const addFollowUp = async (fData) => {
    if (!currentUser?.uid) throw new Error('You must be logged in to create a follow-up');
    const id = await createFollowUpInFirestore(currentUser.uid, fData);
    await logActivityInFirestore(currentUser.uid, 'created', 'follow_up', `Scheduled follow-up with ${fData.contact_person || 'contact'}: "${fData.title}"`);
    return id;
  };

  const updateFollowUpStatus = async (fId, nextStatus) => {
    if (!currentUser?.uid) return;
    const f = followUps.find(item => item.id === fId);
    if (!f) return;

    await updateFollowUpInFirestore(currentUser.uid, fId, {
      status: nextStatus,
      response_received_date: nextStatus === 'received_response' ? new Date().toISOString() : f.response_received_date || null
    });

    await logActivityInFirestore(currentUser.uid, 'updated', 'follow_up', `Updated follow-up status to ${nextStatus}: "${f.title}"`);
  };

  const updateFollowUp = async (fId, updates) => {
    if (!currentUser?.uid) return;
    await updateFollowUpInFirestore(currentUser.uid, fId, updates);
  };

  const deleteFollowUp = async (fId) => {
    if (!currentUser?.uid) return;
    const f = followUps.find(item => item.id === fId);
    await deleteFollowUpFromFirestore(currentUser.uid, fId);
    if (f) {
      await logActivityInFirestore(currentUser.uid, 'deleted', 'follow_up', `Deleted follow-up: "${f.title}"`);
    }
  };

  // Attention Engine Computations for Dashboard & Global Views
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const activeCommitments = commitments.filter(c => c.status !== 'fulfilled');
  const activeFollowUps = followUps.filter(f => f.status !== 'received_response' && f.status !== 'closed');
  const activeGoals = goals.filter(g => g.status === 'active');

  const rankedTasks = rankByAttention(activeTasks, 'task');
  const rankedCommitments = rankByAttention(activeCommitments, 'commitment');
  const rankedFollowUps = rankByAttention(activeFollowUps, 'follow_up');
  const rankedGoals = rankByAttention(activeGoals, 'goal');

  // Unified Attention Queue: All active entities sorted strictly by Attention Score (0-100)
  const unifiedAttentionQueue = [
    ...rankedTasks.map(t => ({ ...t, itemType: 'task' })),
    ...rankedCommitments.map(c => ({ ...c, itemType: 'commitment' })),
    ...rankedFollowUps.map(f => ({ ...f, itemType: 'follow_up' })),
    ...rankedGoals.map(g => ({ ...g, itemType: 'goal' })),
  ].sort((a, b) => b.attention.score - a.attention.score);

  // Helper to determine if an opportunity or deadline is expired
  const isOpportunityExpired = (item) => {
    if (!item) return false;
    if (item.status === 'EXPIRED' || item.status === 'expired' || item.isExpired === true) return true;
    const dl = item.deadline || item.deadlineDate;
    if (!dl) return false;
    const dlMs = new Date(dl).getTime();
    return !isNaN(dlMs) && dlMs <= Date.now();
  };

  // Risk Classification Breakdown
  const overdueCount = unifiedAttentionQueue.filter(i => i.attention.risk === RISK_LEVELS.OVERDUE).length;
  const atRiskCount = unifiedAttentionQueue.filter(i => i.attention.risk === RISK_LEVELS.AT_RISK).length;
  const neglectedCount = unifiedAttentionQueue.filter(i => i.attention.risk === RISK_LEVELS.NEGLECTED).length;
  const criticalGmailCount = gmailFollowUps.filter(i => 
    (i.priorityLevel === 'CRITICAL' || i.score >= 80) && 
    !isOpportunityExpired(i) && 
    i.status !== 'DISMISSED' && 
    i.status !== 'COMPLETED'
  ).length;
  const activeGmailCount = gmailFollowUps.filter(i => 
    !isOpportunityExpired(i) && 
    i.status !== 'DISMISSED' && 
    i.status !== 'COMPLETED'
  ).length;
  const expiredGmailCount = gmailFollowUps.filter(i => isOpportunityExpired(i)).length;
  const unreadNotificationCount = (systemNotifications || []).filter(n => !n.read).length;

  const isGoogleConnected = Boolean(
    (googleIntegration?.connected || serverGoogleStatus?.connected) &&
    serverGoogleStatus?.status !== 'DISCONNECTED' &&
    serverGoogleStatus?.status !== 'NEEDS_REAUTHORIZATION'
  );

  const googleWorkspaceStatus = serverGoogleStatus?.status || (
    isGoogleConnected ? 'CONNECTED' :
    (serverGoogleStatus?.requiresReauth || googleIntegration?.requiresReauth) ? 'NEEDS_REAUTHORIZATION' :
    'DISCONNECTED'
  );

  const googleWorkspace = {
    connected: isGoogleConnected,
    status: googleWorkspaceStatus,
    email: googleIntegration?.email || serverGoogleStatus?.email || currentUser?.email || '',
    connectedAt: googleIntegration?.connectedAt || serverGoogleStatus?.connectedAt || null,
    requiresReauth: googleWorkspaceStatus === 'NEEDS_REAUTHORIZATION',
    lastError: serverGoogleStatus?.lastError || null,
    hasRefreshToken: Boolean(serverGoogleStatus?.hasRefreshToken),
    scopes: googleIntegration?.scopes || serverGoogleStatus?.scopes || [],
    gmailSyncEnabled: true,
    calendarSyncEnabled: true,
  };

  return (
    <AppContext.Provider
      value={{
        currentRoute,
        navigate,
        user: userProfile || {
          uid: currentUser?.uid,
          email: currentUser?.email,
          displayName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Priorix User'
        },
        goals,
        tasks,
        commitments,
        followUps,
        activityLogs,
        systemNotifications,
        unreadNotificationCount,
        notificationSettings,
        emailAnalyses,
        deadlines,
        isDataLoading: isDataLoading && authLoading,
        dataError,
        // Google Integration & Workspace State
        googleIntegration,
        serverGoogleStatus,
        googleWorkspaceStatus,
        googleWorkspace,
        isGoogleConnected,
        isCheckingGoogleStatus,
        googleAccessToken,
        googleCalendarEvents,
        isFetchingCalendar,
        calendarError,
        showGoogleCalendarInTimeline,
        setShowGoogleCalendarInTimeline,
        gmailFollowUps,
        criticalGmailCount,
        activeGmailCount,
        expiredGmailCount,
        isOpportunityExpired,
        isScanningGmail,
        gmailError,
        connectGoogle,
        reconnectGoogle,
        disconnectGoogle,
        refreshGoogleCalendarEvents,
        scanGmail,
        workerStatus,
        refreshWorkerStatus,
        triggerAutonomousSync,
        syncTaskToGoogleCalendar,
        removeTaskFromGoogleCalendar,
        syncCommitmentToGoogleCalendar,
        syncEmailToGoogleCalendar,
        updateEmailAnalysisStatus,
        convertGmailToPriorixFollowUp,
        updateNotificationSettings,
        markNotificationAsRead,
        // Tasks CRUD
        addTask,
        toggleTaskStatus,
        updateTask,
        deleteTask,
        // Goals CRUD
        addGoal,
        updateGoalProgress,
        updateGoal,
        deleteGoal,
        // Commitments CRUD
        addCommitment,
        toggleCommitmentStatus,
        updateCommitment,
        deleteCommitment,
        // Follow-Ups CRUD
        addFollowUp,
        updateFollowUpStatus,
        updateFollowUp,
        deleteFollowUp,
        // Modals
        isQuickAddOpen,
        setIsQuickAddOpen,
        quickAddType,
        setQuickAddType,
        isVoiceModalOpen,
        setIsVoiceModalOpen,
        // Computed Attention Signals
        unifiedAttentionQueue,
        overdueCount,
        atRiskCount,
        neglectedCount,
        rankedTasks,
        rankedCommitments,
        rankedFollowUps,
        rankedGoals
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

