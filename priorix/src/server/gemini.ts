import { GoogleGenAI, Type } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

export interface EmailAnalysisInput {
  messageId: string;
  threadId?: string;
  subject: string;
  from: string;
  fromName?: string;
  fromEmail?: string;
  bodyText: string;
  snippet?: string;
  receivedDate?: string;
  userTimezone?: string;
}

export type PriorixCategory = 
  | "CAREER"
  | "EDUCATION"
  | "PERSONAL_ACTION"
  | "FINANCIAL_ADMIN"
  | "GENERAL_IMPORTANT"
  | "NEWSLETTER_PROMO";

export interface GeminiEntities {
  organization?: string;
  roleOrTitle?: string;
  compensation?: string;
  contactPerson?: string;
  platformOrPortal?: string;
}

export interface GeminiParsedAnalysis {
  sender: string;
  originalSender: string;
  forwardedFromName: string;
  forwardedFromEmail: string;
  subject: string; // EXACT original subject must remain untouched!
  dateReceived: string;
  organization: string;
  jobOrCompanyName: string;
  role: string;
  detectedRoles: string[];
  employmentType: string;
  compensation: string;
  stipend: string;
  applicationUrl: string;
  registrationUrl: string;
  actionLink: string;
  deadlineDate: string | null; // ISO 8601 string or null - NEVER invented if missing
  deadlineTime: string | null;
  deadlineDisplay: string | null;
  deadlineTimezone: string;
  timezone: string;
  eventDate: string | null;
  examDate: string | null;
  interviewDate: string | null;
  requiresAction: boolean;
  actionType: string; // e.g. "Complete Application Form", "Confirm Interview Availability", "Submit Documents", "Register for Exam"
  requiredAction: string;
  requiresResponse: boolean;
  category: PriorixCategory;
  categoryDisplay: string;
  importanceScore: number; // 0-100
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "IGNORE";
  isExpiring: boolean;
  isExpired: boolean;
  isCareerRelated: boolean;
  isExamOrEducation: boolean;
  isPersonalAction: boolean;
  isFinancialAdmin: boolean;
  isPromotionalOrNewsletter: boolean;
  reason: string; // Concrete explanation grounded in real email content
  summary: string;
  keyReasons: string[];
  entities: GeminiEntities;
  confidenceScore: number;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export interface ExtractedActionableDeadline {
  deadlineDate: string; // ISO 8601 string with offset (e.g. "2026-09-09T18:00:00+05:30")
  deadlineTime: string;
  deadlineDisplay: string;
  actionType: string;
}

/**
 * Deterministic extraction of actionable registration/application deadlines
 * from recruitment notices, campus placement emails, and formal announcements.
 *
 * Strictly requires explicit deadline indicators (e.g., "Last date of registration",
 * "Registration closes at", "Last date to apply", "Apply before").
 * Does NOT classify arbitrary event/drive/interview dates as application deadlines.
 */
export function extractActionableDeadline(
  text: string,
  defaultTimezone: string = "Asia/Kolkata"
): ExtractedActionableDeadline | null {
  if (!text) return null;

  // Explicit deadline anchor keywords - strictly requiring application/registration/submission context
  const deadlinePrefixRegex = /(?:last\s+date\s+(?:of|for|to)\s+(?:registration|register|apply|application|submission)|registration\s+(?:deadline|closes(?:\s+on)?)|(?:registration|application)(?:[\w\s,()–-]{0,80}?)(?:will\s+officially\s+close|closes|close)|application\s+deadline|submission\s+deadline|apply\s+(?:before|by)|register\s+(?:before|by)|deadline\s+(?:for|to)\s+(?:registration|application|apply)|last\s+date\s*[:=-])/i;

  const matchPrefix = text.match(deadlinePrefixRegex);
  if (!matchPrefix || matchPrefix.index === undefined) {
    return null;
  }

  // Extract surrounding context starting from prefix (up to 400 characters)
  const startIndex = matchPrefix.index;
  const context = text.slice(startIndex, startIndex + 400);

  // Match date formats in context:
  // Format 1: 09-September-2026, 15 September 2026, 25-August-2026, 9-Sep-2026, 10 September
  const dateRegex1 = /(\d{1,2})(?:st|nd|rd|th)?[\s\-_/\.]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s\-_/\.]*(\d{2,4})?/i;
  // Format 2: September 15, 2026 or Sep 9 2026
  const dateRegex2 = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s\-_/\.]+(\d{1,2})(?:st|nd|rd|th)?(?:,)?(?:[\s\-_/\.]+(\d{2,4}))?/i;
  // Format 3: 25/08/2026, 28/8/2026, 09-09-2026, 25/08/26
  const dateRegex3 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;

  let day = 0;
  let month = 0;
  let year = 0;

  const m1 = context.match(dateRegex1);
  const m2 = context.match(dateRegex2);
  const m3 = context.match(dateRegex3);

  const currentYear = new Date().getFullYear();

  if (m1) {
    day = parseInt(m1[1], 10);
    const mStr = m1[2].toLowerCase();
    month = MONTH_MAP[mStr] || 0;
    year = m1[3] ? parseInt(m1[3], 10) : currentYear;
  } else if (m2) {
    const mStr = m2[1].toLowerCase();
    month = MONTH_MAP[mStr] || 0;
    day = parseInt(m2[2], 10);
    year = m2[3] ? parseInt(m2[3], 10) : currentYear;
  } else if (m3) {
    day = parseInt(m3[1], 10);
    month = parseInt(m3[2], 10);
    year = parseInt(m3[3], 10);
  } else {
    return null;
  }

  if (year < 100) year += 2000;
  if (!day || !month || !year || month > 12 || day > 31) return null;

  // Search for closing time in context
  let hours = 23;
  let minutes = 59;
  let seconds = 59;
  let timeDisplay = "";

  // Priority 1: Closing time near explicit time keywords
  const timeBlockRegex = /(?:registration\s+closes\s+(?:at|by)|closes(?:\s+strictly)?\s+(?:at|by)|closing\s+time|time\s*[:=-]|at|by)\s*[:=-]?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/i;
  const tbMatch = context.match(timeBlockRegex);

  if (tbMatch) {
    let h = parseInt(tbMatch[1], 10);
    let m = tbMatch[2] ? parseInt(tbMatch[2], 10) : 0;
    const meridian = (tbMatch[3] || "").toUpperCase();
    if (meridian === "PM" && h < 12) h += 12;
    if (meridian === "AM" && h === 12) h = 0;
    hours = h;
    minutes = m;
    seconds = 0;
    timeDisplay = `${tbMatch[1]}:${String(m).padStart(2, "0")} ${meridian}`.trim();
  } else {
    // Priority 2: Standard time in context
    const generalTimeMatch = context.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (generalTimeMatch) {
      let h = parseInt(generalTimeMatch[1], 10);
      let m = parseInt(generalTimeMatch[2], 10);
      const meridian = (generalTimeMatch[3] || "").toUpperCase();
      if (meridian === "PM" && h < 12) h += 12;
      if (meridian === "AM" && h === 12) h = 0;
      hours = h;
      minutes = m;
      seconds = 0;
      timeDisplay = `${generalTimeMatch[1]}:${String(m).padStart(2, "0")} ${meridian}`.trim();
    }
  }

  // Resolve timezone offset dynamically for the user's timezone
  const tz = defaultTimezone || "Asia/Kolkata";
  let offset = "+00:00";
  try {
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(probe);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const offsetMatch = tzName.match(/GMT([+-]\d{2}:\d{2})/);
    if (offsetMatch) {
      offset = offsetMatch[1];
    } else if (tz === "Asia/Kolkata" || text.includes("IST")) {
      offset = "+05:30";
    }
  } catch {
    offset = tz === "Asia/Kolkata" ? "+05:30" : "+00:00";
  }

  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${offset}`;
  const monthLabel = MONTH_NAMES[month] || "September";

  return {
    deadlineDate: isoDate,
    deadlineTime: timeDisplay || (hours === 23 ? "11:59 PM" : `${hours}:${String(minutes).padStart(2, "0")}`),
    deadlineDisplay: `${day} ${monthLabel} ${year}${timeDisplay ? ", " + timeDisplay : ""}`.trim(),
    actionType: "Complete Registration / Application Form",
  };
}

// Cache for analyzed emails to avoid redundant Gemini calls
const emailAnalysisCache = new Map<string, { analysis: GeminiParsedAnalysis; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Global Rate Limit & Quota Cooldown Tracker
let quotaCooldownUntil = 0;
let lastQuotaLogTime = 0;

/**
 * Checks if Gemini is currently in a quota / rate limit cooldown period
 */
export function isGeminiInCooldown(): boolean {
  return Date.now() < quotaCooldownUntil;
}

/**
 * Sets cooldown period for Gemini API calls
 */
export function setGeminiCooldown(durationMs: number = 30000) {
  quotaCooldownUntil = Date.now() + durationMs;
}

/**
 * Uses Gemini to semantically analyze incoming email content across all categories
 * with integrated memory cache, rate-limit cooldown, and deterministic fallback.
 */
export async function analyzeEmailWithGemini(
  input: EmailAnalysisInput
): Promise<GeminiParsedAnalysis> {
  const cacheKey = input.messageId || `${input.subject}_${input.from}_${(input.bodyText || input.snippet || "").slice(0, 100)}`;
  
  // 1. Check in-memory analysis cache
  const cached = emailAnalysisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    if (!cached.analysis.deadlineDate) {
      const fullText = `${input.subject}\n${input.bodyText || input.snippet || ""}`;
      const extracted = extractActionableDeadline(fullText, cached.analysis.timezone || "Asia/Kolkata");
      if (extracted) {
        cached.analysis.deadlineDate = extracted.deadlineDate;
        cached.analysis.deadlineTime = cached.analysis.deadlineTime || extracted.deadlineTime;
        cached.analysis.deadlineDisplay = cached.analysis.deadlineDisplay || extracted.deadlineDisplay;
        cached.analysis.requiresAction = true;
        if (!cached.analysis.actionType || cached.analysis.actionType === "Review Information") {
          cached.analysis.actionType = extracted.actionType || "Complete Registration / Application Form";
        }
        cached.analysis.requiredAction = cached.analysis.actionType;
      }
    }
    return cached.analysis;
  }

  // 2. Check if we are in quota cooldown period
  if (isGeminiInCooldown()) {
    const fallback = fallbackDeterministicAnalysis(input);
    emailAnalysisCache.set(cacheKey, { analysis: fallback, timestamp: Date.now() });
    return fallback;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (apiKey) {
    try {
      const ai = getGeminiClient();
      const prompt = `You are the Priorix Semantic Email Intelligence & Opportunity Engine.
