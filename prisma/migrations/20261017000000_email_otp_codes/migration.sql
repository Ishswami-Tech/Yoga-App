-- CreateTable
CREATE TABLE "EmailOtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "ip" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtpCode_email_createdAt_idx" ON "EmailOtpCode"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOtpCode_ip_createdAt_idx" ON "EmailOtpCode"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOtpCode_expiresAt_idx" ON "EmailOtpCode"("expiresAt");
