-- Drop resolution_note_check constraint to allow resolutionNote to be optional/null on RESOLVED/CLOSED maintenance logs
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_resolution_note_check";
