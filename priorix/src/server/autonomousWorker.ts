import fs from "fs";
import path from "path";
import { analyzeEmailWithGemini } from "./gemini.js";
import { calculatePriorityScore } from "./priorityEngine.js";
import {
  computeProgressiveReminders,
  createGoogleCalendarDeadlineEvent,
  extractGmailBodyText,
  fetchFullGmailMessage,
  updateGoogleCalendarEventStatus,
  UserReminderOptions,
} from "./gmailWatcher.js";
import {
  getAllStoredGoogleUsers,
  getSafeGoogleConnectionStatus,
  getValidGoogleAccessToken,
} from "./googleAuthManager.js";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";
const WORKER_VAULT_PATH = path.join(process.cwd(), "data", ".worker_opportunities_vault.json");

export type OpportunityLifecycleStatus =
  | "DETECTED"
  | "SCHEDULED"
  | "REMINDER_ACTIVE"
  | "EXPIRED"
  | "COMPLETED"
  | "DISMISSED"
  | "FAILED_RETRYABLE";

export interface TrackedOpportunity {
  id: string;
  uid: string;
  gmailMessageId: string;
  gmailThreadId?: string;
  subject: string;
  sender?: string;
  category?: string;
  organization: string;
  actionLink: string;
  deadlineDate: string | null;
  deadlineDisplay: string | null;
  priorityScore: number;
  priorityLevel: string;
  urgencyStatus?: string;
  reason?: string;
  calendarEventId: string | null;
  calendarEventLink?: string | null;
  lastReminderConfiguration?: string;
  lifecycleStatus: OpportunityLifecycleStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserSyncState {
  uid: string;
  email: string;
  accessToken: string;
  userTimezone: string;
  autoCalendarSync: boolean;
  minimumPriority: "CRITICAL" | "HIGH" | "MEDIUM";
  minScore: number;
  criticalIntensity: "minimal" | "balanced" | "frequent";
  importantIntensity: "minimal" | "balanced" | "frequent";
  enableTimeCriticalSafetyOverride: boolean;
  maxStages: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  processing: boolean;
  lastSyncAttempt: number | null;
  lastSuccessfulSync: number | null;
  lastError: string | null;
  processedMessageIds: Set<string>;
}

const activeUsers = new Map<string, UserSyncState>();
const trackedOpportunities = new Map<string, TrackedOpportunity>();

let schedulerTimer: NodeJS.Timeout | null = null;
let isCycleRunning = false;
let lastGlobalCycleAt: number | null = null;
let totalCyclesExecuted = 0;

function loadOpportunitiesFromVault() {
  try {
    if (!fs.existsSync(WORKER_VAULT_PATH)) return;
    const raw = fs.readFileSync(WORKER_VAULT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.id) trackedOpportunities.set(item.id, item);
      }
    }
  } catch (err) {
    console.warn("[Worker] Could not load opportunities vault:", err);
  }
}

function saveOpportunitiesToVault() {
  try {
    const dir = path.dirname(WORKER_VAULT_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      WORKER_VAULT_PATH,
      JSON.stringify(Array.from(trackedOpportunities.values()), null, 2),
      "utf-8"
    );
  } catch (err) {
    console.warn("[Worker] Could not save opportunities vault:", err);
  }
}

loadOpportunitiesFromVault();

/**
 * Registers or updates a user's background sync context and reminder preferences
 */
export function registerUserSyncContext(params: {
  uid: string;
  email: string;
  accessToken?: string;
  userTimezone?: string;
  autoCalendarSync?: boolean;
  minimumPriority?: "CRITICAL" | "HIGH" | "MEDIUM";
  minScore?: number;
  criticalIntensity?: "minimal" | "balanced" | "frequent";
  importantIntensity?: "minimal" | "balanced" | "frequent";
  enableTimeCriticalSafetyOverride?: boolean;
  maxStages?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}): UserSyncState {
  const existing = activeUsers.get(params.uid);
  const state: UserSyncState = {
    uid: params.uid,
    email: params.email || existing?.email || "",
    accessToken: params.accessToken || existing?.accessToken || "",
    userTimezone: params.userTimezone || existing?.userTimezone || "Asia/Kolkata",
    autoCalendarSync: params.autoCalendarSync ?? existing?.autoCalendarSync ?? true,
    minimumPriority: params.minimumPriority || existing?.minimumPriority || "HIGH",
    minScore: params.minScore ?? existing?.minScore ?? 75,
    criticalIntensity: params.criticalIntensity || existing?.criticalIntensity || "balanced",
    importantIntensity: params.importantIntensity || existing?.importantIntensity || "balanced",
    enableTimeCriticalSafetyOverride:
      params.enableTimeCriticalSafetyOverride ?? existing?.enableTimeCriticalSafetyOverride ?? true,
    maxStages: params.maxStages ?? existing?.maxStages ?? 5,
    quietHoursEnabled: params.quietHoursEnabled ?? existing?.quietHoursEnabled ?? false,
    quietHoursStart: params.quietHoursStart || existing?.quietHoursStart || "23:00",
    quietHoursEnd: params.quietHoursEnd || existing?.quietHoursEnd || "07:00",
    processing: existing?.processing || false,
    lastSyncAttempt: existing?.lastSyncAttempt || null,
    lastSuccessfulSync: existing?.lastSuccessfulSync || null,
    lastError: existing?.lastError || null,
    processedMessageIds: existing?.processedMessageIds || new Set<string>(),
  };

  activeUsers.set(params.uid, state);
  return state;
}

