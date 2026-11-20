import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Header } from './components/layout/Header.jsx';
import { QuickAddModal } from './components/modals/QuickAddModal.jsx';
import { VoiceSchedulingModal } from './components/modals/VoiceSchedulingModal.jsx';
import { Loader2 } from 'lucide-react';

// Views
import { LandingPage } from './views/LandingPage.jsx';
import { LoginPage } from './views/LoginPage.jsx';
import { DashboardView } from './views/DashboardView.jsx';
import { TasksView } from './views/TasksView.jsx';
import { GoalsView } from './views/GoalsView.jsx';
import { CommitmentsView } from './views/CommitmentsView.jsx';
import { FollowUpsView } from './views/FollowUpsView.jsx';
import { CalendarView } from './views/CalendarView.jsx';
import { SettingsView } from './views/SettingsView.jsx';

function AppContent() {
  const { currentRoute, navigate } = useApp();
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Global Auth Loading State with Bounded Recovery
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider shadow-lg shadow-indigo-500/20 animate-pulse">
            P
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            <span>Signing in to Priorix...</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Loading your workspace
          </p>
        </div>
      </div>
    );
  }

  // Public Landing View
  if (currentRoute === '/') {
    return <LandingPage />;
  }

  // Public Auth Portal
  if (currentRoute === '/login') {
    return <LoginPage />;
  }

  // Protected Routes Check: Unauthenticated users are routed to /login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Workspace View Dispatcher (Protected Routes)
  const renderWorkspaceView = () => {
    switch (currentRoute) {
      case '/tasks':
        return <TasksView />;
      case '/goals':
        return <GoalsView />;
      case '/commitments':
        return <CommitmentsView />;
      case '/follow-ups':
        return <FollowUpsView />;
      case '/calendar':
        return <CalendarView />;
      case '/settings':
        return <SettingsView />;
      case '/dashboard':
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-300">
      {/* Persistent Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area (offset by sidebar on desktop) */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header setMobileOpen={setMobileOpen} />
        <main className="flex-1 pb-16">
          {renderWorkspaceView()}
        </main>
      </div>

      {/* Modals */}
      <QuickAddModal />
      <VoiceSchedulingModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
