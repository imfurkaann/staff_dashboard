import { Router } from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { SupportTicketController } from '../controllers/supportTicketController';
import { permissions } from '../security/permissions';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizePermissions(permissions.TICKET_VIEW), SupportTicketController.getTickets);
router.get('/my-tickets', SupportTicketController.getMyTickets);
router.post('/', SupportTicketController.createTicket);
router.patch('/:id/status', authorizePermissions(permissions.TICKET_MANAGE), SupportTicketController.updateTicketStatus);

export default router;
