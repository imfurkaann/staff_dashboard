import prisma from '../db/prisma';
import bcrypt from 'bcryptjs';

async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  const cleanFirst = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLast = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = `${cleanFirst}.${cleanLast}` || 'personel';
  let candidate = base;
  let counter = 1;
  while (await prisma.user.findFirst({ where: { username: candidate } })) {
    candidate = `${base}${counter}`;
    counter++;
  }
  return candidate;
}

async function main() {
  const unlinkedEmployees = await prisma.employee.findMany({
    where: { isDeleted: false, userId: null },
  });

  console.log(`Found ${unlinkedEmployees.length} employees without portal user accounts.`);

  for (const emp of unlinkedEmployees) {
    const username = await generateUniqueUsername(emp.firstName, emp.lastName);
    const tempPassword = `Lojman${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const email = `${username}@lojman.local`;

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        fullName: `${emp.firstName} ${emp.lastName}`,
        role: 'STAFF',
        isActive: true,
        mustChangePassword: true,
      },
    });

    await prisma.employee.update({
      where: { id: emp.id },
      data: { userId: user.id },
    });

    console.log(`✓ Linked portal account for ${emp.firstName} ${emp.lastName}: username="${username}", tempPassword="${tempPassword}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
