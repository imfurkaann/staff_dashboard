import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config';
import prisma from './db/prisma';
import authRoutes from './routes/authRoutes';
import employeeRoutes from './routes/employeeRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import roomRoutes from './routes/roomRoutes';
import visitorRoutes from './routes/visitorRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import notificationRoutes from './routes/notificationRoutes';
import portalRoutes from './routes/portalRoutes';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';

const app = express();
validateConfig();
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      const isLocalDevelopmentOrigin = config.nodeEnv === 'development' && !!origin && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
      if (!origin || config.cors.allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
        callback(null, true);
      } else {
        callback(new Error('CORS kısıtlaması nedeniyle erişim engellendi.'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cookie Parser with Cookie Secret from Central Config
app.use(cookieParser(config.cookie.secret));
app.use('/api', apiRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/portal', portalRoutes);

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'UNAVAILABLE', timestamp: new Date().toISOString() });
  }
});

app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint bulunamadı.' }));

// Centralized Error Handler Middleware
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  console.log(`🚀 ${config.appName} Backend API Server ${config.port} portunda güvenli şekilde çalışıyor.`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} alındı, sunucu güvenli şekilde kapatılıyor.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
