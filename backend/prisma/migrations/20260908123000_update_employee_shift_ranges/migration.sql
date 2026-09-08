ALTER TABLE "Employee"
ALTER COLUMN "shiftType" SET DEFAULT '08:00 - 16:00';

UPDATE "Employee"
SET "shiftType" = CASE
  WHEN "shiftType" IN ('Gündüz', 'GÜNDÜZ') THEN '08:00 - 16:00'
  WHEN "shiftType" IN ('Gece', 'GECE') THEN '00:00 - 08:00'
  WHEN "shiftType" IN ('Dönüşümlü', 'DÖNÜŞÜMLÜ') THEN 'DÖNÜŞÜMLÜ VARDİYA'
  WHEN "shiftType" IN ('01:00 - 09:00', '01:00-09:00') THEN '13:00 - 21:00'
  ELSE "shiftType"
END
WHERE "shiftType" IN (
  'Gündüz', 'GÜNDÜZ', 'Gece', 'GECE', 'Dönüşümlü', 'DÖNÜŞÜMLÜ',
  '01:00 - 09:00', '01:00-09:00'
);