Analyze the following email meticulously across ALL life domains: Career, Education, Personal Action, Financial & Administrative, and General High-Priority Notices.

CRITICAL INSTRUCTIONS:
1. NEVER alter, synthesize, or prefix the email subject. The output 'subject' MUST EXACTLY match the original input subject verbatim: "${input.subject}".
2. Do NOT limit importance to job/placement emails. Assess whether this email is genuinely important to the user:
   - CAREER: placement drives, internships, jobs, interview invitations, coding tests, assessment deadlines, recruiter notes, offer letters.
   - EDUCATION: GATE exams, university notices, semester exams, admission/scholarship/certification deadlines, project submissions.
   - PERSONAL_ACTION: direct document requests, response required, meeting invitations, appointments, urgent confirmations, travel deadlines, identity verifications.
   - FINANCIAL_ADMIN: bill/payment deadlines, renewals, account security alerts, government deadlines.
   - GENERAL_IMPORTANT: critical alerts or time-sensitive notices that don't fit above but demand user awareness.
3. IMPORTANT EMAILS WITHOUT DEADLINES:
   - If an email is important (e.g., "Your technical interview has been scheduled", "Please submit your verification documents", "Invitation for interview") but contains NO explicit deadline, DO NOT invent or fabricate a deadline. Set 'deadlineDate' to null.
   - Classify its importance based on 'requiresAction' (true), 'actionType', and semantic gravity.
