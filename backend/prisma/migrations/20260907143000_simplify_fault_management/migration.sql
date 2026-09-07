-- Arıza yönetimi yalnızca açma ve kapatma adımlarından oluşur.
-- Eski servis alanları veri kaybını önlemek için tutulur ancak kapanışı artık engellemez.
ALTER TABLE "MaintenanceLog"
  DROP CONSTRAINT IF EXISTS "MaintenanceLog_closed_service_return_check";
