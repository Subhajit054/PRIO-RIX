import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  ShieldCheck,
  Send,
  Calendar,
  Settings,
  Flame,
  Globe,
  LogOut,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export function Sidebar({ mobileOpen, setMobileOpen }) {
  const {
    currentRoute,
    navigate,
    tasks,
    goals,
    commitments,
    followUps,
    overdueCount,
    atRiskCount,
    criticalGmailCount,
    isGoogleConnected,
    googleCalendarEvents
  } = useApp();

  const { currentUser, userProfile, logout } = useAuth();

  const navItems = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      badge: overdueCount > 0 ? `${overdueCount} critical` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    {
      id: 'nav-tasks',
      label: 'Tasks',
      path: '/tasks',
      icon: CheckSquare,
      count: tasks.filter(t => t.status !== 'completed').length,
    },
    {
      id: 'nav-goals',
      label: 'Goals',
      path: '/goals',
      icon: Target,
      count: goals.filter(g => g.status === 'active').length,
    },
    {
      id: 'nav-commitments',
      label: 'Commitments',
      path: '/commitments',
      icon: ShieldCheck,
      count: commitments.filter(c => c.status !== 'fulfilled').length,
    },
    {
      id: 'nav-follow-ups',
      label: 'Follow-ups & Gmail',
      path: '/follow-ups',
      icon: Send,
      count: followUps.filter(f => f.status === 'waiting').length,
      badge: criticalGmailCount > 0 ? `${criticalGmailCount} urgent` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    },
    {
      id: 'nav-calendar',
      label: 'Calendar',
      path: '/calendar',
      icon: Calendar,
      badge: isGoogleConnected ? 'Google Synced' : null,
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
    },
    {
      id: 'nav-settings',
      label: 'Settings & Integrations',
      path: '/settings',
      icon: Settings,
    },
  ];

  const handleNav = (path) => {
    navigate(path);
    if (setMobileOpen) setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const displayName = userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Priorix User';
  const displayEmail = currentUser?.email || 'Signed in';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          id="mobile-nav-backdrop"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <div
            id="brand-logo-button"
            onClick={() => handleNav('/dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider shadow-xs shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
              P
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">
                PRIORIX
              </span>
            </div>
          </div>
        </div>

        {/* Primary Nav */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Execution Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.path;
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                ) : item.count !== undefined ? (
                  <span className="text-xs font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-800/60">
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div className="pt-5 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Public Views
          </div>
          <button
            id="nav-landing-page"
            onClick={() => handleNav('/')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentRoute === '/'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <span>Landing Page</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>

        {/* Authenticated User Card & Logout */}
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-300 font-medium text-xs flex items-center justify-center border border-indigo-500/30 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-500 truncate font-mono">{displayEmail}</p>
            </div>
          </div>
          <button
            id="btn-sidebar-logout"
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