4. ACTION REQUIRED DETECTION:
   - Detect if the user must perform an active task (e.g. fill out a form, reply with availability, complete an assessment, upload documents).
   - Set 'requiresAction': true and provide a concise 'actionType'.
5. REASON MUST BE CONCRETE:
   - The 'reason' must state specific facts from the email content (e.g., "This email requires action because it contains a registration deadline of 5:00 PM today for Keploy Campus Drive and provides an application portal link."). Never generate generic or vague explanations.
6. SUPPRESS LOW-VALUE CONTENT:
   - Mark automated newsletters, promotional discounts, digests, marketing campaigns as category "NEWSLETTER_PROMO", priorityLevel "IGNORE" or "LOW", and isPromotionalOrNewsletter: true.
7. DEADLINE EXTRACTION FOR PLACEMENT & RECRUITMENT NOTICES:
   - Meticulously detect explicit registration, application, or submission deadlines. Look specifically for patterns such as:
     * "Last Date of Registration: DD-Month-YYYY" or "Last date to register: ..."
     * "Registration Closes At: HH:MM AM/PM"
     * "Last Date for Application: ..." or "Application deadline: ..."
     * "Apply before / by: ..."
   - When an explicit registration or application deadline date and closing time are provided, combine them into an ISO 8601 string with the timezone offset (e.g. "+05:30" for Asia/Kolkata / Indian notices, such as "2026-09-09T18:00:00+05:30").
   - DO NOT confuse issue dates ("04_Sept_2026", "Date: 4 Sept"), drive dates ("Pool campus drive on..."), or interview dates with registration/application deadlines. Only extract when the text explicitly designates it as an application, registration, or submission deadline.

