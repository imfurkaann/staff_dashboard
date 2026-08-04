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

export async function createVisitorWorkbook(rows: ExportVisitor[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dosinia Resort Lojman Yönetimi';
  workbook.lastModifiedBy = generatedBy;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'Ziyaretçi kayıt dökümü';
  workbook.title = 'Ziyaretçi Kayıtları';
  workbook.company = 'Dosinia Resort';

  const sheet = workbook.addWorksheet('Ziyaretçi Kayıtları', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: '&LPersonel Lojman Yönetim Sistemi&C&F&R&P / &N' },
  });

  sheet.mergeCells('A1:L1');
  sheet.getCell('A1').value = 'DOSINIA RESORT LOJMAN YÖNETİMİ';
  sheet.getCell('A1').font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:L2');
  sheet.getCell('A2').value = 'ZİYARETÇİ GİRİŞ / ÇIKIŞ KAYIT DÖKÜMÜ';
  sheet.getCell('A2').font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 22;
  sheet.mergeCells('A3:F3');
  sheet.getCell('A3').value = `Toplam kayıt: ${rows.length}`;
  sheet.mergeCells('G3:L3');
  sheet.getCell('G3').value = `Oluşturma: ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date())}`;
  sheet.getCell('G3').alignment = { horizontal: 'right' };
  for (let column = 1; column <= 12; column += 1) sheet.getCell(3, column).font = { name: 'Aptos', size: 9, color: { argb: 'FF475569' } };
  sheet.getRow(4).height = 8;

  const columns = [
    ['Kayıt Durumu', 15], ['Ziyaretçi Adı Soyadı', 25], ['Kişi', 8], ['Telefon', 17],
    ['Firma / Kurum', 22], ['Ziyaret Edilen Personel', 26], ['Oda', 22], ['Ziyaret Amacı', 24], ['Araç Plakası', 15],
    ['Giriş Tarihi', 19], ['Çıkış Tarihi', 19], ['Notlar', 32],
  ] as const;
  columns.forEach(([header, width], index) => { sheet.getColumn(index + 1).width = width; sheet.getCell(5, index + 1).value = header; });
  sheet.getColumn(4).numFmt = '@';
  sheet.getColumn(9).numFmt = '@';
  sheet.getColumn(10).numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn(11).numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getRow(5).eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
  sheet.getRow(5).height = 28;

  rows.forEach((visitor) => {
    const row = sheet.addRow([
      visitor.isDeleted ? 'SİLİNMİŞ' : visitor.status === 'INSIDE' ? 'İÇERİDE' : 'ÇIKIŞ YAPTI', safeCell(visitor.fullName), visitor.visitorCount,
      safeCell(visitor.phone), safeCell(visitor.company), safeCell(visitor.hostEmployeeName), safeCell(visitor.hostRoomLabel),
      safeCell(visitor.purpose), safeCell(visitor.vehiclePlate), new Date(visitor.entryTime), visitor.exitTime ? new Date(visitor.exitTime) : null, safeCell(visitor.notes),
    ]);
    row.font = { name: 'Aptos', size: 9, color: { argb: 'FF1E293B' } };
    row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    row.getCell(3).alignment = { vertical: 'top', horizontal: 'center' };
    row.getCell(10).numFmt = 'dd.mm.yyyy hh:mm';
    row.getCell(11).numFmt = 'dd.mm.yyyy hh:mm';
    row.eachCell((cell) => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }; });
    const statusCell = row.getCell(1);
    statusCell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: visitor.isDeleted ? 'FF9F1239' : visitor.status === 'INSIDE' ? 'FF166534' : 'FF475569' } };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: visitor.isDeleted ? 'FFFFE4E6' : visitor.status === 'INSIDE' ? 'FFDCFCE7' : 'FFF1F5F9' } };
  });
  if (rows.length > 0) sheet.autoFilter = { from: 'A5', to: `L${rows.length + 5}` };
  sheet.properties.defaultRowHeight = 30;
  sheet.pageSetup.printTitlesRow = '1:5';
  sheet.pageSetup.printArea = `A1:L${Math.max(5, rows.length + 5)}`;

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
