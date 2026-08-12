import { Role } from '@prisma/client';
import prisma from '../db/prisma';

async function main() {
  const [activePrivileged, linkedWrongRole, activeUnlinkedStaff, inactiveEmployeeAccounts, pendingPasswordChanges, auditCount] = await Promise.all([
    prisma.user.count({ where: { isActive: true, role: { in: [Role.ADMIN, Role.HOUSING_MANAGER] } } }),
    prisma.user.count({ where: { employee: { isNot: null }, role: { not: Role.STAFF } } }),
    prisma.user.count({ where: { isActive: true, role: Role.STAFF, employee: { is: null } } }),
    prisma.user.count({ where: { isActive: true, role: Role.STAFF, employee: { is: { OR: [{ isDeleted: true }, { status: 'CHECKED_OUT' }] } } } }),
    prisma.user.count({ where: { isActive: true, mustChangePassword: true } }),
    prisma.userAuditLog.count(),
  ]);

  const checks = [
    { name: 'Aktif ayrıcalıklı yönetici', value: activePrivileged, ok: activePrivileged >= 1 },
    { name: 'Personel bağlantılı yanlış rol', value: linkedWrongRole, ok: linkedWrongRole === 0 },
    { name: 'Aktif ve personelsiz STAFF hesabı', value: activeUnlinkedStaff, ok: activeUnlinkedStaff === 0 },
    { name: 'Ayrılmış/arşivli personele ait aktif hesap', value: inactiveEmployeeAccounts, ok: inactiveEmployeeAccounts === 0 },
  ];

  for (const check of checks) console.log(`${check.ok ? 'OK' : 'HATA'} | ${check.name}: ${check.value}`);
  console.log(`BİLGİ | İlk giriş parola değişimi bekleyen aktif hesap: ${pendingPasswordChanges}`);
  console.log(`BİLGİ | Kullanıcı denetim kaydı: ${auditCount}`);

  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

main()
  .catch((error) => { console.error('Kullanıcı/rol üretim doğrulaması çalıştırılamadı:', error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