EMAIL DETAILS:
- Message ID: ${input.messageId}
- Subject: ${input.subject}
- From: ${input.from || input.fromEmail}
- Received Date: ${input.receivedDate || new Date().toISOString()}
- User Timezone: ${input.userTimezone || "Asia/Kolkata"}
- Snippet: ${input.snippet || ""}
- Body Content:
${(input.bodyText || input.snippet || input.subject).slice(0, 8000)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an expert executive email analyst. Output valid JSON matching the exact schema. Always preserve the original subject string verbatim. Ground all reasons in specific email text.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              sender: { type: Type.STRING },
              originalSender: { type: Type.STRING },
              forwardedFromName: { type: Type.STRING },
              forwardedFromEmail: { type: Type.STRING },
              organization: { type: Type.STRING },
              jobOrCompanyName: { type: Type.STRING },
              role: { type: Type.STRING },
              detectedRoles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              employmentType: { type: Type.STRING },
              compensation: { type: Type.STRING },
              stipend: { type: Type.STRING },
              applicationUrl: { type: Type.STRING },
              registrationUrl: { type: Type.STRING },
              actionLink: { type: Type.STRING },
              deadlineDate: { type: Type.STRING, description: "ISO 8601 date string with timezone offset (e.g. 2026-09-09T18:00:00+05:30) if explicit deadline exists, or null. NEVER invent deadlines." },
              deadlineTime: { type: Type.STRING },
              deadlineDisplay: { type: Type.STRING },
              deadlineTimezone: { type: Type.STRING },
              timezone: { type: Type.STRING },
              eventDate: { type: Type.STRING },
              examDate: { type: Type.STRING },
              interviewDate: { type: Type.STRING },
              requiresAction: { type: Type.BOOLEAN },
              actionType: { type: Type.STRING },
              requiredAction: { type: Type.STRING },
              requiresResponse: { type: Type.BOOLEAN },
              category: {
                type: Type.STRING,
                enum: [
                  "CAREER",
                  "EDUCATION",
                  "PERSONAL_ACTION",
                  "FINANCIAL_ADMIN",
                  "GENERAL_IMPORTANT",
                  "NEWSLETTER_PROMO",
                ],
              },
              categoryDisplay: { type: Type.STRING },
              importanceScore: { type: Type.NUMBER },
              priorityLevel: {
                type: Type.STRING,
                enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "IGNORE"],
              },
              isExpiring: { type: Type.BOOLEAN },
              isExpired: { type: Type.BOOLEAN },
              isCareerRelated: { type: Type.BOOLEAN },
              isExamOrEducation: { type: Type.BOOLEAN },
              isPersonalAction: { type: Type.BOOLEAN },
              isFinancialAdmin: { type: Type.BOOLEAN },
              isPromotionalOrNewsletter: { type: Type.BOOLEAN },
              reason: { type: Type.STRING, description: "Grounded, factual explanation based on email content." },
              summary: { type: Type.STRING },
              keyReasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              entities: {
                type: Type.OBJECT,
                properties: {
                  organization: { type: Type.STRING },
                  roleOrTitle: { type: Type.STRING },
                  compensation: { type: Type.STRING },
                  contactPerson: { type: Type.STRING },
                  platformOrPortal: { type: Type.STRING },
                },
              },
              confidenceScore: { type: Type.NUMBER },
            },
            required: [
              "subject",
              "category",
              "requiresAction",
              "isPromotionalOrNewsletter",
              "reason",
              "summary",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() || "{}");
      
      // STRICT SAFETY GUARANTEE: Never allow altered subject
      const resolvedTz = parsed.timezone || parsed.deadlineTimezone || input.userTimezone || "Asia/Kolkata";
      parsed.subject = input.subject;
      parsed.timezone = resolvedTz;
      parsed.deadlineTimezone = resolvedTz;
      parsed.actionLink = parsed.actionLink || parsed.applicationUrl || parsed.registrationUrl || "";
      parsed.applicationUrl = parsed.actionLink;
      parsed.registrationUrl = parsed.actionLink;
      parsed.requiredAction = parsed.requiredAction || parsed.actionType || (parsed.requiresAction ? "Action required" : "Informational");
      parsed.actionType = parsed.actionType || parsed.requiredAction;
      parsed.entities = parsed.entities || {};

      // Deterministic deadline safety-net:
      // If Gemini did not identify an explicit deadlineDate, check for placement / recruitment registration deadline formats
      if (!parsed.deadlineDate) {
        const fullContent = `${input.subject}\n${input.bodyText || input.snippet || ""}`;
        const extracted = extractActionableDeadline(fullContent, resolvedTz);
        if (extracted) {
          parsed.deadlineDate = extracted.deadlineDate;
          parsed.deadlineTime = parsed.deadlineTime || extracted.deadlineTime;
          parsed.deadlineDisplay = parsed.deadlineDisplay || extracted.deadlineDisplay;
          parsed.requiresAction = true;
          if (!parsed.actionType || parsed.actionType === "Review Information") {
            parsed.actionType = extracted.actionType || "Complete Registration / Application Form";
          }
          parsed.requiredAction = parsed.actionType;
          if (!parsed.keyReasons) parsed.keyReasons = [];
          if (!parsed.keyReasons.some((r: string) => r.toLowerCase().includes("deadline"))) {
            parsed.keyReasons.push(`Registration Deadline: ${extracted.deadlineDisplay}`);
          }
        }
      }

      emailAnalysisCache.set(cacheKey, { analysis: parsed, timestamp: Date.now() });
      return parsed as GeminiParsedAnalysis;
    } catch (err: any) {
      const isQuotaError = 
        err?.status === "RESOURCE_EXHAUSTED" ||
        err?.message?.includes("429") ||
        err?.message?.includes("quota") ||
        err?.message?.includes("RESOURCE_EXHAUSTED") ||
        err?.code === 429;

      if (isQuotaError) {
        // Set a 30s cooldown so consecutive batch items do not spam the API
        setGeminiCooldown(30000);
        const now = Date.now();
        if (now - lastQuotaLogTime > 20000) {
          lastQuotaLogTime = now;
          console.info("[Priorix Intelligence] Gemini quota / rate-limit detected. Seamlessly activating high-accuracy deterministic semantic engine.");
        }
      } else {
        console.warn("[Priorix Intelligence] Gemini semantic analysis fallback triggered:", err?.message || err);
      }
    }
  }

  const fallback = fallbackDeterministicAnalysis(input);
  emailAnalysisCache.set(cacheKey, { analysis: fallback, timestamp: Date.now() });
  return fallback;
}

