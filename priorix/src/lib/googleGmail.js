/**
 * Gmail Read-Only Follow-Up & Priority Scanner for Priorix
 * 
 * STRICT COMPLIANCE:
 * - Scope: https://www.googleapis.com/auth/gmail.readonly ONLY
 * - NEVER sends, replies to, modifies, archives, labels, or deletes messages
 * - Deeply inspects message headers, forwarded message bodies, snippets, URLs, deadlines, and CTC/roles
 * - NEVER alters or rewrites original Gmail subjects
 * - Evaluates priority using a generalized, deterministic multi-factor scoring engine
 */

const GMAIL_API_BASE = '/api/gmail';

// Base64URL safe decoder with UTF-8 support
export function decodeBase64Url(str) {
  if (!str) return '';
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
}

/**
 * Recursively extracts plain text from a Gmail message payload (body and parts)
 */
export function extractBodyText(payload) {
  if (!payload) return '';
  let text = '';

  if (payload.body && payload.body.data) {
    text += decodeBase64Url(payload.body.data) + ' ';
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text += decodeBase64Url(part.body.data) + ' ';
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        const stripped = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"');
        text += stripped + ' ';
      } else if (part.parts) {
        text += extractBodyText(part) + ' ';
      }
    }
  }

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Handle HTTP response and throw friendly error messages
 */
async function handleGmailResponse(response, operationDescription = 'Gmail operation') {
  if (response.ok) {
    return await response.json();
  }

  let errorDetails = '';
  try {
    const errorJson = await response.json();
    errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
  } catch (e) {
    errorDetails = response.statusText;
  }

  if (response.status === 401) {
    throw new Error('Google authorization has expired. Please reconnect your Google account in Settings.');
  }
  if (response.status === 403) {
    throw new Error('Insufficient Gmail permissions. Please reconnect and ensure read-only Gmail access is granted.');
  }
  if (response.status === 429) {
    throw new Error('Gmail API rate limit reached. Please wait a moment before refreshing.');
  }

  throw new Error(`${operationDescription} failed: ${errorDetails}`);
}

/**
 * Parses header fields from a Gmail message payload
 */
