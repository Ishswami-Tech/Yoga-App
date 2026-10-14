import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const r = await db.user.deleteMany({ where: { whatsappNumber: { startsWith: "+91700" } } });
console.log(`cleanup: removed ${r.count} test users`);
const e = await db.user.deleteMany({ where: { email: { endsWith: "@vy-test.example" } } });
console.log(`cleanup: removed ${e.count} email test users`);
await db.emailOtpCode.deleteMany({ where: { email: { endsWith: "@vy-test.example" } } });
await db.$disconnect();
