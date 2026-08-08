import { PrismaClient } from '@prisma/client';
import { normalizePrismaWriteArgs } from './writeNormalization';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

prisma.$use(async (params, next) => {
  normalizePrismaWriteArgs(params.model, params.action, params.args);
  return next(params);
});

export default prisma;
