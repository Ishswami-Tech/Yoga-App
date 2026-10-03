// Google Calendar / Google Meet adapter.
//
// In production this module uses the Google Calendar API with an OAuth2
// refresh token stored encrypted on the server. Each actual class date gets
// a NEW Calendar event with `conferenceData: { createRequest: { requestId } }`
// so Google provisions a fresh Meet conference for that day. The returned
// `hangoutLink` is the meetUrl stored on YogaClass.
//
// In this sandbox we deterministically synthesise a unique Meet URL per
// (scheduleId, date) pair using a short hash so the join flow can be
// exercised without real Google credentials.

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

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function meetCode(seed: string): string {
  // Generate a Google-Meet-style code: xxx-xxxx-xxx
  const hash = createHash("sha256").update(seed).digest();
  const pick = (offset: number, len: number) =>
    Array.from({ length: len }, (_, i) =>
      ALPHABET[(hash[(offset + i) % hash.length] || 0) % 26]
    ).join("");
  return `${pick(0, 3)}-${pick(4, 4)}-${pick(9, 3)}`;
}

export const googleMeet = {
  isMock: true,

  async createMeetForClass(input: CreateMeetInput): Promise<CreatedMeet> {
    // Stable seed -> same class always yields the same Meet URL so retries
    // are idempotent.
    const seed = `${input.scheduleId}:${input.date}`;
    const code = meetCode(seed);
    const meetUrl = `https://meet.google.com/${code}`;
    const googleEventId = `evt_${createHash("sha256")
      .update(seed)
      .digest("hex")
      .slice(0, 16)}`;
    const calendarLink = `https://calendar.google.com/calendar/event?eid=${googleEventId}`;
    // Simulate occasional provider latency
    await new Promise((r) => setTimeout(r, 50));
    return { googleEventId, meetUrl, calendarLink };
  },

  // In the real adapter, this would delete/expire the calendar event so the
  // Meet is no longer reachable. Here we just acknowledge the call.
  async cancelMeet(googleEventId: string): Promise<void> {
    if (!googleEventId) return;
    // no-op in mock
  },
};