function getReminderOptionsForUser(user: UserSyncState): UserReminderOptions {
  return {
    minScore: user.minScore ?? 75,
    criticalIntensity: user.criticalIntensity || "balanced",
    importantIntensity: user.importantIntensity || "balanced",
    enableTimeCriticalSafetyOverride: user.enableTimeCriticalSafetyOverride ?? true,
    maxStages: Math.min(user.maxStages ?? 5, 5),
    allowFollowUpFallback: true,
    userTimezone: user.userTimezone || "Asia/Kolkata",
  };
}

/**
 * Resolves the latest valid Google access token for a user
 */
async function resolveAccessTokenForUser(user: UserSyncState): Promise<string | null> {
  try {
    const freshToken = await getValidGoogleAccessToken(user.uid);
    if (freshToken) {
      user.accessToken = freshToken;
      return freshToken;
    }
  } catch {
    // Fall back to in-memory token if available
  }
  return user.accessToken || null;
}

/**
 * Hydrates activeUsers from persisted server-side Google OAuth credentials
 */
function hydrateUsersFromAuthVault() {
  try {
    const storedUsers = getAllStoredGoogleUsers();
    for (const stored of storedUsers) {
      if (!activeUsers.has(stored.uid)) {
        registerUserSyncContext({
          uid: stored.uid,
          email: stored.email || "",
          accessToken: stored.accessToken || "",
        });
      }
    }
  } catch {
    // Ignore vault read errors
  }
}

/**
 * Fetches recent important inbox messages from Gmail, analyzes them with Gemini,
 * and auto-adds qualifying important emails to Google Calendar with reminders.
 */
