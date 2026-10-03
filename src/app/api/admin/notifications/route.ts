import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { run } from "@/lib/api";
import { istDateString } from "@/lib/services/scheduling";

export const runtime = "nodejs";

// Admin notifications center.
//
// Returns a prioritised list of items that need admin attention:
//   - PENDING_MEET classes (Google Meet creation failed or hasn't run yet)
//   - FAILED WhatsApp messages (within 24h)
//   - FAILED/halted subscriptions
//   - HALTED subscriptions
//   - Pending payments (status PENDING > 1h)
//   - Classes today without a Meet link
//   - Students with no WhatsApp number (can't send reminders)
//
// Each notification has: type, severity, title, description, link (admin view),
// and a count. The admin dashboard shows a bell icon with the unread count
// and a dropdown listing these items.
export async function GET() {
  return run(async () => {
    await requireRole("ADMIN");

    const todayStr = istDateString(new Date());
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);

    const [
      pendingMeets,
      failedWhatsapp,
      haltedSubs,
      pendingPayments,
      classesTodayNoMeet,
      studentsNoWhatsapp,
    ] = await Promise.all([
      db.yogaClass.count({
        where: { status: "PENDING_MEET", date: { gte: todayStr } },
      }),
      db.whatsAppMessage.count({
        where: { status: "FAILED", createdAt: { gte: yesterday } },
      }),
      db.subscription.count({ where: { status: "HALTED" } }),
      db.payment.count({
        where: { status: "PENDING", createdAt: { gte: yesterday } },
      }),
      db.yogaClass.count({
        where: { date: todayStr, meetUrl: null, status: { not: "CANCELLED" } },
      }),
      db.user.count({
        where: {
          role: "STUDENT",
          status: "ACTIVE",
          subscriptions: { some: { status: "ACTIVE" } },
          OR: [{ whatsappNumber: null }, { whatsappNumber: "" }],
        },
      }),
    ]);

    type Notification = {
      type: string;
      severity: "critical" | "warning" | "info";
      title: string;
      description: string;
      link: string;
      count: number;
    };

    const items: Notification[] = [];

    if (pendingMeets > 0) {
      items.push({
        type: "pending_meets",
        severity: "warning",
        title: "Classes with no Google Meet",
        description: `${pendingMeets} upcoming class${pendingMeets === 1 ? "" : "es"} still waiting for a Meet link. Run the class generator.`,
        link: "admin-classes",
        count: pendingMeets,
      });
    }
    if (classesTodayNoMeet > 0) {
      items.push({
        type: "today_no_meet",
        severity: "critical",
        title: "Today's classes have no Meet link",
        description: `${classesTodayNoMeet} class${classesTodayNoMeet === 1 ? "" : "es"} today without a Meet link. Students can't join!`,
        link: "admin-classes",
        count: classesTodayNoMeet,
      });
    }
    if (failedWhatsapp > 0) {
      items.push({
        type: "failed_whatsapp",
        severity: "warning",
        title: "WhatsApp reminders failed",
        description: `${failedWhatsapp} message${failedWhatsapp === 1 ? "" : "s"} failed in the last 24h. Retry them.`,
        link: "admin-whatsapp",
        count: failedWhatsapp,
      });
    }
    if (haltedSubs > 0) {
      items.push({
        type: "halted_subs",
        severity: "critical",
        title: "Halted subscriptions",
        description: `${haltedSubs} subscription${haltedSubs === 1 ? "" : "s"} halted — payment retries exhausted.`,
        link: "admin-subscriptions",
        count: haltedSubs,
      });
    }
    if (pendingPayments > 0) {
      items.push({
        type: "pending_payments",
        severity: "info",
        title: "Pending payments",
        description: `${pendingPayments} payment${pendingPayments === 1 ? "" : "s"} pending verification.`,
        link: "admin-payments",
        count: pendingPayments,
      });
    }
    if (studentsNoWhatsapp > 0) {
      items.push({
        type: "students_no_whatsapp",
        severity: "info",
        title: "Active members without WhatsApp",
        description: `${studentsNoWhatsapp} active member${studentsNoWhatsapp === 1 ? "" : "s"} have no WhatsApp number — can't send reminders.`,
        link: "admin-users",
        count: studentsNoWhatsapp,
      });
    }

    const critical = items.filter((i) => i.severity === "critical").length;
    const warning = items.filter((i) => i.severity === "warning").length;
    const total = items.reduce((a, i) => a + i.count, 0);

    return NextResponse.json({
      items,
      summary: {
        total,
        critical,
        warning,
        info: items.length - critical - warning,
      },
    });
  });
}
