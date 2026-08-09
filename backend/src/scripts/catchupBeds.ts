import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Bed Inventory synchronization catch-up...');

  // Find all occupied beds
  const activeBeds = await prisma.bed.findMany({
    where: {
      isOccupied: true,
      currentEmployeeId: { not: null },
    },
    include: {
      room: {
        include: {
          block: true,
        },
      },
    },
  });

  console.log(`Found ${activeBeds.length} active bed assignments in the database.`);

  let createdCount = 0;

  for (const bed of activeBeds) {
    const employeeId = bed.currentEmployeeId!;

    // Check if employee already has an active YATAK-ZİMMETİ
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        employeeId,
        itemCode: 'YATAK-ZİMMETİ',
        returnedDate: null,
      },
    });

    if (!existing) {
      await prisma.inventoryItem.create({
        data: {
          employeeId,
          itemName: `${bed.room.block.name} • Oda ${bed.room.roomNumber} - ${bed.bedLabel}`,
          itemCode: 'YATAK-ZİMMETİ',
          category: 'LOJMAN_ZİMMETİ',
          status: 'TESLİM_EDİLDİ',
          notes: 'Veri eşleştirme ile geriye dönük otomatik oluşturuldu.',
        },
      });
      createdCount++;
    }
  }

  console.log(`Catch-up finished. Created ${createdCount} missing Bed Inventory records.`);
}

main()
  .catch((e) => {
    console.error('Error running catchup script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
