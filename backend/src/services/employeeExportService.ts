import ExcelJS from 'exceljs';
import { decryptSensitiveData } from '../utils/crypto';

interface ExportEmployee {
  status: string;
  registrationNo?: string | null;
  tcNo?: string | null;
  firstName: string;
  lastName: string;
  gender: string;
  department: string;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  vehiclePlate?: string | null;
  ageGroup?: string | null;
  languageNationality?: string | null;
  emergencyContactName?: string | null;
  emergencyRelation?: string | null;
  emergencyContactPhone?: string | null;
  createdAt: Date;
  createdBy?: { fullName: string; username: string } | null;
  checkedOutBy?: { fullName: string; username: string } | null;
  beds?: {
    bedLabel: string;
    room: {
      roomNumber: string;
      block: {
        name: string;
      };
    };
  }[];
  occupancies?: {
    checkInDate: Date;
    checkOutDate: Date | null;
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
  }[];
}

const statusLabels: Record<string, string> = {
  PENDING_ASSIGNMENT: 'ODA BEKLİYOR',
  RESIDENT: 'LOJMANDA KALIYOR',
  ON_LEAVE: 'İZİNLİ',
  CHECKED_OUT: 'AYRILMIŞ / ÇIKIŞ YAPMIŞ',
};

export async function createEmployeeWorkbook(rows: ExportEmployee[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Personel Kayıtları');

  const reportDate = new Intl.DateTimeFormat('tr-TR', { 
    dateStyle: 'short', 
    timeStyle: 'short', 
    timeZone: 'Europe/Istanbul' 
  }).format(new Date());

  // 1. Corporate Header Section
  sheet.mergeCells('A1:Y1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'DOSİNİA RESORT LOJMAN YÖNETİMİ - PERSONEL SİCİL VE İKAMET KAYITLARI RAPORU';
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells('A2:Y2');
  const subCell = sheet.getCell('A2');
  subCell.value = `Rapor Oluşturulma Tarihi: ${reportDate}  |  Raporu Düzenleyen Yetkili: ${generatedBy}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  // 2. Table Column Headers
  const columns = [
    'DURUM',
    'SİCİL NO',
    'TC / PASAPORT NO',
    'ADI',
    'SOYADI',
    'CİNSİYET',
    'DEPARTMAN',
    'GÖREV / ÜNVAN',
    'FİRMA',
    'TELEFON',
    'ARAÇ PLAKASI',
    'YAŞ GRUBU',
    'DİL / UYRUK',
    'YERLEŞİLEN BLOK',
    'ODA NO',
    'YATAK KONUMU',
    'ACİL DURUM YAKINI',
    'YAKINLIK DERECESİ',
    'ACİL DURUM TEL',
    'KAYIT TARİHİ',
    'KAYIT SAATİ',
    'ODAYA GİRİŞ TARİHİ',
    'ODAYA GİRİŞ SAATİ',
    'ODADAN ÇIKIŞ TARİHİ',
    'ODADAN ÇIKIŞ SAATİ',
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
  rows.forEach((emp, idx) => {
    let decryptedTc = '-';
    if (emp.tcNo) {
      try {
        decryptedTc = decryptSensitiveData(emp.tcNo) || '-';
      } catch (err) {
        decryptedTc = 'Şifreli / Hatalı';
      }
    }

    const assignedBed = emp.beds && emp.beds.length > 0 ? emp.beds[0] : null;
    const latestOccupancy = emp.occupancies && emp.occupancies.length > 0 ? emp.occupancies[0] : null;

    // Use current bed, or fallback to the latest bed occupied from history
    const activeBed = assignedBed || latestOccupancy?.bed;

    const blockName = (activeBed?.room?.block?.name || '-').toLocaleUpperCase('tr-TR');
    const roomNumber = activeBed?.room?.roomNumber || '-';
    const bedLabel = (activeBed?.bedLabel || '-').toLocaleUpperCase('tr-TR');

    const roomCheckInDate = latestOccupancy ? latestOccupancy.checkInDate : null;
    const roomCheckOutDate = latestOccupancy ? latestOccupancy.checkOutDate : null;

    const firstName = emp.firstName.toLocaleUpperCase('tr-TR');
    const lastName = emp.lastName.toLocaleUpperCase('tr-TR');
    const genderStr = emp.gender === 'Male' ? 'ERKEK' : emp.gender === 'Female' ? 'KADIN' : emp.gender.toLocaleUpperCase('tr-TR');
    const departmentStr = emp.department.toLocaleUpperCase('tr-TR');
    const titleStr = (emp.title || '-').toLocaleUpperCase('tr-TR');
    const companyStr = (emp.company || '-').toLocaleUpperCase('tr-TR');

    const rowIndex = headerRowNum + 1 + idx;
    const row = sheet.getRow(rowIndex);
    row.height = 20;

    row.values = [
      statusLabels[emp.status] || emp.status,
      emp.registrationNo || '-',
      decryptedTc,
      firstName,
      lastName,
      genderStr,
      departmentStr,
      titleStr,
      companyStr,
      emp.phone || '-',
      emp.vehiclePlate || '-',
      emp.ageGroup || '-',
      emp.languageNationality || '-',
      blockName,
      roomNumber,
      bedLabel,
      (emp.emergencyContactName || '-').toLocaleUpperCase('tr-TR'),
      (emp.emergencyRelation || '-').toLocaleUpperCase('tr-TR'),
      emp.emergencyContactPhone || '-',
      new Date(emp.createdAt),
      new Date(emp.createdAt),
      roomCheckInDate ? new Date(roomCheckInDate) : '',
      roomCheckInDate ? new Date(roomCheckInDate) : '',
      roomCheckOutDate ? new Date(roomCheckOutDate) : '',
      roomCheckOutDate ? new Date(roomCheckOutDate) : '',
    ];

    const isEven = idx % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let col = 1; col <= 25; col++) {
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
    if (emp.status === 'RESIDENT') {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
    } else if (emp.status === 'CHECKED_OUT') {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
    } else {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
    }

    // Number formats
    row.getCell(3).numFmt = '@';
    row.getCell(10).numFmt = '@';
    row.getCell(19).numFmt = '@';
    row.getCell(20).numFmt = 'dd.mm.yyyy';
    row.getCell(21).numFmt = 'hh:mm';

    if (roomCheckInDate) {
      row.getCell(22).numFmt = 'dd.mm.yyyy';
      row.getCell(23).numFmt = 'hh:mm';
    }
    if (roomCheckOutDate) {
      row.getCell(24).numFmt = 'dd.mm.yyyy';
      row.getCell(25).numFmt = 'hh:mm';
    }
  });

  // Set corporate column widths
  const widths = [22, 16, 20, 18, 18, 14, 24, 24, 24, 18, 16, 14, 16, 16, 12, 16, 22, 18, 18, 16, 14, 16, 14, 16, 14];
  widths.forEach((w, colIdx) => {
    sheet.getColumn(colIdx + 1).width = w;
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