async function syncSingleUser(user: UserSyncState) {
  if (user.processing) {
    return { skipped: true, reason: "already_processing", syncedCount: 0, calendarCreated: 0 };
  }

  user.processing = true;
  user.lastSyncAttempt = Date.now();
  user.lastError = null;

  let syncedCount = 0;
  let calendarCreated = 0;

  try {
    const token = await resolveAccessTokenForUser(user);
    if (!token) {
      user.lastError = "No valid Google access token available";
      return { skipped: true, reason: "no_token", syncedCount: 0, calendarCreated: 0 };
    }

    const listUrl = new URL(`${GMAIL_API_BASE}/messages`);
    listUrl.searchParams.set("q", "in:inbox -category:promotions -category:social -in:sent newer_than:14d");
    listUrl.searchParams.set("maxResults", "25");

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (!listRes.ok) {
      const errText = await listRes.text().catch(() => listRes.statusText);
      user.lastError = `Gmail API error (${listRes.status}): ${errText.slice(0, 140)}`;
      return { skipped: false, error: user.lastError, syncedCount: 0, calendarCreated: 0 };
    }

    const listData = await listRes.json();
    const messageRefs: Array<{ id: string; threadId?: string }> = listData.messages || [];
    const options = getReminderOptionsForUser(user);
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    for (const ref of messageRefs) {
      const oppKey = `${user.uid}_${ref.id}`;
      const existingOpp = trackedOpportunities.get(oppKey);

      // Skip already completed/dismissed/expired items
      if (
        existingOpp &&
        (existingOpp.lifecycleStatus === "COMPLETED" ||
          existingOpp.lifecycleStatus === "DISMISSED" ||
          existingOpp.lifecycleStatus === "EXPIRED")
      ) {
        continue;
      }

      // Skip already scheduled items that already have a Calendar event
      if (existingOpp?.calendarEventId && existingOpp.lifecycleStatus === "SCHEDULED") {
        continue;
      }

      try {
        const full = await fetchFullGmailMessage(token, ref.id);
        const headers = full.payload?.headers || [];
        const getH = (name: string) =>
          headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getH("subject") || "(No Subject)";
        const from = getH("from") || "";
        const dateHeader = getH("date") || new Date().toISOString();
        const snippet = full.snippet || "";
        const bodyText = extractGmailBodyText(full.payload) || snippet;

        const analysis = await analyzeEmailWithGemini({
          messageId: ref.id,
          threadId: full.threadId,
          subject,
          from,
          bodyText,
          snippet,
          receivedDate: dateHeader,
          userTimezone: user.userTimezone,
        });

        const scoring = calculatePriorityScore(analysis, new Date(), user.userTimezone);
        syncedCount++;

        const qualifiesForCalendar =
          user.autoCalendarSync &&
          !analysis.isPromotionalOrNewsletter &&
          !scoring.isExpired &&
          scoring.score >= (user.minScore ?? 75) &&
          (Boolean(analysis.deadlineDate || analysis.interviewDate || analysis.examDate || analysis.eventDate) ||
            analysis.requiresAction ||
            scoring.priorityLevel === "CRITICAL" ||
            scoring.priorityLevel === "HIGH");

        let calendarEventId = existingOpp?.calendarEventId || null;
        let calendarEventLink = existingOpp?.calendarEventLink || null;
        let lastReminderConfiguration = existingOpp?.lastReminderConfiguration || "";
        let lifecycleStatus: OpportunityLifecycleStatus = existingOpp?.lifecycleStatus || "DETECTED";

        if (qualifiesForCalendar) {
          try {
            const calEvt = await createGoogleCalendarDeadlineEvent({
              accessToken: token,
              analysis,
              scoring,
              messageId: ref.id,
              eventId: calendarEventId,
              appUrl,
              options,
            });

            if (calEvt?.id) {
              calendarEventId = calEvt.id;
              calendarEventLink = calEvt.htmlLink || calendarEventLink;
              const overrideMins = (calEvt.reminders?.overrides || []).map((o: any) => `${o.minutes}m`);
              lastReminderConfiguration = overrideMins.join(", ");
              lifecycleStatus = "SCHEDULED";
              calendarCreated++;
            }
          } catch (calErr: any) {
            console.warn(`[Worker] Calendar sync error for ${ref.id}:`, calErr?.message || calErr);
            lifecycleStatus = "FAILED_RETRYABLE";
          }
        }

        const opp: TrackedOpportunity = {
          id: oppKey,
          uid: user.uid,
          gmailMessageId: ref.id,
          gmailThreadId: full.threadId,
          subject: analysis.subject || subject,
          sender: analysis.originalSender || from,
          category: analysis.category,
          organization: analysis.jobOrCompanyName || analysis.organization || "",
          actionLink: analysis.actionLink || analysis.applicationUrl || "",
          deadlineDate: analysis.deadlineDate || null,
          deadlineDisplay: analysis.deadlineDisplay || null,
          priorityScore: scoring.score,
          priorityLevel: scoring.priorityLevel,
          urgencyStatus: scoring.urgencyStatus,
          reason: analysis.reason || analysis.summary || "",
          calendarEventId,
          calendarEventLink,
          lastReminderConfiguration,
          lifecycleStatus,
          retryCount: existingOpp?.retryCount || 0,
          lastError: null,
          createdAt: existingOpp?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        trackedOpportunities.set(oppKey, opp);
        user.processedMessageIds.add(ref.id);
      } catch (msgErr: any) {
        console.warn(`[Worker] Error processing message ${ref.id}:`, msgErr?.message || msgErr);
      }
    }

    user.lastSuccessfulSync = Date.now();
    saveOpportunitiesToVault();
    return { skipped: false, syncedCount, calendarCreated };
  } finally {
    user.processing = false;
  }
}

/**
 * Transitions an opportunity status (COMPLETED / DISMISSED / EXPIRED) and silences its Google Calendar reminders
 */
export async function transitionOpportunityStatus(
  uid: string,
  messageId: string,
  status: OpportunityLifecycleStatus,
  explicitAccessToken?: string
) {
  const oppKey = `${uid}_${messageId}`;
  const opp = trackedOpportunities.get(oppKey);
  if (!opp) return null;

  opp.lifecycleStatus = status;
  opp.updatedAt = Date.now();

  if (opp.calendarEventId && (status === "COMPLETED" || status === "DISMISSED" || status === "EXPIRED")) {
    const user = activeUsers.get(uid);
    const token = explicitAccessToken || (user ? await resolveAccessTokenForUser(user) : null);
    if (token) {
      await updateGoogleCalendarEventStatus({
        accessToken: token,
        eventId: opp.calendarEventId,
        status,
      });
    }
  }

  trackedOpportunities.set(oppKey, opp);
  saveOpportunitiesToVault();
  return opp;
}

/**
 * Reconciles stored opportunities: marks expired deadlines and clears reminders on expired Calendar events
 */
export async function reconcileAllStoredOpportunities(nowMs: number = Date.now()) {
  let expiredCount = 0;
  let updatedCount = 0;

  for (const opp of trackedOpportunities.values()) {
    if (
      opp.lifecycleStatus === "COMPLETED" ||
      opp.lifecycleStatus === "DISMISSED" ||
      opp.lifecycleStatus === "EXPIRED"
    ) {
      continue;
    }

    if (opp.deadlineDate) {
      const dlMs = new Date(opp.deadlineDate).getTime();
      if (!isNaN(dlMs) && dlMs <= nowMs) {
        await transitionOpportunityStatus(opp.uid, opp.gmailMessageId, "EXPIRED");
        expiredCount++;
        continue;
      }

      // Refresh progressive reminders if approaching deadline
      if (opp.calendarEventId && !isNaN(dlMs)) {
        const user = activeUsers.get(opp.uid);
        const options = user ? getReminderOptionsForUser(user) : undefined;
        const overrides = computeProgressiveReminders(
          dlMs - 60 * 60 * 1000,
          opp.priorityLevel,
          nowMs,
          opp.priorityScore,
          options
        );
        const nextConfig = overrides.map((o) => `${o.minutes}m`).join(", ");
        if (nextConfig && nextConfig !== opp.lastReminderConfiguration) {
          opp.lastReminderConfiguration = nextConfig;
          opp.updatedAt = nowMs;
          updatedCount++;
        }
      }
    }
  }

  if (expiredCount > 0 || updatedCount > 0) {
    saveOpportunitiesToVault();
  }

  return { expiredCount, updatedCount, totalTracked: trackedOpportunities.size };
}

/**
 * Runs a single autonomous sync cycle across all connected users
 */
export async function runAutonomousSyncCycle() {
  if (isCycleRunning) {
    return { skipped: true, reason: "cycle_in_progress", usersProcessed: 0 };
  }

  isCycleRunning = true;
  totalCyclesExecuted++;
  lastGlobalCycleAt = Date.now();

  try {
    hydrateUsersFromAuthVault();
    let usersProcessed = 0;
    let totalCalendarCreated = 0;

    for (const user of activeUsers.values()) {
      const result = await syncSingleUser(user);
      if (!result.skipped) {
        usersProcessed++;
        totalCalendarCreated += result.calendarCreated || 0;
      }
    }

    const reconcile = await reconcileAllStoredOpportunities(Date.now());
    return {
      skipped: false,
      usersProcessed,
      totalCalendarCreated,
      reconcile,
    };
  } finally {
    isCycleRunning = false;
  }
}

/**
 * Triggers an immediate manual sync for one user
 */
export async function triggerManualUserSync(uid: string) {
  hydrateUsersFromAuthVault();
  const user = activeUsers.get(uid);
  if (!user) {
    return {
      success: false,
      error: "User is not registered for Google Workspace sync",
      syncedCount: 0,
      calendarCreated: 0,
    };
  }

  const result = await syncSingleUser(user);
  await reconcileAllStoredOpportunities(Date.now());

  const userOpportunities = Array.from(trackedOpportunities.values())
    .filter((o) => o.uid === uid)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    success: !result.error,
    ...result,
    opportunities: userOpportunities,
  };
}

