WITH numbered AS (
  SELECT
    ri."id",
    r."roomNumber" || ' NOLU ODA - ' || si."itemName" || ' ' ||
      ROW_NUMBER() OVER (
        PARTITION BY ri."roomId", ri."stockItemId"
        ORDER BY ri."installedAt", ri."id"
      ) AS generated_name
  FROM "RoomInventory" ri
  JOIN "Room" r ON r."id" = ri."roomId"
  JOIN "StockItem" si ON si."id" = ri."stockItemId"
)
UPDATE "RoomInventory" ri
SET "itemName" = numbered.generated_name
FROM numbered
WHERE ri."id" = numbered."id";
