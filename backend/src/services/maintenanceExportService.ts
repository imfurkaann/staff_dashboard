import ExcelJS from 'exceljs';

interface ExportMaintenanceLog {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  category?: string | null;
  location?: string | null;
  reportedBy?: string | null;
  assignedTo?: string | null;
  resolutionNote?: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  room?: {
    roomNumber: string;
    floor: number;
    block?: {
      name: string;
    } | null;
  } | null;
}

function safeCell(value?: string | null): string {
  const text = value?.trim() || '-';
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function createMaintenanceWorkbook(rows: ExportMaintenanceLog[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Arıza Kayıtları');

  const reportDate = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date());

  // 1. Corporate Main Header Section
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DOSİNİA RESORT LOJMAN YÖNETİMİ - ARIZA VE TEKNİK BAKIM KAYITLARI RAPORU';
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:L2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  let currentRowNum = 4;

  // Group records by Block & Room / Location
  const groupMap = new Map<string, { blockName: string; roomTitle: string; items: ExportMaintenanceLog[] }>();

  rows.forEach((m) => {
    const blockName = m.room?.block?.name ? m.room.block.name.toLocaleUpperCase('tr-TR') : 'LOJMAN GENELİ';
    const roomTitle = m.room
      ? `ODA ${m.room.roomNumber} (${m.room.floor}. KAT)`
      : (m.location || 'ODA GENELİ / ORTAK ALANLAR').toLocaleUpperCase('tr-TR');

    const key = `${blockName}__${roomTitle}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        blockName,
        roomTitle,
        items: [],
      });
    }
    groupMap.get(key)!.items.push(m);
  });

  if (groupMap.size === 0) {
    sheet.getCell('A4').value = 'Seçilen kriterlere uygun arıza veya teknik bakım kaydı bulunamadı.';
    sheet.getCell('A4').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  } else {
    groupMap.forEach((group) => {
      // 1. Group Banner Header Row (Merged A to L)
      sheet.mergeCells(`A${currentRowNum}:L${currentRowNum}`);
      const bannerCell = sheet.getCell(`A${currentRowNum}`);
      bannerCell.value = `${group.blockName} - ${group.roomTitle}  (TOPLAM ARIZA / BAKIM: ${group.items.length} ADET)`;
      bannerCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Corporate Dark Slate Banner
      bannerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      sheet.getRow(currentRowNum).height = 24;
      currentRowNum++;

      // 2. Sub-table Column Headers
      const subHeaders = [
        'DURUM',
        'ÖNCELİK',
        'ARIZA KATEGORİSİ',
        'ARIZA AÇIKLAMASI',
        'KONUM / ALAN',
        'BİLDİREN KİŞİ',
        'ÇÖZÜMLEYEN PERSONEL',
        'AÇILIŞ TARİHİ',
        'AÇILIŞ SAATİ',
        'KAPANIŞ TARİHİ',
        'KAPANIŞ SAATİ',
        'ÇÖZÜM NOTU',
      ];

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
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      sheet.getRow(currentRowNum).height = 20;
      currentRowNum++;

      // 3. Maintenance Items Rows
      group.items.forEach((m, idx) => {
        const statusLabel =
          m.status === 'OPEN'
            ? 'AÇIK BİLDİRİM'
            : m.status === 'IN_PROGRESS'
            ? 'İŞLEMDE (TEKNİK)'
            : m.status === 'RESOLVED'
            ? 'ÇÖZÜLDÜ'
            : 'KAPATILDI';

        const priorityLabel =
          m.priority === 'URGENT'
            ? 'ACİL'
            : m.priority === 'HIGH'
            ? 'YÜKSEK'
            : m.priority === 'MEDIUM'
            ? 'ORTA'
            : 'DÜŞÜK';

        const description = (m.description || m.title || '').toLocaleUpperCase('tr-TR');
        const category = (m.category || m.title || '-').toLocaleUpperCase('tr-TR');
        const location = (m.location || 'ODA GENELİ').toLocaleUpperCase('tr-TR');
        const reportedBy = safeCell(m.reportedBy || 'Lojman Yönetimi');
        const assignedTo = safeCell(m.assignedTo || (m.status === 'RESOLVED' || m.status === 'CLOSED' ? 'Lojman Yönetimi' : '-'));
        const resolutionNote = safeCell(m.resolutionNote);

        const createdAtDate = new Date(m.createdAt);
        const resolvedAtDate = m.resolvedAt ? new Date(m.resolvedAt) : null;

        const isEven = idx % 2 === 0;
        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        const row = sheet.getRow(currentRowNum);
        row.height = 20;

        row.values = [
          statusLabel,
          priorityLabel,
          category,
          description,
          location,
          reportedBy,
          assignedTo,
          createdAtDate,
          createdAtDate,
          resolvedAtDate || '',
          resolvedAtDate || '',
          resolutionNote,
        ];

        for (let col = 1; col <= 12; col++) {
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

        // Status Font Styling
        const statusCell = row.getCell(1);
        if (m.status === 'OPEN') {
          statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
        } else if (m.status === 'IN_PROGRESS') {
          statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
        } else {
          statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
        }

        // Priority Font Styling
        const priorityCell = row.getCell(2);
        if (m.priority === 'URGENT') {
          priorityCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFBE123C' } };
        } else if (m.priority === 'HIGH') {
          priorityCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
        }

        // Date & Time Number Formatting
        row.getCell(8).numFmt = 'dd.mm.yyyy';
        row.getCell(9).numFmt = 'hh:mm';

        if (resolvedAtDate) {
          row.getCell(10).numFmt = 'dd.mm.yyyy';
          row.getCell(11).numFmt = 'hh:mm';
        }

        currentRowNum++;
      });

      // Spacing row between groups
      currentRowNum++;
    });
  }

  // Set corporate column widths
  const widths = [18, 14, 22, 32, 18, 20, 22, 14, 12, 14, 12, 32];
  widths.forEach((w, colIdx) => {
    sheet.getColumn(colIdx + 1).width = w;
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