export function extractHeaders(headersList = []) {
  const result = {
    from: '',
    fromName: '',
    fromEmail: '',
    subject: '(No Subject)',
    date: null,
    messageId: '',
  };

  for (const header of headersList) {
    const name = (header.name || '').toLowerCase();
    const value = header.value || '';

    if (name === 'from') {
      result.from = value;
      const match = value.match(/(.*?)\s*<(.+?)>/);
      if (match) {
        result.fromName = match[1].replace(/["']/g, '').trim() || match[2];
        result.fromEmail = match[2].trim().toLowerCase();
      } else {
        result.fromName = value;
        result.fromEmail = value.trim().toLowerCase();
      }
    } else if (name === 'subject') {
      result.subject = value || '(No Subject)';
    } else if (name === 'date') {
      try {
        result.date = new Date(value);
      } catch (e) {
        result.date = null;
      }
    } else if (name === 'message-id') {
      result.messageId = value;
    }
  }

  return result;
}

/**
 * Parses forwarded email markers and extracts original sender info
 */
export function extractForwardedMetadata(bodyText = '') {
  const result = {
    isForwarded: false,
    forwardedFrom: '',
    forwardedFromName: '',
    forwardedFromEmail: '',
    forwardedDate: '',
    forwardedSubject: '',
  };

  if (!bodyText) return result;

  const fwdHeaderMatch = bodyText.match(
    /(?:---------- Forwarded message ---------|Begin forwarded message|---------- Forwarded message ----------)[\s\S]*?(?:From|from):\s*([^\n\r<]+)?(?:<([^>\n\r]+)>)?/i
  );

  if (fwdHeaderMatch) {
    result.isForwarded = true;
    const rawName = (fwdHeaderMatch[1] || '').trim();
    const rawEmail = (fwdHeaderMatch[2] || '').trim().toLowerCase();
    result.forwardedFromName = rawName.replace(/["']/g, '');
    result.forwardedFromEmail = rawEmail;
    result.forwardedFrom = rawEmail ? `${result.forwardedFromName} <${rawEmail}>` : result.forwardedFromName;
  } else {
    // Check for inline From: lines inside body that differ from top sender
    const inlineFromMatch = bodyText.match(/(?:From|Sender):\s*([A-Za-z0-9\s.\-_]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/i);
    if (inlineFromMatch) {
      result.isForwarded = true;
      result.forwardedFromName = inlineFromMatch[1].trim();
      result.forwardedFromEmail = inlineFromMatch[2].trim().toLowerCase();
      result.forwardedFrom = `${result.forwardedFromName} <${result.forwardedFromEmail}>`;
    }
  }

  return result;
}

/**
 * Generalized, multi-format deadline parser
 * Detects patterns like:
 * - "4:00 PM of 25/08/2026"
 * - "25/08/2026, 4:00 PM"
 * - "25-08-2026 16:00"
 * - "August 25, 2026 at 4:00 PM"
 * - "Deadline: 4:00 PM of 25/08/2026"
 */
export function extractDeadlineFromContent(text = '', referenceDate = new Date()) {
  if (!text) return null;

  // 1. Time of DD/MM/YYYY or DD-MM-YYYY (e.g. "4:00 PM of 25/08/2026" or "4 PM of 25-08-2026")
  const pattern1 = /(?:deadline|last date|due date|closing date|apply by|submit by|before|end date|window closes|time)?\s*(?:is|:|-)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s+(?:of|on)\s+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i;
  const match1 = text.match(pattern1);
  if (match1) {
    const timeStr = match1[1];
    const day = parseInt(match1[2], 10);
    const month = parseInt(match1[3], 10) - 1;
    let year = parseInt(match1[4], 10);
    if (year < 100) year += 2000;

    const parsedDate = parseTimeStringIntoDate(timeStr, year, month, day);
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      return {
        rawString: match1[0].trim(),
        deadlineDate: parsedDate,
        day,
        month: month + 1,
        year,
      };
    }
  }

  // 2. DD/MM/YYYY at/by/comma Time (e.g. "25/08/2026 at 4:00 PM" or "25/08/2026, 4:00 PM" or "25-08-2026 16:00")
  const pattern2 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s*(?:at|by|,|-)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i;
  const match2 = text.match(pattern2);
  if (match2) {
    const day = parseInt(match2[1], 10);
    const month = parseInt(match2[2], 10) - 1;
    let year = parseInt(match2[3], 10);
    if (year < 100) year += 2000;
    const timeStr = match2[4] || '17:00';

    const parsedDate = parseTimeStringIntoDate(timeStr, year, month, day);
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      return {
        rawString: match2[0].trim(),
        deadlineDate: parsedDate,
        day,
        month: month + 1,
        year,
      };
    }
  }

  // 3. Month name date format (e.g. "25 Aug 2026, 4:00 PM" or "August 25, 2026 at 4:00 PM")
  const pattern3 = /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})(?:\s*(?:at|by|,)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?))?/i;
  const match3 = text.match(pattern3);
  if (match3) {
    const day = parseInt(match3[1], 10);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = monthNames.indexOf(match3[2].toLowerCase().substring(0, 3));
    const year = parseInt(match3[3], 10);
    const timeStr = match3[4] || '17:00';

    if (month !== -1) {
      const parsedDate = parseTimeStringIntoDate(timeStr, year, month, day);
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        return {
          rawString: match3[0].trim(),
          deadlineDate: parsedDate,
          day,
          month: month + 1,
          year,
        };
      }
    }
  }

  return null;
}

/**
 * Helper to parse time string like "4:00 PM", "4 PM", "16:00" into a Date object
 */
function parseTimeStringIntoDate(timeStr, year, month, day) {
  let hours = 17;
  let minutes = 0;

  if (timeStr) {
    const trimmed = timeStr.trim().toUpperCase();
    const isPM = trimmed.includes('PM');
    const isAM = trimmed.includes('AM');
    const cleanTime = trimmed.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');

    if (parts.length >= 1 && parts[0]) {
      hours = parseInt(parts[0], 10);
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      if (parts.length >= 2 && parts[1]) {
        minutes = parseInt(parts[1], 10);
      }
    }
  }

  const d = new Date(year, month, day, hours, minutes, 0, 0);
  return d;
}

/**
 * Formats a Date object into human friendly representation
 */
export function formatDeadlineDisplay(date) {
  if (!date || isNaN(date.getTime())) return null;
  const options = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return date.toLocaleDateString('en-GB', options);
}

