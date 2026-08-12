import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { validatePassword } from './security/passwordPolicy';
import { cleanEmail, cleanFullName, cleanUsername } from './security/userManagementPolicy';

const prisma = new PrismaClient();

async function main() {
  const username = cleanUsername(process.env.ADMIN_USERNAME || 'admin');
  const email = cleanEmail(process.env.ADMIN_EMAIL || '');
  const password = validatePassword(process.env.ADMIN_PASSWORD || '', 'ADMIN_PASSWORD');
  const fullName = cleanFullName(process.env.ADMIN_FULL_NAME || 'Sistem Yöneticisi');
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { username: true, email: true } });
  if (existing) {
    if (existing.username !== username || existing.email !== email) {
      throw new Error('ADMIN_USERNAME veya ADMIN_EMAIL başka bir hesap tarafından kullanılıyor. Mevcut hesap otomatik değiştirilmedi.');
    }
    console.log(`Yönetici hesabı zaten mevcut; parola ve rol değiştirilmedi: ${username}`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { username, email, fullName, passwordHash, role: 'ADMIN', isActive: true, mustChangePassword: true },
  });
  console.log(`Yönetici hesabı oluşturuldu; ilk girişte parola değişimi zorunlu: ${username}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
