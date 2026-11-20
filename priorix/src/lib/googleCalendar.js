/**
 * Google Calendar API Service for Priorix
 * 
 * Scope: https://www.googleapis.com/auth/calendar.events
 * Provides real synchronization for tasks and commitments to the user's primary calendar.
 */

const CALENDAR_API_BASE = '/api/calendar';

/**
 * Handle HTTP response and throw friendly error messages
 */
async function handleCalendarResponse(response, operationDescription = 'Calendar operation') {
  if (response.ok) {
    if (response.status === 204) return true; // No content (e.g., delete)
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
    throw new Error('Insufficient Google Calendar permissions. Please reconnect and ensure calendar access is granted.');
  }
  if (response.status === 404) {
    throw new Error('The specified calendar event was not found on Google Calendar.');
  }
  if (response.status === 429) {
    throw new Error('Google Calendar rate limit exceeded. Please wait a few seconds and try again.');
  }

  throw new Error(`${operationDescription} failed: ${errorDetails}`);
}

/**
 * Retrieves the user's Google Calendar events within a specified date window
 */
export async function fetchGoogleCalendarEvents(accessToken, startDate = new Date(), daysRange = 60) {
  if (!accessToken) throw new Error('Missing Google access token');

  const timeMin = new Date(startDate);
  timeMin.setDate(timeMin.getDate() - 15); // Look back 15 days
  const timeMax = new Date(startDate);
  timeMax.setDate(timeMax.getDate() + daysRange); // Look forward 60 days

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const url = new URL(`${CALENDAR_API_BASE}/events`, baseUrl);
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '100');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  const data = await handleCalendarResponse(res, 'Fetching Google Calendar events');
  const items = data.items || [];

  return items.map(item => {
    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    const isAllDay = !item.start?.dateTime;

    return {
      id: item.id,
      googleEventId: item.id,
      title: item.summary || '(Untitled Event)',
      description: item.description || '',
      location: item.location || '',
      start: startRaw,
      end: endRaw,
      date: new Date(startRaw),
      isAllDay,
      htmlLink: item.htmlLink,
      status: item.status,
      itemType: 'google_calendar_event',
      isGoogleCalendarEvent: true,
      organizer: item.organizer?.email || item.creator?.email || '',
      attendeesCount: item.attendees?.length || 0,
      isPriorixManaged: item.description?.includes('[Priorix Managed') || false,
    };
  });
}

/**
 * Creates a new event in the user's primary Google Calendar
 */
export async function createGoogleCalendarEvent(accessToken, {
  title,
  description = '',
  dueDate,
  estimatedMinutes = 60,
  priorixId = '',
  itemType = 'task'
}) {
  if (!accessToken) throw new Error('Missing Google access token');
  if (!title) throw new Error('Event title is required');

  const start = dueDate ? new Date(dueDate) : new Date();
  // If time is midnight (e.g. date-only selector), schedule at 9:00 AM
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    start.setHours(9, 0, 0, 0);
  }

  const end = new Date(start.getTime() + (Number(estimatedMinutes) || 60) * 60 * 1000);

  const eventPayload = {
    summary: title,
    description: `${description ? description + '\n\n' : ''}--- \n📌 Priorix Managed ${itemType.toUpperCase()} [ID: ${priorixId || 'N/A'}]\nSynchronized via Priorix Execution Workspace.`,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    reminders: {
      useDefault: true,
    }
  };

  const res = await fetch(`${CALENDAR_API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  const createdEvent = await handleCalendarResponse(res, 'Creating Google Calendar event');
  return {
    id: createdEvent.id,
    htmlLink: createdEvent.htmlLink,
    summary: createdEvent.summary,
    start: createdEvent.start,
    end: createdEvent.end,
  };
}

/**
 * Updates an existing Google Calendar event
 */
export async function updateGoogleCalendarEvent(accessToken, eventId, {
  title,
  description = '',
  dueDate,
  estimatedMinutes = 60,
  priorixId = '',
  itemType = 'task'
}) {
  if (!accessToken) throw new Error('Missing Google access token');
  if (!eventId) throw new Error('Missing Google event ID to update');

  const start = dueDate ? new Date(dueDate) : new Date();
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + (Number(estimatedMinutes) || 60) * 60 * 1000);

  const eventPayload = {
    summary: title,
    description: `${description ? description + '\n\n' : ''}--- \n📌 Priorix Managed ${itemType.toUpperCase()} [ID: ${priorixId || 'N/A'}]\nSynchronized via Priorix Execution Workspace.`,
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    },
  };

  const res = await fetch(`${CALENDAR_API_BASE}/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  return await handleCalendarResponse(res, 'Updating Google Calendar event');
}

/**
 * Deletes a Google Calendar event
 */
export async function deleteGoogleCalendarEvent(accessToken, eventId) {
  if (!accessToken || !eventId) return false;

  try {
    const res = await fetch(`${CALENDAR_API_BASE}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (res.status === 404) return true; // Already deleted
    return await handleCalendarResponse(res, 'Deleting Google Calendar event');
  } catch (err) {
    console.warn('Could not delete event from Google Calendar:', err);
    return false;
  }
}
