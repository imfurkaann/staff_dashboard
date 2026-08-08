ALTER TABLE "Notification" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "Notification_isDeleted_createdAt_idx" ON "Notification"("isDeleted", "createdAt");
CREATE INDEX "Notification_deletedById_idx" ON "Notification"("deletedById");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
