import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const fullName = (process.env.ADMIN_FULL_NAME || 'Sistem Yöneticisi').trim();
  if (!email || password.length < 12) throw new Error('ADMIN_EMAIL ve en az 12 karakterli ADMIN_PASSWORD zorunludur.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    update: { email, fullName, passwordHash, role: 'ADMIN', isActive: true },
    create: { username, email, fullName, passwordHash, role: 'ADMIN', isActive: true },
  });
  console.log(`Yönetici hesabı hazırlandı: ${username}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
