// Reminder / WhatsApp service.
//
// Implements the REMINDER algorithm from the spec:
//   1. Find YogaClass rows whose reminderAt <= now and reminderSentAt is null
//      and status = READY (must have a Meet URL).
//   2. Resolve active memberships for those classes.
//   3. Send one WhatsApp reminder per eligible student via the whatsapp
//      adapter, persisting provider message ID + status.
//   4. Mark reminderSentAt so duplicate worker runs never resend.
//
// Idempotency:
//  - reminderSentAt gate on YogaClass
//  - unique WhatsAppMessage per (userId, classId, templateName) is enforced
//    in code by checking existing records before sending
//  - provider failures are retried by the retry job

import { db } from "@/lib/db";
import { whatsapp, WHATSAPP_TEMPLATE_NAME } from "@/lib/providers/whatsapp";
import { activeMembersWhere } from "@/lib/services/membership";
import { istDateString, istDateTime, prettyTime } from "./scheduling";
import { NON_RETRYABLE_ERROR_CODES, decideRetry } from "./retry-policy";

// Soft time budget per job run (the worker route has maxDuration = 60s).
const JOB_BUDGET_MS = 45_000;

export type ReminderResult = {
  classesProcessed: number;
  messagesSent: number;
  messagesFailed: number;
  details: {
    classId: string;
    date: string;
    sent: number;
    failed: number;
    skipped: number;
  }[];
};

