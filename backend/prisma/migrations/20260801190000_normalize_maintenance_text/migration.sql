UPDATE "MaintenanceLog"
SET
  "description" = UPPER("description"),
  "location" = CASE WHEN "location" IS NULL THEN NULL ELSE UPPER("location") END;
