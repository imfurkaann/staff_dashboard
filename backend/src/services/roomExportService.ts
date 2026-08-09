import ExcelJS from 'exceljs';
import { decryptSensitiveData } from '../utils/crypto';

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
    tcNo?: string | null;
    registrationNo?: string | null;
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

  const reportDate = new Intl.DateTimeFormat('tr-TR', { 
    dateStyle: 'short', 
    timeStyle: 'short', 
    timeZone: 'Europe/Istanbul' 
  }).format(new Date());

  // 1. Corporate Header Section
  sheet.mergeCells('A1:O1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DOSİNİA RESORT LOJMAN YÖNETİMİ - LOJMAN İKAMET VE KONAKLAYANLAR LİSTESİ';
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:O2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  // 2. Table Column Headers
  const columns = [
    'KONAKLAMA DURUMU',
    'BLOK ADI',
    'ODA NO',
    'YATAK KONUMU',
    'ADI',
    'SOYADI',
    'TC / PASAPORT NO',
    'SİCİL NO',
    'GÖREV / ÜNVAN',
    'DEPARTMAN',
    'BAĞLI ŞİRKET / TAŞERON',
    'GİRİŞ TARİHİ',
    'GİRİŞ SAATİ',
    'ÇIKIŞ TARİHİ',
    'ÇIKIŞ SAATİ',
  ];

  const headerRowNum = 4;
  columns.forEach((header, index) => {
    const cell = sheet.getCell(headerRowNum, index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  sheet.getRow(headerRowNum).height = 22;

  // 3. Populate Rows
  rows.forEach((occ, idx) => {
    let decryptedTc = '-';
    if (occ.employee?.tcNo) {
      try {
        decryptedTc = decryptSensitiveData(occ.employee.tcNo) || '-';
      } catch (err) {
        decryptedTc = 'Şifreli / Hatalı';
      }
    }

    const firstName = (occ.employee?.firstName || occ.employeeName.split(' ')[0] || occ.employeeName).toLocaleUpperCase('tr-TR');
    const lastName = (occ.employee?.lastName || occ.employeeName.split(' ').slice(1).join(' ') || '').toLocaleUpperCase('tr-TR');
    const registrationNo = occ.employee?.registrationNo || '-';
    const department = (occ.employee?.department || occ.employeeDepartment || '-').toLocaleUpperCase('tr-TR');
    const title = (occ.employee?.title || occ.employeeTitle || '-').toLocaleUpperCase('tr-TR');
    const company = (occ.employee?.company || occ.employeeCompany || '-').toLocaleUpperCase('tr-TR');

    const statusLabel = occ.checkOutDate ? 'ODADAN AYRILDI' : 'HALEN ODADA KALAN';
    const blockName = (occ.bed?.room?.block?.name || '-').toLocaleUpperCase('tr-TR');
    const roomNumber = occ.bed?.room?.roomNumber || '-';
    const bedLabel = (occ.bed?.bedLabel || '-').toLocaleUpperCase('tr-TR');

    const rowIndex = headerRowNum + 1 + idx;
    const row = sheet.getRow(rowIndex);
    row.height = 20;

    row.values = [
      statusLabel,
      blockName,
      roomNumber,
      bedLabel,
      firstName,
      lastName,
      decryptedTc,
      registrationNo,
      title,
      department,
      company,
      new Date(occ.checkInDate),
      new Date(occ.checkInDate),
      occ.checkOutDate ? new Date(occ.checkOutDate) : '',
      occ.checkOutDate ? new Date(occ.checkOutDate) : '',
    ];

    const isEven = idx % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let col = 1; col <= 15; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Arial', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    // Number formats & alignments
    row.getCell(1).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: occ.checkOutDate ? 'FF64748B' : 'FF1E3A8A' } };
    row.getCell(7).numFmt = '@';
    row.getCell(8).numFmt = '@';
    row.getCell(12).numFmt = 'dd.mm.yyyy';
    row.getCell(13).numFmt = 'hh:mm';

    if (occ.checkOutDate) {
      row.getCell(14).numFmt = 'dd.mm.yyyy';
      row.getCell(15).numFmt = 'hh:mm';
    }
  });

  // Column Widths
  const widths = [22, 16, 12, 16, 18, 18, 20, 16, 24, 22, 24, 16, 14, 16, 14];
  widths.forEach((w, colIdx) => {
    sheet.getColumn(colIdx + 1).width = w;
  });

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
  titleCell.value = 'DOSİNİA RESORT LOJMAN YÖNETİMİ - ODA DEMİRBAŞ VE ZİMMET GEÇMİŞİ RAPORU';
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

        const c1 = row.getCell(1); c1.value = inv.itemName; c1.font = { name: 'Arial', size: 9.5, bold: true };
        const c2 = row.getCell(2); c2.value = inv.brand || '-'; c2.font = { name: 'Arial', size: 9.5 };
        const c3 = row.getCell(3); c3.value = inv.serialNo || '-'; c3.font = { name: 'Arial', size: 9.5 };
        const c4 = row.getCell(4); c4.value = inv.quantity; c4.font = { name: 'Arial', size: 9.5, bold: true }; c4.alignment = { horizontal: 'center' };
        const c5 = row.getCell(5); c5.value = statusText; c5.font = { name: 'Arial', size: 9.5, bold: true };
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
