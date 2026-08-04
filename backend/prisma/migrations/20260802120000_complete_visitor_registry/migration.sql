DO $$ BEGIN
  CREATE TYPE "VisitorStatus" AS ENUM ('INSIDE', 'EXITED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Visitor" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "visitorCount" INTEGER NOT NULL DEFAULT 1,
  "identityNo" TEXT,
  "identityNoHash" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "hostEmployeeId" TEXT,
  "hostEmployeeName" TEXT,
  "hostRoomLabel" TEXT,
  "purpose" TEXT,
  "vehiclePlate" TEXT,
  "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitTime" TIMESTAMP(3),
  "status" "VisitorStatus" NOT NULL DEFAULT 'INSIDE',
  "notes" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Visitor" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "identityNo" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "identityNoHash" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "hostRoomLabel" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

DROP INDEX IF EXISTS "Visitor_status_entryTime_idx";
DROP INDEX IF EXISTS "Visitor_isDeleted_entryTime_idx";
CREATE INDEX IF NOT EXISTS "Visitor_hostEmployeeId_entryTime_idx" ON "Visitor"("hostEmployeeId", "entryTime");
CREATE INDEX IF NOT EXISTS "Visitor_status_isDeleted_entryTime_idx" ON "Visitor"("status", "isDeleted", "entryTime");
CREATE INDEX IF NOT EXISTS "Visitor_identityNoHash_idx" ON "Visitor"("identityNoHash");
CREATE INDEX IF NOT EXISTS "Visitor_fullName_idx" ON "Visitor"("fullName");

DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_hostEmployeeId_fkey" FOREIGN KEY ("hostEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Visitor" DROP CONSTRAINT IF EXISTS "Visitor_visitorCount_check";
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_visitorCount_check" CHECK ("visitorCount" BETWEEN 1 AND 20);
ALTER TABLE "Visitor" DROP CONSTRAINT IF EXISTS "Visitor_exit_state_check";
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_exit_state_check" CHECK (("status" = 'INSIDE' AND "exitTime" IS NULL) OR ("status" = 'EXITED' AND "exitTime" IS NOT NULL));