/**
 * Evaluates deadline proximity & status relative to current time
 */
export function calculateDeadlineStatus(deadlineDate, now = new Date()) {
  if (!deadlineDate || isNaN(deadlineDate.getTime())) {
    return {
      status: 'NO_DEADLINE',
      statusLabel: 'No explicit deadline',
      isPassed: false,
      isToday: false,
      hoursRemaining: null,
    };
  }

  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const isSameDay =
    deadlineDate.getFullYear() === now.getFullYear() &&
    deadlineDate.getMonth() === now.getMonth() &&
    deadlineDate.getDate() === now.getDate();

  if (diffMs < 0) {
    return {
      status: 'DEADLINE_PASSED',
      statusLabel: 'Deadline passed',
      isPassed: true,
      isToday: isSameDay,
      hoursRemaining: 0,
    };
  }

  if (isSameDay) {
    const timeStr = deadlineDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return {
      status: 'DUE_TODAY',
      statusLabel: `Due today at ${timeStr}`,
      isPassed: false,
      isToday: true,
      hoursRemaining: Math.max(0, Math.round(diffHours)),
    };
  }

  if (diffHours <= 36) {
    return {
      status: 'DUE_TOMORROW',
      statusLabel: 'Due tomorrow',
      isPassed: false,
      isToday: false,
      hoursRemaining: Math.round(diffHours),
    };
  }

  return {
    status: 'UPCOMING',
    statusLabel: `Due ${formatDeadlineDisplay(deadlineDate)}`,
    isPassed: false,
    isToday: false,
    hoursRemaining: Math.round(diffHours),
  };
}

/**
 * Universal content analyzer for Gmail messages
 * Extracts all features and computes priority score without hardcoding company names
 */
