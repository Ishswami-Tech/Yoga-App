-- Speeds up "latest subscription for a user" and per-day class lookups filtered by status.
CREATE INDEX IF NOT EXISTS "Subscription_userId_createdAt_idx" ON "Subscription"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "YogaClass_date_status_idx" ON "YogaClass"("date", "status");
