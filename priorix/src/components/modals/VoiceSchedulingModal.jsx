import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Mic,
  MicOff,
  Sparkles,
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Flame,
  Volume2
} from 'lucide-react';

export function VoiceSchedulingModal() {
  const {
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    addTask,
    addCommitment,
    addFollowUp,
    googleAccessToken,
    refreshGoogleCalendarEvents,
    user
  } = useApp();

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedSchedule, setParsedSchedule] = useState(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);

  // Initialize Web Speech API if supported
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setParseError(null);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setParseError('Microphone permission was denied. You can type your command below.');
        } else if (event.error !== 'no-speech') {
          setParseError(`Voice input error: ${event.error}. You can also type directly.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
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

  // Clean state when modal opens/closes
  useEffect(() => {
    if (isVoiceModalOpen) {
      setTranscript('');
      setParsedSchedule(null);
      setScheduleSuccess(null);
      setParseError(null);
    } else {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    }
  }, [isVoiceModalOpen]);

  if (!isVoiceModalOpen) return null;

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setParseError('Speech recognition is not supported in this browser. Please type your command.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setParseError(null);
      setScheduleSuccess(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  const handleParseTranscript = async (textToParse) => {
    const text = (textToParse || transcript).trim();
    if (!text) {
      setParseError('Please speak or enter a scheduling command.');
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const response = await fetch('/api/voice/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          timezone: userTz,
          nowIso: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse voice command');
      }

      setParsedSchedule(data.parsed);
    } catch (err) {
      console.error('Voice parsing error:', err);
      setParseError(err.message || 'Could not analyze voice command. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!parsedSchedule) return;

    setIsConfirming(true);
    setParseError(null);

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      const displayTitle = parsedSchedule.title || parsedSchedule.intent || 'Scheduled Item';

      // 1. Send to server voice confirmation endpoint (creates Google Calendar event if authenticated)
      const res = await fetch('/api/voice/confirm-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceCommandId: parsedSchedule.voiceCommandId,
          uid: user?.uid,
          title: displayTitle,
          dateTimeIso: parsedSchedule.dateTimeIso,
          timezone: userTz,
          reminders: parsedSchedule.reminderPreferences,
          priority: parsedSchedule.priority,
          accessToken: googleAccessToken,
        }),
      });

      const serverData = await res.json();
      if (!res.ok || !serverData.success) {
        throw new Error(serverData.error || 'Failed to confirm schedule on server');
      }

      // 2. Persist locally to Firestore according to category
      const targetDate = parsedSchedule.dateTimeIso ? parsedSchedule.dateTimeIso.split('T')[0] : new Date().toISOString().split('T')[0];

      if (parsedSchedule.category === 'COMMITMENT') {
        await addCommitment({
          title: displayTitle,
          recipient: 'Scheduled via Voice',
          source: 'voice_assistant',
          importance: (parsedSchedule.priority || '').toUpperCase() === 'CRITICAL' ? 'critical' : 'high',
          due_date: targetDate,
          notes: `Voice scheduled: ${parsedSchedule.rawTranscript || transcript}`,
        });
      } else if (parsedSchedule.category === 'FOLLOW_UP') {
        await addFollowUp({
          title: displayTitle,
          contact_person: 'Contact',
          contact_channel: 'calendar',
          context: `Voice scheduled: ${parsedSchedule.rawTranscript || transcript}`,
          sent_date: new Date().toISOString().split('T')[0],
          follow_up_due_date: targetDate,
        });
      } else {
        // Default to Actionable Task
        await addTask({
          title: displayTitle,
          description: `Voice scheduled: "${parsedSchedule.rawTranscript || transcript}"`,
          priority: (parsedSchedule.priority || 'high').toLowerCase(),
          due_date: targetDate,
          estimated_minutes: 45,
        });
      }

      if (serverData.scheduled?.calendarEventId && googleAccessToken) {
        refreshGoogleCalendarEvents(googleAccessToken).catch(() => {});
      }

      setScheduleSuccess({
        title: displayTitle,
        dateTimeIso: parsedSchedule.dateTimeIso,
        calendarEventId: serverData.scheduled?.calendarEventId || null,
        calendarEventLink: serverData.scheduled?.calendarEventLink || null,
      });
    } catch (err) {
      console.error('Confirmation error:', err);
      setParseError(err.message || 'Failed to save scheduled event.');
    } finally {
      setIsConfirming(false);
    }
  };

  const samplePrompts = [
    'Schedule project presentation tomorrow at 4 PM with high priority',
    'Add campus placement registration deadline on Friday 10 AM',
    'Follow up with recruiter on Monday at 2 PM',
  ];

  return (
    <div
      id="voice-scheduling-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="voice-scheduling-modal-container"
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Voice Scheduling Assistant
              </h3>
              <p className="text-xs text-slate-400">
                Speak naturally to schedule tasks, deadlines & calendar events
              </p>
            </div>
          </div>
          <button
            id="btn-close-voice-modal"
            onClick={() => setIsVoiceModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {scheduleSuccess ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-100">Successfully Scheduled!</h4>
              <p className="text-xs text-slate-300 max-w-sm mx-auto font-medium">
                "{scheduleSuccess.title}" has been added to your execution workspace
                {scheduleSuccess.calendarEventId ? ' and synced to Google Calendar' : ''}.
              </p>
              {scheduleSuccess.dateTimeIso && !isNaN(new Date(scheduleSuccess.dateTimeIso).getTime()) && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 max-w-sm mx-auto flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>
                    {new Date(scheduleSuccess.dateTimeIso).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              <button
                id="btn-voice-modal-done"
                onClick={() => setIsVoiceModalOpen(false)}
                className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
              >
                Return to Workspace
              </button>
            </div>
          ) : (
            <>
              {/* Voice Input Section */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center relative overflow-hidden">
                <button
                  id="btn-toggle-mic"
                  onClick={toggleListening}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-4 ring-rose-500/30 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <p className="text-xs font-semibold text-slate-200 mt-3">
                  {isListening ? 'Listening... Speak your command' : 'Click microphone or type below'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Powered by Gemini AI Semantic Intent Parsing
                </p>
              </div>

              {/* Text Input / Transcription Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Command Transcript</span>
                  {transcript && (
                    <button
                      onClick={() => setTranscript('')}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <textarea
                  id="input-voice-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="e.g., Schedule campus placement interview prep tomorrow at 4 PM"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>

              {/* Quick Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Quick Prompts:</span>
                <div className="flex flex-col gap-1.5">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(p);
                        handleParseTranscript(p);
                      }}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-800/80 text-slate-400 hover:text-indigo-300 border border-slate-800/60 transition-colors truncate"
                    >
                      "{p}"
                    </button>
                  ))}
                </div>
              </div>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed Preview Card */}
              {parsedSchedule && (
                <div
                  id="voice-parsed-preview"
                  className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40 space-y-2.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                      Parsed Intent Preview
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        parsedSchedule.priority === 'CRITICAL'
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                          : parsedSchedule.priority === 'HIGH'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                          : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40'
                      }`}
                    >
                      {parsedSchedule.priority} Priority
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-100">
                    {parsedSchedule.title || parsedSchedule.intent}
                  </h4>

                  {parsedSchedule.isAmbiguous && parsedSchedule.clarificationQuestion && (
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs">
                      {parsedSchedule.clarificationQuestion}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        {parsedSchedule.dateTimeIso && !isNaN(new Date(parsedSchedule.dateTimeIso).getTime())
                          ? new Date(parsedSchedule.dateTimeIso).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : (parsedSchedule.date || 'No date specified')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>
                        {parsedSchedule.dateTimeIso && !isNaN(new Date(parsedSchedule.dateTimeIso).getTime())
                          ? new Date(parsedSchedule.dateTimeIso).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : (parsedSchedule.time || 'No time specified')}
                      </span>
                    </div>
                  </div>

                  {parsedSchedule.reminderPreferences?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Reminder: {parsedSchedule.reminderPreferences[0].minutes} minutes before
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!scheduleSuccess && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3">
            <button
              id="btn-voice-cancel"
              onClick={() => setIsVoiceModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            {parsedSchedule ? (
              <button
                id="btn-confirm-schedule"
                onClick={handleConfirmSchedule}
                disabled={isConfirming}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-xs shadow-indigo-600/30 transition-colors"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Schedule</span>
                  </>
                )}
              </button>
            ) : (
              <button
                id="btn-parse-transcript"
                onClick={() => handleParseTranscript()}
                disabled={isParsing || !transcript.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-xs shadow-indigo-600/30 transition-colors"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Intent...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze & Preview</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