export async function sendReminders(opts?: {
  nowOverride?: Date;
}): Promise<ReminderResult> {
  const now = opts?.nowOverride ?? new Date();
  const deadline = Date.now() + JOB_BUDGET_MS;
  const result: ReminderResult = {
    classesProcessed: 0,
    messagesSent: 0,
    messagesFailed: 0,
    details: [],
  };

  const due = await db.yogaClass.findMany({
    where: {
      reminderAt: { lte: now },
      reminderSentAt: null,
      status: "READY",
      meetUrl: { not: null },
    },
    include: { schedule: true },
    orderBy: { reminderAt: "asc" },
    take: 20,
  });

  let activeMembers: Awaited<ReturnType<typeof db.user.findMany>> | null = null;

  for (const cls of due) {
    // Stay inside the serverless time limit; unfinished classes stay due and
    // are picked up by the next tick (reminderSentAt is only set after a pass).
    if (Date.now() > deadline) break;
    // Never send "starts soon" for a class that is already over; mark it handled so it does not
    // occupy a slot in the 20-class window forever.
    if (istDateTime(cls.date, cls.endTime).getTime() <= now.getTime()) {
      await db.yogaClass.update({ where: { id: cls.id }, data: { reminderSentAt: new Date() } });
      continue;
    }
    const detail = {
      classId: cls.id,
      date: cls.date,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    result.classesProcessed++;

    // Active members: entitled per membership rules (paid order or live subscription).
    activeMembers ??= await db.user.findMany({ where: activeMembersWhere(now) });

    for (const member of activeMembers) {
      if (Date.now() > deadline) break;
      if (!member.whatsappNumber) {
        detail.skipped++;
        continue;
      }
      // Idempotency: skip if any row exists for this (user, class, template): sent, in flight
      // (QUEUED) or failed (the retry job owns failed rows).
      const existing = await db.whatsAppMessage.findFirst({
        where: {
          userId: member.id,
          classId: cls.id,
          templateName: WHATSAPP_TEMPLATE_NAME,
        },
        select: { id: true },
      });
      if (existing) {
        detail.skipped++;
        continue;
      }

      const send = await whatsapp.sendClassReminder({
        toWhatsapp: member.whatsappNumber,
        templateName: WHATSAPP_TEMPLATE_NAME,
        studentName: member.name,
        classTime: prettyTime(cls.startTime),
        meetUrl: cls.meetUrl!,
        className: cls.schedule?.name ?? "Yoga Class",
      });

      await db.whatsAppMessage.create({
        data: {
          userId: member.id,
          classId: cls.id,
          templateName: WHATSAPP_TEMPLATE_NAME,
          providerMessageId: send.providerMessageId || null,
          status: send.status,
          sentAt: send.status !== "FAILED" ? new Date() : null,
          errorCode: send.errorCode ?? null,
          errorMessage: send.errorMessage ?? null,
        },
      });

      if (send.status === "FAILED") {
        result.messagesFailed++;
        detail.failed++;
      } else {
        result.messagesSent++;
        detail.sent++;
      }
    }

    // Out of time mid-class: leave reminderSentAt null. Members already sent
    // are skipped next tick via the per-member idempotency check above.
    if (Date.now() > deadline) {
      result.details.push(detail);
      break;
    }

    // Only mark reminderSentAt if we attempted every eligible member; failed
    // sends are retried by the retry job, but the class-level gate prevents
    // re-scanning on the next worker tick.
    await db.yogaClass.update({
      where: { id: cls.id },
      data: { reminderSentAt: new Date() },
    });

    result.details.push(detail);
  }

  return result;
}

// Retry job: resend failed WhatsApp messages (oldest first) for upcoming classes. Permanent
// errors are skipped, attempts per (user, class, template) are capped, and each failed retry
// is recorded as a new FAILED row while the superseded row becomes RETRIED, so the number of
// FAILED + RETRIED rows is the attempt count.
export async function retryFailedMessages(): Promise<{
  retried: number;
  recovered: number;
  stillFailing: number;
}> {
  const out = { retried: 0, recovered: 0, stillFailing: 0 };

  const now = new Date();
  const deadline = Date.now() + JOB_BUDGET_MS;
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const failed = await db.whatsAppMessage.findMany({
    where: {
      status: "FAILED",
      classId: { not: null },
      createdAt: { gte: cutoff },
      OR: [{ errorCode: null }, { errorCode: { notIn: [...NON_RETRYABLE_ERROR_CODES] } }],
      yogaClass: { date: { gte: istDateString(now) } },
    },
    include: { yogaClass: { include: { schedule: true } }, user: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const msg of failed) {
    if (Date.now() > deadline) break;
    const cls = msg.yogaClass;
    if (!cls?.meetUrl || !msg.user?.whatsappNumber || msg.user.status !== "ACTIVE") continue;

    const attempts = await db.whatsAppMessage.count({
      where: {
        userId: msg.userId,
        classId: msg.classId,
        templateName: msg.templateName,
        status: { in: ["FAILED", "RETRIED"] },
      },
    });
    const decision = decideRetry({
      errorCode: msg.errorCode,
      attempts,
      classDate: cls.date,
      classEndTime: cls.endTime,
      now,
    });
    if (!decision.retry) continue;

    out.retried++;
    const send = await whatsapp.sendClassReminder({
      toWhatsapp: msg.user.whatsappNumber,
      templateName: msg.templateName,
      studentName: msg.user.name,
      classTime: prettyTime(cls.startTime),
      meetUrl: cls.meetUrl,
      className: cls.schedule?.name ?? "Yoga Class",
    });
    if (send.status === "FAILED") {
      out.stillFailing++;
      await db.$transaction([
        db.whatsAppMessage.create({
          data: {
            userId: msg.userId,
            classId: msg.classId,
            templateName: msg.templateName,
            status: "FAILED",
            errorCode: send.errorCode ?? null,
            errorMessage: send.errorMessage ?? null,
          },
        }),
        db.whatsAppMessage.update({ where: { id: msg.id }, data: { status: "RETRIED" } }),
      ]);
      continue;
    }
    await db.whatsAppMessage.update({
      where: { id: msg.id },
      data: {
        status: send.status,
        providerMessageId: send.providerMessageId || null,
        sentAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    out.recovered++;
  }

  return out;
}
