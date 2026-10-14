// Production bootstrap: creates the first ADMIN user and the initial AppSettings.
// Idempotent: safe to run repeatedly (existing settings are NOT overwritten).
//
//   BOOTSTRAP_ADMIN_NAME="Asha" BOOTSTRAP_ADMIN_EMAIL="asha@example.com" \
//   [BOOTSTRAP_ADMIN_PHONE="+919876543210"] DATABASE_URL=... bun run db:bootstrap
//
// Name and email are required. The phone is OPTIONAL: with it the admin can sign in with a WhatsApp
// code; without it they sign in by email code or Google (the email must match) and link a WhatsApp
// number from the app. No password or demo data is created.
import { PrismaClient } from "@prisma/client";
import { normalizePhone, toCanonical } from "../src/lib/phone";

const db = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  razorpayPlanAmount: "150000", // paise
  lookAheadDays: "3",
  reminderMinutesBefore: "15",
  meetLeadMinutes: "90",
  whatsappTemplate: "yoga_class_reminder_v1",
};

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const phoneRaw = process.env.BOOTSTRAP_ADMIN_PHONE?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!name || !email) {
    throw new Error("Set BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_EMAIL (BOOTSTRAP_ADMIN_PHONE is optional).");
  }
  let whatsappNumber: string | null = null;
  if (phoneRaw) {
    const digits = normalizePhone(phoneRaw);
    if (!digits) throw new Error("BOOTSTRAP_ADMIN_PHONE is not a valid phone number.");
    whatsappNumber = toCanonical(digits);
  }

  const existing =
    (await db.user.findUnique({ where: { email } })) ??
    (whatsappNumber ? await db.user.findFirst({ where: { whatsappNumber } }) : null);

  if (existing) {
    const admin = await db.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        ...(whatsappNumber ? { whatsappNumber, phone: existing.phone ?? whatsappNumber } : {}),
      },
    });
    console.log(`Admin ensured (existing user ${admin.id}).`);
  } else {
    const admin = await db.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
        profileCompletedAt: new Date(),
        ...(whatsappNumber ? { phone: whatsappNumber, whatsappNumber } : {}),
      },
    });
    console.log(`Admin created (${admin.id}).`);
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.appSettings.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("Default settings ensured:", Object.keys(DEFAULT_SETTINGS).join(", "));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
