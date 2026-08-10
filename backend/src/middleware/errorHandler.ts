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
  const expressError = err as Error & { type?: string; status?: number };
  if (expressError.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'İstek gövdesi geçerli JSON biçiminde değildir.';
  } else if (expressError.type === 'entity.too.large' || expressError.status === 413) {
    statusCode = 413;
    message = 'Gönderilen veri izin verilen boyutu aşıyor.';
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Aynı bilgilerle kayıtlı başka bir veri bulunuyor.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'İşlem yapılmak istenen kayıt bulunamadı.';
    } else if (err.code === 'P2003' || err.code === 'P2014') {
      statusCode = 409;
      message = 'Bu kayıt ilişkili veriler bulunduğu için değiştirilemez veya silinemez.';
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
  });
};
