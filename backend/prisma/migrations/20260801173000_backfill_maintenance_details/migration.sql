UPDATE "MaintenanceLog"
SET "category" = "title"
WHERE "category" IS NULL OR BTRIM("category") = '';

UPDATE "MaintenanceLog"
SET
  "location" = NULLIF(BTRIM(SPLIT_PART("description", ' | Konum:', 2)), ''),
  "description" = BTRIM(SPLIT_PART("description", ' | Konum:', 1))
WHERE "description" LIKE '% | Konum:%';
