// Seed script: creates demo instructor, admin, students, a schedule with
// exceptions, and a few active subscriptions so the platform is immediately
// explorable on first launch.
//
// Run with: bun run prisma/seed.ts

import { PrismaClient } from "@prisma/client";

// Placeholder plan id for local demo rows only; real plans are created through the Razorpay API.
const SEED_PLAN_ID = "plan_local_seed";
import { RAZORPAY_PLAN_AMOUNT, RAZORPAY_PLAN_CURRENCY } from "../src/lib/providers/razorpay";

const db = new PrismaClient();

async function upsertSetting(key: string, value: string) {
  await db.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("Refusing to seed demo accounts in production. Use `bun run db:bootstrap` to create the first admin.");
    process.exit(1);
  }
  console.log("Seeding database...");

  // --- Settings ---
  await upsertSetting("razorpayPlanId", SEED_PLAN_ID);
  await upsertSetting("razorpayPlanAmount", String(RAZORPAY_PLAN_AMOUNT));
  await upsertSetting("razorpayPlanCurrency", RAZORPAY_PLAN_CURRENCY);
  await upsertSetting("lookAheadDays", "3");
  await upsertSetting("reminderMinutesBefore", "15");
  await upsertSetting("whatsappTemplate", "yoga_class_reminder_v1");

  // --- Admin ---
  const admin = await db.user.upsert({
    where: { email: "admin@yoga.demo" },
    update: {},
    create: {
      email: "admin@yoga.demo",
      name: "Aarav Admin",
      role: "ADMIN",
      status: "ACTIVE",
      phone: "+919000000001",
      whatsappNumber: "+919000000001",
    },
  });

  // --- Instructor ---
  const instructor = await db.user.upsert({
    where: { email: "instructor@yoga.demo" },
    update: {},
    create: {
      email: "instructor@yoga.demo",
      name: "Meera Instructor",
      role: "INSTRUCTOR",
      status: "ACTIVE",
      phone: "+919000000002",
      whatsappNumber: "+919000000002",
    },
  });

  // --- Students ---
  const students = [
    {
      email: "priya@student.demo",
      name: "Priya Sharma",
      whatsapp: "+919000000010",
      active: true,
    },
    {
      email: "rohit@student.demo",
      name: "Rohit Verma",
      whatsapp: "+919000000011",
      active: true,
    },
    {
      email: "ananya@student.demo",
      name: "Ananya Iyer",
      whatsapp: "+919000000012",
      active: false, // no membership yet
    },
    {
      email: "kabir@student.demo",
      name: "Kabir Singh",
      whatsapp: "+919000000013",
      active: false, // expired
    },
  ];

  for (const s of students) {
    const u = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        role: "STUDENT",
        status: "ACTIVE",
        phone: s.whatsapp,
        whatsappNumber: s.whatsapp,
      },
    });

    if (s.active) {
      // Create an ACTIVE subscription + a captured payment.
      const subId = `sub_seed_${u.id.slice(0, 8)}`;
      const payId = `pay_seed_${u.id.slice(0, 8)}`;
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 86400 * 1000);
      const existing = await db.subscription.findUnique({
        where: { razorpaySubscriptionId: subId },
      });
      if (!existing) {
        await db.subscription.create({
          data: {
            userId: u.id,
            razorpaySubscriptionId: subId,
            razorpayPlanId: SEED_PLAN_ID,
            status: "ACTIVE",
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            startDate: start,
            endDate: end,
            nextBillingDate: end,
          },
        });
        await db.payment.create({
          data: {
            userId: u.id,
            razorpayPaymentId: payId,
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            status: "CAPTURED",
            gatewayFee: 1180,
            paidAt: start,
          },
        });
      }
    }

    if (s.email === "kabir@student.demo") {
      // Expired membership
      const subId = `sub_seed_expired_${u.id.slice(0, 8)}`;
      const start = new Date(Date.now() - 60 * 86400 * 1000);
      const end = new Date(Date.now() - 30 * 86400 * 1000);
      const existing = await db.subscription.findUnique({
        where: { razorpaySubscriptionId: subId },
      });
      if (!existing) {
        await db.subscription.create({
          data: {
            userId: u.id,
            razorpaySubscriptionId: subId,
            razorpayPlanId: SEED_PLAN_ID,
            status: "EXPIRED",
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            startDate: start,
            endDate: end,
          },
        });
        await db.payment.create({
          data: {
            userId: u.id,
            razorpayPaymentId: `pay_seed_old_${u.id.slice(0, 8)}`,
            amount: RAZORPAY_PLAN_AMOUNT,
            currency: RAZORPAY_PLAN_CURRENCY,
            status: "CAPTURED",
            gatewayFee: 1180,
            paidAt: start,
          },
        });
      }
    }
  }

  // --- Schedule ---
  const scheduleName = "Morning Vinyasa Flow";
  const existingSchedule = await db.classSchedule.findFirst({
    where: { name: scheduleName },
  });
  const schedule =
    existingSchedule ??
    (await db.classSchedule.create({
      data: {
        name: scheduleName,
        timezone: "Asia/Kolkata",
        startTime: "07:00",
        endTime: "08:00",
        active: true,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      },
    }));

  // No-class exceptions: the next coming Sunday and the day after tomorrow
  // (deterministic examples). We compute them in IST.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = new Date();
  const in2 = new Date(today.getTime() + 2 * 86400 * 1000);
  const holidayDate = fmt.format(in2);
  const existingHoliday = await db.classException.findUnique({
    where: { scheduleId_date: { scheduleId: schedule.id, date: holidayDate } },
  });
  if (!existingHoliday) {
    await db.classException.create({
      data: {
        scheduleId: schedule.id,
        date: holidayDate,
        type: "NO_CLASS",
        reason: "Instructor unavailable (demo holiday)",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Dev accounts (sign in with a WhatsApp OTP to the number shown):");
  console.log("  admin@yoga.demo      (ADMIN, +919000000001)");
  console.log("  instructor@yoga.demo (INSTRUCTOR, +919000000002)");
  console.log("  priya@student.demo   (STUDENT, active membership)");
  console.log("  ananya@student.demo  (STUDENT, no membership yet)");
  console.log("  kabir@student.demo   (STUDENT, expired membership)");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
