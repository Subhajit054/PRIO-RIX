import { GeminiParsedAnalysis } from "./gemini.js";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "IGNORE";

export type UrgencyStatus = 
  | "EXPIRING_SOON"     // < 3 hours
  | "DUE_TODAY"         // Today
  | "DUE_WITHIN_24H"    // < 24 hours
  | "DUE_WITHIN_72H"    // 24 - 72 hours
  | "DUE_WITHIN_7D"     // 3 - 7 days
  | "UPCOMING"          // > 7 days
  | "EXPIRED"           // Passed
  | "ACTION_REQUIRED_NO_DEADLINE"
  | "NO_DEADLINE";

export interface PriorityScoreResult {
  score: number;
  originalPriorityScore?: number; // Preserves historical/audit score
  currentUrgency?: number; // Current real-time urgency (0 if expired)
  isExpired?: boolean;
  priorityLevel: PriorityLevel;
  urgencyStatus: UrgencyStatus;
  urgencyLabel: string;
  isDeadlineToday: boolean;
  isExpiringSoon: boolean;
  isDeadlinePassed: boolean;
  requiresImmediateAction: boolean;
  hoursRemaining: number | null;
  scoreBreakdown: Array<{ factor: string; delta: number; explanation: string }>;
  badges: string[];
}

/**
 * Calculates deterministic priority score and dynamic urgency across all domains
 */