/**
 * Starts the periodic background sync scheduler
 */
export function startAutonomousScheduler(intervalMs: number = 3 * 60 * 1000) {
  if (schedulerTimer) return;
  hydrateUsersFromAuthVault();

  schedulerTimer = setInterval(() => {
    runAutonomousSyncCycle().catch((err) => {
      console.warn("[Worker] Scheduled cycle error:", err?.message || err);
    });
  }, intervalMs);
}

/**
 * Returns a clean status snapshot of the background sync worker
 */
export function getAutonomousWorkerStatus() {
  hydrateUsersFromAuthVault();

  const users = Array.from(activeUsers.values()).map((u) => {
    const authStatus = getSafeGoogleConnectionStatus(u.uid);
    return {
      uid: u.uid,
      email: u.email,
      connected: authStatus.connected,
      processing: u.processing,
      autoCalendarSync: u.autoCalendarSync,
      lastSuccessfulSync: u.lastSuccessfulSync,
      lastError: u.lastError,
      processedCount: u.processedMessageIds.size,
    };
  });

  return {
    running: Boolean(schedulerTimer),
    isCycleRunning,
    lastGlobalCycleAt,
    totalCyclesExecuted,
    activeUserCount: users.length,
    trackedOpportunityCount: trackedOpportunities.size,
    users,
  };
}
