// Google Calendar / Google Meet adapter.
//
// With GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET and GOOGLE_CALENDAR_REFRESH_TOKEN set,
// every class date gets its own Google Calendar event created through the Calendar API with
// `conferenceData.createRequest`, so Google provisions a fresh Meet conference per day and returns the
// `hangoutLink`, which is stored as YogaClass.meetUrl. GOOGLE_CALENDAR_ID selects the calendar
// (default "primary"). The refresh token belongs to the account that hosts the classes (the instructor
// or studio Google account); it is read from the environment and never stored in the database.
//
// Without those variables Meet creation throws (the class is marked FAILED with a clear error
// that admins can see); no placeholder link is ever generated.

import { createHash } from "crypto";

export type CreateMeetInput = {
  scheduleId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string;
  name: string;
};

export type CreatedMeet = {
  googleEventId: string;
  meetUrl: string;
  calendarLink: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type Credentials = { clientId: string; clientSecret: string; refreshToken: string; calendarId: string };

function liveCredentials(): Credentials | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || "primary" };
}

/** fetch with a timeout; timeouts/network failures become a clean Error (callers already handle throws). */
async function gFetch(url: string, init: RequestInit, timeoutMs = 10_000): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new Error(timedOut ? "Google request timed out" : "Google network error");
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(c: Credentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await gFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(`Google token refresh failed: ${data?.error_description ?? res.status}`);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

type CalendarEvent = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
  error?: { message?: string };
  items?: CalendarEvent[];
};

function meetUrlOf(ev: CalendarEvent): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  return ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
}

async function createLiveMeet(input: CreateMeetInput, c: Credentials): Promise<CreatedMeet> {
  const token = await accessToken(c);
  const calendar = encodeURIComponent(c.calendarId);
  // requestId makes the call idempotent: retrying the same (schedule, date) reuses the same conference.
  const requestId = createHash("sha256").update(`${input.scheduleId}:${input.date}`).digest("hex").slice(0, 32);
  // Idempotency across retries (e.g. the DB update after creation failed): the event is tagged with a
  // private extended property; if one already exists for this (schedule, date) reuse it, never duplicate.
  const classKey = `${input.scheduleId}:${input.date}`;
  let ev: CalendarEvent | null = null;
  const existingRes = await gFetch(
    `${CALENDAR_API}/calendars/${calendar}/events?privateExtendedProperty=${encodeURIComponent(`vishwayogClassKey=${classKey}`)}&showDeleted=false&maxResults=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (existingRes.ok) {
    const list = (await existingRes.json().catch(() => null)) as CalendarEvent | null;
    const found = list?.items?.find((e) => e.id);
    if (found) ev = found;
  }
  if (!ev) {
    const res = await gFetch(
      `${CALENDAR_API}/calendars/${calendar}/events?conferenceDataVersion=1&sendUpdates=none`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: input.name,
          start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone: input.timezone },
          end: { dateTime: `${input.date}T${input.endTime}:00`, timeZone: input.timezone },
          extendedProperties: { private: { vishwayogClassKey: classKey } },
          conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        }),
      },
      15_000
    );
    ev = (await res.json().catch(() => null)) as CalendarEvent | null;
    if (!res.ok || !ev?.id) {
      throw new Error(`Google Calendar event creation failed: ${ev?.error?.message ?? res.status}`);
    }
  }
  if (!ev.id) throw new Error("Google Calendar event has no id");
  const eventId = ev.id;
  // Conference creation can be asynchronous: poll the event briefly until the Meet link exists.
  for (let attempt = 0; attempt < 5 && !meetUrlOf(ev); attempt++) {
    await new Promise((r) => setTimeout(r, 800));
    const again = await gFetch(`${CALENDAR_API}/calendars/${calendar}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const next = (await again.json().catch(() => null)) as CalendarEvent | null;
    if (again.ok && next) ev = next;
  }
  const meetUrl = meetUrlOf(ev);
  if (!meetUrl) throw new Error("Google did not return a Meet link for the event");
  return { googleEventId: eventId, meetUrl, calendarLink: ev.htmlLink ?? "" };
}

export const googleMeet = {
  get configured(): boolean {
    return liveCredentials() !== null;
  },

  async createMeetForClass(input: CreateMeetInput): Promise<CreatedMeet> {
    const live = liveCredentials();
    if (!live) {
      throw new Error(
        "Google Calendar is not configured (set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET and GOOGLE_CALENDAR_REFRESH_TOKEN)"
      );
    }
    return createLiveMeet(input, live);
  },

  // Deletes the calendar event so the Meet is no longer reachable.
  async cancelMeet(googleEventId: string): Promise<void> {
    if (!googleEventId) return;
    const live = liveCredentials();
    if (!live) return;
    const token = await accessToken(live);
    await gFetch(`${CALENDAR_API}/calendars/${encodeURIComponent(live.calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=none`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
