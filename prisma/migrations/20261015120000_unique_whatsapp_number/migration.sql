-- Make User.whatsappNumber (the login identifier) unique.
--
-- Run this BEFORE applying; the migration fails loudly (index creation errors
-- with "could not create unique index") if any duplicates exist:
--   SELECT "whatsappNumber", COUNT(*) AS n, array_agg("id" ORDER BY "createdAt") AS ids
--   FROM "User" WHERE "whatsappNumber" IS NOT NULL
--   GROUP BY "whatsappNumber" HAVING COUNT(*) > 1;
-- Resolve duplicates manually (merge or NULL out the extra rows), then migrate.
-- NULLs are allowed many times in a Postgres unique index.

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappNumber_key" ON "User"("whatsappNumber");
