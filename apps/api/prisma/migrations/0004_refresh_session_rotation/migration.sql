-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM (
  'ROTATED',
  'LOGOUT',
  'LOGOUT_ALL',
  'PASSWORD_RESET',
  'USER_DISABLED',
  'ROLE_CHANGED',
  'REUSE_DETECTED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "user_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" "SessionRevocationReason",
  "replacedBySessionId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");
CREATE UNIQUE INDEX "user_sessions_replacedBySessionId_key" ON "user_sessions"("replacedBySessionId");
CREATE INDEX "user_sessions_userId_revokedAt_idx" ON "user_sessions"("userId", "revokedAt");
CREATE INDEX "user_sessions_familyId_idx" ON "user_sessions"("familyId");
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_replacedBySessionId_fkey"
  FOREIGN KEY ("replacedBySessionId") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
