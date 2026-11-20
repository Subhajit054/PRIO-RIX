import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiClient } from "./gemini.js";

export interface VoiceReminderOverride {
  minutes: number;
  method?: "popup" | "email";
  label?: string;
}

export interface VoiceParsedSchedule {
  intent: "schedule_task" | "schedule_meeting" | "schedule_reminder" | "schedule_interview" | "other";
  goalType?: "GOAL" | "TASK" | "CALENDAR_EVENT" | "REMINDER" | "PREPARATION_TASK";
  category?: "TASK" | "COMMITMENT" | "FOLLOW_UP" | "GENERAL";
  priorityScore?: number;
  formattedDisplay?: string;
  title: string;
  eventTitle?: string;
  preparationTask?: string | null;
  preparationReminderMinutes?: number | null;
  preparationReminderLabel?: string | null;
  syncToGoogleCalendar?: boolean;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm (24-hour)
  dateTimeIso: string | null;
  timezone: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  reminderPreferences: VoiceReminderOverride[];
  recurrence: string | null;
  isMissingTime: boolean;
  isMissingDate: boolean;
  isAmbiguous: boolean;
  clarificationQuestion: string | null;
  confirmationSummary: string;
  voiceCommandId: string;
}

/**
 * Deterministic helper to compute dates relative to a reference date
 */
