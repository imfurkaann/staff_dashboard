ALTER TABLE "OccupancyLog"
ADD COLUMN "employeeName" TEXT,
ADD COLUMN "employeeDepartment" TEXT,
ADD COLUMN "employeeTitle" TEXT,
ADD COLUMN "employeeCompany" TEXT;

UPDATE "OccupancyLog" o
SET
  "employeeName" = CONCAT(e."firstName", ' ', e."lastName"),
  "employeeDepartment" = e."department",
  "employeeTitle" = e."title",
  "employeeCompany" = e."company"
FROM "Employee" e
WHERE e."id" = o."employeeId";

UPDATE "OccupancyLog" SET "employeeName" = 'SİLİNMİŞ PERSONEL' WHERE "employeeName" IS NULL;
ALTER TABLE "OccupancyLog" ALTER COLUMN "employeeName" SET NOT NULL;

ALTER TABLE "OccupancyLog" DROP CONSTRAINT "OccupancyLog_employeeId_fkey";
ALTER TABLE "OccupancyLog" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "OccupancyLog" ADD CONSTRAINT "OccupancyLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
