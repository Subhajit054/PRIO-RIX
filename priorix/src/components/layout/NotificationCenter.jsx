import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Bell,
  CheckCircle2,
  Flame,
  Clock,
  ExternalLink,
  Trash2,
  Check,
  ShieldAlert,
  Sparkles,
  Plane,
  X,
  Mail,
  Zap
} from 'lucide-react';

export function NotificationCenter() {
  const {
    systemNotifications,
    unreadNotificationCount,
    markNotificationAsRead,
    notificationSettings,
    updateNotificationSettings,
    navigate
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'critical', 'deadlines', 'unread'
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredNotifications = (systemNotifications || []).filter(item => {
    if (filter === 'unread') return !item.read;
    if (filter === 'critical') return item.priority === 'CRITICAL' || (item.score && item.score >= 80);
    if (filter === 'deadlines') return Boolean(item.deadlineDate);
    return true;
  });

  const handleMarkAllRead = () => {
    (systemNotifications || []).forEach(n => {
      if (!n.read) markNotificationAsRead(n.id);
    });
  };

  const handleToggleAwayMode = async () => {
    if (notificationSettings) {
      await updateNotificationSettings({
        awayMode: !notificationSettings.awayMode,
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Trigger */}
      <button
        id="btn-notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-850 transition-colors"
        aria-label="Notification Center"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center border-2 border-slate-950">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Modal */}
      {isOpen && (
        <div
          id="notification-center-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-100">Executive Alert Center</h3>
            </div>

            <div className="flex items-center gap-2">
              {unreadNotificationCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Away Mode Quick Bar */}
          <div className={`px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs ${
            notificationSettings?.awayMode ? 'bg-amber-950/30 text-amber-200' : 'bg-slate-950/40 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Plane className={`w-3.5 h-3.5 ${notificationSettings?.awayMode ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="font-semibold">{notificationSettings?.awayMode ? 'Away Mode: ACTIVE' : 'Away Mode: Off'}</span>
            </div>
            <button
              onClick={handleToggleAwayMode}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                notificationSettings?.awayMode
                  ? 'bg-amber-900/60 text-amber-200 border-amber-700/60'
                  : 'bg-slate-850 text-slate-300 border-slate-700 hover:border-slate-600'
              }`}
            >
              {notificationSettings?.awayMode ? 'Deactivate' : 'Turn On'}
            </button>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 bg-slate-950/50 border-b border-slate-800/60 flex items-center gap-1 overflow-x-auto text-[11px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({systemNotifications?.length || 0})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === 'unread' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadNotificationCount})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === 'critical' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilter('deadlines')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filter === 'deadlines' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deadlines
            </button>
          </div>

          {/* Notifications Feed */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-400">All caught up!</p>
                <p className="text-[10px] text-slate-600">No active alerts matching this filter.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isCritical = notif.priority === 'CRITICAL' || (notif.score && notif.score >= 80);

                return (
                  <div
                    key={notif.id}
                    onClick={() => markNotificationAsRead(notif.id)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-2.5 ${
                      !notif.read ? 'bg-slate-850/60 hover:bg-slate-800/60' : 'bg-slate-900/40 hover:bg-slate-850/40'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isCritical ? (
                        <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                          <Flame className="w-3.5 h-3.5" />
                        </div>
                      ) : notif.type === 'critical_email' ? (
                        <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {notif.title || notif.subject}
                        </span>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.body || notif.message || notif.summary}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                        <span>
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                        {notif.deadlineDate && (
                          <span className="text-amber-400 font-sans font-semibold">
                            Due: {new Date(notif.deadlineDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/follow-ups');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center justify-center gap-1 w-full"
            >
              <span>View All Detected Opportunities</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