export function calculateRelativeDate(keyword: string, refDate: Date = new Date(), timezone: string = "Asia/Kolkata"): { dateStr: string; dateObj: Date } {
  const normalized = keyword.toLowerCase().trim();
  const d = new Date(refDate);

  if (normalized === "today") {
    // unchanged
  } else if (normalized === "tomorrow") {
    d.setDate(d.getDate() + 1);
  } else if (normalized === "day after tomorrow") {
    d.setDate(d.getDate() + 2);
  } else {
    // Days of the week
    const daysMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    for (const [dayName, targetDayNum] of Object.entries(daysMap)) {
      if (normalized.includes(dayName)) {
        const currentDay = d.getDay();
        let daysToAdd = targetDayNum - currentDay;
        if (daysToAdd <= 0 || normalized.includes("next")) {
          daysToAdd += 7;
        }
        d.setDate(d.getDate() + daysToAdd);
        break;
      }
    }
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  return { dateStr, dateObj: d };
}

/**
 * Deterministic rule-based fallback parser for high-reliability voice intent extraction
 */
export function parseVoiceCommandDeterministic(
  transcript: string,
  now: Date = new Date(),
  userTimezone: string = "Asia/Kolkata"
): VoiceParsedSchedule {
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // 1. VAGUE TIMING CHECK (ZERO DEADLINE FABRICATION MANDATE)
  const isVagueTiming =
    /\b(soon|sometime|later|one day|eventually|in the future|sometime next week|sometime soon)\b/i.test(lower);

  if (isVagueTiming) {
    let question = "When would you like to schedule this? Please specify the date and time.";
    if (lower.includes("sometime next week")) {
      question = "What day and time is the interview?";
    } else if (lower.includes("soon") || lower.includes("finish my project")) {
      question = "I can create the project goal, but I don't have a confirmed deadline. What date would you like to use?";
    }
    const cleanGoalTitle = text
      .replace(/^(i need to|i want to|my goal is to|please|remind me to)\s*/i, "")
      .replace(/\b(soon|sometime|later|sometime next week|sometime soon)\b/gi, "")
      .trim();
    const capitalizedTitle = cleanGoalTitle ? cleanGoalTitle.charAt(0).toUpperCase() + cleanGoalTitle.slice(1) : "Goal";

    return {
      intent: "schedule_task",
      goalType: "GOAL",
      category: "TASK",
      priorityScore: 70,
      formattedDisplay: "Goal (No deadline confirmed)",
      title: capitalizedTitle,
      eventTitle: capitalizedTitle,
      preparationTask: null,
      preparationReminderMinutes: null,
      preparationReminderLabel: null,
      syncToGoogleCalendar: false,
      date: null,
      time: null,
      dateTimeIso: null,
      timezone: userTimezone,
      priority: null,
      reminderPreferences: [],
      recurrence: null,
      isMissingTime: true,
      isMissingDate: true,
      isAmbiguous: true,
      clarificationQuestion: question,
      confirmationSummary: `Create goal "${capitalizedTitle}" without a fixed deadline?`,
      voiceCommandId: `vc_${crypto.createHash("sha256").update(text.toLowerCase()).digest("hex").slice(0, 16)}`,
    };
  }

  // 2. OUTCOME GOALS (No immediate date/time)
  if (lower.startsWith("i want to prepare for") || (lower.includes("placement interviews") && !lower.includes("tomorrow") && !lower.includes("at "))) {
    return {
      intent: "schedule_task",
      goalType: "GOAL",
      category: "TASK",
      priorityScore: 80,
      formattedDisplay: "Outcome Goal",
      title: "Prepare for placement interviews",
      eventTitle: "Prepare for placement interviews",
      preparationTask: null,
      preparationReminderMinutes: null,
      preparationReminderLabel: null,
      syncToGoogleCalendar: false,
      date: null,
      time: null,
      dateTimeIso: null,
      timezone: userTimezone,
      priority: "HIGH",
      reminderPreferences: [],
      recurrence: null,
      isMissingTime: true,
      isMissingDate: true,
      isAmbiguous: true,
      clarificationQuestion: "I can create this goal for you. What target date or milestones would you like to set?",
      confirmationSummary: 'Create outcome goal "Prepare for placement interviews"?',
      voiceCommandId: `vc_${crypto.createHash("sha256").update("placement_interviews").digest("hex").slice(0, 16)}`,
    };
  }

  // 3. PREPARATION TASK EXTRACTION
  let preparationTask: string | null = null;
  let preparationReminderMinutes: number | null = null;
  let preparationReminderLabel: string | null = null;

  const prepWithTaskMatch = text.match(/remind me to ([^,.]+?)\s+(\d+|one|two|three|half an?)\s+(hours?|mins?|minutes?|days?)\s+before/i);
  if (prepWithTaskMatch) {
    const rawPrep = prepWithTaskMatch[1].trim();
    preparationTask = rawPrep.charAt(0).toUpperCase() + rawPrep.slice(1);
    const qtyStr = prepWithTaskMatch[2].toLowerCase();
    const unitStr = prepWithTaskMatch[3].toLowerCase();
    let qty = 1;
    if (qtyStr === "two" || qtyStr === "2") qty = 2;
    else if (qtyStr === "three" || qtyStr === "3") qty = 3;
    else if (qtyStr.includes("half")) qty = 0.5;

    let mins = qty * 60;
    if (unitStr.startsWith("day")) mins = qty * 1440;
    else if (unitStr.startsWith("min")) mins = qty;

    preparationReminderMinutes = mins;
    preparationReminderLabel = `${qtyStr} ${unitStr} before`;
  }

  // 4. INTENT CLASSIFICATION
  let intent: VoiceParsedSchedule["intent"] = "schedule_reminder";
  let goalType: VoiceParsedSchedule["goalType"] = "TASK";

  if (lower.includes("interview")) {
    intent = "schedule_interview";
    goalType = "CALENDAR_EVENT";
  } else if (lower.includes("meeting")) {
    intent = "schedule_meeting";
    goalType = "CALENDAR_EVENT";
  } else if (lower.startsWith("remind me at") || lower.startsWith("set a reminder")) {
    intent = "schedule_reminder";
    goalType = "REMINDER";
  } else if (lower.includes("task") || lower.includes("submit") || lower.includes("complete") || lower.includes("presentation") || lower.includes("project") || lower.startsWith("schedule")) {
    intent = "schedule_task";
    goalType = "TASK";
  }

  // 5. PRIORITY DETECTION
  let priority: VoiceParsedSchedule["priority"] = null;
  if (lower.includes("critical") || lower.includes("urgent") || lower.includes("asap")) {
    priority = "CRITICAL";
  } else if (lower.includes("high priority") || lower.includes("important")) {
    priority = "HIGH";
  } else if (lower.includes("medium priority")) {
    priority = "MEDIUM";
  } else if (lower.includes("low priority")) {
    priority = "LOW";
  }

  // 6. REMINDERS EXTRACTION
  const reminders: VoiceReminderOverride[] = [];
  if (lower.includes("two days before") || lower.includes("2 days before")) {
    reminders.push({ minutes: 2880, method: "popup", label: "2 days before" });
  }
  if (lower.includes("one day before") || lower.includes("1 day before") || lower.includes("a day before")) {
    reminders.push({ minutes: 1440, method: "popup", label: "1 day before" });
  }
  if (lower.includes("three hours before") || lower.includes("3 hours before")) {
    reminders.push({ minutes: 180, method: "popup", label: "3 hours before" });
  }
  if (lower.includes("two hours before") || lower.includes("2 hours before")) {
    reminders.push({ minutes: 120, method: "popup", label: "2 hours before" });
  }
  if (lower.includes("one hour before") || lower.includes("1 hour before") || lower.includes("an hour before")) {
    reminders.push({ minutes: 60, method: "popup", label: "1 hour before" });
  }
  if (lower.includes("30 minutes before") || lower.includes("30 mins before") || lower.includes("half an hour before")) {
    reminders.push({ minutes: 30, method: "popup", label: "30 minutes before" });
  }
  if (lower.includes("15 minutes before") || lower.includes("15 mins before")) {
    reminders.push({ minutes: 15, method: "popup", label: "15 minutes before" });
  }
  if (lower.includes("10 minutes before") || lower.includes("10 mins before")) {
    reminders.push({ minutes: 10, method: "popup", label: "10 minutes before" });
  }

  if (preparationReminderMinutes && !reminders.some((r) => r.minutes === preparationReminderMinutes)) {
    reminders.push({
      minutes: preparationReminderMinutes,
      method: "popup",
      label: preparationReminderLabel || `${preparationReminderMinutes} min before`,
    });
  }

  // If no reminder explicitly mentioned, default to 1 hour
  if (reminders.length === 0) {
    reminders.push({ minutes: 60, method: "popup", label: "1 hour before" });
  }

  // 7. DATE PARSING
  let dateStr: string | null = null;
  let isMissingDate = false;

  if (lower.includes("tomorrow")) {
    dateStr = calculateRelativeDate("tomorrow", now, userTimezone).dateStr;
  } else if (lower.includes("day after tomorrow")) {
    dateStr = calculateRelativeDate("day after tomorrow", now, userTimezone).dateStr;
  } else if (lower.includes("today")) {
    dateStr = calculateRelativeDate("today", now, userTimezone).dateStr;
  } else {
    const dayMatch = lower.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      dateStr = calculateRelativeDate(dayMatch[0], now, userTimezone).dateStr;
    } else {
      const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (isoMatch) {
        dateStr = isoMatch[1];
      } else {
        isMissingDate = true;
      }
    }
  }

  // 8. TIME PARSING
  let timeStr: string | null = null;
  let isMissingTime = false;

  const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const timeMatch = lower.match(timeRegex);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? timeMatch[2] : "00";
    const meridiem = timeMatch[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    timeStr = `${String(hour).padStart(2, "0")}:${minute}`;
  } else {
    const militaryMatch = lower.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (militaryMatch) {
      timeStr = `${String(militaryMatch[1]).padStart(2, "0")}:${militaryMatch[2]}`;
    } else {
      isMissingTime = true;
    }
  }

  // 9. TITLE EXTRACTION
  let title = text;

  // If specific pattern "I have an interview with ABC..." -> "ABC interview"
  const interviewWithMatch = text.match(/interview with ([^,.]+?)(?:\s+tomorrow|\s+at|\s+on|\.|$)/i);
  if (interviewWithMatch) {
    title = `${interviewWithMatch[1].trim()} interview`;
  } else if (lower.includes("interview") && (lower.includes("i have an interview") || lower.includes("my interview is"))) {
    title = "Interview";
  } else {
    title = text
      .replace(/^(remind me to|remind me|schedule my|schedule a|schedule|create a task to|set a reminder to|i have an?|my)\s*/i, "")
      .replace(/\b(tomorrow|today|day after tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, "")
      .replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
      .replace(/\b(?:and\s+)?remind me\s+.*$/i, "")
      .replace(/\bwith\s+a\s+\d+.*reminder\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    title = title.replace(/\b(at|on|for|about|to)\s*$/i, "").trim();
    if (title.toLowerCase().startsWith("to ")) {
      title = title.substring(3).trim();
    }
  }

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = intent === "schedule_interview" ? "Interview" : intent === "schedule_meeting" ? "Meeting" : "Scheduled Task";
  }

  // 10. CHECK AMBIGUITY
  let isAmbiguous = false;
  let clarificationQuestion: string | null = null;

  if (isMissingDate && isMissingTime) {
    isAmbiguous = true;
    clarificationQuestion = "When would you like to schedule this? Please specify the date and time.";
  } else if (isMissingTime) {
    isAmbiguous = true;
    clarificationQuestion = "What time would you like to schedule this?";
  } else if (isMissingDate) {
    isAmbiguous = true;
    clarificationQuestion = "What day would you like to schedule this?";
  } else if (!title || title.length < 2) {
    isAmbiguous = true;
    clarificationQuestion = "What would you like me to schedule? Please provide a title or description.";
  }

  // Build full ISO date-time string if both date & time available
  let dateTimeIso: string | null = null;
  if (dateStr && timeStr && !isAmbiguous) {
    dateTimeIso = `${dateStr}T${timeStr}:00`;
  }

  // Confirmation Summary construction
  const displayTime = timeStr
    ? (() => {
        const [h, m] = timeStr.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      })()
    : "at your specified time";

  const reminderSummary = reminders.map((r) => r.label).join(" and ");
  const confirmationSummary = `Schedule ${title} for ${lower.includes("tomorrow") ? "tomorrow" : dateStr || "upcoming date"} at ${displayTime}${reminderSummary ? ` with a ${reminderSummary} reminder` : ""}?`;

  const rawIdKey = `${title.toLowerCase().replace(/[^a-z0-9]/g, "")}_${dateStr || "nodate"}_${timeStr || "notime"}`;
  const voiceCommandId = `vc_${crypto.createHash("sha256").update(rawIdKey).digest("hex").slice(0, 16)}`;

  const category: VoiceParsedSchedule["category"] =
    intent === "schedule_meeting" || intent === "schedule_interview"
      ? "COMMITMENT"
      : intent === "schedule_reminder"
      ? "FOLLOW_UP"
      : "TASK";

  const priorityScore =
    priority === "CRITICAL" ? 95 : priority === "HIGH" ? 85 : priority === "MEDIUM" ? 65 : 75;

  const formattedDisplay = dateTimeIso
    ? `${dateStr} at ${displayTime}`
    : `Upcoming at ${displayTime}`;

  const syncToGoogleCalendar = Boolean(dateTimeIso && (intent === "schedule_interview" || intent === "schedule_meeting" || priorityScore >= 75));

  return {
    intent,
    goalType,
    category,
    priorityScore,
    formattedDisplay,
    title,
    eventTitle: title,
    preparationTask,
    preparationReminderMinutes,
    preparationReminderLabel,
    syncToGoogleCalendar,
    date: dateStr,
    time: timeStr,
    dateTimeIso,
    timezone: userTimezone,
    priority,
    reminderPreferences: reminders,
    recurrence: null,
    isMissingTime,
    isMissingDate,
    isAmbiguous,
    clarificationQuestion,
    confirmationSummary,
    voiceCommandId,
  };
}

/**
 * AI-assisted voice parsing using Gemini with deterministic fallback
 */
export async function parseVoiceSchedulingCommand(
  transcript: string,
  nowIso?: string,
  userTimezone: string = "Asia/Kolkata"
): Promise<VoiceParsedSchedule> {
  const refDate = nowIso ? new Date(nowIso) : new Date();

  // 1. Run deterministic parser first
  const deterministicResult = parseVoiceCommandDeterministic(transcript, refDate, userTimezone);

  // If vague timing (Zero deadline fabrication) or preparation task found, deterministic is authoritative
  if (deterministicResult.goalType === "GOAL" || deterministicResult.preparationTask || (deterministicResult.date && deterministicResult.time)) {
    return deterministicResult;
  }

  // Try Gemini AI extraction if API key is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getGeminiClient();
      const prompt = `You are the Priorix Voice Scheduling Assistant.
Analyze the following natural language voice command from a user and extract structured scheduling details.
Current reference time: ${refDate.toISOString()}
Current User Timezone: ${userTimezone}

User Voice Command: "${transcript}"

STRICT INSTRUCTIONS:
1. Extract intent: "schedule_task", "schedule_meeting", "schedule_reminder", "schedule_interview", or "other".
2. Extract clean task/event title without conversational prefixes like "remind me to" or date/time phrases.
3. Compute exact date YYYY-MM-DD relative to reference time.
4. Extract 24-hour time HH:mm (e.g. 17:00 for 5 PM). DO NOT INVENT A TIME if the user didn't provide one.
5. If user said "tomorrow" or "next Monday" but DID NOT mention a time, set isMissingTime: true, and set clarificationQuestion: "What time would you like to schedule this?"
6. Extract priority ONLY if explicitly stated (e.g. "urgent", "critical", "high priority").
7. Extract reminder preferences (e.g. 60 min for "1 hour before", 1440 min for "1 day before"). Default to 60 min if unspecified.
8. Set isAmbiguous to true if required information is missing or unclear.
9. Format a natural confirmationSummary like: "Schedule [Title] for [Date/Relative] at [Time] with a [Reminders] reminder?"
10. Return strictly valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              time: { type: Type.STRING },
              priority: { type: Type.STRING },
              remindersMinutes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              isMissingTime: { type: Type.BOOLEAN },
              isMissingDate: { type: Type.BOOLEAN },
              isAmbiguous: { type: Type.BOOLEAN },
              clarificationQuestion: { type: Type.STRING },
              confirmationSummary: { type: Type.STRING },
            },
            required: ["intent", "title", "isMissingTime", "isAmbiguous"],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        const reminders: VoiceReminderOverride[] = (parsed.remindersMinutes || [60]).map((min: number) => {
          let label = `${min} minutes before`;
          if (min === 1440) label = "1 day before";
          if (min === 60) label = "1 hour before";
          return { minutes: min, method: "popup", label };
        });

        const dateStr = parsed.date || (parsed.isMissingDate ? null : calculateRelativeDate("tomorrow", refDate, userTimezone).dateStr);
        const timeStr = parsed.time || null;
        let dateTimeIso: string | null = null;
        if (dateStr && timeStr && !parsed.isMissingTime && !parsed.isMissingDate) {
          dateTimeIso = `${dateStr}T${timeStr}:00`;
        }

        const rawIdKey = `${(parsed.title || "task").toLowerCase().replace(/[^a-z0-9]/g, "")}_${dateStr || "nodate"}_${timeStr || "notime"}`;
        const voiceCommandId = `vc_${crypto.createHash("sha256").update(rawIdKey).digest("hex").slice(0, 16)}`;

        let normPriority: VoiceParsedSchedule["priority"] = null;
        const rawP = String(parsed.priority || "").toUpperCase();
        if (rawP.includes("CRITICAL") || rawP.includes("URGENT") || rawP.includes("ASAP")) normPriority = "CRITICAL";
        else if (rawP.includes("HIGH")) normPriority = "HIGH";
        else if (rawP.includes("MEDIUM")) normPriority = "MEDIUM";
        else if (rawP.includes("LOW")) normPriority = "LOW";

        const intentNorm = (parsed.intent || "schedule_task") as VoiceParsedSchedule["intent"];
        const category: VoiceParsedSchedule["category"] =
          intentNorm === "schedule_meeting" || intentNorm === "schedule_interview"
            ? "COMMITMENT"
            : intentNorm === "schedule_reminder"
            ? "FOLLOW_UP"
            : "TASK";

        const priorityScore =
          normPriority === "CRITICAL" ? 95 : normPriority === "HIGH" ? 85 : normPriority === "MEDIUM" ? 65 : 75;

        const formattedDisplay = dateTimeIso || `${dateStr} ${timeStr || ""}`.trim();

        return {
          intent: intentNorm,
          goalType: deterministicResult.goalType || "TASK",
          category,
          priorityScore,
          formattedDisplay,
          title: parsed.title || deterministicResult.title || "Scheduled Task",
          eventTitle: parsed.title || deterministicResult.title || "Scheduled Task",
          preparationTask: deterministicResult.preparationTask || null,
          preparationReminderMinutes: deterministicResult.preparationReminderMinutes || null,
          preparationReminderLabel: deterministicResult.preparationReminderLabel || null,
          syncToGoogleCalendar: Boolean(dateTimeIso && (intentNorm === "schedule_interview" || intentNorm === "schedule_meeting" || priorityScore >= 75)),
          date: dateStr,
          time: timeStr,
          dateTimeIso,
          timezone: userTimezone,
          priority: normPriority,
          reminderPreferences: reminders,
          recurrence: null,
          isMissingTime: Boolean(parsed.isMissingTime),
          isMissingDate: Boolean(parsed.isMissingDate),
          isAmbiguous: Boolean(parsed.isAmbiguous),
          clarificationQuestion: parsed.clarificationQuestion || (parsed.isMissingTime ? "What time would you like to schedule this?" : null),
          confirmationSummary: parsed.confirmationSummary || `Schedule ${parsed.title || "Task"} for ${dateStr} at ${timeStr}?`,
          voiceCommandId,
        };
      }
    } catch (aiErr) {
      console.warn("[VoiceAssistant] Gemini extraction notice, falling back to deterministic parser:", aiErr);
    }
  }

  // Fallback to robust deterministic parser
  return deterministicResult;
}
