UPDATE "MaintenanceLog"
SET "description" = BTRIM(SUBSTRING("description" FROM CHAR_LENGTH("title") + 4))
WHERE "description" LIKE '[' || "title" || '] %';
