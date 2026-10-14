-- AlterTable
ALTER TABLE "User" ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- Backfill: everyone who already has an account has a complete profile.
UPDATE "User" SET "profileCompletedAt" = "createdAt" WHERE "profileCompletedAt" IS NULL;
