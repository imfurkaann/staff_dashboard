ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOUSING_STAFF';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TECHNICAL_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TECHNICIAN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOUSEKEEPING';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WAREHOUSE_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR_MANAGER';

CREATE TABLE "UserAuditLog" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "beforeRole" "Role",
  "afterRole" "Role",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAuditLog_targetUserId_createdAt_idx" ON "UserAuditLog"("targetUserId", "createdAt");
CREATE INDEX "UserAuditLog_actorUserId_createdAt_idx" ON "UserAuditLog"("actorUserId", "createdAt");
CREATE INDEX "UserAuditLog_action_createdAt_idx" ON "UserAuditLog"("action", "createdAt");

ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
