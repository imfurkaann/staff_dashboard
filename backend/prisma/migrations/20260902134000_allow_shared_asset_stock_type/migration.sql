-- Ortak eşya stok kartları bağımsız bir tür olarak tutulur. Eski kural bu
-- değeri kabul etmediği için ortak eşya kartı/kaydı oluşturma işlemi 500'e düşüyordu.
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_type_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_type_check"
  CHECK ("itemType" IN ('DEMİRBAŞ', 'SARF_MALZEME', 'ORTAK_EŞYA', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM'));
