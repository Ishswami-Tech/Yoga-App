// Production bootstrap: creates the first ADMIN user and the initial AppSettings.
// Idempotent: safe to run repeatedly (existing settings are NOT overwritten).
//
//   BOOTSTRAP_ADMIN_NAME="Asha" BOOTSTRAP_ADMIN_PHONE="+919876543210" \
//   BOOTSTRAP_ADMIN_EMAIL="asha@example.com" DATABASE_URL=... bun run db:bootstrap
//
// The admin signs in with WhatsApp OTP on BOOTSTRAP_ADMIN_PHONE. No password
// or demo data is created.
import { PrismaClient } from "@prisma/client";
import { normalizePhone, toCanonical } from "../src/lib/phone";

const db = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  razorpayPlanAmount: "150000", // paise
  lookAheadDays: "3",
  reminderMinutesBefore: "15",
  whatsappTemplate: "yoga_class_reminder_v1",
};

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const phoneRaw = process.env.BOOTSTRAP_ADMIN_PHONE?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!name || !phoneRaw || !email) {
    throw new Error("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PHONE and BOOTSTRAP_ADMIN_EMAIL.");
  }
  const digits = normalizePhone(phoneRaw);
  if (!digits) throw new Error("BOOTSTRAP_ADMIN_PHONE is not a valid phone number.");
  const whatsappNumber = toCanonical(digits);

  const existing =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.findFirst({ where: { whatsappNumber } }));

  if (existing) {
    const admin = await db.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", status: "ACTIVE", whatsappNumber, phone: existing.phone ?? whatsappNumber },
    });
    console.log(`Admin ensured (existing user ${admin.id}).`);
  } else {
    const admin = await db.user.create({
      data: { email, name, role: "ADMIN", status: "ACTIVE", phone: whatsappNumber, whatsappNumber, emailVerified: true, profileCompletedAt: new Date() },
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
