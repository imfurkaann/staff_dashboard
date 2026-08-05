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

export async function createEmployeeWorkbook(rows: ExportEmployee[], generatedBy: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Personel Kayıtları');

  // Generation date at the top
  const reportDate = new Intl.DateTimeFormat('tr-TR', { 
    dateStyle: 'short', 
    timeStyle: 'short', 
    timeZone: 'Europe/Istanbul' 
  }).format(new Date());
  
  sheet.getCell('A1').value = `Rapor Tarihi: ${reportDate}`;
  sheet.getCell('A1').font = { name: 'Arial', size: 10, bold: true };

  // Table headers in row 3
  const columns = [
    'Durum',
    'Sicil No',
    'TC / Pasaport No',
    'Adı',
    'Soyadı',
    'Cinsiyet',
    'Departman',
    'Görev/Unvan',
    'Firma',
    'Telefon',
    'Araç Plakası',
    'Yaş Grubu',
    'Dil / Uyruk',
    'Yerleşilen Blok',
    'Oda Numarası',
    'Yatak Konumu',
    'Acil Durum Yakını',
    'Yakınlık Derecesi',
    'Acil Durum Tel',
    'Kayıt Tarihi',
    'Kayıt Saati',
    'Odaya Giriş Tarihi',
    'Odaya Giriş Saati',
    'Odadan Çıkış Tarihi',
    'Odadan Çıkış Saati'
  ];

  columns.forEach((header, index) => {
    const cell = sheet.getCell(3, index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true };
  });

  const statusLabels: Record<string, string> = {
    PENDING_ASSIGNMENT: 'Oda Bekliyor',
    RESIDENT: 'Lojmanda Kalıyor',
    ON_LEAVE: 'İzinli',
    CHECKED_OUT: 'Ayrılmış / Çıkış Yapmış',
  };

  rows.forEach((emp) => {
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

    const blockName = activeBed?.room?.block?.name || '-';
    const roomNumber = activeBed?.room?.roomNumber || '-';
    const bedLabel = activeBed?.bedLabel || '-';

    const roomCheckInDate = latestOccupancy ? latestOccupancy.checkInDate : null;
    const roomCheckOutDate = latestOccupancy ? latestOccupancy.checkOutDate : null;

    const row = sheet.addRow([
      statusLabels[emp.status] || emp.status,
      emp.registrationNo || '-',
      decryptedTc,
      emp.firstName,
      emp.lastName,
      emp.gender === 'Male' ? 'Erkek' : emp.gender === 'Female' ? 'Kadın' : emp.gender,
      emp.department,
      emp.title || '-',
      emp.company || '-',
      emp.phone || '-',
      emp.vehiclePlate || '-',
      emp.ageGroup || '-',
      emp.languageNationality || '-',
      blockName,
      roomNumber,
      bedLabel,
      emp.emergencyContactName || '-',
      emp.emergencyRelation || '-',
      emp.emergencyContactPhone || '-',
      new Date(emp.createdAt), // Kayıt Tarihi
      new Date(emp.createdAt), // Kayıt Saati
      roomCheckInDate ? new Date(roomCheckInDate) : '',
      roomCheckInDate ? new Date(roomCheckInDate) : '',
      roomCheckOutDate ? new Date(roomCheckOutDate) : '',
      roomCheckOutDate ? new Date(roomCheckOutDate) : '',
    ]);

    row.font = { name: 'Arial', size: 10 };
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

  // Set standard column widths
  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
