import crypto from "crypto";
import { PriorityScoreResult } from "./priorityEngine.js";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";

/**
 * Fetches single Gmail message full payload
 */
export async function fetchFullGmailMessage(accessToken: string, messageId: string) {
  const url = new URL(`${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "full");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch message ${messageId}: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Strips HTML tags, scripts, and styles into clean readable plain text
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Recursively extracts readable plain text from any Gmail MIME payload (text/plain preferred, text/html fallback)
 */
export function extractGmailBodyText(payload: any, maxChars: number = 10000): string {
  if (!payload) return "";

  const plainChunks: string[] = [];
  const htmlChunks: string[] = [];

  const decodeData = (data?: string): string => {
    if (!data) return "";
    try {
      return Buffer.from(data, "base64url").toString("utf-8");
    } catch {
      try {
        return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      } catch {
        return "";
      }
    }
  };

  const walk = (part: any) => {
    if (!part) return;
    const mime = (part.mimeType || "").toLowerCase();

    if (part.body?.data) {
      const decoded = decodeData(part.body.data);
      if (decoded) {
        if (mime === "text/plain" || (!mime && !decoded.includes("<html"))) {
          plainChunks.push(decoded);
        } else if (mime === "text/html" || decoded.includes("<html") || decoded.includes("<div") || decoded.includes("<p>")) {
          htmlChunks.push(decoded);
        }
      }
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  };

  walk(payload);

  const combinedPlain = plainChunks.join("\n").trim();
  if (combinedPlain.length >= 40) {
    return combinedPlain.slice(0, maxChars);
  }

  const combinedHtml = htmlToPlainText(htmlChunks.join("\n"));
  const best = combinedHtml.length > combinedPlain.length ? combinedHtml : combinedPlain;
  return best.slice(0, maxChars);
}

export interface UserReminderOptions {
  minScore?: number; // default 75
  criticalIntensity?: "minimal" | "balanced" | "frequent"; // default "balanced"
  importantIntensity?: "minimal" | "balanced" | "frequent"; // default "balanced"
  enableTimeCriticalSafetyOverride?: boolean; // default true
  maxStages?: number; // default 5 (Google Calendar API max is 5 overrides)
  allowFollowUpFallback?: boolean; // default true: schedule follow-up reminder for important actionable emails without explicit deadline
  userTimezone?: string;
}

export const DEFAULT_REMINDER_PROFILES = {
  // CRITICAL 90–100: 48h, 24h, 12h, 6h, 3h, 1h, 30m, 10m
  CRITICAL: [48 * 60, 24 * 60, 12 * 60, 6 * 60, 3 * 60, 60, 30, 10],
  // HIGH 80–89: 24h, 12h, 6h, 3h, 1h, 30m, 10m
  HIGH: [24 * 60, 12 * 60, 6 * 60, 3 * 60, 60, 30, 10],
  // IMPORTANT 75–79: 24h, 2h, 30m
  IMPORTANT: [24 * 60, 2 * 60, 30],
  // Below threshold: NO REMINDERS
  NO_ALERT: [] as number[],
};

export const REMINDER_PROFILES: Record<string, number[]> = {
  CRITICAL: [...DEFAULT_REMINDER_PROFILES.CRITICAL],
  HIGH: [...DEFAULT_REMINDER_PROFILES.HIGH],
  MEDIUM: [...DEFAULT_REMINDER_PROFILES.IMPORTANT],
  LOW: [],
  IGNORE: [],
};

/**
 * Resolves the baseline reminder profile by score, priority level, and user customization options
 */
export function getReminderProfile(
  priorityLevel: string = "CRITICAL",
  score?: number,
  options?: UserReminderOptions
): { name: string; tier: string; offsets: number[] } {
  const minScore = options?.minScore ?? 75;
  const criticalIntensity = options?.criticalIntensity ?? "balanced";
  const importantIntensity = options?.importantIntensity ?? "balanced";

  const effScore =
    score !== undefined
      ? score
      : priorityLevel === "CRITICAL"
      ? 95
      : priorityLevel === "HIGH"
      ? 82
      : priorityLevel === "MEDIUM"
      ? 76
      : 40;

  if (effScore < minScore) {
    return { name: "NO_ALERT", tier: "NO_ALERT", offsets: [] };
  }

  let offsets: number[] = [];
  let tierName = "NO_ALERT";

  if (effScore >= 90) {
    tierName = "CRITICAL";
    if (criticalIntensity === "minimal" || (criticalIntensity as any) === "light") {
      offsets = [24 * 60, 6 * 60, 60, 30, 10];
    } else {
      offsets = [48 * 60, 24 * 60, 12 * 60, 6 * 60, 3 * 60, 60, 30, 10];
    }
  } else if (effScore >= 80) {
    tierName = "HIGH";
    if (importantIntensity === "minimal" || (importantIntensity as any) === "light") {
      offsets = [24 * 60, 60, 15];
    } else if (importantIntensity === "frequent" || (importantIntensity as any) === "strong") {
      offsets = [48 * 60, 24 * 60, 6 * 60, 60, 30, 10];
    } else {
      offsets = [24 * 60, 6 * 60, 60, 30, 10];
    }
  } else {
    tierName = "IMPORTANT";
    if ((importantIntensity as any) === "off") {
      offsets = [];
    } else if (importantIntensity === "frequent" || (importantIntensity as any) === "strong") {
      offsets = [24 * 60, 6 * 60, 120, 30, 10];
    } else {
      offsets = [24 * 60, 120, 30];
    }
  }

  return {
    name: tierName,
    tier: tierName,
    offsets,
  };
}

/**
 * Selects up to `limit` (max 5 for Google Calendar API) reminder offsets that always preserve
 * near-term actionable alerts (e.g. 10m, 30m, 1h) alongside key advance warnings (e.g. 24h, 6h).
 */
function selectBestCalendarOverrides(activeOffsetsDesc: number[], limit: number = 5): number[] {
  const uniqueSortedDesc = Array.from(new Set(activeOffsetsDesc))
    .filter((m) => m >= 0 && m <= 40320) // Google Calendar API valid range: 0..40320 minutes
    .sort((a, b) => b - a);

  if (uniqueSortedDesc.length <= limit) {
    return uniqueSortedDesc;
  }

  // Always keep the earliest advance alert (e.g. 24h or 48h) + the closest (limit - 1) near-term alerts
  const selected = new Set<number>();
  // Prefer 24h (1440) as anchor if present, else the largest offset
  if (uniqueSortedDesc.includes(1440)) {
    selected.add(1440);
  } else {
    selected.add(uniqueSortedDesc[0]);
  }

  // Fill remaining slots from the closest/smallest reminders (10m, 30m, 60m, 360m, etc.)
  const ascending = [...uniqueSortedDesc].reverse();
  for (const offset of ascending) {
    if (selected.size >= limit) break;
    selected.add(offset);
  }

  return Array.from(selected).sort((a, b) => b - a);
}

/**
 * Computes progressive, non-accumulating valid reminder offsets relative to event start time.
 * Guarantees at least 1 valid popup reminder for any upcoming event that passes the score threshold.
 */
export function computeProgressiveReminders(
  eventStartMs: number,
  priorityLevel: string = "CRITICAL",
  nowMs: number = Date.now(),
  score?: number,
  options?: UserReminderOptions
): { method: string; minutes: number }[] {
  const diffMs = eventStartMs - nowMs;
  if (diffMs <= 0) {
    return [];
  }

  const remainingMinutes = Math.floor(diffMs / (1000 * 60));
  const profile = getReminderProfile(priorityLevel, score, options);

  if (profile.offsets.length === 0) {
    return [];
  }

  // Keep reminders whose trigger time (eventStart - offset) is still in the future
  let activeOffsets = profile.offsets.filter((offsetMin) => remainingMinutes >= offsetMin);

  // Guarantee at least one popup reminder if the event is still upcoming
  if (activeOffsets.length === 0 && remainingMinutes >= 1) {
    if (remainingMinutes >= 30) {
      activeOffsets = [30, 10];
    } else if (remainingMinutes >= 10) {
      activeOffsets = [10];
    } else {
      activeOffsets = [Math.max(1, remainingMinutes - 1)];
    }
  }

  const maxOverrides = Math.min(options?.maxStages ?? 5, 5);
  const chosen = selectBestCalendarOverrides(activeOffsets, maxOverrides);

  return chosen.map((minutes) => ({
    method: "popup",
    minutes,
  }));
}

export function computeIntelligentReminders(
  deadlineMs: number,
  nowMs: number = Date.now(),
  priorityLevel: string = "CRITICAL",
  score?: number,
  options?: UserReminderOptions
): { method: string; minutes: number }[] {
  return computeProgressiveReminders(deadlineMs, priorityLevel, nowMs, score, options);
}

/**
 * Computes a sensible smart follow-up slot for an important email that has no explicit date/deadline.
 */
function computeSmartFollowUpSlot(priorityLevel: string, score: number, nowMs: number = Date.now()): { start: Date; end: Date } {
  const now = new Date(nowMs);
  let start: Date;

  if (priorityLevel === "CRITICAL" || score >= 90) {
    // 2 hours from now, rounded up to the next 15-minute mark
    start = new Date(nowMs + 2 * 60 * 60 * 1000);
    const rem = start.getMinutes() % 15;
    if (rem !== 0) start.setMinutes(start.getMinutes() + (15 - rem), 0, 0);
    else start.setSeconds(0, 0);
  } else {
    // 4 hours from now if daytime, otherwise next day at 09:00 local server/user approximation
    const candidate = new Date(nowMs + 4 * 60 * 60 * 1000);
    if (candidate.getHours() >= 8 && candidate.getHours() <= 20) {
      start = candidate;
      start.setMinutes(0, 0, 0);
    } else {
      start = new Date(now);
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
    }
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30-minute focus reminder block
  return { start, end };
}

/**
 * Parses an ISO or date-only string safely into a Date object
 */
function parseTargetDate(rawDate: string | null | undefined, deadlineTime?: string | null, isDeadline: boolean = true): Date | null {
  if (!rawDate) return null;
  let str = String(rawDate).trim();
  if (!str) return null;

  // Handle YYYY-MM-DD date-only strings
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    if (deadlineTime && /\d{1,2}:\d{2}/.test(deadlineTime)) {
      const m = deadlineTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const mer = (m[3] || "").toUpperCase();
        if (mer === "PM" && h < 12) h += 12;
        if (mer === "AM" && h === 12) h = 0;
        str = `${str}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
      } else {
        str = isDeadline ? `${str}T18:00:00` : `${str}T10:00:00`;
      }
    } else {
      str = isDeadline ? `${str}T18:00:00` : `${str}T10:00:00`;
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Queries Google Calendar for an existing event created by Priorix for this Gmail messageId.
 * Guarantees zero duplicate events across browser tabs, refreshes, or background syncs.
 */
async function findExistingCalendarEventByMessageId(accessToken: string, messageId: string): Promise<string | null> {
  if (!messageId) return null;
  try {
    const url = new URL(`${CALENDAR_API_BASE}/events`);
    url.searchParams.set("privateExtendedProperty", `priorixMessageId=${messageId}`);
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("showDeleted", "false");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const existing = (data.items || []).find((item: any) => item.status !== "cancelled");
    return existing?.id || null;
  } catch {
    return null;
  }
}

/**
 * Creates or updates a Google Calendar event with intelligent multi-stage popup reminders
 * for important emails (with explicit deadlines/events OR smart follow-up reminders).
 * Strictly enforces 1:1 deduplication via Google Calendar extendedProperties.private.priorixMessageId.
 */
export async function createGoogleCalendarDeadlineEvent({
  accessToken,
  analysis,
  scoring,
  messageId,
  eventId = null,
  appUrl,
  options,
}: {
  accessToken: string;
  analysis: any;
  scoring: PriorityScoreResult;
  messageId: string;
  eventId?: string | null;
  appUrl?: string;
  options?: UserReminderOptions;
}) {
  if (!accessToken) throw new Error("Missing Google access token");
  if (!analysis) return null;

  // Never schedule promotional or ignored emails
  if (analysis.isPromotionalOrNewsletter || scoring?.priorityLevel === "IGNORE") {
    return null;
  }

  const minScore = options?.minScore ?? 75;
  const effScore = scoring?.score ?? analysis.importanceScore ?? 0;
  const effPriority = scoring?.priorityLevel || analysis.priorityLevel || (effScore >= 90 ? "CRITICAL" : effScore >= 75 ? "HIGH" : "MEDIUM");
  const resolvedAppUrl = appUrl || process.env.APP_URL || "http://localhost:3000";
  const timeZone = options?.userTimezone || analysis.timezone || analysis.deadlineTimezone || "Asia/Kolkata";
  const nowMs = Date.now();

  // Resolve scheduling window:
  // 1. Explicit deadlineDate
  // 2. Explicit interviewDate / examDate / eventDate
  // 3. Smart Follow-Up Reminder if email is genuinely important & actionable
  let eventStart: Date | null = null;
  let eventEnd: Date | null = null;
  let scheduleKind: "DEADLINE" | "SCHEDULED_EVENT" | "FOLLOW_UP_REMINDER" = "DEADLINE";

  const parsedDeadline = parseTargetDate(analysis.deadlineDate, analysis.deadlineTime, true);
  const parsedEventDate = parseTargetDate(
    analysis.interviewDate || analysis.examDate || analysis.eventDate,
    analysis.deadlineTime,
    false
  );

  if (parsedDeadline) {
    if (parsedDeadline.getTime() <= nowMs) {
      // Explicit deadline already passed
      return null;
    }
    scheduleKind = "DEADLINE";
    eventEnd = parsedDeadline;
    // 1-hour block ending at deadline; if deadline is < 65m away, start soon so reminders still fire cleanly
    const idealStartMs = parsedDeadline.getTime() - 60 * 60 * 1000;
    if (idealStartMs <= nowMs + 2 * 60 * 1000) {
      const clampedStartMs = Math.min(
        parsedDeadline.getTime() - 5 * 60 * 1000,
        nowMs + 5 * 60 * 1000
      );
      eventStart = new Date(Math.max(nowMs + 60 * 1000, clampedStartMs));
      if (eventEnd.getTime() <= eventStart.getTime()) {
        eventEnd = new Date(eventStart.getTime() + 15 * 60 * 1000);
      }
    } else {
      eventStart = new Date(idealStartMs);
    }
  } else if (parsedEventDate) {
    if (parsedEventDate.getTime() <= nowMs) {
      return null;
    }
    scheduleKind = "SCHEDULED_EVENT";
    eventStart = parsedEventDate;
    eventEnd = new Date(parsedEventDate.getTime() + 60 * 60 * 1000);
  } else if (
    options?.allowFollowUpFallback !== false &&
    effScore >= minScore &&
    (analysis.requiresAction || effPriority === "CRITICAL" || effPriority === "HIGH")
  ) {
    scheduleKind = "FOLLOW_UP_REMINDER";
    const slot = computeSmartFollowUpSlot(effPriority, effScore, nowMs);
    eventStart = slot.start;
    eventEnd = slot.end;
  } else {
    return null;
  }

  // Preserve original Gmail subject verbatim without artificial prefixes
  const title = (
    analysis.subject ||
    (analysis.jobOrCompanyName ? `${analysis.jobOrCompanyName} Action Item` : "Important Email")
  )
    .replace(/^(\s*\[Priorix\]\s*)+/i, "")
    .replace(/^(\s*(?:URGENT|Reminder|PRIORIX|Deadline|Action Required)\s*[:\-–—]\s*)+/i, "")
    .trim() || analysis.subject || "Important Email";

  const whyItMatters =
    analysis.reason ||
    (analysis.keyReasons?.length > 0
      ? analysis.keyReasons.join(". ")
      : `Priority Score ${effScore}/100 (${effPriority}).`);

  const scheduleLine =
    scheduleKind === "DEADLINE"
      ? `Deadline: ${analysis.deadlineDisplay || analysis.deadlineDate}`
      : scheduleKind === "SCHEDULED_EVENT"
      ? `Scheduled Event: ${analysis.interviewDate || analysis.examDate || analysis.eventDate}`
      : `Scheduled Follow-Up Reminder (No explicit deadline stated in email)`;

  const actionUrl = analysis.actionLink || analysis.applicationUrl || analysis.registrationUrl || "";

  const descriptionLines = [
    `PRIORIX REMINDER`,
    `--------------------------------------------------`,
    `Original Subject: ${analysis.subject || title}`,
    analysis.jobOrCompanyName ? `Organization: ${analysis.jobOrCompanyName}` : null,
    analysis.detectedRoles?.length > 0 ? `Roles: ${analysis.detectedRoles.join(" • ")}` : null,
    analysis.compensation || analysis.stipend
      ? `Compensation: ${[analysis.compensation, analysis.stipend].filter(Boolean).join(" • ")}`
      : null,
    analysis.originalSender || analysis.sender ? `From: ${analysis.originalSender || analysis.sender}` : null,
    ``,
    scheduleLine,
    analysis.actionType || analysis.requiredAction ? `Action: ${analysis.actionType || analysis.requiredAction}` : null,
    actionUrl ? `Action Link: ${actionUrl}` : null,
    ``,
    `Why This Matters:`,
    whyItMatters,
    ``,
    `Priority: ${effScore}/100 [${effPriority}]`,
    `Gmail Message ID: ${messageId}`,
    `Open Priorix: ${resolvedAppUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const activeOverrides = computeProgressiveReminders(
    eventStart.getTime(),
    effPriority,
    nowMs,
    effScore,
    { ...options, minScore: Math.min(minScore, effScore) } // ensure manual syncs & qualifying items always get reminders
  );

  const payload = {
    summary: title,
    description: descriptionLines,
    start: {
      dateTime: eventStart.toISOString(),
      timeZone,
    },
    end: {
      dateTime: eventEnd.toISOString(),
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: activeOverrides.slice(0, 5),
    },
    colorId:
      effPriority === "CRITICAL"
        ? "11" // Tomato
        : effPriority === "HIGH"
        ? "5" // Banana
        : effPriority === "MEDIUM"
        ? "7" // Peacock
        : "9", // Blueberry
    extendedProperties: {
      private: {
        priorixMessageId: String(messageId),
        priorixSource: "priorix_gmail_sync",
        priorixScheduleKind: scheduleKind,
      },
    },
  };

  // Simulated token handler for offline smoke testing
  if (accessToken.startsWith("mock_") || accessToken.startsWith("simulated_") || accessToken === "test_token") {
    if (accessToken === "mock_fail_token") {
      throw new Error("Simulated Google Calendar API 503 Service Unavailable");
    }
    const simulatedId =
      eventId || `cal_evt_${crypto.createHash("sha256").update(String(messageId)).digest("hex").slice(0, 16)}`;
    return {
      id: simulatedId,
      summary: payload.summary,
      description: payload.description,
      start: payload.start,
      end: payload.end,
      reminders: payload.reminders,
      colorId: payload.colorId,
      extendedProperties: payload.extendedProperties,
      status: "confirmed",
      scheduleKind,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${simulatedId}`,
    };
  }

  // Deduplicate against Google Calendar itself if no eventId was passed
  let targetEventId = eventId;
  if (!targetEventId && messageId) {
    targetEventId = await findExistingCalendarEventByMessageId(accessToken, messageId);
  }

  if (targetEventId) {
    const updateRes = await fetch(`${CALENDAR_API_BASE}/events/${encodeURIComponent(targetEventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (updateRes.ok) {
      const updated = await updateRes.json();
      return { ...updated, scheduleKind };
    }

    if (updateRes.status !== 404) {
      const errText = await updateRes.text().catch(() => "");
      throw new Error(`Google Calendar PATCH failed (${updateRes.status}): ${errText}`);
    }
  }

  const res = await fetch(`${CALENDAR_API_BASE}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create calendar event: ${res.status} ${res.statusText}`);
  }

  const created = await res.json();
  return { ...created, scheduleKind };
}

/**
 * Updates a Google Calendar event status when user completes, dismisses, or expires an item
 */
export async function updateGoogleCalendarEventStatus({
  accessToken,
  eventId,
  status = "COMPLETED",
  newDeadlineDate = null,
}: {
  accessToken: string;
  eventId: string;
  status: string;
  newDeadlineDate?: string | null;
}) {
  if (!accessToken || !eventId) return null;

  if (accessToken.startsWith("mock_") || accessToken.startsWith("simulated_") || accessToken === "test_token") {
    if (accessToken === "mock_fail_token") return null;
    return {
      id: eventId,
      status: "confirmed",
      reminders: { useDefault: false, overrides: [] },
    };
  }

  try {
    const getRes = await fetch(`${CALENDAR_API_BASE}/events/${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!getRes.ok) return null;

    const event = await getRes.json();
    const cleanSummary = (event.summary || "")
      .replace(/^✅\s*\[Completed\]\s*/i, "")
      .replace(/^\[Dismissed\]\s*/i, "")
      .replace(/^\[Expired\]\s*/i, "")
      .trim();

    const patchBody: any = {
      summary: cleanSummary || event.summary,
    };

    if (status === "COMPLETED") {
      patchBody.colorId = "10"; // Basil / Green
      patchBody.reminders = { useDefault: false, overrides: [] };
    } else if (status === "DISMISSED" || status === "EXPIRED") {
      patchBody.colorId = "8"; // Graphite / Gray
      patchBody.reminders = { useDefault: false, overrides: [] };
    }

    if (newDeadlineDate) {
      const newDl = new Date(newDeadlineDate);
      if (!isNaN(newDl.getTime())) {
        const newStart = new Date(newDl.getTime() - 60 * 60 * 1000);
        const tz = event.start?.timeZone || "Asia/Kolkata";
        patchBody.start = { dateTime: newStart.toISOString(), timeZone: tz };
        patchBody.end = { dateTime: newDl.toISOString(), timeZone: tz };
      }
    }

    const patchRes = await fetch(`${CALENDAR_API_BASE}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(patchBody),
    });

    if (patchRes.ok) {
      return await patchRes.json();
    }
  } catch (err) {
    console.warn("Calendar event update error (non-blocking):", err);
  }
  return null;
}
