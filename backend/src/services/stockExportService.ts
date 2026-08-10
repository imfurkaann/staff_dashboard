import ExcelJS from 'exceljs';

const movementLabels: Record<string, string> = {
  OPENING: 'AÇILIŞ', RECEIPT: 'DEPO GİRİŞİ', ADJUSTMENT: 'FİZİKSEL SAYIM',
  ROOM_ASSIGNMENT: 'ODAYA ZİMMET', ROOM_RETURN: 'ODADAN İADE', ROOM_TRANSFER: 'ODA TRANSFERİ',
  STATUS_CHANGE: 'DURUM DEĞİŞİMİ', REPLACEMENT: 'ÜRÜN DEĞİŞİMİ', RETIREMENT: 'HURDA / KAYIP DÜŞÜMÜ',
  PERSONNEL_ASSIGNMENT: 'PERSONELE ZİMMET', PERSONNEL_RETURN: 'PERSONELDEN İADE',
};

const styleHeader = (cell: ExcelJS.Cell) => {
  cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
};

function setupSheet(sheet: ExcelJS.Worksheet, title: string, headers: string[], widths: number[], generatedBy: string) {
  const end = sheet.getColumn(headers.length).letter;
  sheet.mergeCells(`A1:${end}1`);
  sheet.getCell('A1').value = title;
  styleHeader(sheet.getCell('A1'));
  sheet.getRow(1).height = 26;
  sheet.mergeCells(`A2:${end}2`);
  sheet.getCell('A2').value = `Oluşturulma: ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date())}  |  Yetkili: ${generatedBy}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  headers.forEach((value, index) => { const cell = sheet.getCell(4, index + 1); cell.value = value; styleHeader(cell); });
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.autoFilter = `A4:${end}4`;
}

function styleRows(sheet: ExcelJS.Worksheet, fromRow = 5) {
  for (let rowIndex = fromRow; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    row.height = 19;
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 ? 'FFFFFFFF' : 'FFF8FAFC' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });
  }
}

export async function createStockWorkbook(items: any[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dosinia Resort Lojman Yönetimi';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Stok Özeti', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(summary, 'DOSİNİA RESORT LOJMAN YÖNETİMİ - DEPO STOK VE ZİMMET RAPORU',
    ['STOK KODU', 'MALZEME', 'KATEGORİ', 'BİRİM', 'TOPLAM', 'ODALARDA', 'PERSONELDE', 'MÜSAİT', 'KRİTİK SEVİYE', 'DURUM', 'SON SAYIM', 'SON HAREKET'],
    [16, 28, 24, 12, 12, 12, 12, 12, 16, 14, 20, 20], generatedBy);
  items.forEach((item) => {
    const available = item.totalStock - item.usedStock - item.usedInRooms;
    summary.addRow([item.itemCode || '-', item.itemName, item.category, item.unit, item.totalStock, item.usedInRooms, item.usedStock,
      available, item.minimumStock, !item.isActive ? 'PASİF' : available <= item.minimumStock ? 'KRİTİK' : 'AKTİF',
      item.lastCountedAt || '', item.movements[0]?.createdAt || '']);
  });
  summary.getColumn(11).numFmt = 'dd.mm.yyyy hh:mm'; summary.getColumn(12).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(summary);

  const activeRooms = workbook.addWorksheet('Aktif Oda Zimmetleri', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(activeRooms, 'AKTİF ODA ZİMMETLERİ',
    ['BLOK', 'ODA', 'STOK KODU', 'MALZEME', 'ADET', 'DURUM', 'ZİMMET TARİHİ', 'NOT'],
    [16, 12, 16, 28, 10, 24, 20, 35], generatedBy);
  items.forEach((item) => item.roomInventories.filter((entry: any) => !entry.returnedAt).forEach((entry: any) => activeRooms.addRow([
    entry.room.block.name, entry.room.roomNumber, item.itemCode || '-', item.itemName, entry.quantity, entry.status, entry.installedAt, entry.notes || '-',
  ])));
  activeRooms.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(activeRooms);

  const roomHistory = workbook.addWorksheet('Oda Zimmet Geçmişi', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(roomHistory, 'TÜM ODA ZİMMET GEÇMİŞİ',
    ['BLOK', 'ODA', 'STOK KODU', 'MALZEME', 'ADET', 'SON DURUM', 'ZİMMET TARİHİ', 'KAPANIŞ TARİHİ', 'NOT'],
    [16, 12, 16, 28, 10, 24, 20, 20, 35], generatedBy);
  items.forEach((item) => item.roomInventories.forEach((entry: any) => roomHistory.addRow([
    entry.room.block.name, entry.room.roomNumber, item.itemCode || '-', item.itemName, entry.quantity, entry.status,
    entry.installedAt, entry.returnedAt || '', entry.notes || '-',
  ])));
  roomHistory.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm'; roomHistory.getColumn(8).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(roomHistory);

  const personnel = workbook.addWorksheet('Personel Zimmetleri', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(personnel, 'TÜM PERSONEL STOK ZİMMETLERİ',
    ['SİCİL NO', 'PERSONEL', 'DEPARTMAN', 'STOK KODU', 'MALZEME', 'DURUM', 'ZİMMET TARİHİ', 'İADE TARİHİ', 'NOT'],
    [16, 26, 22, 16, 28, 22, 20, 20, 35], generatedBy);
  items.forEach((item) => item.inventories.forEach((entry: any) => personnel.addRow([
    entry.employee.registrationNo || '-', `${entry.employee.firstName} ${entry.employee.lastName}`, entry.employee.department,
    item.itemCode || '-', item.itemName, entry.status, entry.assignedDate, entry.returnedDate || '', entry.notes || '-',
  ])));
  personnel.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm'; personnel.getColumn(8).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(personnel);

  const history = workbook.addWorksheet('Hareket Geçmişi', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(history, 'STOK HAREKET GEÇMİŞİ',
    ['TARİH', 'STOK KODU', 'MALZEME', 'HAREKET', 'MİKTAR', 'ODA / PERSONEL', 'NEDEN', 'AÇIKLAMA', 'BAĞLI ARIZA KAYDI', 'İŞLEMİ YAPAN'],
    [20, 16, 28, 22, 12, 30, 24, 38, 34, 24], generatedBy);
  items.flatMap((item) => item.movements.map((movement: any) => ({ item, movement })))
    .sort((a, b) => +new Date(b.movement.createdAt) - +new Date(a.movement.createdAt))
    .forEach(({ item, movement }) => history.addRow([
      movement.createdAt, item.itemCode || '-', movement.itemNameSnapshot, movementLabels[movement.type] || movement.type, movement.quantity,
      movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}${movement.employee.registrationNo ? ` / ${movement.employee.registrationNo}` : ''}` : '-'),
      movement.reason || '-', movement.notes || '-', movement.maintenance ? `${movement.maintenance.title} / ${movement.maintenance.id}` : '-', movement.createdBy?.fullName || 'SİSTEM',
    ]));
  history.getColumn(1).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(history);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
