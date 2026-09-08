import { normalizeIdentifier, normalizeInventoryItemName, normalizeUpper } from '../utils/normalization';

type StringNormalizer = (value?: string | null) => string | null;

// Only fields whose letter casing has no technical meaning belong here. IDs,
// encrypted values, hashes, URLs, push keys and case-sensitive enums are
// deliberately excluded.
const MODEL_FIELD_NORMALIZERS: Record<string, Record<string, StringNormalizer>> = {
  User: {
    fullName: normalizeUpper,
    username: (value) => value?.trim().toLocaleLowerCase('en-US') || null,
    email: (value) => value?.trim().toLocaleLowerCase('en-US') || null,
  },
  UserAuditLog: { notes: normalizeUpper },
  Employee: {
    firstName: normalizeUpper,
    lastName: normalizeUpper,
    department: normalizeUpper,
    title: normalizeUpper,
    company: normalizeUpper,
    shiftType: normalizeUpper,
    ageGroup: normalizeUpper,
    languageNationality: normalizeUpper,
    emergencyContactName: normalizeUpper,
    emergencyRelation: normalizeUpper,
    registrationNo: normalizeIdentifier,
    vehiclePlate: normalizeIdentifier,
  },
  Block: { name: normalizeUpper },
  Room: { roomNumber: normalizeUpper },
  Bed: { bedLabel: normalizeUpper },
  OccupancyLog: {
    employeeName: normalizeUpper,
    employeeDepartment: normalizeUpper,
    employeeTitle: normalizeUpper,
    employeeCompany: normalizeUpper,
    transferReason: normalizeUpper,
  },
  InventoryItem: {
    itemName: normalizeInventoryItemName,
    itemCode: normalizeIdentifier,
    serialNo: normalizeUpper,
    notes: normalizeUpper,
  },
  StockItem: {
    itemName: normalizeInventoryItemName,
    itemCode: normalizeIdentifier,
    category: normalizeUpper,
    unit: normalizeUpper,
    specifications: normalizeUpper,
    physicalStatus: normalizeUpper,
    locationNote: normalizeUpper,
  },
  StockMovement: {
    itemNameSnapshot: normalizeInventoryItemName,
    roomLabelSnapshot: normalizeUpper,
    brand: normalizeUpper,
    serialNo: normalizeIdentifier,
    reason: normalizeUpper,
    notes: normalizeUpper,
  },
  DisciplinaryNote: {
    title: normalizeUpper,
    content: normalizeUpper,
    reportedBy: normalizeUpper,
  },
  MaintenanceLog: {
    category: normalizeUpper,
    location: normalizeUpper,
    title: normalizeUpper,
    description: normalizeUpper,
    reportedBy: normalizeUpper,
    assignedTo: normalizeUpper,
    resolutionNote: normalizeUpper,
    serviceProvider: normalizeUpper,
    serviceReference: normalizeUpper,
    inventoryItemNameSnapshot: normalizeUpper,
    inventoryBrandSnapshot: normalizeUpper,
    inventorySerialNoSnapshot: normalizeIdentifier,
    inventoryAssetTagSnapshot: normalizeIdentifier,
  },
  MaintenanceEvent: { action: normalizeUpper, notes: normalizeUpper, serviceProvider: normalizeUpper, serviceReference: normalizeUpper, performedBy: normalizeUpper },
  RoomInventory: {
    itemName: normalizeUpper,
    location: normalizeUpper,
    brand: normalizeUpper,
    serialNo: normalizeIdentifier,
    assetTag: normalizeIdentifier,
    notes: normalizeUpper,
  },
  Visitor: {
    fullName: normalizeUpper,
    company: normalizeUpper,
    hostEmployeeName: normalizeUpper,
    hostRoomLabel: normalizeUpper,
    purpose: normalizeUpper,
    vehiclePlate: normalizeIdentifier,
    notes: normalizeUpper,
  },
  RoomCleaningLog: {
    requestedBy: normalizeUpper,
    cleanedBy: normalizeUpper,
    notes: normalizeUpper,
  },
  Notification: {
    title: normalizeUpper,
    message: normalizeUpper,
  },
  SharedAsset: {
    assetCode: normalizeIdentifier,
    assetName: normalizeUpper,
    category: normalizeUpper,
    brandModel: normalizeUpper,
    serialNo: normalizeIdentifier,
    locationNote: normalizeUpper,
    notes: normalizeUpper,
  },
  SharedAssetLog: {
    action: normalizeUpper,
    assetCodeSnapshot: normalizeIdentifier,
    assetNameSnapshot: normalizeUpper,
    borrowerName: normalizeUpper,
    notes: normalizeUpper,
  },
  SupportTicket: {
    ticketNo: normalizeIdentifier,
    creatorName: normalizeUpper,
    roomNumber: normalizeUpper,
    blockName: normalizeUpper,
    category: normalizeUpper,
    subject: normalizeUpper,
    description: normalizeUpper,
    adminNote: normalizeUpper,
  },
};

function normalizeFieldValue(value: unknown, normalizer: StringNormalizer): unknown {
  if (typeof value === 'string' || value === null) return normalizer(value);
  if (value && typeof value === 'object' && 'set' in value) {
    const operation = value as { set?: unknown };
    if (typeof operation.set === 'string' || operation.set === null) {
      return { ...operation, set: normalizer(operation.set) };
    }
  }
  return value;
}

function normalizeDataObject(model: string, data: unknown): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  const fields = MODEL_FIELD_NORMALIZERS[model];
  if (!fields) return;
  for (const [field, normalizer] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      record[field] = normalizeFieldValue(record[field], normalizer);
    }
  }
}

export function normalizePrismaWriteArgs(model: string | undefined, action: string, args: Record<string, any> | undefined): void {
  if (!model || !args) return;
  if (action === 'upsert') {
    normalizeDataObject(model, args.create);
    normalizeDataObject(model, args.update);
    return;
  }
  if (!['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany'].includes(action)) return;
  if (Array.isArray(args.data)) args.data.forEach((item: unknown) => normalizeDataObject(model, item));
  else normalizeDataObject(model, args.data);
}

export const writeNormalizationPolicy = MODEL_FIELD_NORMALIZERS;
