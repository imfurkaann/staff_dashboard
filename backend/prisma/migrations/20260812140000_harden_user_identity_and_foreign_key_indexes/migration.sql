-- Keep account identifiers canonical at the database boundary. The application
-- already writes normalized values; this migration also repairs legacy casing
-- while refusing ambiguous or invalid legacy data.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY lower(btrim("username"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize User.username: case-insensitive duplicates exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize User.email: case-insensitive duplicates exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE lower(btrim("username")) !~ '^[a-z0-9._-]{3,50}$'
       OR char_length(lower(btrim("email"))) NOT BETWEEN 3 AND 254
       OR lower(btrim("email")) NOT LIKE '%_@_%._%'
  ) THEN
    RAISE EXCEPTION 'Cannot normalize User identity: an invalid username or email exists';
  END IF;
END
$$;

UPDATE "User"
SET
  "username" = lower(btrim("username")),
  "email" = lower(btrim("email")),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "username" <> lower(btrim("username"))
   OR "email" <> lower(btrim("email"));

ALTER TABLE "User"
  ADD CONSTRAINT "User_username_normalized_check"
    CHECK ("username" = lower(btrim("username")) AND "username" ~ '^[a-z0-9._-]{3,50}$'),
  ADD CONSTRAINT "User_email_normalized_check"
    CHECK (
      "email" = lower(btrim("email"))
      AND char_length("email") BETWEEN 3 AND 254
      AND "email" LIKE '%_@_%._%'
    );

-- Cover role-management filters and every previously unindexed foreign key.
CREATE INDEX "User_isActive_role_idx" ON "User"("isActive", "role");
CREATE INDEX "User_isActive_fullName_idx" ON "User"("isActive", "fullName");
CREATE INDEX "StockMovement_roomInventoryId_idx" ON "StockMovement"("roomInventoryId");
CREATE INDEX "StockMovement_createdById_idx" ON "StockMovement"("createdById");
CREATE INDEX "SharedAsset_currentEmployeeId_idx" ON "SharedAsset"("currentEmployeeId");
CREATE INDEX "SharedAsset_currentRoomId_idx" ON "SharedAsset"("currentRoomId");
CREATE INDEX "SharedAssetLog_createdById_idx" ON "SharedAssetLog"("createdById");
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

COMMIT;
