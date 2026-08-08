-- This migration closes the historical gap between schema.prisma and the
-- migration chain. It is intentionally additive/idempotent so databases that
-- were previously synchronized with `prisma db push` can also deploy it.

DO $$ BEGIN CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NotificationTargetType" AS ENUM ('ALL', 'SPECIFIC_USERS', 'BLOCK', 'DEPARTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "checkedOutById" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "OccupancyLog" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "OccupancyLog" ADD COLUMN IF NOT EXISTS "checkedOutById" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "returnedById" TEXT;
ALTER TABLE "DisciplinaryNote" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE TABLE IF NOT EXISTS "RoomCleaningLog" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEEDS_CLEANING',
  "requestedBy" TEXT NOT NULL DEFAULT 'Lojman Yönetimi',
  "cleanedBy" TEXT,
  "notes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleanedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomCleaningLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "targetType" "NotificationTargetType" NOT NULL DEFAULT 'ALL',
  "targetValue" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationRecipient" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX IF NOT EXISTS "Employee_status_isDeleted_idx" ON "Employee"("status", "isDeleted");
CREATE INDEX IF NOT EXISTS "Employee_createdById_idx" ON "Employee"("createdById");
CREATE INDEX IF NOT EXISTS "Employee_checkedOutById_idx" ON "Employee"("checkedOutById");
CREATE INDEX IF NOT EXISTS "Employee_deletedById_idx" ON "Employee"("deletedById");
CREATE INDEX IF NOT EXISTS "OccupancyLog_createdById_idx" ON "OccupancyLog"("createdById");
CREATE INDEX IF NOT EXISTS "OccupancyLog_checkedOutById_idx" ON "OccupancyLog"("checkedOutById");
CREATE INDEX IF NOT EXISTS "InventoryItem_createdById_idx" ON "InventoryItem"("createdById");
CREATE INDEX IF NOT EXISTS "InventoryItem_returnedById_idx" ON "InventoryItem"("returnedById");
CREATE INDEX IF NOT EXISTS "DisciplinaryNote_createdById_idx" ON "DisciplinaryNote"("createdById");
CREATE INDEX IF NOT EXISTS "RoomCleaningLog_roomId_status_idx" ON "RoomCleaningLog"("roomId", "status");
CREATE INDEX IF NOT EXISTS "RoomCleaningLog_roomId_requestedAt_idx" ON "RoomCleaningLog"("roomId", "requestedAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "Notification_createdById_idx" ON "Notification"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");
CREATE INDEX IF NOT EXISTS "NotificationRecipient_userId_isRead_idx" ON "NotificationRecipient"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "NotificationRecipient_notificationId_idx" ON "NotificationRecipient"("notificationId");

DO $$ BEGIN ALTER TABLE "Employee" ADD CONSTRAINT "Employee_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Employee" ADD CONSTRAINT "Employee_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OccupancyLog" ADD CONSTRAINT "OccupancyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OccupancyLog" ADD CONSTRAINT "OccupancyLog_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "DisciplinaryNote" ADD CONSTRAINT "DisciplinaryNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Canonicalize safe categorical values before enforcing database checks.
UPDATE "Employee" SET "gender" = CASE
  WHEN LOWER(BTRIM("gender")) IN ('male', 'erkek') THEN 'Male'
  WHEN LOWER(BTRIM("gender")) IN ('female', 'kadın', 'kadin') THEN 'Female'
  ELSE BTRIM("gender") END;
UPDATE "Block" SET "genderPolicy" = CASE
  WHEN LOWER(BTRIM("genderPolicy")) IN ('male', 'erkek') THEN 'Male'
  WHEN LOWER(BTRIM("genderPolicy")) IN ('female', 'kadın', 'kadin') THEN 'Female'
  WHEN LOWER(BTRIM("genderPolicy")) IN ('mixed', 'karma') THEN 'Mixed'
  ELSE BTRIM("genderPolicy") END;

DO $$ BEGIN ALTER TABLE "Employee" ADD CONSTRAINT "Employee_gender_check" CHECK ("gender" IN ('Male', 'Female'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Block" ADD CONSTRAINT "Block_gender_policy_check" CHECK ("genderPolicy" IN ('Male', 'Female', 'Mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_status_check" CHECK ("status" IN ('NEEDS_CLEANING', 'IN_PROGRESS', 'CLEANED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RoomCleaningLog" ADD CONSTRAINT "RoomCleaningLog_cleaned_state_check" CHECK (("status" = 'CLEANED' AND "cleanedAt" IS NOT NULL) OR ("status" <> 'CLEANED' AND "cleanedAt" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OccupancyLog" ADD CONSTRAINT "OccupancyLog_date_order_check" CHECK ("checkOutDate" IS NULL OR "checkOutDate" >= "checkInDate");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_category_check" CHECK ("category" IN ('LOJMAN_ZİMMETİ', 'ŞAHSİ_EŞYA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_return_state_check" CHECK (("returnedDate" IS NULL AND "status" IN ('TESLİM_EDİLDİ', 'ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK')) OR ("returnedDate" IS NOT NULL AND "status" IN ('TAM_İADE_ALINDI', 'TESLİM_ALINAMADI')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
