-- Previously shared development credentials must be treated as compromised.
-- Existing sessions remain unable to access operational routes until the password is changed.
UPDATE "User"
SET "mustChangePassword" = true
WHERE "isActive" = true;