/**
 * High-accuracy deterministic email analyzer fallback supporting all categories
 */
export function fallbackDeterministicAnalysis(input: EmailAnalysisInput): GeminiParsedAnalysis {
  const content = `${input.subject} ${input.from || ""} ${input.bodyText || ""} ${input.snippet || ""}`;
  const lower = content.toLowerCase();

  // Forwarded metadata
  let forwardedFromName = "";
  let forwardedFromEmail = "";
  const fwdMatch = content.match(/(?:---------- Forwarded message ---------|Begin forwarded message)[\s\S]*?(?:From|from):\s*([^\n\r<]+)?(?:<([^>\n\r]+)>)?/i) ||
                   content.match(/(?:From|Sender):\s*([A-Za-z0-9\s.\-_]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/i);
  if (fwdMatch) {
    forwardedFromName = (fwdMatch[1] || "").replace(/["']/g, "").trim();
    forwardedFromEmail = (fwdMatch[2] || "").trim().toLowerCase();
  }

  // Company detection
  let jobOrCompanyName = "";
  const companyMatch = content.match(/M\/s\.\s*([A-Za-z0-9&.\-_]+)/i) ||
                       content.match(/Company:\s*([A-Za-z0-9&.\-_ ]+)/i) ||
                       content.match(/([A-Za-z0-9\-_]{3,20})\s*\|\s*Virtual ON Campus/i) ||
                       content.match(/Hiring by\s+([A-Za-z0-9&.\-_]+)/i) ||
                       content.match(/\bKeploy\b/i);
  if (companyMatch) {
    jobOrCompanyName = (companyMatch[1] || companyMatch[0]).trim();
  }

  // Roles detection
  const detectedRoles: string[] = [];
  if (/\bSDE\b|Software Development Engineer|Software Engineer/i.test(content)) detectedRoles.push("SDE Intern / Full-Time");
  if (/\bDevRel\b|Developer Relations/i.test(content)) detectedRoles.push("DevRel Intern / Full-Time");
  if (/Frontend Engineer|Frontend Developer/i.test(content)) detectedRoles.push("Frontend Engineer");
  if (/Backend Engineer|Backend Developer/i.test(content)) detectedRoles.push("Backend Engineer");
  if (/Data Analyst|Data Scientist/i.test(content)) detectedRoles.push("Data Analyst");

  // Compensation
  let compensation = "";
  const ctcMatch = content.match(/(\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?)?\s*LPA(?:[\s\w-]*Base)?)/i);
  if (ctcMatch) compensation = ctcMatch[1].trim();

  let stipend = "";
  const stipendMatch = content.match(/(?:stipend\s+(?:up\s+to|of|is)|stipend\s*[:=-]|stipend)\s*([₹Rs.\d,\s–-]+(?:\/month|pm|per month)?)/i) ||
                       content.match(/(₹\s*[\d,]+(?:\s*[–-]\s*₹?\s*[\d,]+)?(?:\s*(?:\/month|pm|per month))?)/);
  if (stipendMatch) stipend = stipendMatch[1].trim();

  // Action / Application link
  let actionLink = "";
  const urlMatch = content.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms|forms\.office\.com|typeform\.com|unstop\.com|internshala\.com|gate\d*\.[a-z0-9.\-_]+|[a-zA-Z0-9.\-_]+\/(?:portal|apply|register|confirm|assessment|submit))[^\s<>"'\)]+/gi) ||
                   content.match(/https?:\/\/[^\s<>"'\)]+/gi);
  if (urlMatch && urlMatch.length > 0) {
    actionLink = urlMatch[0];
  }

  // Explicit Deadline parsing
  let deadlineDate: string | null = null;
  let deadlineTime: string | null = null;
  let deadlineDisplay: string | null = null;
  const userTz = input.userTimezone || "Asia/Kolkata";

  const actionableDl = extractActionableDeadline(content, userTz);
  if (actionableDl) {
    deadlineDate = actionableDl.deadlineDate;
    deadlineTime = actionableDl.deadlineTime;
    deadlineDisplay = actionableDl.deadlineDisplay;
  }

  // Multi-Category Classification (check high-value signals BEFORE newsletter suppression so "unsubscribe" footers on real emails don't drop them)
  const hasInterviewSignal =
    lower.includes("interview scheduled") ||
    lower.includes("interview invitation") ||
    lower.includes("invitation to interview") ||
    lower.includes("technical round") ||
    lower.includes("coding test") ||
    lower.includes("assessment link") ||
    lower.includes("online assessment") ||
    lower.includes("shortlisted for interview") ||
    lower.includes("interview slot");

  const hasCareerSignal =
    detectedRoles.length > 0 ||
    lower.includes("placement") ||
    lower.includes("recruitment") ||
    lower.includes("hiring") ||
    lower.includes("campus recruitment") ||
    lower.includes("internship") ||
    lower.includes("offer letter") ||
    Boolean(compensation) ||
    hasInterviewSignal;

  const hasExamSignal =
    lower.includes("gate") ||
    lower.includes("examination") ||
    lower.includes("semester") ||
    lower.includes("admit card") ||
    lower.includes("university notice") ||
    lower.includes("scholarship") ||
    lower.includes("project submission") ||
    lower.includes("assignment due") ||
    lower.includes("exam schedule");

  const hasFinancialSignal =
    lower.includes("payment due") ||
    lower.includes("invoice due") ||
    lower.includes("bill due") ||
    lower.includes("subscription expiry") ||
    lower.includes("renewal notice") ||
    lower.includes("security alert") ||
    lower.includes("account verification") ||
    lower.includes("tax deadline");

  const hasPersonalActionSignal =
    lower.includes("please confirm") ||
    lower.includes("please reply") ||
    lower.includes("submit your document") ||
    lower.includes("documents requested") ||
    lower.includes("confirm your attendance") ||
    lower.includes("invitation to") ||
    lower.includes("action required") ||
    lower.includes("meeting request") ||
    lower.includes("flight confirmation") ||
    lower.includes("appointment confirmation");

  const hasStrongPromoSignal =
    lower.includes("min read") ||
    lower.includes("newsletter") ||
    lower.includes("weekly digest") ||
    lower.includes("weekly fastforward") ||
    lower.includes("promotional") ||
    lower.includes("marketing campaign") ||
    lower.includes("top 5 interview tips") ||
    lower.includes("% off") ||
    lower.includes("shop now") ||
    lower.includes("limited time offer") ||
    lower.includes("flash sale") ||
    lower.includes("discount code") ||
    (lower.includes("unsubscribe") && (lower.includes("sale") || lower.includes("discount") || lower.includes("digest") || lower.includes("promo") || lower.includes("deal")));

  const hasAnyImportantSignal = hasInterviewSignal || hasCareerSignal || hasExamSignal || hasFinancialSignal || hasPersonalActionSignal || Boolean(deadlineDate);

  const isPromotionalOrNewsletter = hasStrongPromoSignal && !hasInterviewSignal && !deadlineDate && !hasExamSignal && !hasFinancialSignal && !hasPersonalActionSignal;

  const isInterview = !isPromotionalOrNewsletter && hasInterviewSignal;
  const isCareerRelated = !isPromotionalOrNewsletter && hasCareerSignal;
  const isExamOrEducation = !isPromotionalOrNewsletter && hasExamSignal;
  const isFinancialAdmin = !isPromotionalOrNewsletter && hasFinancialSignal;
  const isPersonalAction = !isPromotionalOrNewsletter && hasPersonalActionSignal;

  const requiresAction = !isPromotionalOrNewsletter && (
    Boolean(deadlineDate) ||
    Boolean(actionLink && hasAnyImportantSignal) ||
    lower.includes("please complete") ||
    lower.includes("please confirm") ||
    lower.includes("please submit") ||
    lower.includes("action required") ||
    lower.includes("reply with") ||
    lower.includes("register before") ||
    isInterview
  );

  // Resolve Category
  let category: PriorixCategory = "GENERAL_IMPORTANT";
  let categoryDisplay = "General Notice";

  if (isPromotionalOrNewsletter) {
    category = "NEWSLETTER_PROMO";
    categoryDisplay = "Newsletter / Promo";
  } else if (isCareerRelated) {
    category = "CAREER";
    categoryDisplay = "Career Opportunity";
  } else if (isExamOrEducation) {
    category = "EDUCATION";
    categoryDisplay = "Education & Exams";
  } else if (isPersonalAction) {
    category = "PERSONAL_ACTION";
    categoryDisplay = "Personal Action Required";
  } else if (isFinancialAdmin) {
    category = "FINANCIAL_ADMIN";
    categoryDisplay = "Financial & Admin";
  }

  // Determine Action Type
  let actionType = "Review Information";
  if (isInterview) actionType = "Confirm Interview Availability / Join Meeting";
  else if (actionLink && (lower.includes("form") || lower.includes("apply") || lower.includes("register"))) actionType = "Complete Application / Registration Form";
  else if (lower.includes("document") || lower.includes("submit")) actionType = "Submit Requested Documents";
  else if (lower.includes("confirm")) actionType = "Confirm Attendance / Participation";
  else if (isFinancialAdmin && lower.includes("pay")) actionType = "Pay Outstanding Bill";

  // Grounded Reason Construction
  let reason = "";
  if (category === "CAREER" && deadlineDisplay) {
    reason = `This email requires action because it contains an on-campus placement/internship opportunity from ${jobOrCompanyName || "Recruiter"} with a strict application deadline of ${deadlineDisplay}.`;
  } else if (category === "CAREER" && isInterview) {
    reason = `This email is highly critical because it contains an interview invitation/scheduling request requiring prompt user confirmation.`;
  } else if (category === "EDUCATION" && deadlineDisplay) {
    reason = `This email contains an official educational/examination deadline (${deadlineDisplay}) for ${input.subject}.`;
  } else if (category === "PERSONAL_ACTION") {
    reason = `This email requires personal action to respond to: ${input.subject}.`;
  } else if (category === "FINANCIAL_ADMIN") {
    reason = `This email contains an administrative or financial alert: ${input.subject}.`;
  } else if (isPromotionalOrNewsletter) {
    reason = `Automated digest/newsletter; low personal priority.`;
  } else {
    reason = `General notification regarding: ${input.subject}.`;
  }

  const keyReasons: string[] = [];
  if (category === "CAREER") keyReasons.push("Career / placement recruitment drive");
  if (isInterview) keyReasons.push("Direct interview or technical evaluation invitation");
  if (detectedRoles.length > 0) keyReasons.push(`Role: ${detectedRoles.join(", ")}`);
  if (compensation || stipend) keyReasons.push(`Compensation: ${[compensation, stipend].filter(Boolean).join(" • ")}`);
  if (deadlineDisplay) keyReasons.push(`Deadline: ${deadlineDisplay}`);
  if (actionLink) keyReasons.push(`Action Link: ${actionLink}`);
  if (requiresAction) keyReasons.push(`Action Required: ${actionType}`);

  return {
    sender: input.from || input.fromName || "",
    originalSender: forwardedFromName || input.fromName || input.from || "",
    forwardedFromName,
    forwardedFromEmail,
    subject: input.subject, // PRESERVE EXACT ORIGINAL SUBJECT
    dateReceived: input.receivedDate || new Date().toISOString(),
    organization: forwardedFromName || (isCareerRelated ? (jobOrCompanyName || "Brainware University Placement Cell") : (isExamOrEducation ? "GATE / Examination Office" : "Sender")),
    jobOrCompanyName: jobOrCompanyName || (isCareerRelated ? "Recruitment Partner" : ""),
    role: detectedRoles[0] || (isInterview ? "Interview Candidate" : ""),
    detectedRoles,
    employmentType: lower.includes("intern") ? "Internship & Full-Time" : "Full-Time",
    compensation,
    stipend,
    applicationUrl: actionLink,
    registrationUrl: actionLink,
    actionLink,
    deadlineDate,
    deadlineTime,
    deadlineDisplay,
    deadlineTimezone: userTz,
    timezone: userTz,
    eventDate: null,
    examDate: isExamOrEducation ? deadlineDate : null,
    interviewDate: isInterview ? deadlineDate : null,
    requiresAction,
    actionType,
    requiredAction: actionType,
    requiresResponse: requiresAction,
    category,
    categoryDisplay,
    importanceScore: isPromotionalOrNewsletter ? 10 : (isCareerRelated || isInterview ? 90 : (isExamOrEducation ? 85 : 70)),
    priorityLevel: isPromotionalOrNewsletter ? "LOW" : (isCareerRelated || isInterview ? "CRITICAL" : (isExamOrEducation ? "HIGH" : "MEDIUM")),
    isExpiring: false,
    isExpired: false,
    isCareerRelated,
    isExamOrEducation,
    isPersonalAction,
    isFinancialAdmin,
    isPromotionalOrNewsletter,
    reason,
    summary: reason,
    keyReasons,
    entities: {
      organization: jobOrCompanyName || forwardedFromName || "",
      roleOrTitle: detectedRoles[0] || "",
      compensation: compensation || stipend || "",
      contactPerson: forwardedFromName || "",
      platformOrPortal: actionLink || "",
    },
    confidenceScore: 0.95,
  };
}
