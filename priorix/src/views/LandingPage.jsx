import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Target,
  Send,
  CheckCircle2,
  Clock,
  Flame,
  Lock,
  Layers,
  Sparkles,
  TrendingUp,
  Briefcase,
  GraduationCap,
  Laptop,
  Code
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge.jsx';
import { RISK_LEVELS } from '../lib/attentionEngine.js';

export function LandingPage() {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/20 selection:text-indigo-300">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            id="landing-logo"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider shadow-xs shadow-indigo-500/20">
              P
            </div>
            <span className="text-lg font-bold tracking-tight text-white">PRIORIX</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400 font-medium">
            <a href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-slate-200 transition-colors">Core Capabilities</a>
            <a href="#use-cases" className="hover:text-slate-200 transition-colors">Who It's For</a>
            <a href="#security" className="hover:text-slate-200 transition-colors">Architecture & Security</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-nav-login"
              onClick={() => navigate('/login')}
              className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              Sign In
            </button>
            <button
              id="btn-nav-dashboard"
              onClick={() => navigate('/dashboard')}
              className="text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg shadow-xs shadow-indigo-600/30 transition-colors flex items-center gap-1.5"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Deterministic Execution & Attention Layer</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 tracking-tight leading-[1.15] mb-6">
            Turn important intentions into <br className="hidden sm:inline" />
            <span className="text-indigo-400">completed actions.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed mb-8">
            Priorix watches deadlines, commitments, goals, and unfinished work so important responsibilities don't disappear when life gets busy.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="btn-hero-launch-dashboard"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-colors"
            >
              <span>Launch Execution Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="btn-hero-view-login"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-sm border border-slate-800 flex items-center justify-center gap-2 transition-colors"
            >
              <span>Sign In / Create Account</span>
            </button>
          </div>

          {/* Interactive Hero Preview Card */}
          <div className="mt-14 max-w-4xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono text-slate-400">PRIORIX ATTENTION ENGINE // REAL-TIME RANKING</span>
              </div>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                MULTI-SIGNAL SCORING
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">Distributed Systems Thesis Section 4</span>
                      <RiskBadge risk={RISK_LEVELS.OVERDUE} score={95} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Task • Overdue by 1 day • 3 days without progress</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-mono font-semibold text-rose-400">Score 95/100</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">Follow up with Elena (Senior Platform Engineer Recruiter)</span>
                      <RiskBadge risk={RISK_LEVELS.AT_RISK} score={88} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Follow-up • Awaiting reply for 7 days • Follow-up date is today</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-mono font-semibold text-amber-400">Score 88/100</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">Client E-Commerce Redesign (Acme Corp)</span>
                      <RiskBadge risk={RISK_LEVELS.NEGLECTED} score={84} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Goal • 30% complete • Deadline in 5 days • 16 days untouched</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-mono font-semibold text-orange-400">Score 84/100</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section id="problem" className="py-16 sm:py-20 border-b border-slate-800/80 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">The Execution Breakdown</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Why important things get forgotten
            </h3>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Information is fragmented across calendars, email threads, sticky notes, and fragile human memory. When pressure builds, high-stakes commitments silently decay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-200 mb-1.5">Unseen Inactivity & Neglect</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A goal created 3 weeks ago sits at 20% progress. A job application or client lead gets lost because no alert triggers when days slip past without touches.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Send className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-200 mb-1.5">Lost Follow-Ups</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                You send a proposal, resume, or question. You wait for a reply, get busy with daily tasks, and never follow up at the critical decision window.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-200 mb-1.5">Flat, Unprioritized Task Lists</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Traditional to-do apps treat every checkbox equally. They fail to calculate deadline velocity, external promises, and true risk urgency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Priorix Works */}
      <section id="how-it-works" className="py-16 sm:py-20 border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">How It Works</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              An intelligent, multi-layer execution system
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 relative">
              <div className="text-xs font-mono text-indigo-400 font-bold mb-2">01 // INGEST</div>
              <h4 className="text-sm font-bold text-slate-200 mb-2">Capture 4 Core Entities</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track larger Goals, granular Tasks, external Commitments, and pending Follow-ups in one unified database.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 relative">
              <div className="text-xs font-mono text-indigo-400 font-bold mb-2">02 // SCORE</div>
              <h4 className="text-sm font-bold text-slate-200 mb-2">Multi-Signal Attention</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deterministic mathematical scoring factors in deadline proximity, completion deficit, and importance multipliers.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 relative">
              <div className="text-xs font-mono text-indigo-400 font-bold mb-2">03 // DETECT</div>
              <h4 className="text-sm font-bold text-slate-200 mb-2">Neglect & Risk Flagging</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Items that sit without progress or updates are automatically escalated with clear diagnostic reasons.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 relative">
              <div className="text-xs font-mono text-indigo-400 font-bold mb-2">04 // EXECUTE</div>
              <h4 className="text-sm font-bold text-slate-200 mb-2">The Attention Queue</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your workspace always answers one question: "What deserves my focus right now?"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-16 sm:py-20 border-b border-slate-800/80 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">System Architecture</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Purpose-built for total commitment clarity
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
                <Target className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-2">Outcome Goals & Milestone Linking</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Define the high-level outcomes that matter. Connect tasks directly to parent goals so progress is accurately reflected and stagnant milestones are flagged before deadlines pass.
              </p>
              <div className="text-xs font-mono text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                Goal: "Ship Q4 Release" • 4/5 milestones complete • Target: Friday
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-2">External Commitments & Recipient Tracking</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Keep promises made to clients, team leads, professors, and partners. Track who you made the promise to, the origin channel, and exact fulfillment deadlines.
              </p>
              <div className="text-xs font-mono text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                Pledged: "Deliver staging credentials to Acme QA team" [High Importance]
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
                <Send className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-2">Follow-Up Aging & Waiting Status</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Never lose a warm lead, job application, or pending proposal. Priorix calculates the exact days waiting and triggers proactive alerts on the scheduled follow-up date.
              </p>
              <div className="text-xs font-mono text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                Waiting on Stripe Recruiter: 7 days elapsed • Next ping: Today
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
                <Flame className="w-4 h-4" />
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-2">Deterministic Attention Engine</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                No black-box hallucinations or simulated AI. Rigorous mathematical ranking evaluates due dates, inactive intervals, and priority coefficients to generate a transparent 0–100 score.
              </p>
              <div className="text-xs font-mono text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                AttentionScore = Base(20) + Priority(25) + Proximity(35) + Neglect(15)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Persona Support */}
      <section id="use-cases" className="py-16 sm:py-20 border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">Versatile Application</h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Engineered for anyone with real responsibilities
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              Priorix powers execution across diverse high-accountability domains.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <Code className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Software Engineers</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track code review commitments, architecture RFCs, deployment runbooks, and sprint deliverables without relying on memory.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <Briefcase className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Job Seekers</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manage high-stakes application pipelines, recruiter interview follow-up dates, take-home challenge deadlines, and referral check-ins.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <Laptop className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Freelancers & Consultants</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Keep client milestones, scope agreements, contract proposals, invoice follow-ups, and staging delivery promises crystal clear.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <TrendingUp className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Founders & Leaders</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track investor commitments, hiring follow-ups, product release milestones, and prevent vital company initiatives from stalling.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <GraduationCap className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Students & Researchers</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ensure thesis drafts, model exam preparation, scholarship applications, and advisor feedback follow-ups are finished ahead of time.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 mb-2 text-indigo-400">
                <ShieldCheck className="w-4 h-4" />
                <h4 className="text-sm font-bold text-slate-200">Busy Professionals</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ensure personal promises, license renewals, medical appointments, and long-term habits are never neglected when work gets frantic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Google Workspace Integration */}
      <section id="security" className="py-16 sm:py-20 border-b border-slate-800/80 bg-slate-900/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Private Workspace &amp; Automatic Google Calendar Sync</h3>
                <p className="text-xs text-slate-400">Read-Only Gmail Analysis • Automatic Calendar Reminders • Per-User Data Isolation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Priorix connects securely to your Google account with minimal permissions. Important deadlines, placement drives, interview invites, and actionable follow-ups are detected automatically and added straight to your Google Calendar with timely reminders.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                <span className="font-semibold text-emerald-400 block mb-1">Read-Only Gmail Access</span>
                <span className="text-slate-400">Scans inbox messages for deadlines and urgent actions without ever sending, modifying, or deleting emails.</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                <span className="font-semibold text-emerald-400 block mb-1">Auto Calendar Reminders</span>
                <span className="text-slate-400">Creates deduplicated Google Calendar events with progressive popup alerts so nothing slips past you.</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                <span className="font-semibold text-emerald-400 block mb-1">Strictly Isolated Data</span>
                <span className="text-slate-400">Every account has a private cloud workspace with real-time synchronization across sessions.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 sm:py-24 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight mb-4">
            Start tracking what actually matters
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mb-8">
            Experience the deterministic execution layer built for high-accountability professionals, students, and builders.
          </p>

          <button
            id="btn-cta-open-dashboard"
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-colors inline-flex items-center gap-2"
          >
            <span>Open Priorix Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">PRIORIX</span>
            <span>—</span>
            <span>Never lose track of what matters.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-emerald-400">Google Workspace Ready</span>
            <span>•</span>
            <button onClick={() => navigate('/login')} className="hover:text-slate-300">Sign In</button>
            <span>•</span>
            <button onClick={() => navigate('/dashboard')} className="hover:text-slate-300">Dashboard</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
