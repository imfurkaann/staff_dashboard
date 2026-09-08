import ExcelJS from 'exceljs';
import { config } from '../config';

/** Prevent spreadsheet programs from evaluating user-controlled text as a formula. */
export function safeExcelCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export interface ExportOccupancy {
  checkInDate: Date;
  checkOutDate: Date | null;
  employeeName: string;
  employeeDepartment?: string | null;
  employeeTitle?: string | null;
  employeeCompany?: string | null;
  employee?: {
    firstName: string;
    lastName: string;
    department: string;
    title?: string | null;
    company?: string | null;
  } | null;
  createdBy?: { fullName: string; username: string } | null;
  checkedOutBy?: { fullName: string; username: string } | null;
  bed: {
    bedLabel: string;
    room: {
      roomNumber: string;
      block: {
        name: string;
      };
    };
  };
}

export interface ExportRoomInventory {
  itemName: string;
  brand?: string | null;
  serialNo?: string | null;
  quantity: number;
  status: string;
  installedAt: Date;
  room: {
    roomNumber: string;
    status: string;
    block: {
      name: string;
    };
  };
}

const statusLabelsRoomInventory: Record<string, string> = {
  HEALTHY: 'SAĞLAM VE KULLANILABİLİR',
  MAINTENANCE_REQUIRED: 'ARIZALI / BAKIM BEKLEYEN',
  DAMAGED: 'KIRIK / HASARLI',
  LOST: 'KAYIP / ZAYİ',
  IN_SERVICE: 'TAMİRDE / SERVİSTE',
  REPLACEMENT_REQUIRED: 'DEĞİŞİM BEKLEYEN',
  RETIRED: 'İADE / DÜŞÜM YAPILDI',
};

const roomStatusLabels: Record<string, string> = {
  READY: 'HAZIR / TEMİZ',
  NEEDS_CLEANING: 'TEMİZLİK BEKLEYEN',
  OUT_OF_ORDER: 'ARIZALI / KULLANIM DİŞI',
};

/**
 * Generate Corporate Excel Workbook for Room Occupancies (Konaklayanlar Listesi)
 */
