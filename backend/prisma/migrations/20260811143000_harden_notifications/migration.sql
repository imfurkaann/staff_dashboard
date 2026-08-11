ALTER TABLE "Notification" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "Notification_requestKey_key" ON "Notification"("requestKey");
