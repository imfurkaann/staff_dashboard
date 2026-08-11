ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "DisciplinaryNote" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DisciplinaryNote" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "DisciplinaryNote" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "DisciplinaryNote" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DisciplinaryNote" ADD CONSTRAINT "DisciplinaryNote_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_gender_check";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_gender_check" CHECK ("gender" IN ('Male','Female'));
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_soft_delete_check";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_soft_delete_check" CHECK (("isDeleted" = false AND "deletedAt" IS NULL) OR ("isDeleted" = true AND "deletedAt" IS NOT NULL));

ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_category_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_category_check" CHECK ("category" IN ('LOJMAN_ZİMMETİ','ŞAHSİ_EŞYA'));
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_status_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_status_check" CHECK ("status" IN ('TESLİM_EDİLDİ','TAM_İADE_ALINDI','TESLİM_ALINAMADI','ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK'));
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_return_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_return_check" CHECK (
  ("returnedDate" IS NULL AND "status" IN ('TESLİM_EDİLDİ','ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK'))
  OR ("returnedDate" IS NOT NULL AND "status" IN ('TAM_İADE_ALINDI','TESLİM_ALINAMADI'))
);
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_soft_delete_check";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_soft_delete_check" CHECK (("isDeleted" = false AND "deletedAt" IS NULL) OR ("isDeleted" = true AND "deletedAt" IS NOT NULL));

ALTER TABLE "DisciplinaryNote" DROP CONSTRAINT IF EXISTS "DisciplinaryNote_status_check";
ALTER TABLE "DisciplinaryNote" ADD CONSTRAINT "DisciplinaryNote_status_check" CHECK ("status" IN ('GÖRÜŞÜLDÜ','ÇÖZÜLDÜ','UYARILDI'));
ALTER TABLE "DisciplinaryNote" DROP CONSTRAINT IF EXISTS "DisciplinaryNote_soft_delete_check";
ALTER TABLE "DisciplinaryNote" ADD CONSTRAINT "DisciplinaryNote_soft_delete_check" CHECK (("isDeleted" = false AND "deletedAt" IS NULL) OR ("isDeleted" = true AND "deletedAt" IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_active_serial_key" ON "InventoryItem"("serialNo")
  WHERE "serialNo" IS NOT NULL AND "returnedDate" IS NULL AND "isDeleted" = false;
CREATE INDEX IF NOT EXISTS "InventoryItem_employeeId_isDeleted_returnedDate_idx" ON "InventoryItem"("employeeId","isDeleted","returnedDate");
CREATE INDEX IF NOT EXISTS "InventoryItem_deletedById_idx" ON "InventoryItem"("deletedById");
CREATE INDEX IF NOT EXISTS "DisciplinaryNote_employeeId_isDeleted_createdAt_idx" ON "DisciplinaryNote"("employeeId","isDeleted","createdAt");
CREATE INDEX IF NOT EXISTS "DisciplinaryNote_deletedById_idx" ON "DisciplinaryNote"("deletedById");