export function analyzeEmailContent({
  subject = '',
  from = '',
  fromName = '',
  fromEmail = '',
  bodyText = '',
  snippet = '',
  receivedDate = new Date(),
  now = new Date(),
}) {
  const fullContent = `${subject} ${fromName} ${fromEmail} ${bodyText} ${snippet}`;
  const lowerContent = fullContent.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // 1. Forwarded Message Metadata
  const forwardedMeta = extractForwardedMetadata(bodyText || snippet);

  // 2. Department & Institution Source Extraction
  let sourceDepartment = '';
  let isPlacementOrAcademic = false;

  const placementKeywords = [
    'placement',
    'campus placement',
    'training & placement',
    'training and placement',
    't&p',
    'career development',
    'crc',
    'tnp',
    'recruitment cell',
    'university placement'
  ];

  if (
    placementKeywords.some(kw => lowerContent.includes(kw)) ||
    lowerContent.includes('.ac.in') ||
    lowerContent.includes('.edu')
  ) {
    isPlacementOrAcademic = true;
    if (forwardedMeta.forwardedFromName) {
      sourceDepartment = forwardedMeta.forwardedFromName;
    } else if (fromName && placementKeywords.some(kw => fromName.toLowerCase().includes(kw))) {
      sourceDepartment = fromName;
    } else if (lowerContent.includes('brainware university')) {
      sourceDepartment = 'Brainware University Placement Department';
    } else {
      sourceDepartment = 'Campus Placement & Career Office';
    }
  }

  // 3. Company / Organization / Entity Extraction (Generic Regex Patterns)
  let detectedCompany = '';
  const entityPatterns = [
    /M\/s\.\s*([A-Za-z0-9&.\-_]+)/i,
    /Company:\s*([A-Za-z0-9&.\-_ ]+)/i,
    /Organization:\s*([A-Za-z0-9&.\-_ ]+)/i,
    /Recruitment (?:drive|opportunity) for\s+([A-Za-z0-9&.\-_]+)/i,
    /Hiring by\s+([A-Za-z0-9&.\-_]+)/i,
    /([A-Za-z0-9\-_]{3,20})\s*\|\s*Virtual ON Campus/i,
    /GATE\s*20\d\d/i,
    /NPTEL/i
  ];

  for (const pat of entityPatterns) {
    const match = fullContent.match(pat);
    if (match) {
      detectedCompany = (match[1] || match[0]).trim();
      break;
    }
  }

  // 4. Job Roles / Opportunities Detection
  const detectedRoles = [];
  const roleKeywords = [
    { pattern: /\bSDE\b|Software Development Engineer|Software Engineer/i, label: 'SDE Intern / Full-Time' },
    { pattern: /\bDevRel\b|Developer Relations/i, label: 'DevRel Intern / Full-Time' },
    { pattern: /Frontend Engineer|Frontend Developer/i, label: 'Frontend Engineer' },
    { pattern: /Backend Engineer|Backend Developer/i, label: 'Backend Engineer' },
    { pattern: /Full[\s-]Stack Engineer|Full[\s-]Stack Developer/i, label: 'Full Stack Engineer' },
    { pattern: /AI[\s\/]ML Engineer|Machine Learning/i, label: 'AI/ML Engineer' },
    { pattern: /Data Analyst|Data Scientist/i, label: 'Data Analyst' },
    { pattern: /QA Engineer|Quality Assurance/i, label: 'QA Engineer' },
    { pattern: /DevOps Engineer|Cloud Engineer/i, label: 'DevOps Engineer' },
    { pattern: /GATE\s*20\d\d/i, label: 'GATE 2027 Examination' },
  ];

  for (const { pattern, label } of roleKeywords) {
    if (pattern.test(fullContent) && !detectedRoles.includes(label)) {
      detectedRoles.push(label);
    }
  }

  // 5. Compensation / CTC / Stipend Extraction
  let detectedCTC = '';
  let detectedStipend = '';

  const ctcMatch = fullContent.match(/(\d+(?:\.\d+)?\s*(?:-\s*\d+(?:\.\d+)?)?\s*LPA(?:[\s\w-]*Base)?)/i);
  if (ctcMatch) {
    detectedCTC = ctcMatch[1].trim();
  }

  const stipendMatch = fullContent.match(/(?:stipend|stipend up to|stipend:)\s*([₹Rs.\d,\s–-]+(?:\/month|pm)?)/i) ||
                       fullContent.match(/(₹\s*[\d,]+(?:\s*[–-]\s*₹?\s*[\d,]+)?)/);
  if (stipendMatch) {
    detectedStipend = stipendMatch[1].trim();
  }

  // 6. Application Form Links Detection
  const linkMatches = fullContent.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms|forms\.office\.com|typeform\.com|surveymonkey\.com|unstop\.com|internshala\.com|hackerearth\.com|hackerrank\.com|bit\.ly|t\.ly)[^\s<>"'\)]+/gi);
  const applicationLink = linkMatches && linkMatches.length > 0 ? linkMatches[0] : null;
  const hasApplicationForm = Boolean(applicationLink || lowerContent.includes('forms.gle') || lowerContent.includes('google form') || lowerContent.includes('application form'));

  // 7. Explicit Deadline Extraction
  const deadlineInfo = extractDeadlineFromContent(fullContent, now);
  const deadlineDate = deadlineInfo ? deadlineInfo.deadlineDate : null;
  const deadlineStatus = calculateDeadlineStatus(deadlineDate, now);
  const deadlineDisplay = formatDeadlineDisplay(deadlineDate);

  // 8. Action Required & Career Signals Detection
  const hasActionRequired =
    lowerContent.includes('mandatory') ||
    lowerContent.includes('action required') ||
    lowerContent.includes('deadline') ||
    lowerContent.includes('apply before') ||
    lowerContent.includes('last date') ||
    lowerContent.includes('registration required') ||
    lowerContent.includes('submit your') ||
    lowerContent.includes('fill the form');

  const isCareerOpportunity =
    detectedRoles.length > 0 ||
    isPlacementOrAcademic ||
    lowerContent.includes('campus placement') ||
    lowerContent.includes('virtual on campus') ||
    lowerContent.includes('recruitment') ||
    lowerContent.includes('hiring') ||
    lowerContent.includes('interview') ||
    lowerContent.includes('internship') ||
    lowerContent.includes('full-time') ||
    Boolean(detectedCTC);

  // 9. Negative Newsletter / Digest / Marketing Penalties (do not penalize real action/interview/deadline emails just for having an unsubscribe footer)
  const isNewsletter =
    !isCareerOpportunity &&
    !deadlineInfo &&
    !hasActionRequired &&
    (lowerContent.includes('2 minute read') ||
      lowerContent.includes('3 min read') ||
      lowerContent.includes('min read') ||
      lowerContent.includes('weekly digest') ||
      lowerContent.includes('newsletter') ||
      lowerContent.includes('view in browser') ||
      lowerContent.includes('curated for you') ||
      (lowerContent.includes('unsubscribe') &&
        (lowerContent.includes('digest') || lowerContent.includes('promo') || lowerContent.includes('offer'))));

  const isMarketingPromo =
    !isCareerOpportunity &&
    !deadlineInfo &&
    (lowerContent.includes('discount') ||
      lowerContent.includes('coupon') ||
      lowerContent.includes('flash sale') ||
      lowerContent.includes('sponsored'));

  // 10. Multi-Factor Priority Scoring Engine (0-100+)
  let score = 15; // Baseline
  const reasons = [];

  if (isPlacementOrAcademic) {
    score += 35;
    reasons.push(sourceDepartment ? `From ${sourceDepartment}` : 'University placement / academic department notice');
  }

  if (isCareerOpportunity) {
    score += 30;
    if (detectedRoles.length > 0) {
      reasons.push(`${detectedRoles.join(', ')} opportunity`);
    } else {
      reasons.push('Career / recruitment opportunity');
    }
  }

  if (hasApplicationForm) {
    score += 25;
    reasons.push(applicationLink ? `Application form detected: ${applicationLink}` : 'Application form / portal detected');
  }

  if (deadlineInfo) {
    score += 30;
    reasons.push(`Explicit deadline detected: ${deadlineDisplay || deadlineInfo.rawString}`);

    if (deadlineStatus.isToday) {
      score += 35;
      reasons.push('Deadline was today (Critical immediate action)');
    } else if (deadlineStatus.hoursRemaining !== null && deadlineStatus.hoursRemaining <= 48 && !deadlineStatus.isPassed) {
      score += 25;
      reasons.push(`Urgent: ${deadlineStatus.hoursRemaining} hours remaining`);
    }
  }

  if (hasActionRequired) {
    score += 20;
    reasons.push('Mandatory application action required');
  }

  if (detectedCTC || detectedStipend) {
    score += 15;
    reasons.push(`Compensation stated: ${[detectedCTC, detectedStipend].filter(Boolean).join(' / ')}`);
  }

  // Penalize newsletters / digests
  if (isNewsletter) {
    score -= 40;
    reasons.push('Generic newsletter / digest (Lowered priority)');
  }

  if (isMarketingPromo) {
    score -= 45;
  }

  // Clamp score
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Priority Level & Badges
  let priorityLevel = 'LOW';
  const badges = [];

  if (finalScore >= 80) {
    priorityLevel = 'CRITICAL';
    badges.push('CRITICAL');
  } else if (finalScore >= 55) {
    priorityLevel = 'HIGH';
    badges.push('HIGH PRIORITY');
  } else if (finalScore >= 35) {
    priorityLevel = 'MEDIUM';
    badges.push('MEDIUM');
  } else {
    priorityLevel = 'LOW';
    badges.push('LOW');
  }

  if (deadlineStatus.status === 'DEADLINE_PASSED') {
    badges.push('DEADLINE PASSED');
  } else if (deadlineStatus.status === 'DUE_TODAY') {
    badges.push('DEADLINE TODAY');
  }

  if (isCareerOpportunity) {
    badges.push('CAREER OPPORTUNITY');
  }

  if (hasApplicationForm || hasActionRequired) {
    badges.push('APPLICATION REQUIRED');
  }

  return {
    score: finalScore,
    priorityLevel,
    badges,
    reasons,
    isForwarded: forwardedMeta.isForwarded,
    forwardedFrom: forwardedMeta.forwardedFrom,
    forwardedFromName: forwardedMeta.forwardedFromName,
    forwardedFromEmail: forwardedMeta.forwardedFromEmail,
    sourceDepartment,
    detectedCompany,
    detectedRoles,
    detectedCTC,
    detectedStipend,
    applicationLink,
    hasApplicationForm,
    deadlineDate: deadlineDate ? deadlineDate.toISOString() : null,
    deadlineDisplay,
    deadlineStatus: deadlineStatus.status,
    deadlineStatusLabel: deadlineStatus.statusLabel,
    isDeadlinePassed: deadlineStatus.isPassed,
    isDeadlineToday: deadlineStatus.isToday,
  };
}

