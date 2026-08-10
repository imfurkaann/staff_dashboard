import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Database reset started...');

  // 1. Fetch and display existing admin users to confirm who is being preserved
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, username: true, email: true, fullName: true, role: true }
  });

  if (adminUsers.length === 0) {
    console.warn('⚠️ WARNING: No users with ADMIN role found in the database!');
    console.log('To prevent lockout, we will stop and not delete other users unless at least one ADMIN exists.');
    console.log('Please seed or create an admin user first.');
    process.exit(1);
  } else {
    console.log('The following ADMIN users will be PRESERVED:');
    adminUsers.forEach(u => {
      console.log(`- ${u.username} (${u.email}) - ${u.fullName}`);
    });
  }

  // 2. Perform the deletions in a transaction to maintain integrity
  console.log('\nDeleting records from all tables except ADMIN users...');
  const results = await prisma.$transaction([
    prisma.pushSubscription.deleteMany(),
    prisma.notificationRecipient.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.roomCleaningLog.deleteMany(),
    prisma.visitor.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.maintenanceLog.deleteMany(),
    prisma.disciplinaryNote.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.occupancyLog.deleteMany(),
    prisma.roomInventory.deleteMany(),
    prisma.bed.deleteMany(),
    prisma.room.deleteMany(),
    prisma.block.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.stockItem.deleteMany(),
    prisma.user.deleteMany({
      where: {
        role: {
          not: 'ADMIN'
        }
      }
    })
  ]);

  const tableNames = [
    'PushSubscription',
    'NotificationRecipient',
    'Notification',
    'RoomCleaningLog',
    'Visitor',
    'StockMovement',
    'MaintenanceLog',
    'DisciplinaryNote',
    'InventoryItem',
    'OccupancyLog',
    'RoomInventory',
    'Bed',
    'Room',
    'Block',
    'Employee',
    'StockItem',
    'User (Non-Admin)'
  ];

  console.log('\nDeletion Summary:');
  tableNames.forEach((name, idx) => {
    console.log(`- ${name}: Deleted ${results[idx].count} records`);
  });

  console.log('\nDatabase reset completed successfully. Only admin users remain.');
}

main()
  .catch((error) => {
    console.error('Error resetting database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
