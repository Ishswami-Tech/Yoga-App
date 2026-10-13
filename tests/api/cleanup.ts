import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const r = await db.user.deleteMany({ where: { whatsappNumber: { startsWith: "+91700" } } });
console.log(`cleanup: removed ${r.count} test users`);
await db.$disconnect();
