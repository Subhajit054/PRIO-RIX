/**
 * PRIORIX Attention & Neglect Engine
 * 
 * Deterministic multi-signal prioritization model:
 * Signals:
 * 1. Deadline Proximity (due date distance in hours/days)
 * 2. Inactivity & Touch Recency (days since last touch / update)
 * 3. Progress Deficit (target deadline near vs completion %)
 * 4. Inherent Importance / Priority Level
 * 5. Overdue Penalty
 */

export const RISK_LEVELS = {
  OVERDUE: 'OVERDUE',
  AT_RISK: 'AT_RISK',
  NEGLECTED: 'NEGLECTED',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  NORMAL: 'NORMAL',
};

/**
 * Calculates days between two date strings or Date objects
 */
export function getDaysDifference(targetDate, baseDate = new Date()) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const base = new Date(baseDate);
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates hours between two date strings
 */
export function getHoursDifference(targetDate, baseDate = new Date()) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const base = new Date(baseDate);
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60));
}

/**
 * Computes deterministic attention score (0 - 100) and risk classification for an item
 * Supports Tasks, Commitments, Goals, and Follow-ups
 */
export function calculateAttentionScore(item, itemType = 'task') {
  if (!item) return { score: 0, risk: RISK_LEVELS.NORMAL, reasons: [] };

  // If completed or fulfilled, attention is 0
  if (
    item.status === 'completed' ||
    item.status === 'fulfilled' ||
    item.status === 'closed' ||
    item.status === 'archived'
  ) {
    return {
      score: 0,
      risk: RISK_LEVELS.NORMAL,
      reasons: ['Resolved/Completed']
    };
  }

  let score = 20; // baseline
  const reasons = [];
  const now = new Date();

  // 1. Inherent Priority / Importance Weight
  const priority = (item.priority || item.importance || 'medium').toLowerCase();
  const priorityMultipliers = {
    critical: 35,
    high: 25,
    medium: 12,
    low: 0,
  };
  score += priorityMultipliers[priority] || 10;

  // 2. Deadline & Proximity Calculation
  const dueDate = item.due_date || item.target_date || item.follow_up_due_date;
  let isOverdue = false;
  let daysUntilDue = null;

  if (dueDate) {
    daysUntilDue = getDaysDifference(dueDate, now);
    if (daysUntilDue < 0) {
      isOverdue = true;
      const overdueDays = Math.abs(daysUntilDue);
      score += 40 + Math.min(overdueDays * 5, 25);
      reasons.push(`Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`);
    } else if (daysUntilDue === 0) {
      score += 35;
      reasons.push('Due today');
    } else if (daysUntilDue === 1) {
      score += 28;
      reasons.push('Due tomorrow');
    } else if (daysUntilDue <= 3) {
      score += 20;
      reasons.push(`Due in ${daysUntilDue} days`);
    } else if (daysUntilDue <= 7) {
      score += 10;
      reasons.push(`Due this week (${daysUntilDue} days)`);
    }
  }

  // 3. Neglect & Inactivity Signals
  const lastTouch = item.last_touched_at || item.last_progress_date || item.last_ping_date || item.created_at;
  let daysSinceTouch = 0;
  if (lastTouch) {
    daysSinceTouch = Math.abs(getDaysDifference(lastTouch, now));
    const neglectThreshold = itemType === 'goal' ? 14 : 7;
    
    if (daysSinceTouch >= neglectThreshold) {
      const neglectBonus = Math.min((daysSinceTouch - neglectThreshold + 1) * 4, 30);
      score += neglectBonus;
      reasons.push(`No activity for ${daysSinceTouch} days`);
    }
  }

  // 4. Progress Deficit Signal (For Goals or Tasks with progress)
  if (item.progress_percentage !== undefined && daysUntilDue !== null && !isOverdue) {
    const progress = Number(item.progress_percentage) || 0;
    if (daysUntilDue <= 5 && progress < 40) {
      score += 20;
      reasons.push(`Low progress (${progress}%) near deadline`);
    } else if (daysUntilDue <= 10 && progress < 20) {
      score += 12;
      reasons.push(`Only ${progress}% completed with ${daysUntilDue} days left`);
    }
  }

  // 5. Follow-Up Waiting Aging
  if (itemType === 'follow_up' && item.sent_date) {
    const daysWaiting = Math.abs(getDaysDifference(item.sent_date, now));
    if (daysWaiting >= 5 && item.status === 'waiting') {
      score += 15;
      reasons.push(`Awaiting response for ${daysWaiting} days`);
    }
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(Math.max(Math.round(score), 0), 100);

  // Determine Risk Category
  let risk = RISK_LEVELS.NORMAL;
  if (isOverdue) {
    risk = RISK_LEVELS.OVERDUE;
  } else if (finalScore >= 80) {
    risk = RISK_LEVELS.AT_RISK;
  } else if (daysSinceTouch >= (itemType === 'goal' ? 14 : 7)) {
    risk = RISK_LEVELS.NEGLECTED;
  } else if (finalScore >= 60 || (daysUntilDue !== null && daysUntilDue <= 2)) {
    risk = RISK_LEVELS.NEEDS_ATTENTION;
  }

  return {
    score: finalScore,
    risk,
    daysUntilDue,
    daysSinceTouch,
    reasons: reasons.length > 0 ? reasons : ['Normal monitoring']
  };
}

/**
 * Sorts any list of items by Attention Score in descending order
 */
export function rankByAttention(items, itemType = 'task') {
  return [...items]
    .map(item => ({
      ...item,
      attention: calculateAttentionScore(item, itemType)
    }))
    .sort((a, b) => b.attention.score - a.attention.score);
}
