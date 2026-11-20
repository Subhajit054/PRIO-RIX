import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Sliders,
  Shield,
  CheckCircle2,
  Calendar,
  Mail,
  User,
  LogOut,
  Sparkles,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Lock,
  Eye,
  Check,
  Bell,
  Plane,
  Moon
} from 'lucide-react';

export function SettingsView() {
  const {
    navigate,
    googleIntegration,
    googleWorkspace,
    isGoogleConnected,
    connectGoogle,
    reconnectGoogle,
    disconnectGoogle,
    googleCalendarEvents,
    refreshGoogleCalendarEvents,
    isFetchingCalendar,
    calendarError,
    showGoogleCalendarInTimeline,
    setShowGoogleCalendarInTimeline,
    gmailFollowUps,
    scanGmail,
    isScanningGmail,
    gmailError,
    convertGmailToPriorixFollowUp,
    notificationSettings,
    updateNotificationSettings,
    workerStatus,
    triggerAutonomousSync
  } = useApp();

  const { currentUser, userProfile, logout, updateProfileData } = useAuth();

  const [profileForm, setProfileForm] = useState({
    displayName: userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Priorix User',
    email: currentUser?.email || '',
    attentionThreshold: userProfile?.attentionThreshold || 75,
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  useEffect(() => {
    setProfileForm({
      displayName: userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Priorix User',
      email: currentUser?.email || '',
      attentionThreshold: userProfile?.attentionThreshold ?? 75,
    });
  }, [userProfile, currentUser]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setSavedNotice(false);
    try {
      await updateProfileData({
        displayName: profileForm.displayName.trim() || 'Priorix User',
        attentionThreshold: Number(profileForm.attentionThreshold) || 75,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileError(err.message || 'Could not save preferences. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      await connectGoogle();
    } catch (err) {
      if (
        err?.isCancelled ||
        err?.type === 'popup_closed' ||
        err?.message?.toLowerCase().includes('closed') ||
        err?.message?.toLowerCase().includes('cancelled')
      ) {
        setConnectError('Authorization was cancelled. Click Connect Google Workspace when you are ready.');
      } else {
        console.error('Google connect error:', err);
        setConnectError(err.message || 'Failed to connect Google Account. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmDisconnectGoogle = async () => {
    try {
      await disconnectGoogle();
      setConfirmingDisconnect(false);
    } catch (err) {
      console.error('Disconnect error:', err);
      setConnectError(err.message || 'Could not disconnect Google Workspace.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            Settings &amp; Integrations
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage automated Gmail-to-Calendar reminders, notification preferences, and account settings
          </p>
        </div>
      </div>

      {/* Progressive Deadline Awareness & Notification Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">Progressive Deadline Awareness & Notification Preferences</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic priority thresholding, multi-stage reminder curves, and noise suppression
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Smart Alerts Active
            </span>
          </div>
        </div>

        {/* Minimum Score Threshold Slider */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-200">Minimum Notification Score Threshold</h4>
              <p className="text-[11px] text-slate-400">
                Only emails scoring at or above this threshold trigger Calendar events and progressive alerts.
              </p>
            </div>
            <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
              {notificationSettings?.minScore ?? 75}/100
            </span>
          </div>

          <div className="space-y-1">
            <input
              id="slider-min-notification-score"
              type="range"
              min="50"
              max="95"
              step="5"
              value={notificationSettings?.minScore ?? 75}
              onChange={(e) => updateNotificationSettings({ minScore: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50 (Permissive)</span>
              <span>75 (Default - Recommended)</span>
              <span>95 (Critical Only)</span>
            </div>
          </div>
        </div>

        {/* Reminder Intensity Profiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Critical Items Profile */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Critical Priority Reminders
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Score ≥ 80</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-stage alert schedule leading up to deadline expiration.
            </p>
            <select
              id="select-critical-intensity"
              value={notificationSettings?.criticalIntensity || 'balanced'}
              onChange={(e) => updateNotificationSettings({ criticalIntensity: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="minimal">Minimal (24h, 1h, 10m before)</option>
              <option value="balanced">Balanced (24h, 6h, 1h, 10m before - Recommended)</option>
              <option value="frequent">Frequent (48h, 24h, 12h, 6h, 3h, 1h, 30m, 10m before)</option>
            </select>
          </div>

          {/* Important Items Profile */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Important Priority Reminders
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Score 65–79</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Moderate alert profile for secondary action items.
            </p>
            <select
              id="select-important-intensity"
              value={notificationSettings?.importantIntensity || 'minimal'}
              onChange={(e) => updateNotificationSettings({ importantIntensity: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="minimal">Minimal (24h, 1h before - Recommended)</option>
              <option value="balanced">Balanced (24h, 6h, 1h before)</option>
              <option value="frequent">Frequent (24h, 12h, 3h, 1h, 30m before)</option>
            </select>
          </div>
        </div>

        {/* Quiet Hours & Safety Override */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quiet Hours */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-slate-200">Quiet Hours (Do Not Disturb)</h4>
              </div>
              <input
                id="toggle-quiet-hours"
                type="checkbox"
                checked={notificationSettings?.quietHoursEnabled ?? false}
                onChange={(e) => updateNotificationSettings({ quietHoursEnabled: e.target.checked })}
                className="accent-indigo-500 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Suppresses audible alert popups during designated rest hours while quietly updating dashboard.
            </p>
            {notificationSettings?.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Start Time</label>
                  <input
                    id="input-quiet-hours-start"
                    type="time"
                    value={notificationSettings?.quietHoursStart || '23:00'}
                    onChange={(e) => updateNotificationSettings({ quietHoursStart: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">End Time</label>
                  <input
                    id="input-quiet-hours-end"
                    type="time"
                    value={notificationSettings?.quietHoursEnd || '07:00'}
                    onChange={(e) => updateNotificationSettings({ quietHoursEnd: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Time-Critical Safety Override */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200">Emergency Imminent Override</h4>
              </div>
              <input
                id="toggle-safety-override"
                type="checkbox"
                checked={notificationSettings?.enableTimeCriticalSafetyOverride ?? true}
                onChange={(e) => updateNotificationSettings({ enableTimeCriticalSafetyOverride: e.target.checked })}
                className="accent-emerald-500 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If an email has a confirmed deadline expiring within 45 minutes, Priorix will issue ONE emergency notification regardless of threshold settings to prevent missed commitments.
            </p>
          </div>
        </div>

        {/* Away Mode Switch */}
        <div className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          notificationSettings?.awayMode
            ? 'bg-amber-950/40 border-amber-600/60 shadow-lg shadow-amber-950/20'
            : 'bg-slate-950/70 border-slate-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Plane className={`w-4 h-4 ${notificationSettings?.awayMode ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
              <h4 className="text-xs font-bold text-slate-100">Executive "Away Mode" / Strict Focus</h4>
            </div>
            <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
              When enabled, only critical campus placement deadlines and high-priority recruiter emails are alerted.
            </p>
          </div>

          <button
            id="btn-toggle-away-mode"
            onClick={() => updateNotificationSettings({ awayMode: !notificationSettings?.awayMode })}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              notificationSettings?.awayMode
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs shadow-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {notificationSettings?.awayMode ? 'Away Mode: ACTIVE' : 'Enable Away Mode'}
          </button>
        </div>

        {/* Category Toggles & Calendar Sync */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-200">Signals & Automatic Synchronization</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="checkbox-job-alerts"
                type="checkbox"
                checked={notificationSettings?.jobAlerts ?? true}
                onChange={(e) => updateNotificationSettings({ jobAlerts: e.target.checked })}
                className="accent-indigo-500 rounded"
              />
              <span>Campus Recruitment & Job Drives</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="checkbox-exam-alerts"
                type="checkbox"
                checked={notificationSettings?.examAlerts ?? true}
                onChange={(e) => updateNotificationSettings({ examAlerts: e.target.checked })}
                className="accent-indigo-500 rounded"
              />
              <span>Exam Notices & Academic Deadlines</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="checkbox-deadline-alerts"
                type="checkbox"
                checked={notificationSettings?.deadlineAlerts ?? true}
                onChange={(e) => updateNotificationSettings({ deadlineAlerts: e.target.checked })}
                className="accent-indigo-500 rounded"
              />
              <span>Explicit Application Deadlines</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="checkbox-auto-calendar-sync"
                type="checkbox"
                checked={notificationSettings?.autoCalendarSync ?? true}
                onChange={(e) => updateNotificationSettings({ autoCalendarSync: e.target.checked })}
                className="accent-indigo-500 rounded"
              />
              <span>Auto-create Google Calendar Events with Progressive Popups</span>
            </label>
          </div>
        </div>
      </div>

      {/* Google Workspace Real Integration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">Google Workspace Integrations</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous background Gmail monitoring and Google Calendar synchronization
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isGoogleConnected ? (
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Google Workspace Connected
              </span>
            ) : googleWorkspace?.requiresReauth ? (
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Re-auth Required
              </span>
            ) : (
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Connected Confirmation Banner */}
        {isGoogleConnected && (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-100">Google Workspace Connected</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Authorized Account: <strong className="text-slate-200 font-mono">{googleWorkspace?.email || currentUser?.email}</strong>
                  {googleWorkspace?.connectedAt && (
                    <span className="text-slate-500 ml-2">
                      • Connected {new Date(googleWorkspace.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Gmail ✓
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Calendar ✓
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Re-auth Warning Banner */}
        {!isGoogleConnected && googleWorkspace?.requiresReauth && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Google Workspace Authorization Expired / Reconnect Required</span>
            </div>
            <p className="text-xs text-slate-400">
              Your Google authorization has expired. Re-authenticate to resume continuous Gmail inbox monitoring and Calendar event synchronization.
            </p>
          </div>
        )}

        {/* OAuth Permission Transparency Box */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Strict Privacy & Scope Enforcement</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Google Calendar Events
                </span>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                  calendar.events
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Priorix creates automated calendar reminders for confirmed deadlines and synchronization.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Gmail Follow-Up Detector
                </span>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                  gmail.readonly
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Strictly read-only. Scans message metadata to detect unanswered inquiries. <strong className="text-slate-300">Never sends, modifies, organizes, archives, or deletes emails.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Connect / Disconnect Actions */}
        {connectError && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{connectError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          {isGoogleConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              {confirmingDisconnect ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/40 border border-rose-800/60">
                  <span className="text-xs text-rose-200">Disconnect Gmail &amp; Calendar?</span>
                  <button
                    id="btn-confirm-disconnect-google"
                    onClick={handleConfirmDisconnectGoogle}
                    className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                  >
                    Yes, Disconnect
                  </button>
                  <button
                    onClick={() => setConfirmingDisconnect(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  id="btn-disconnect-google"
                  onClick={() => setConfirmingDisconnect(true)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 text-xs font-semibold transition-colors"
                >
                  Disconnect Google Account
                </button>
              )}
              <button
                id="btn-reconnect-google"
                onClick={() => handleConnectGoogle()}
                disabled={isConnecting}
                className="px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                <span>Refresh Permissions</span>
              </button>
            </div>
          ) : googleWorkspace?.requiresReauth ? (
            <button
              id="btn-reconnect-google-required"
              onClick={() => handleConnectGoogle()}
              disabled={isConnecting}
              className="flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/30 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Reconnecting to Google...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Reconnect Google Workspace</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="btn-connect-google"
              onClick={() => handleConnectGoogle()}
              disabled={isConnecting}
              className="flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-600/30 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Connect Google Workspace</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Real Live Subsystems Panels */}
        {isGoogleConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            {/* Google Calendar Panel */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-200">Google Calendar</h4>
                </div>
                <button
                  id="btn-sync-calendar-events"
                  onClick={() => refreshGoogleCalendarEvents()}
                  disabled={isFetchingCalendar}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingCalendar ? 'animate-spin' : ''}`} />
                  <span>{isFetchingCalendar ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              {calendarError && (
                <p className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                  {calendarError}
                </p>
              )}

              <div className="space-y-1.5 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Synced External Events:</span>
                  <span className="font-mono text-slate-200 font-bold">{googleCalendarEvents.length} events</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>Show in Calendar View:</span>
                  <input
                    type="checkbox"
                    checked={showGoogleCalendarInTimeline}
                    onChange={(e) => setShowGoogleCalendarInTimeline(e.target.checked)}
                    className="accent-indigo-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Autonomous Gmail Monitoring Panel */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200">Autonomous Worker (3-Min Cycle)</h4>
                </div>
                <button
                  id="btn-scan-gmail"
                  onClick={() => triggerAutonomousSync()}
                  disabled={isScanningGmail}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 transition-colors disabled:opacity-50"
                  title="Scan Gmail inbox and sync calendar reminders now"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanningGmail ? 'animate-spin' : ''}`} />
                  <span>{isScanningGmail ? 'Scanning...' : 'Sync Now'}</span>
                </button>
              </div>

              {gmailError && (
                <p className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                  {gmailError}
                </p>
              )}

              <div className="space-y-1.5 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Background Sync:</span>
                  <span className="font-mono text-emerald-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monitored Inbox Items:</span>
                  <span className="font-mono text-slate-200 font-bold">{gmailFollowUps.length} opportunities</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Automatically scans your inbox every 3 minutes and adds important deadlines &amp; reminders to Google Calendar.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Info & Logout */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">Account</h3>
          </div>
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Signed In
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30 flex items-center justify-center text-sm">
              {(profileForm.displayName || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">{profileForm.displayName}</p>
              <p className="text-xs text-slate-400 font-mono">{currentUser?.email || 'Authenticated Account'}</p>
            </div>
          </div>

          <button
            id="btn-settings-logout"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Profile & Execution Thresholds */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">User Profile & Attention Thresholds</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Display Name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <input
                type="text"
                disabled
                value={profileForm.email}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Attention Score Alert Threshold ({profileForm.attentionThreshold}/100)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Items with an Attention Score equal to or exceeding this threshold are highlighted with alert indicators across your dashboard.
            </p>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={profileForm.attentionThreshold}
              onChange={(e) => setProfileForm({ ...profileForm, attentionThreshold: Number(e.target.value) })}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {profileError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {savedNotice ? (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Profile preferences saved
              </span>
            ) : <span />}

            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs shadow-indigo-600/30"
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


