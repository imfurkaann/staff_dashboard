WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "roomId" ORDER BY "requestedAt" DESC, "createdAt" DESC) AS rn
  FROM "RoomCleaningLog"
  WHERE "status" <> 'CLEANED'
)
UPDATE "RoomCleaningLog" c
SET "status" = 'CLEANED', "cleanedAt" = COALESCE(c."cleanedAt", CURRENT_TIMESTAMP), "cleanedBy" = COALESCE(c."cleanedBy", 'Sistem Veri Bütünlüğü')
FROM ranked r WHERE c."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX "RoomCleaningLog_one_active_per_room"
ON "RoomCleaningLog"("roomId") WHERE "status" <> 'CLEANED';
