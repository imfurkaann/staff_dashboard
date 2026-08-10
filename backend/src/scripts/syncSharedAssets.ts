import prisma from '../db/prisma';

async function main() {
  const stockItems = await prisma.stockItem.findMany({
    where: { itemType: 'ORTAK_EKİPMAN' },
  });

  console.log(`Found ${stockItems.length} ORTAK_EKİPMAN stock items.`);

  for (const item of stockItems) {
    console.log(`StockItem: ID=${item.id}, Name=${item.itemName}, Specs="${item.specifications || ''}", Category=${item.category}`);
    
    const orConditions: Array<{ assetCode?: string; assetName?: string }> = [
      { assetName: item.itemName },
    ];
    if (item.itemCode) orConditions.push({ assetCode: item.itemCode });

    const sharedAssets = await prisma.sharedAsset.findMany({
      where: { OR: orConditions },
    });

    for (const sharedAsset of sharedAssets) {
      console.log(`Updating SharedAsset ID=${sharedAsset.id} with specs="${item.specifications || ''}"`);
      await prisma.sharedAsset.update({
        where: { id: sharedAsset.id },
        data: {
          assetName: item.itemName,
          category: item.category,
          brandModel: item.specifications || null,
          warrantyEndDate: item.warrantyEndDate || null,
          locationNote: item.locationNote || sharedAsset.locationNote,
        },
      });
    }
  }

  console.log('Sync complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
