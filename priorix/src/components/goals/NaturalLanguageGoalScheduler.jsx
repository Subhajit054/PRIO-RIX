import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Edit3,
  HelpCircle,
  Loader2,
  Check,
  ChevronRight,
  ShieldCheck,
  Layers
} from 'lucide-react';

export function NaturalLanguageGoalScheduler({ onScheduleCreated }) {
  const {
    addGoal,
    addTask,
    googleAccessToken,
    refreshGoogleCalendarEvents,
    user
  } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedTime, setEditedTime] = useState('');

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setInputQuery(text);
      };

      recognition.onerror = (event) => {
        console.warn('Natural language speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access was denied. You can type your command below.');
        } else if (event.error !== 'no-speech') {
          setErrorMessage(`Voice recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech start error:', err);
      }
    }
  };

  const handleParse = async (textToSubmit) => {
    const query = (textToSubmit || inputQuery).trim();
    if (!query) {
      setErrorMessage('Please type or speak a goal or scheduling request.');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setParsedResult(null);
    setIsEditing(false);

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const res = await fetch('/api/voice/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: query,
          timezone: userTz,
          nowIso: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to interpret natural language request');
      }

      setParsedResult(data.parsed);
      setEditedTitle(data.parsed.title || '');
      setEditedDate(data.parsed.date || '');
      setEditedTime(data.parsed.time || '');
    } catch (err) {
      console.error('Goal scheduling parse error:', err);
      setErrorMessage(err.message || 'Could not interpret command. Please try rephrasing.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnswerClarification = async () => {
    if (!clarificationAnswer.trim()) return;
    const combinedQuery = `${inputQuery}. ${clarificationAnswer.trim()}`;
    setInputQuery(combinedQuery);
    setClarificationAnswer('');
    await handleParse(combinedQuery);
  };

  const handleConfirmSchedule = async () => {
    if (!parsedResult) return;

    setIsConfirming(true);
    setErrorMessage(null);

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const finalTitle = isEditing ? editedTitle : (parsedResult.title || 'Goal');
      const finalDate = isEditing ? editedDate : parsedResult.date;
      const finalTime = isEditing ? editedTime : parsedResult.time;

      let finalDateTimeIso = parsedResult.dateTimeIso;
      if (finalDate && finalTime) {
        finalDateTimeIso = `${finalDate}T${finalTime}:00`;
      }

      let calendarEventId = null;

      // 1. Google Calendar sync if dateTime is confirmed
      if (finalDateTimeIso && googleAccessToken) {
        try {
          const calRes = await fetch('/api/voice/confirm-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              voiceCommandId: parsedResult.voiceCommandId,
              uid: user?.uid,
              title: finalTitle,
              dateTimeIso: finalDateTimeIso,
              timezone: userTz,
              reminders: parsedResult.reminderPreferences,
              priority: parsedResult.priority || 'HIGH',
              accessToken: googleAccessToken,
            }),
          });

          const calData = await calRes.json();
          if (calData?.scheduled?.calendarEventId) {
            calendarEventId = calData.scheduled.calendarEventId;
            refreshGoogleCalendarEvents(googleAccessToken).catch(() => {});
          }
        } catch (calErr) {
          console.warn('Calendar sync notice during goal confirmation:', calErr);
        }
      }

      // 2. Local entity creation in Priorix
      if (parsedResult.goalType === 'GOAL' || (!finalDateTimeIso && parsedResult.intent === 'schedule_task')) {
        await addGoal({
          title: finalTitle,
          description: `Created via natural language: "${inputQuery}"`,
          category: 'career',
          target_date: finalDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          milestones: [
            { id: `ms_${Date.now()}_1`, title: 'Define preparation milestone', is_completed: false },
            { id: `ms_${Date.now()}_2`, title: 'Execute key practice tasks', is_completed: false },
          ],
        });
      } else {
        // Create primary task / event
        const dueDate = finalDate || new Date().toISOString().split('T')[0];
        await addTask({
          title: finalTitle,
          due_date: dueDate,
          due_time: finalTime || null,
          priority: (parsedResult.priority || 'HIGH').toLowerCase(),
          category: parsedResult.category === 'COMMITMENT' ? 'client' : 'career',
          estimated_minutes: 45,
          description: `Created via Natural Language Scheduler\nSource query: "${inputQuery}"${calendarEventId ? `\nSynced to Google Calendar` : ''}`,
        });

        // 3. Create Preparation Task if extracted
        if (parsedResult.preparationTask) {
          await addTask({
            title: parsedResult.preparationTask,
            due_date: dueDate,
            due_time: finalTime ? calculatePrepTime(finalTime, parsedResult.preparationReminderMinutes || 120) : null,
            priority: 'high',
            category: 'career',
            estimated_minutes: 30,
            description: `Preparation task linked to: ${finalTitle}\nReminder: ${parsedResult.preparationReminderLabel || '2 hours before'}`,
          });
        }
      }

      setSuccessMessage(`Successfully created "${finalTitle}"${calendarEventId ? ' and synchronized with Google Calendar' : ''}!`);
      setParsedResult(null);
      setInputQuery('');
      setIsEditing(false);

      if (onScheduleCreated) {
        onScheduleCreated();
      }
    } catch (err) {
      console.error('Failed to create schedule:', err);
      setErrorMessage(err.message || 'Failed to create schedule. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Helper to compute preparation reminder time e.g. 3:00 PM minus 2 hours = 1:00 PM
  const calculatePrepTime = (timeStr, offsetMinutes = 120) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m - offsetMinutes;
    if (totalMins < 0) return '09:00';
    const newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const formatDisplayTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Natural-Language Goal & Schedule Creator</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/40">
                Voice & Text
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Type or speak natural instructions. Priorix extracts goals, preparation tasks, deadlines, and reminders.
            </p>
          </div>
        </div>
      </div>

      {/* Input Bar */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500/80 transition-colors">
          <button
            type="button"
            id="btn-voice-input-goals"
            onClick={toggleMic}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={isListening ? 'Stop listening' : 'Start speaking'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            id="input-natural-goal-query"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleParse();
            }}
            placeholder='e.g. "I have an interview with ABC tomorrow at 3 PM. Remind me to prepare my resume two hours before."'
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          <button
            type="button"
            id="btn-submit-natural-goal"
            onClick={() => handleParse()}
            disabled={isParsing || !inputQuery.trim()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            {isParsing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Interpret</span>
          </button>
        </div>

        {isListening && (
          <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Listening... Speak your command clearly (e.g. "I have an interview tomorrow at 3 PM...")</span>
          </p>
        )}
      </div>

      {/* Error or Success feedback */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Parsed Result Preview Card (Shown BEFORE permanently creating anything) */}
      {parsedResult && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-indigo-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">I understood:</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                {parsedResult.goalType || 'SCHEDULE'}
              </span>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
            </button>
          </div>

          {/* Ambiguity / Clarification Required Banner (Zero Deadline Fabrication Rule) */}
          {parsedResult.isAmbiguous && parsedResult.clarificationQuestion && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-xs space-y-2 text-amber-200">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="font-medium">{parsedResult.clarificationQuestion}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnswerClarification();
                  }}
                  placeholder="e.g. Friday at 10 AM, or Tomorrow at 4 PM..."
                  className="w-full bg-slate-900 border border-amber-800/50 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAnswerClarification}
                  className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium shrink-0"
                >
                  Reply
                </button>
              </div>
            </div>
          )}

          {/* Structured Display */}
          <div className="space-y-2.5 text-xs">
            {/* Event or Goal Title */}
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="w-full">
                {isEditing ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      placeholder="Title"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editedDate}
                        onChange={(e) => setEditedDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="time"
                        value={editedTime}
                        onChange={(e) => setEditedTime(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-slate-100 text-sm block">
                      {parsedResult.title}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {parsedResult.date
                        ? `${parsedResult.date} at ${formatDisplayTime(parsedResult.time)}`
                        : 'No fixed deadline (Continuous Goal)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Preparation Task */}
            {parsedResult.preparationTask && (
              <div className="flex items-start gap-2 pl-2 border-l-2 border-indigo-500/40 py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-200 font-medium block">
                    Preparation: {parsedResult.preparationTask}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Bell className="w-3 h-3 text-amber-400" />
                    <span>
                      Reminder: {parsedResult.preparationReminderLabel || '2 hours before'}{' '}
                      {parsedResult.time && `(${formatDisplayTime(calculatePrepTime(parsedResult.time, parsedResult.preparationReminderMinutes || 120))})`}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Google Calendar Sync Indicator */}
            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {googleAccessToken
                  ? 'Will automatically sync to Google Calendar'
                  : 'Will be stored in Priorix Workspace'}
              </span>
            </div>
          </div>

          {/* Confirmation Controls */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setParsedResult(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-confirm-natural-schedule"
              onClick={handleConfirmSchedule}
              disabled={isConfirming}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {isConfirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Confirm & Create</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
