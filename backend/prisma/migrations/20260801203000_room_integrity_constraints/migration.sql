UPDATE "Bed" SET "isOccupied" = ("currentEmployeeId" IS NOT NULL);

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "employeeId" ORDER BY "checkInDate" DESC, "createdAt" DESC) AS rn
  FROM "OccupancyLog"
  WHERE "employeeId" IS NOT NULL AND "checkOutDate" IS NULL
)
UPDATE "OccupancyLog" o SET "checkOutDate" = o."checkInDate"
FROM ranked r WHERE o."id" = r."id" AND r.rn > 1;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "bedId" ORDER BY "checkInDate" DESC, "createdAt" DESC) AS rn
  FROM "OccupancyLog"
  WHERE "checkOutDate" IS NULL
)
UPDATE "OccupancyLog" o SET "checkOutDate" = o."checkInDate"
FROM ranked r WHERE o."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX "OccupancyLog_one_active_per_employee" ON "OccupancyLog"("employeeId") WHERE "checkOutDate" IS NULL AND "employeeId" IS NOT NULL;
CREATE UNIQUE INDEX "OccupancyLog_one_active_per_bed" ON "OccupancyLog"("bedId") WHERE "checkOutDate" IS NULL;

ALTER TABLE "Room" ADD CONSTRAINT "Room_capacity_range_check" CHECK ("capacity" BETWEEN 1 AND 26);
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_occupancy_consistency_check" CHECK (("isOccupied" AND "currentEmployeeId" IS NOT NULL) OR (NOT "isOccupied" AND "currentEmployeeId" IS NULL));
ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_description_not_blank_check" CHECK (LENGTH(BTRIM("description")) > 0);