export function calculatePriorityScore(
  analysis: GeminiParsedAnalysis,
  now: Date = new Date(),
  userTimezone: string = "Asia/Kolkata"
): PriorityScoreResult {
  let score = 20; // Baseline neutral score
  const breakdown: Array<{ factor: string; delta: number; explanation: string }> = [];
  const badges: string[] = [];

  // 1. Direct Interview / Scheduling / Evaluation (+35 to +45)
  const isDirectInterview = analysis.interviewDate ||
    (analysis.reason && analysis.reason.toLowerCase().includes("interview")) ||
    (analysis.actionType && analysis.actionType.toLowerCase().includes("interview")) ||
    (analysis.subject && /interview|technical round|coding test|assessment/i.test(analysis.subject));

  if (isDirectInterview) {
    score += 42;
    breakdown.push({
      factor: "Direct Interview / Evaluation",
      delta: 42,
      explanation: "Direct interview invitation, scheduling, or technical assessment required",
    });
    badges.push("INTERVIEW / ASSESSMENT");
  }

  // 2. Career / Placement Drive signals (+25 to +35)
  else if (analysis.category === "CAREER" || analysis.isCareerRelated || analysis.detectedRoles?.length > 0) {
    const delta = analysis.detectedRoles?.length > 0 ? 35 : 28;
    score += delta;
    breakdown.push({
      factor: "Career / Placement",
      delta,
      explanation: `Campus recruitment / placement opportunity (${analysis.detectedRoles?.join(", ") || "General hiring"})`,
    });
    badges.push("CAREER");
  }

  // 3. Educational & Examination signals (+25 to +35)
  if (analysis.category === "EDUCATION" || analysis.isExamOrEducation) {
    const delta = 32;
    score += delta;
    breakdown.push({
      factor: "Examination / Academic",
      delta,
      explanation: "Academic notice, entrance examination, or project submission",
    });
    badges.push("EDUCATION & EXAMS");
  }

  // 4. Personal Action / Response Required (+20 to +30)
  if (analysis.category === "PERSONAL_ACTION" || analysis.isPersonalAction) {
    const delta = 25;
    score += delta;
    breakdown.push({
      factor: "Personal Response Required",
      delta,
      explanation: "Direct request requiring personal action or reply",
    });
    badges.push("ACTION REQUIRED");
  }

  // 5. Financial & Administrative signals (+20 to +25)
  if (analysis.category === "FINANCIAL_ADMIN" || analysis.isFinancialAdmin) {
    const delta = 22;
    score += delta;
    breakdown.push({
      factor: "Financial / Administrative Alert",
      delta,
      explanation: "Bill, renewal, security, or official administrative notice",
    });
    badges.push("FINANCIAL & ADMIN");
  }

  // 6. Action / Application link / Form required (+15 to +20)
  if (analysis.requiresAction || analysis.actionLink || analysis.applicationUrl || analysis.requiresResponse) {
    const delta = (analysis.actionLink || analysis.applicationUrl) ? 20 : 15;
    score += delta;
    breakdown.push({
      factor: "Action / Registration Portal",
      delta,
      explanation: analysis.actionType || "Active task or form submission required",
    });
    if (!badges.includes("ACTION REQUIRED")) {
      badges.push("ACTION REQUIRED");
    }
  }

  // 7. Compensation details specified (+10 to +15)
  if (analysis.compensation || analysis.stipend) {
    const delta = (analysis.compensation && analysis.stipend) ? 14 : 10;
    score += delta;
    breakdown.push({
      factor: "Compensation Stated",
      delta,
      explanation: `Compensation specified: ${[analysis.compensation, analysis.stipend].filter(Boolean).join(" • ")}`,
    });
  }

  // 8. Explicit Deadline / Scheduled Event Analysis & Proximity (+15 to +35)
  let deadlineDateObj: Date | null = null;
  const effectiveDateRaw = analysis.deadlineDate || analysis.interviewDate || analysis.examDate || analysis.eventDate;
  if (effectiveDateRaw) {
    try {
      let rawDl = String(effectiveDateRaw).trim();

      // If deadline string is only YYYY-MM-DD or midnight without explicit timezone
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawDl) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z?$/.test(rawDl);

      if (isDateOnly) {
        const datePart = rawDl.slice(0, 10);
        let timeCandidate = analysis.deadlineTime || "";
        if (!timeCandidate && analysis.deadlineDisplay) {
          const matchTime = analysis.deadlineDisplay.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
          if (matchTime) timeCandidate = matchTime[1];
        }

        if (timeCandidate && /\d{1,2}:\d{2}/.test(timeCandidate)) {
          let h = 0;
          let m = 0;
          const pmMatch = timeCandidate.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (pmMatch) {
            h = parseInt(pmMatch[1], 10);
            m = parseInt(pmMatch[2], 10);
            const isPM = (pmMatch[3] || "").toUpperCase() === "PM";
            const isAM = (pmMatch[3] || "").toUpperCase() === "AM";
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
          }
          const timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
          rawDl = userTimezone === "Asia/Kolkata" ? `${datePart}T${timePart}+05:30` : `${datePart}T${timePart}`;
        } else {
          // If no specific time mentioned, default to end of that calendar day (23:59:59)
          rawDl = userTimezone === "Asia/Kolkata" ? `${datePart}T23:59:59+05:30` : `${datePart}T23:59:59`;
        }
      }

      deadlineDateObj = new Date(rawDl);
    } catch {
      deadlineDateObj = null;
    }
  }

  let urgencyStatus: UrgencyStatus = analysis.requiresAction ? "ACTION_REQUIRED_NO_DEADLINE" : "NO_DEADLINE";
  let urgencyLabel = analysis.requiresAction ? "Action required (No fixed deadline)" : "No explicit deadline";
  let isDeadlineToday = false;
  let isExpiringSoon = false;
  let isDeadlinePassed = false;
  let requiresImmediateAction = isDirectInterview || Boolean(analysis.requiresAction);
  let hoursRemaining: number | null = null;

  let isExpired = false;
  let currentUrgency = 0;
  const originalPriorityScore = Math.min(Math.max(Math.round(score), 0), 100);

  if (deadlineDateObj && !isNaN(deadlineDateObj.getTime())) {
    const diffMs = deadlineDateObj.getTime() - now.getTime();
    hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

    // Convert both to User Timezone for strict "Same Calendar Day" check
    const nowTzString = now.toLocaleDateString("en-CA", { timeZone: userTimezone });
    const dlTzString = deadlineDateObj.toLocaleDateString("en-CA", { timeZone: userTimezone });
    isDeadlineToday = nowTzString === dlTzString;

    if (diffMs <= 0) {
      urgencyStatus = "EXPIRED";
      urgencyLabel = "Deadline passed / Expired";
      isDeadlinePassed = true;
      isExpired = true;
      currentUrgency = 0; // Urgency is 0 / currently not urgent
      requiresImmediateAction = false;
      isExpiringSoon = false;
      isDeadlineToday = false;
      score = Math.min(score - 50, 30);
      breakdown.push({
        factor: "Deadline Expired Suppression",
        delta: -50,
        explanation: "Opportunity deadline has already passed; demoted from active urgent pipeline",
      });
      badges.push("DEADLINE EXPIRED");
    } else if (diffMs <= 3 * 60 * 60 * 1000) {
      urgencyStatus = "EXPIRING_SOON";
      urgencyLabel = `Expiring soon: ${Math.max(1, Math.round(diffMs / (1000 * 60)))}m left`;
      isExpiringSoon = true;
      requiresImmediateAction = true;
      score += 35;
      breakdown.push({
        factor: "Deadline < 3 Hours",
        delta: 35,
        explanation: "Critical immediate deadline window",
      });
      badges.push("EXPIRING SOON");
    } else if (isDeadlineToday) {
      urgencyStatus = "DUE_TODAY";
      urgencyLabel = `Due today (${analysis.deadlineTime || analysis.deadlineDisplay || "End of Day"})`;
      requiresImmediateAction = true;
      score += 32;
      breakdown.push({
        factor: "Deadline Today",
        delta: 32,
        explanation: "Deadline expires today",
      });
      badges.push("DEADLINE TODAY");
    } else if (diffMs <= 24 * 60 * 60 * 1000) {
      urgencyStatus = "DUE_WITHIN_24H";
      urgencyLabel = `Due within 24 hours (${analysis.deadlineDisplay || "Tomorrow"})`;
      score += 28;
      breakdown.push({
        factor: "Deadline < 24h",
        delta: 28,
        explanation: "Urgent deadline within 24 hours",
      });
      badges.push("DUE TOMORROW");
    } else if (diffMs <= 72 * 60 * 60 * 1000) {
      urgencyStatus = "DUE_WITHIN_72H";
      urgencyLabel = `Due within 3 days (${analysis.deadlineDisplay})`;
      score += 22;
      breakdown.push({
        factor: "Deadline 24-72h",
        delta: 22,
        explanation: "Approaching deadline within 3 days",
      });
    } else if (diffMs <= 7 * 24 * 60 * 60 * 1000) {
      urgencyStatus = "DUE_WITHIN_7D";
      urgencyLabel = `Due this week (${analysis.deadlineDisplay})`;
      score += 16;
      breakdown.push({
        factor: "Deadline 3-7 days",
        delta: 16,
        explanation: "Upcoming deadline within 7 days",
      });
    } else {
      urgencyStatus = "UPCOMING";
      urgencyLabel = `Due ${analysis.deadlineDisplay || "in > 7 days"}`;
      score += 10;
      breakdown.push({
        factor: "Upcoming Deadline",
        delta: 10,
        explanation: "Future scheduled deadline",
      });
    }
  }

  // 9. Promotional / Marketing / Low-Value Newsletter Suppression (-50 to -70)
  if (analysis.category === "NEWSLETTER_PROMO" || analysis.isPromotionalOrNewsletter) {
    const delta = -55;
    score += delta;
    breakdown.push({
      factor: "Newsletter / Promotional Suppression",
      delta,
      explanation: "Demoted due to promotional / digest format",
    });
  }

  // Clamp final score 0 - 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Priority Tier classification:
  // 90–100: CRITICAL
  // 85–89: VERY IMPORTANT (HIGH)
  // 80–84: IMPORTANT (HIGH)
  // 75–79: WORTH ATTENTION (HIGH / MEDIUM)
  // 0–74: NO NORMAL ALERT (MEDIUM / LOW / IGNORE)
  let priorityLevel: PriorityLevel = "LOW";
  if (finalScore >= 90) {
    priorityLevel = "CRITICAL";
  } else if (finalScore >= 75) {
    priorityLevel = "HIGH";
  } else if (finalScore >= 50) {
    priorityLevel = "MEDIUM";
  } else if (finalScore >= 25) {
    priorityLevel = "LOW";
  } else {
    priorityLevel = "IGNORE";
  }

  // Top level badge
  if (priorityLevel === "CRITICAL") {
    badges.unshift("CRITICAL");
  } else if (finalScore >= 85) {
    badges.unshift("VERY IMPORTANT");
  } else if (finalScore >= 80) {
    badges.unshift("IMPORTANT");
  } else if (finalScore >= 75) {
    badges.unshift("WORTH ATTENTION");
  }

  if (!isExpired) {
    currentUrgency = finalScore;
  }

  return {
    score: finalScore,
    originalPriorityScore,
    currentUrgency,
    isExpired,
    priorityLevel,
    urgencyStatus,
    urgencyLabel,
    isDeadlineToday,
    isExpiringSoon,
    isDeadlinePassed,
    requiresImmediateAction,
    hoursRemaining,
    scoreBreakdown: breakdown,
    badges: Array.from(new Set(badges)),
  };
}

export type PriorityTier = "CRITICAL" | "VERY_IMPORTANT" | "IMPORTANT" | "WORTH_ATTENTION" | "NO_ALERT";

export function getPriorityTier(score: number): { tier: PriorityTier; label: string; minScoreEligible: boolean } {
  if (score >= 90) {
    return { tier: "CRITICAL", label: "CRITICAL (90–100)", minScoreEligible: true };
  }
  if (score >= 85) {
    return { tier: "VERY_IMPORTANT", label: "VERY IMPORTANT (85–89)", minScoreEligible: true };
  }
  if (score >= 80) {
    return { tier: "IMPORTANT", label: "IMPORTANT (80–84)", minScoreEligible: true };
  }
  if (score >= 75) {
    return { tier: "WORTH_ATTENTION", label: "WORTH ATTENTION (75–79)", minScoreEligible: true };
  }
  return { tier: "NO_ALERT", label: "NO NORMAL ALERT (0–74)", minScoreEligible: false };
}
