import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err instanceof AppError ? err.statusCode : 500;
  let message = err instanceof AppError ? err.message : 'Beklenmeyen bir sunucu hatası oluştu.';
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Aynı bilgilerle kayıtlı başka bir veri bulunuyor.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'İşlem yapılmak istenen kayıt bulunamadı.';
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('API Error Stack:', err);
  } else if (statusCode >= 500) {
    console.error('API Error:', { method: req.method, path: req.path, name: err.name });
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
