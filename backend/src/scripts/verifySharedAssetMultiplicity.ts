import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../db/prisma';
import { SharedAssetService } from '../services/sharedAssetService';
import { StockService } from '../services/stockService';
import { AppError } from '../middleware/errorHandler';

async function main() {
  if (new URL(process.env.DATABASE_URL || '').pathname !== '/staff_shared_asset_regression') {
    throw new Error('Bu test yalnızca staff_shared_asset_regression test veritabanında çalışabilir.');
  }
  const suffix = Date.now().toString();
  const stock = await StockService.createStockItem({
    itemName: `TEST ÇAMAŞIR MAKİNESİ ${suffix}`,
    itemType: 'ORTAK_EŞYA', category: 'BEYAZ EŞYA', totalStock: 100,
  });
  const first = await SharedAssetService.createAsset({
    stockItemId: stock.id, assetName: 'ERKEK ÇAMAŞIR MAKİNESİ', assetCode: stock.itemCode!,
  });
  const second = await SharedAssetService.createAsset({
    stockItemId: stock.id, assetName: 'KADIN ÇAMAŞIR MAKİNESİ',
  });
  assert.notEqual(first.assetCode, second.assetCode);
  assert.notEqual(first.assetCode, stock.itemCode);
  assert.equal(first.stockItemId, second.stockItemId);
  const overview = await StockService.getOverview();
  const row = overview.items.find(item => item.id === stock.id)!;
  assert.equal(row.totalStock, 100);
  assert.equal(row.availableStock, 98);
  assert.equal(row.sharedAssetsInLocations, 2);
  await assert.rejects(SharedAssetService.createAsset({
    stockItemId: stock.id, assetName: 'KOD ÇAKIŞMASI', assetCode: first.assetCode,
  }), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  const serialNo = `SERIAL-${suffix}`;
  await SharedAssetService.createAsset({ stockItemId: stock.id, assetName: 'SERİ TESTİ', serialNo });
  await assert.rejects(SharedAssetService.createAsset({
    stockItemId: stock.id, assetName: 'SERİ ÇAKIŞMASI', serialNo,
  }), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  const requestKey = randomUUID();
  const replayInput = { stockItemId: stock.id, assetName: 'TEKRAR İSTEK', requestKey };
  const original = await SharedAssetService.createAsset(replayInput);
  const replay = await SharedAssetService.createAsset(replayInput);
  assert.equal(original.id, replay.id);
  for (let index = 4; index < 100; index++) {
    await SharedAssetService.createAsset({ stockItemId: stock.id, assetName: `TEST MAKİNE ${index}` });
  }
  assert.equal(await prisma.sharedAsset.count({ where: { stockItemId: stock.id } }), 100);
  await assert.rejects(SharedAssetService.createAsset({ stockItemId: stock.id, assetName: '101. MAKİNE' }),
    (error: unknown) => error instanceof AppError && error.statusCode === 409);
  console.log('PASS: Same stock card supports 100 uniquely coded devices; after first two, available stock is 98.');
  console.log('PASS: Device 101, duplicate device code and duplicate serial are rejected; replay creates no duplicate.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
