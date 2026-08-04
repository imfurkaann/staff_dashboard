import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /api/auth/login (Protected with rate limiter to prevent brute-force attacks)
router.post('/login', loginRateLimiter, AuthController.login);

// POST /api/auth/logout
router.post('/logout', AuthController.logout);

// GET /api/auth/me (Get current logged-in user profile)
router.get('/me', authenticateToken, AuthController.me);

// POST /api/auth/change-password (Secure password update)
router.post('/change-password', authenticateToken, AuthController.changePassword);

export default router;
