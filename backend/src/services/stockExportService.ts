import ExcelJS from 'exceljs';
import { config } from '../config';

const withOrganizationName = (title: string) => `${config.appName.toLocaleUpperCase('tr-TR')} - ${title.split(' - ').slice(1).join(' - ') || title}`;

export function safeStockCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const addSafeRow = (sheet: ExcelJS.Worksheet, values: unknown[]) => sheet.addRow(values.map(safeStockCell));

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
  sheet.getCell('A1').value = withOrganizationName(title);
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
  setupSheet(summary, 'DOSİNİA RESORT LOJMAN YÖNETİMİ - DETAYLI DEPO VE STOK RAPORU',
    [
      'MALZEME KODU', 'MALZEME ADI', 'KATEGORİ', 'TİP', 'ÖZELLİK / DETAY',
      'DEPO (YEDEK)', 'ZİMMETLİ', 'TOPLAM MİKTAR', 'BİRİM', 'FİZİKSEL DURUM',
      'KONUM / DEPO', 'SON SAYIM'
    ],
    [16, 28, 22, 16, 28, 14, 14, 14, 10, 18, 22, 18], generatedBy);
  items.forEach((item) => {
    const available = item.totalStock - item.usedStock - item.usedInRooms;
    const usedTotal = item.usedStock + item.usedInRooms;
    addSafeRow(summary, [
      item.itemCode || '-',
      item.itemName,
      item.category,
      item.itemType || 'DEMİRBAŞ',
      item.specifications || '-',
      available,
      usedTotal,
      item.totalStock,
      item.unit,
      item.physicalStatus || 'KULLANILABİLİR',
      item.locationNote || '-',
      item.lastCountedAt || '',
    ]);
  });
  summary.getColumn(12).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(summary);

  const activeRooms = workbook.addWorksheet('Aktif Oda Zimmetleri', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(activeRooms, 'AKTİF ODA ZİMMETLERİ',
    ['BLOK', 'ODA', 'STOK KODU', 'MALZEME', 'ADET', 'DURUM', 'ZİMMET TARİHİ', 'NOT'],
    [16, 12, 16, 28, 10, 24, 20, 35], generatedBy);
  items.forEach((item) => item.roomInventories.filter((entry: any) => !entry.returnedAt).forEach((entry: any) => addSafeRow(activeRooms, [
    entry.room.block.name, entry.room.roomNumber, item.itemCode || '-', item.itemName, entry.quantity, entry.status, entry.installedAt, entry.notes || '-',
  ])));
  activeRooms.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(activeRooms);

  const roomHistory = workbook.addWorksheet('Oda Zimmet Geçmişi', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(roomHistory, 'TÜM ODA ZİMMET GEÇMİŞİ',
    ['BLOK', 'ODA', 'STOK KODU', 'MALZEME', 'ADET', 'SON DURUM', 'ZİMMET TARİHİ', 'KAPANIŞ TARİHİ', 'NOT'],
    [16, 12, 16, 28, 10, 24, 20, 20, 35], generatedBy);
  items.forEach((item) => item.roomInventories.forEach((entry: any) => addSafeRow(roomHistory, [
    entry.room.block.name, entry.room.roomNumber, item.itemCode || '-', item.itemName, entry.quantity, entry.status,
    entry.installedAt, entry.returnedAt || '', entry.notes || '-',
  ])));
  roomHistory.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm'; roomHistory.getColumn(8).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(roomHistory);

  const personnel = workbook.addWorksheet('Personel Zimmetleri', { views: [{ state: 'frozen', ySplit: 4 }] });
  setupSheet(personnel, 'TÜM PERSONEL STOK ZİMMETLERİ',
    ['SİCİL NO', 'PERSONEL', 'DEPARTMAN', 'STOK KODU', 'MALZEME', 'DURUM', 'ZİMMET TARİHİ', 'İADE TARİHİ', 'NOT'],
    [16, 26, 22, 16, 28, 22, 20, 20, 35], generatedBy);
  items.forEach((item) => item.inventories.forEach((entry: any) => addSafeRow(personnel, [
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
    .forEach(({ item, movement }) => addSafeRow(history, [
      movement.createdAt, item.itemCode || '-', movement.itemNameSnapshot, movementLabels[movement.type] || movement.type, movement.quantity,
      movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}${movement.employee.registrationNo ? ` / ${movement.employee.registrationNo}` : ''}` : '-'),
      movement.reason || '-', movement.notes || '-', movement.maintenance ? `${movement.maintenance.title} / ${movement.maintenance.id}` : '-', movement.createdBy?.fullName || 'SİSTEM',
    ]));
  history.getColumn(1).numFmt = 'dd.mm.yyyy hh:mm'; styleRows(history);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export type StockDetailExportSection = 'summary' | 'rooms' | 'coverage' | 'faults' | 'movements';

function setupDetailSheet(sheet: ExcelJS.Worksheet, title: string, scope: string, headers: string[], widths: number[], generatedBy: string) {
  const end = sheet.getColumn(headers.length).letter;
  sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
  sheet.mergeCells(`A1:${end}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = withOrganizationName(title);
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;
  sheet.mergeCells(`A2:${end}2`);
  sheet.getCell('A2').value = `Rapor Oluşturulma Tarihi: ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date())}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sheet.mergeCells(`A4:${end}4`);
  const scopeCell = sheet.getCell('A4');
  scopeCell.value = String(safeStockCell(scope));
  scopeCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
  scopeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  scopeCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(4).height = 24;
  headers.forEach((header, index) => {
    const cell = sheet.getCell(5, index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  sheet.getRow(5).height = 28;
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.autoFilter = `A5:${end}5`;
}

function finishDetailRows(sheet: ExcelJS.Worksheet, dateColumns: number[] = [], centeredColumns: number[] = []) {
  for (let rowIndex = 6; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      cell.alignment = { vertical: 'middle', horizontal: centeredColumns.includes(colNumber) ? 'center' : 'left', wrapText: true };
    });
    dateColumns.forEach((column) => { if (row.getCell(column).value) row.getCell(column).numFmt = 'dd.mm.yyyy hh:mm'; });
  }
}

const roomStatusLabels: Record<string, string> = {
  HEALTHY: 'SAĞLAM / KULLANIMDA', MAINTENANCE_REQUIRED: 'BAKIM BEKLİYOR', DAMAGED: 'KIRIK / HASARLI',
  LOST: 'KAYIP / ZAYİ', IN_SERVICE: 'ARIZALI / BAKIM BEKLİYOR', REPLACEMENT_REQUIRED: 'DEĞİŞİM BEKLİYOR', RETIRED: 'İADE / DÜŞÜM',
};

export async function createStockDetailWorkbook(data: any, sections: StockDetailExportSection[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dosinia Resort Lojman Yönetimi';
  workbook.created = new Date();
  workbook.creator = config.appName;
  workbook.creator = config.appName;
  const item = data.item;
  const device = data.device;
  const scope = device ? `${device.itemName} - ${device.room.block.name} / ODA ${device.room.roomNumber}` : `${item.itemName} (${item.itemCode || 'KODSUZ'})`;

  for (const section of sections) {
    if (section === 'summary') {
      const sheet = workbook.addWorksheet(device ? 'Cihaz Bilgileri' : 'Stok Özeti');
      setupDetailSheet(sheet, device ? 'DOSİNİA RESORT LOJMAN YÖNETİMİ - CİHAZ BİLGİLERİ' : 'DOSİNİA RESORT LOJMAN YÖNETİMİ - STOK KARTI ÖZETİ', scope, ['BİLGİ ALANI', 'DEĞER'], [30, 65], generatedBy);
      const rows = device ? [
        ['Cihaz Adı', device.itemName], ['Bağlı Stok Kartı', item.itemName], ['Stok Kodu', item.itemCode || '-'],
        ['Blok / Oda', `${device.room.block.name} / ODA ${device.room.roomNumber}`], ['Kat', device.room.floor],
        ['Odaya Veriliş Tarihi', device.installedAt], ['Miktar', device.quantity], ['Birim', item.unit],
        ['Marka / Model', device.brand || '-'], ['Güncel Durum', roomStatusLabels[device.status] || device.status], ['Yönetim Notu', device.notes || '-'],
      ] : [
        ['Stok Kodu', item.itemCode || '-'], ['Malzeme / Cihaz Adı', item.itemName], ['Kategori', item.category], ['Ürün Niteliği', item.itemType || 'DEMİRBAŞ'],
        ['Toplam Miktar', item.totalStock], ['Elde Kalan Miktar', item.availableStock], ['Birim', item.unit], ['Fiziksel Durum', item.physicalStatus || 'KULLANILABİLİR'],
        ['Depo Konumu', item.locationNote || '-'], ['Teknik Özellikler', item.specifications || '-'],
      ];
      rows.forEach((row) => addSafeRow(sheet, row));
      finishDetailRows(sheet);
      if (device) sheet.getCell('B11').numFmt = 'dd.mm.yyyy hh:mm';
    }

    if (section === 'rooms') {
      const sheet = workbook.addWorksheet('Oda Dağılımı');
      setupDetailSheet(sheet, 'DOSİNİA RESORT LOJMAN YÖNETİMİ - ODA DAĞILIMI', scope, ['BLOK', 'ODA', 'KAT', 'CİHAZ ADI', 'MARKA / MODEL', 'MİKTAR', 'BİRİM', 'DURUM', 'ODAYA VERİLİŞ TARİHİ', 'YÖNETİM NOTU'], [18, 12, 10, 34, 24, 12, 10, 25, 21, 36], generatedBy);
      data.roomAssignments.forEach((entry: any) => addSafeRow(sheet, [entry.room.block.name, entry.room.roomNumber, entry.room.floor, entry.itemName, entry.brand || '-', entry.quantity, item.unit, roomStatusLabels[entry.status] || entry.status, entry.installedAt, entry.notes || '-']));
      if (!data.roomAssignments.length) addSafeRow(sheet, ['Aktif oda cihazı bulunmuyor.']);
      finishDetailRows(sheet, [9], [2, 3, 6, 7]);
    }

    if (section === 'coverage') {
      const sheet = workbook.addWorksheet('Eksik Odalar');
      setupDetailSheet(sheet, 'DOSİNİA RESORT LOJMAN YÖNETİMİ - EKSİK ODA RAPORU', scope, ['BLOK', 'ODA', 'KAT', 'ODA KAPASİTESİ', 'OLMASI GEREKEN', 'MEVCUT', 'EKSİK MİKTAR', 'BİRİM'], [20, 14, 10, 18, 20, 14, 18, 12], generatedBy);
      data.coverage.forEach((room: any) => addSafeRow(sheet, [room.blockName, room.roomNumber, room.floor, room.capacity, room.required, room.assigned, room.missing, item.unit]));
      if (!data.coverage.length) addSafeRow(sheet, ['Eksik oda bulunmuyor.']);
      finishDetailRows(sheet, [], [2, 3, 4, 5, 6, 7, 8]);
    }

    if (section === 'faults') {
      const sheet = workbook.addWorksheet('Arıza Kayıtları');
      setupDetailSheet(sheet, 'DOSİNİA RESORT LOJMAN YÖNETİMİ - ARIZA KAYITLARI RAPORU', scope, ['DURUM', 'ÖNCELİK', 'BLOK', 'ODA', 'CİHAZ', 'MARKA / MODEL', 'ARIZA AÇIKLAMASI', 'BİLDİREN', 'KAPATAN', 'AÇILIŞ TARİHİ', 'KAPANIŞ TARİHİ', 'KAPANIŞ NOTU'], [14, 13, 18, 12, 34, 23, 38, 22, 22, 21, 21, 38], generatedBy);
      data.faults.forEach((fault: any) => addSafeRow(sheet, [fault.status === 'OPEN' || fault.status === 'IN_PROGRESS' ? 'AÇIK' : 'KAPALI', fault.priority === 'URGENT' ? 'ACİL' : fault.priority === 'HIGH' ? 'YÜKSEK' : fault.priority === 'LOW' ? 'DÜŞÜK' : 'ORTA', fault.room.block.name, fault.room.roomNumber, fault.roomInventory?.itemName || fault.inventoryItemNameSnapshot || item.itemName, fault.roomInventory?.brand || fault.inventoryBrandSnapshot || '-', fault.description || fault.title, fault.reportedBy || 'Lojman Yönetimi', fault.assignedTo || '-', fault.createdAt, fault.resolvedAt || '', fault.resolutionNote || '-']));
      if (!data.faults.length) addSafeRow(sheet, ['Arıza kaydı bulunmuyor.']);
      finishDetailRows(sheet, [10, 11], [1, 2, 4]);
    }

    if (section === 'movements') {
      const sheet = workbook.addWorksheet(device ? 'Cihaz Hareketleri' : 'Stok Hareketleri');
      setupDetailSheet(sheet, device ? 'DOSİNİA RESORT LOJMAN YÖNETİMİ - CİHAZ HAREKETLERİ' : 'DOSİNİA RESORT LOJMAN YÖNETİMİ - STOK HAREKETLERİ', scope, ['TARİH', 'İŞLEM TÜRÜ', 'CİHAZ / ÜRÜN', 'KONUM / ODA / PERSONEL', 'MİKTAR', 'BİRİM', 'GEREKÇE', 'AÇIKLAMA', 'BAĞLI ARIZA', 'İŞLEMİ YAPAN'], [21, 22, 34, 32, 12, 10, 28, 40, 34, 24], generatedBy);
      data.movements.forEach((movement: any) => addSafeRow(sheet, [movement.createdAt, movementLabels[movement.type] || movement.type, movement.itemNameSnapshot, movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}${movement.employee.registrationNo ? ` / ${movement.employee.registrationNo}` : ''}` : 'ANA DEPO'), movement.quantity, item.unit, movement.reason || '-', movement.notes || '-', movement.maintenance ? `${movement.maintenance.title} / ${movement.maintenance.id}` : '-', movement.createdBy?.fullName || 'SİSTEM']));
      if (!data.movements.length) addSafeRow(sheet, ['Hareket kaydı bulunmuyor.']);
      finishDetailRows(sheet, [1], [5, 6]);
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