export async function createOccupancyWorkbook(rows: ExportOccupancy[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Konaklayanlar Listesi');
  const reportDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date());
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `${config.appName.toLocaleUpperCase('tr-TR')} - LOJMAN İKAMET VE KONAKLAYANLAR LİSTESİ`;
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;
  sheet.mergeCells('A2:H2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;
  const roomMap = new Map<string, { blockName: string; roomNumber: string; entries: ExportOccupancy[] }>();
  rows.forEach((entry) => {
    const blockName = (entry.bed?.room?.block?.name || 'TANIMSIZ BLOK').toLocaleUpperCase('tr-TR');
    const roomNumber = entry.bed?.room?.roomNumber || 'TANIMSIZ ODA';
    const key = `${blockName}__${roomNumber}`;
    if (!roomMap.has(key)) roomMap.set(key, { blockName, roomNumber, entries: [] });
    roomMap.get(key)!.entries.push(entry);
  });

  let currentRow = 4;
  if (!roomMap.size) {
    sheet.getCell('A4').value = 'Seçilen kriterlere uygun konaklama kaydı bulunamadı.';
  }
  roomMap.forEach((group) => {
    const activeCount = group.entries.filter((item) => !item.checkOutDate).length;
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const banner = sheet.getCell(currentRow, 1);
    banner.value = `${group.blockName} - ODA ${group.roomNumber}  (AKTİF KONAKLAYAN: ${activeCount}  |  LİSTELENEN KAYIT: ${group.entries.length})`;
    banner.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    banner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(currentRow).height = 24;
    currentRow++;

    const headers = ['KONAKLAMA DURUMU', 'YATAK', 'AD SOYAD', 'GÖREV / ÜNVAN', 'DEPARTMAN', 'BAĞLI ŞİRKET / TAŞERON', 'GİRİŞ TARİHİ', 'ÇIKIŞ TARİHİ'];
    headers.forEach((header, index) => {
      const cell = sheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    });
    currentRow++;

    group.entries.forEach((entry, index) => {
      const fullName = entry.employee
        ? `${entry.employee.firstName} ${entry.employee.lastName}`
        : entry.employeeName;
      const row = sheet.getRow(currentRow);
      row.values = [
        entry.checkOutDate ? 'ODADAN AYRILDI' : 'HALEN ODADA KALIYOR',
        safeExcelCell(entry.bed?.bedLabel || '-'),
        safeExcelCell(fullName.toLocaleUpperCase('tr-TR')),
        safeExcelCell((entry.employee?.title || entry.employeeTitle || '-').toLocaleUpperCase('tr-TR')),
        safeExcelCell((entry.employee?.department || entry.employeeDepartment || '-').toLocaleUpperCase('tr-TR')),
        safeExcelCell((entry.employee?.company || entry.employeeCompany || '-').toLocaleUpperCase('tr-TR')),
        new Date(entry.checkInDate),
        entry.checkOutDate ? new Date(entry.checkOutDate) : 'DEVAM EDİYOR',
      ];
      row.height = 20;
      for (let col = 1; col <= 8; col++) {
        const cell = row.getCell(col);
        cell.font = { name: 'Arial', size: 9.5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      }
      row.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: entry.checkOutDate ? 'FF64748B' : 'FF15803D' } };
      row.getCell(7).numFmt = 'dd.mm.yyyy hh:mm';
      if (entry.checkOutDate) row.getCell(8).numFmt = 'dd.mm.yyyy hh:mm';
      currentRow++;
    });
    currentRow++;
  });

  [22, 15, 28, 22, 24, 28, 20, 20].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

/**
 * Generate Corporate Excel Workbook for Room Inventories (Oda Demirbaş / Eşya Zimmetleri) - Room Grouped Layout
 */
export async function createRoomInventoryWorkbook(rows: ExportRoomInventory[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Oda Demirbaş Zimmetleri');

  const reportDate = new Intl.DateTimeFormat('tr-TR', { 
    dateStyle: 'short', 
    timeStyle: 'short', 
    timeZone: 'Europe/Istanbul' 
  }).format(new Date());

  // 1. Corporate Main Header
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `${config.appName.toLocaleUpperCase('tr-TR')} - ODA DEMİRBAŞ VE ZİMMET GEÇMİŞİ RAPORU`;
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:F2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  let currentRowNum = 4;

  // Group items by Room (Block Name + Room Number)
  const roomMap = new Map<string, { blockName: string; roomNumber: string; roomStatus: string; items: ExportRoomInventory[] }>();

  rows.forEach((inv) => {
    const blockName = (inv.room?.block?.name || 'TANIMSIZ BLOK').toLocaleUpperCase('tr-TR');
    const roomNumber = inv.room?.roomNumber || 'TANIMSIZ ODA';
    const key = `${blockName}__${roomNumber}`;

    if (!roomMap.has(key)) {
      roomMap.set(key, {
        blockName,
        roomNumber,
        roomStatus: (roomStatusLabels[inv.room?.status] || inv.room?.status || '-').toLocaleUpperCase('tr-TR'),
        items: [],
      });
    }
    roomMap.get(key)!.items.push(inv);
  });

  if (roomMap.size === 0) {
    sheet.getCell('A4').value = 'Seçilen kriterlere uygun oda demirbaş kaydı bulunamadı.';
    sheet.getCell('A4').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  } else {
    roomMap.forEach((roomGroup) => {
      // 1. Corporate Room Section Banner (Merged A to F, No Emojis)
      sheet.mergeCells(`A${currentRowNum}:F${currentRowNum}`);
      const bannerCell = sheet.getCell(`A${currentRowNum}`);
      bannerCell.value = `${roomGroup.blockName} - ODA ${roomGroup.roomNumber}  (ODA DURUMU: ${roomGroup.roomStatus}  |  TOPLAM DEMİRBAŞ: ${roomGroup.items.length} ADET)`;
      bannerCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Corporate Dark Slate Banner
      bannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      sheet.getRow(currentRowNum).height = 24;
      currentRowNum++;

      // 2. Sub-table Column Headers
      const subHeaders = ['DEMİRBAŞ / EŞYA TANIMI', 'MARKA', 'SERİ NUMARASI', 'ADET', 'DEMİRBAŞ DURUMU', 'KURULUM TARİHİ'];
      subHeaders.forEach((headerText, colIdx) => {
        const cell = sheet.getCell(currentRowNum, colIdx + 1);
        cell.value = headerText;
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        cell.alignment = { vertical: 'middle', horizontal: colIdx === 3 ? 'center' : 'left' };
      });
      sheet.getRow(currentRowNum).height = 20;
      currentRowNum++;

      // 3. Room Inventory Items Rows
      roomGroup.items.forEach((inv, itemIdx) => {
        const statusText = statusLabelsRoomInventory[inv.status] || inv.status;
        const isEven = itemIdx % 2 === 0;
        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        const row = sheet.getRow(currentRowNum);
        row.height = 19;

        const c1 = row.getCell(1); c1.value = safeExcelCell(inv.itemName); c1.font = { name: 'Arial', size: 9.5, bold: true };
        const c2 = row.getCell(2); c2.value = safeExcelCell(inv.brand || '-'); c2.font = { name: 'Arial', size: 9.5 };
        const c3 = row.getCell(3); c3.value = safeExcelCell(inv.serialNo || '-'); c3.font = { name: 'Arial', size: 9.5 };
        const c4 = row.getCell(4); c4.value = inv.quantity; c4.font = { name: 'Arial', size: 9.5, bold: true }; c4.alignment = { horizontal: 'center' };
        const c5 = row.getCell(5); c5.value = safeExcelCell(statusText); c5.font = { name: 'Arial', size: 9.5, bold: true };
        const c6 = row.getCell(6); c6.value = new Date(inv.installedAt); c6.numFmt = 'dd.mm.yyyy'; c6.font = { name: 'Arial', size: 9.5 };

        // Apply borders & row background fills
        for (let col = 1; col <= 6; col++) {
          const cell = row.getCell(col);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        }

        // Status text colors (Corporate colors)
        if (inv.status === 'HEALTHY') c4.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
        else if (inv.status === 'MAINTENANCE_REQUIRED' || inv.status === 'REPLACEMENT_REQUIRED') c4.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
        else if (inv.status === 'DAMAGED' || inv.status === 'LOST') c4.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFBE123C' } };

        currentRowNum++;
      });

      // Spacing row between room sections
      currentRowNum++;
    });
  }

  // Column width settings
  sheet.getColumn(1).width = 34; // Demirbaş Adı
  sheet.getColumn(2).width = 20; // Konum
  sheet.getColumn(3).width = 12; // Adet
  sheet.getColumn(4).width = 28; // Demirbaş Durumu
  sheet.getColumn(5).width = 20; // Kurulum Tarihi
  sheet.getColumn(6).width = 38; // Açıklama

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export type RoomDetailExportSection = 'occupancy' | 'inventory' | 'maintenance' | 'cleaning';

const maintenancePriorityLabels: Record<string, string> = { LOW: 'DÜŞÜK', MEDIUM: 'ORTA', HIGH: 'YÜKSEK', URGENT: 'ACİL' };
const maintenanceStatusLabels: Record<string, string> = { OPEN: 'AÇIK', IN_PROGRESS: 'İŞLEMDE', RESOLVED: 'ÇÖZÜLDÜ', CLOSED: 'KAPALI' };
const cleaningStatusLabels: Record<string, string> = { NEEDS_CLEANING: 'TEMİZLİK BEKLİYOR', IN_PROGRESS: 'TEMİZLENİYOR', CLEANED: 'TEMİZLENDİ', OUT_OF_ORDER: 'KULLANIM DIŞI' };

export async function createRoomDetailWorkbook(room: any, sections: RoomDetailExportSection[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.appName;
  workbook.created = new Date();
  const reportDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date());
  const roomLabel = `${String(room.block?.name || '-').toLocaleUpperCase('tr-TR')} - ODA ${room.roomNumber}`;
  const roomStatus = roomStatusLabels[room.status] || room.status || '-';

  const createSheet = (name: string, title: string, headers: string[], widths: number[]) => {
    const sheet = workbook.addWorksheet(name);
    const lastColumn = headers.length;
    sheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `${config.appName.toLocaleUpperCase('tr-TR')} - ${title}`;
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 26;
    sheet.mergeCells(2, 1, 2, lastColumn);
    sheet.getCell(2, 1).value = `Rapor Tarihi: ${reportDate}  |  Hazırlayan: ${generatedBy}`;
    sheet.getCell(2, 1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
    sheet.mergeCells(4, 1, 4, lastColumn);
    const roomCell = sheet.getCell(4, 1);
    roomCell.value = `${roomLabel}  (ODA DURUMU: ${roomStatus}  |  KAPASİTE: ${room.capacity}  |  DOLU: ${(room.beds || []).filter((bed: any) => bed.isOccupied).length})`;
    roomCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    roomCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    roomCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(4).height = 24;
    headers.forEach((header, index) => {
      const cell = sheet.getCell(5, index + 1);
      cell.value = header;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    });
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.views = [{ state: 'frozen', ySplit: 5 }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return sheet;
  };

  const appendRows = (sheet: ExcelJS.Worksheet, values: unknown[][], dateColumns: number[] = []) => {
    if (!values.length) {
      sheet.mergeCells(6, 1, 6, Math.max(1, sheet.columnCount));
      sheet.getCell(6, 1).value = 'Bu bölüm için kayıt bulunamadı.';
      sheet.getCell(6, 1).font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
      return;
    }
    values.forEach((valuesForRow, index) => {
      const row = sheet.getRow(6 + index);
      row.values = valuesForRow.map((value) => value instanceof Date ? value : safeExcelCell(value));
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      dateColumns.forEach((column) => { if (row.getCell(column).value instanceof Date) row.getCell(column).numFmt = 'dd.mm.yyyy hh:mm'; });
    });
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + values.length, column: sheet.columnCount } };
  };

  if (sections.includes('occupancy')) {
    const sheet = createSheet('Konaklama Kayıtları', 'ODA KONAKLAMA KAYITLARI', ['DURUM', 'YATAK', 'AD SOYAD', 'DEPARTMAN', 'GÖREV / ÜNVAN', 'ŞİRKET', 'GİRİŞ TARİHİ', 'ÇIKIŞ TARİHİ'], [18, 14, 28, 24, 22, 25, 20, 20]);
    appendRows(sheet, (room.occupancyHistory || []).map((item: any) => [
      item.checkOutDate ? 'AYRILDI' : 'HALEN ODADA', item.bedLabel || '-',
      `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim().toLocaleUpperCase('tr-TR') || '-',
      item.employee?.department || '-', item.employee?.title || '-', item.employee?.company || '-',
      new Date(item.checkInDate), item.checkOutDate ? new Date(item.checkOutDate) : 'DEVAM EDİYOR',
    ]), [7, 8]);
  }

  if (sections.includes('inventory')) {
    const sheet = createSheet('Oda Zimmetleri', 'ODA ZİMMET VE DEMİRBAŞLARI', ['DEMİRBAŞ / EŞYA', 'MARKA', 'SERİ NUMARASI', 'ADET', 'DURUM', 'KURULUM TARİHİ'], [34, 22, 20, 10, 28, 20]);
    appendRows(sheet, (room.inventories || []).map((item: any) => [item.itemName, item.brand || '-', item.serialNo || '-', item.quantity, statusLabelsRoomInventory[item.status] || item.status, new Date(item.installedAt)]), [6]);
  }

  if (sections.includes('maintenance')) {
    const sheet = createSheet('Arıza Kayıtları', 'ODA ARIZA VE BAKIM KAYITLARI', ['DURUM', 'ÖNCELİK', 'ARIZA / KATEGORİ', 'AÇIKLAMA', 'KONUM', 'BİLDİREN', 'ARIZAYI ÇÖZEN', 'AÇILIŞ', 'KAPANIŞ', 'SONUÇ NOTU'], [14, 12, 24, 38, 20, 22, 24, 20, 20, 32]);
    appendRows(sheet, (room.maintenances || []).map((item: any) => [
      maintenanceStatusLabels[item.status] || item.status, maintenancePriorityLabels[item.priority] || item.priority,
      item.category || item.title || '-', item.description || '-', item.location || '-', item.reportedBy || '-',
      item.assignedTo || '-', new Date(item.createdAt), item.resolvedAt ? new Date(item.resolvedAt) : '-', item.resolutionNote || '-',
    ]), [8, 9]);
  }

  if (sections.includes('cleaning')) {
    const sheet = createSheet('Temizlik Kayıtları', 'ODA TEMİZLİK KAYITLARI', ['DURUM', 'TALEP EDEN', 'TEMİZLEYEN', 'TALEP TARİHİ', 'TAMAMLANMA TARİHİ', 'NOTLAR'], [24, 24, 24, 20, 20, 40]);
    appendRows(sheet, (room.cleaningLogs || []).map((item: any) => [
      cleaningStatusLabels[item.status] || item.status, item.requestedBy || '-', item.cleanedBy || '-',
      new Date(item.requestedAt), item.cleanedAt ? new Date(item.cleanedAt) : '-', item.notes || '-',
    ]), [4, 5]);
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
