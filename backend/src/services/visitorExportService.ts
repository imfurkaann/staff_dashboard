import ExcelJS from 'exceljs';

interface ExportVisitor {
  fullName: string;
  visitorCount: number;
  phone?: string | null;
  company?: string | null;
  hostEmployeeName?: string | null;
  hostRoomLabel?: string | null;
  purpose?: string | null;
  vehiclePlate?: string | null;
  entryTime: Date;
  exitTime?: Date | null;
  status: 'INSIDE' | 'EXITED';
  notes?: string | null;
  isDeleted: boolean;
}

function safeCell(value?: string | null): string {
  const text = value?.trim() || '-';
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function toLocalExcelDate(dateVal: Date | string | null | undefined): Date | string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  // Convert to Europe/Istanbul ISO components for correct Excel representation
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1;
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  // Return a Date object with UTC components matching local Istanbul time so Excel renders exact local time
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export async function createVisitorWorkbook(rows: ExportVisitor[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ziyaretçi Kayıtları');

  const reportDate = new Intl.DateTimeFormat('tr-TR', { 
    dateStyle: 'short', 
    timeStyle: 'short', 
    timeZone: 'Europe/Istanbul' 
  }).format(new Date());

  // 1. Corporate Header Section
  sheet.mergeCells('A1:N1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DOSİNİA RESORT LOJMAN YÖNETİMİ - ZİYARETÇİ GİRİŞ / ÇIKIŞ VE İKAMET KAYITLARI RAPORU';
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:N2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${safeCell(generatedBy)}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  // 2. Table Column Headers
  const columns = [
    'KAYIT DURUMU',
    'ZİYARETÇİ ADI SOYADI',
    'KİŞİ SAYISI',
    'TELEFON',
    'FİRMA / KURUM',
    'ZİYARET EDİLEN PERSONEL',
    'ODA / LOJMAN KONUMU',
    'ZİYARET AMACI',
    'ARAÇ PLAKASI',
    'GİRİŞ TARİHİ',
    'GİRİŞ SAATİ',
    'ÇIKIŞ TARİHİ',
    'ÇIKIŞ SAATİ',
    'NOTLAR',
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
    cell.alignment = { vertical: 'middle', horizontal: index === 2 ? 'center' : 'left' };
  });
  sheet.getRow(headerRowNum).height = 22;

  // 3. Populate Rows
  rows.forEach((v, idx) => {
    const statusLabel = v.isDeleted 
      ? 'ARŞİVLENMİŞ / SİLİNMİŞ' 
      : v.status === 'INSIDE' 
      ? 'HALEN İÇERİDE' 
      : 'ÇIKIŞ YAPTI';

    const fullName = safeCell(v.fullName.toLocaleUpperCase('tr-TR'));
    const company = safeCell((v.company || '-').toLocaleUpperCase('tr-TR'));
    const hostName = safeCell((v.hostEmployeeName || '-').toLocaleUpperCase('tr-TR'));
    const hostRoom = safeCell((v.hostRoomLabel || '-').toLocaleUpperCase('tr-TR'));
    const purpose = safeCell((v.purpose || '-').toLocaleUpperCase('tr-TR'));

    const entryExcelDate = toLocalExcelDate(v.entryTime);
    const exitExcelDate = v.exitTime ? toLocalExcelDate(v.exitTime) : '';

    const rowIndex = headerRowNum + 1 + idx;
    const row = sheet.getRow(rowIndex);
    row.height = 20;

    row.values = [
      statusLabel,
      fullName,
      v.visitorCount,
      safeCell(v.phone),
      company,
      hostName,
      hostRoom,
      purpose,
      safeCell(v.vehiclePlate),
      entryExcelDate,
      entryExcelDate,
      exitExcelDate,
      exitExcelDate,
      safeCell(v.notes),
    ];

    const isEven = idx % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let col = 1; col <= 14; col++) {
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

    // Corporate Status Font Styling
    const statusCell = row.getCell(1);
    if (v.isDeleted) {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFBE123C' } };
    } else if (v.status === 'INSIDE') {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
    } else {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
    }

    // Number formats & Alignments
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = '@';
    row.getCell(9).numFmt = '@';
    row.getCell(10).numFmt = 'dd.mm.yyyy';
    row.getCell(11).numFmt = 'hh:mm';

    if (v.exitTime) {
      row.getCell(12).numFmt = 'dd.mm.yyyy';
      row.getCell(13).numFmt = 'hh:mm';
    }
  });

  // Set corporate column widths
  const widths = [24, 26, 12, 18, 24, 26, 20, 24, 16, 16, 14, 16, 14, 32];
  widths.forEach((w, colIdx) => {
    sheet.getColumn(colIdx + 1).width = w;
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