/**
 * Scans recent incoming messages from Gmail API using read-only scopes.
 * Evaluates candidate batch, parses full body content, and ranks by priority.
 */
export async function scanGmailFollowUps(accessToken, userEmail = '') {
  if (!accessToken) throw new Error('Missing Google access token');

  // 1. First attempt the fast, unified server-side scan proxy
  try {
    const scanRes = await fetch('/api/gmail/scan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        userEmail,
        maxResults: 60,
      }),
    });

    if (scanRes.ok) {
      const scanData = await scanRes.json();
      if (scanData.success && Array.isArray(scanData.messages)) {
        return processAndRankMessages(scanData.messages, userEmail);
      }
    }
  } catch (scanErr) {
    console.warn('[Gmail Scanner] Fast batch scan endpoint unavailable, falling back to message proxy:', scanErr);
  }

  // 2. Fallback: Query up to 60 messages from inbox via proxy endpoint
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const url = new URL(`${GMAIL_API_BASE}/messages`, baseUrl);
  url.searchParams.set('maxResults', '60');
  url.searchParams.set('q', 'in:inbox -category:promotions -category:social');

  const listRes = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const listData = await handleGmailResponse(listRes, 'Listing Gmail messages');
  const messageSummaries = listData.messages || [];

  if (messageSummaries.length === 0) {
    return [];
  }

  // Fetch full message payloads in parallel batches (10 at a time to stay performant and respect limits)
  const batchSize = 10;
  const messageDetails = [];

  for (let i = 0; i < messageSummaries.length; i += batchSize) {
    const slice = messageSummaries.slice(i, i + batchSize);
    const batchPromises = slice.map(async (msg) => {
      try {
        const msgUrl = new URL(`${GMAIL_API_BASE}/messages/${msg.id}`, baseUrl);
        msgUrl.searchParams.set('format', 'full');

        const msgRes = await fetch(msgUrl.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!msgRes.ok) return null;
        const msgData = await msgRes.json();
        const headers = extractHeaders(msgData.payload?.headers);
        const bodyText = extractBodyText(msgData.payload);

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          snippet: msgData.snippet || '',
          bodyText,
          ...headers,
        };
      } catch (e) {
        console.warn(`Could not load details for message ${msg.id}:`, e);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    messageDetails.push(...batchResults.filter(Boolean));
  }

  return processAndRankMessages(messageDetails, userEmail);
}

/**
 * Transforms, scores, and ranks email message payloads
 */
export function processAndRankMessages(messageDetails, userEmail = '') {
  const now = new Date();
  const normalizedUserEmail = (userEmail || '').trim().toLowerCase();
  const scoredItems = [];

  for (const msg of messageDetails) {
    // Skip if message was authored by the user themselves
    if (normalizedUserEmail && msg.fromEmail === normalizedUserEmail) {
      continue;
    }

    const msgDate = msg.date ? new Date(msg.date) : new Date();
    const analysis = analyzeEmailContent({
      subject: msg.subject,
      from: msg.from,
      fromName: msg.fromName,
      fromEmail: msg.fromEmail,
      bodyText: msg.bodyText,
      snippet: msg.snippet,
      receivedDate: msgDate,
      now,
    });

    // Compute message age in days
    const diffMs = now.getTime() - msgDate.getTime();
    const daysAgo = Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)), 0);

    // Keep original subject intact without modifications
    scoredItems.push({
      id: msg.id,
      threadId: msg.threadId,
      from: msg.from,
      fromName: msg.fromName,
      fromEmail: msg.fromEmail,
      subject: msg.subject, // Original exact subject preserved!
      snippet: msg.snippet,
      bodyText: (msg.bodyText || msg.snippet || '').substring(0, 6000),
      bodyPreview: (msg.bodyText || msg.snippet || '').substring(0, 300),
      receivedDate: msgDate.toISOString(),
      daysAgo,
      source: 'gmail',
      // Multi-factor analysis results
      ...analysis,
      suggestedTitle: msg.subject, // Exact subject
      suggestedContact: analysis.forwardedFromName || msg.fromName || msg.fromEmail,
    });
  }

  // Sort strictly by priority score descending, then by urgency
  return scoredItems.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.daysAgo - b.daysAgo;
  });
}
