// In-app worker watchdog.
//
// The dedicated worker mini-service on port 3004 is the primary driver, but
// in sandboxed environments where background processes get reaped between
// shell sessions, this module gives the platform a self-sufficient fallback:
// it runs the same class-generation + reminder + retry jobs on an interval
// inside the Next.js server process.
//
// The jobs are idempotent (gated by reminderSentAt, WebhookEvent table, and
// the unique (scheduleId, date) constraint on YogaClass), so it is always
// safe for both the external worker AND this watchdog to fire — duplicates
// are a no-op.

import { generateClasses } from "@/lib/services/class-generator";
import { sendReminders, retryFailedMessages } from "@/lib/services/reminders";

let started = false;
let lastRemind = 0;
let lastRetry = 0;
let lastGenerate = 0;

const REMIND_INTERVAL = 60 * 1000; // 1 min
const RETRY_INTERVAL = 5 * 60 * 1000; // 5 min
const GENERATE_INTERVAL = 5 * 60 * 1000; // 5 min

export function startWatchdog() {
  if (started) return;
  started = true;
  // Fire one boot-time run shortly after server start.
  setTimeout(async () => {
    try {
      await generateClasses();
      await sendReminders();
    } catch (e) {
      console.error("[watchdog] boot run failed", e);
    }
  }, 5000);

  setInterval(async () => {
    const now = Date.now();
    try {
      if (now - lastRemind >= REMIND_INTERVAL) {
        lastRemind = now;
        await sendReminders();
      }
    } catch (e) {
      console.error("[watchdog] remind failed", e);
    }
    try {
      if (now - lastRetry >= RETRY_INTERVAL) {
        lastRetry = now;
        await retryFailedMessages();
      }
    } catch (e) {
      console.error("[watchdog] retry failed", e);
    }
    try {
      if (now - lastGenerate >= GENERATE_INTERVAL) {
        lastGenerate = now;
        await generateClasses();
      }
    } catch (e) {
      console.error("[watchdog] generate failed", e);
    }
  }, 30 * 1000); // tick every 30s
}
